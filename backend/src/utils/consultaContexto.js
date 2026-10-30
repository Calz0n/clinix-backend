const AREAS = ['MEDICINA_GENERAL', 'ODONTOLOGIA', 'NUTRICION', 'PSICOLOGIA'];

function normalizarArea(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

class ErrorConsulta extends Error {
  constructor(mensaje, status = 409) { super(mensaje); this.status = status; }
}

function validarDerivacionSalida(datos, origen) {
  if (datos == null) return;
  const destino = normalizarArea(datos.area_destino);
  if (!AREAS.includes(destino) || destino === origen || typeof datos.motivo_derivacion !== 'string' || !datos.motivo_derivacion.trim()) {
    throw new ErrorConsulta('La derivación debe indicar otro servicio interno válido y su motivo.', 400);
  }
  if (datos.prioridad != null && !['NORMAL', 'URGENTE'].includes(datos.prioridad)) {
    throw new ErrorConsulta('La prioridad de la derivación no es válida.', 400);
  }
  datos.area_destino = destino;
}

// Sólo se interpolan identificadores internos; los valores del área son parámetros.
const areaSql = "btrim(regexp_replace(translate(upper(COALESCE(a.area_servicio, '')), 'ÁÉÍÓÚÜ', 'AEIOUU'), '[^A-Z0-9]+', '_', 'g'), '_')";

async function obtenerColaConsulta(db, area) {
  if (!AREAS.includes(area)) throw new Error('Área interna desconocida');
  const result = await db.query(`
    WITH referencias AS (
      SELECT DISTINCT ON (tc.atencion_origen_id) tc.atencion_origen_id, tc.id,
             tc.motivo_derivacion, tc.prioridad, tc.fecha_hora_derivacion
      FROM tratamientos_cruzados tc
      WHERE tc.area_destino = $1 AND tc.estado = 'PENDIENTE'
      ORDER BY tc.atencion_origen_id, tc.fecha_hora_derivacion, tc.id
    ), candidatas AS (
      SELECT a.id FROM atenciones_clinicas a
      WHERE a.estado = 'EN_CONSULTA' AND ${areaSql} = $1
        AND a.fecha_hora_ingreso >= CURRENT_DATE AND a.fecha_hora_ingreso < CURRENT_DATE + INTERVAL '1 day'
      UNION SELECT atencion_origen_id FROM referencias
    )
    SELECT a.id AS atencion_id, a.fecha_hora_ingreso, a.tipo_atencion, a.estado, a.area_servicio,
           p.id AS paciente_id, p.numero_expediente, p.curp, p.nombres, p.apellido_paterno, p.apellido_materno,
           p.fecha_nacimiento, p.sexo, p.derechohabiencia, p.enfermedades_previas,
           t.id AS triaje_id, t.tension_arterial, t.frecuencia_cardiaca, t.frecuencia_respiratoria,
           t.temperatura, t.saturacion_oxigeno, t.glucosa_capilar, t.peso_kg, t.talla_metros, t.imc,
           t.clasificacion_imc, t.detecciones_riesgo,
           tu.nombre_completo AS tutor_nombre, tu.parentesco AS tutor_parentesco, tu.telefono_contacto AS tutor_telefono,
           ref.id AS tratamiento_cruzado_id, $1::text AS area_destino_consulta,
           ref.motivo_derivacion, ref.prioridad
    FROM atenciones_clinicas a
    JOIN candidatas c ON c.id = a.id
    JOIN pacientes p ON p.id = a.paciente_id
    LEFT JOIN triaje_signos_vitales t ON t.atencion_id = a.id
    LEFT JOIN tutores tu ON tu.paciente_id = p.id
    LEFT JOIN referencias ref ON ref.atencion_origen_id = a.id
    WHERE NOT EXISTS (SELECT 1 FROM consultas_base cb WHERE cb.atencion_id = a.id AND cb.area_medica = $1)
      AND ((a.estado = 'EN_CONSULTA' AND ${areaSql} = $1
            AND a.fecha_hora_ingreso >= CURRENT_DATE AND a.fecha_hora_ingreso < CURRENT_DATE + INTERVAL '1 day')
           OR ref.id IS NOT NULL)
    ORDER BY CASE WHEN ref.prioridad = 'URGENTE' THEN 0 ELSE 1 END,
             COALESCE(ref.fecha_hora_derivacion, a.fecha_hora_ingreso), a.id
  `, [area]);
  const hoy = new Date();
  return result.rows.map(row => {
    const fecha = new Date(row.fecha_nacimiento);
    let edad = hoy.getFullYear() - fecha.getFullYear();
    if (hoy.getMonth() < fecha.getMonth() || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate())) edad--;
    return { ...row, edad, es_menor: edad < 18 };
  });
}

// Se llama dentro de BEGIN. El bloqueo serializa dobles clics y guardados concurrentes.
async function validarContextoConsulta(client, body, area) {
  if (!Number.isInteger(body.atencion_id) || body.atencion_id <= 0) throw new ErrorConsulta('Selecciona una atención válida antes de guardar.', 400);
  if (!Number.isInteger(body.paciente_id) || body.paciente_id <= 0) throw new ErrorConsulta('Selecciona un paciente válido antes de guardar. Actualiza el frontend si este dato no se está enviando.', 400);
  const result = await client.query(`
    SELECT a.*, p.fecha_nacimiento, p.sexo,
           (a.fecha_hora_ingreso >= CURRENT_DATE AND a.fecha_hora_ingreso < CURRENT_DATE + INTERVAL '1 day') AS vigente_hoy
    FROM atenciones_clinicas a JOIN pacientes p ON p.id = a.paciente_id
    WHERE a.id = $1 FOR UPDATE OF a
  `, [body.atencion_id]);
  if (!result.rows.length) throw new ErrorConsulta('La atención seleccionada ya no existe. Actualiza la lista.', 404);
  const atencion = result.rows[0];
  if (body.paciente_id !== atencion.paciente_id) throw new ErrorConsulta('El paciente y la atención no corresponden. Actualiza la lista y vuelve a seleccionar.');
  let derivacion = null;
  if (body.tratamiento_cruzado_id != null) {
    if (!Number.isInteger(body.tratamiento_cruzado_id) || body.tratamiento_cruzado_id <= 0) throw new ErrorConsulta('La derivación seleccionada no es válida.', 400);
    const ref = await client.query(`SELECT * FROM tratamientos_cruzados
      WHERE id = $1 AND atencion_origen_id = $2 AND area_destino = $3 AND estado = 'PENDIENTE' FOR UPDATE`,
    [body.tratamiento_cruzado_id, atencion.id, area]);
    if (!ref.rows.length) throw new ErrorConsulta('La derivación ya no está pendiente o no corresponde a este servicio. Actualiza la lista.');
    derivacion = ref.rows[0];
  } else if (normalizarArea(atencion.area_servicio) !== area || atencion.estado !== 'EN_CONSULTA' || !atencion.vigente_hoy) {
    throw new ErrorConsulta('La atención no está disponible para este servicio. Selecciona un paciente de su cola o una derivación pendiente.');
  }
  const previa = await client.query('SELECT id FROM consultas_base WHERE atencion_id = $1 AND area_medica = $2 LIMIT 1', [atencion.id, area]);
  if (previa.rows.length) throw new ErrorConsulta('Esta atención ya fue registrada en este servicio. Actualiza la lista para evitar duplicarla.');
  return { atencion, derivacion };
}

async function finalizarContextoConsulta(client, contexto) {
  if (contexto.derivacion) {
    await client.query("UPDATE tratamientos_cruzados SET estado = 'ATENDIDO' WHERE id = $1", [contexto.derivacion.id]);
  }
  // Se conserva la finalización de la visita original. Las derivaciones pendientes
  // aparecen en la cola de su destino por su registro propio, incluso si la visita finalizó.
  await client.query("UPDATE atenciones_clinicas SET estado = 'FINALIZADA' WHERE id = $1", [contexto.atencion.id]);
}

function responderErrorConsulta(res, err, area) {
  if (err instanceof ErrorConsulta) return res.status(err.status).json({ error: err.message, codigo: 'ATENCION_NO_DISPONIBLE' });
  console.error(`[CONSULTA ${area}]`, { codigo: err.code || null, restriccion: err.constraint || null });
  return res.status(500).json({ error: 'No se pudo guardar la consulta. Revisa el servicio y vuelve a intentarlo.' });
}

module.exports = { obtenerColaConsulta, validarContextoConsulta, finalizarContextoConsulta, responderErrorConsulta, validarDerivacionSalida };
