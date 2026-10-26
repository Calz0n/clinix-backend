const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

// Máxima confidencialidad bajo NOM-004-SSA3-2012 y LGPDPPSO:
// Solo el personal de Psicología y Dirección Médica pueden consultar o registrar notas terapéuticas
router.use(authenticateToken);
router.use(requireRoles('PSICOLOGO', 'DIRECCION'));

// 0. GET /api/psicologia/pendientes (Cola de pacientes en espera de consulta psicológica hoy)
router.get('/pendientes', async (req, res) => {
  try {
    const query = `
      SELECT a.id as atencion_id, a.fecha_hora_ingreso, a.tipo_atencion, a.estado, a.area_servicio,
             p.id as paciente_id, p.numero_expediente, p.curp, p.nombres, p.apellido_paterno, p.apellido_materno,
             p.fecha_nacimiento, p.sexo, p.derechohabiencia, p.enfermedades_previas,
             t.id as triaje_id, t.tension_arterial, t.frecuencia_cardiaca, t.frecuencia_respiratoria,
             t.temperatura, t.saturacion_oxigeno, t.glucosa_capilar, t.peso_kg, t.talla_metros, t.imc,
             t.clasificacion_imc, t.detecciones_riesgo,
             tut.nombre_completo as tutor_nombre, tut.parentesco as tutor_parentesco, tut.telefono_contacto as tutor_telefono
      FROM atenciones_clinicas a
      JOIN pacientes p ON a.paciente_id = p.id
      LEFT JOIN triaje_signos_vitales t ON a.id = t.atencion_id
      LEFT JOIN tutores tut ON p.id = tut.paciente_id
      WHERE a.estado = 'EN_CONSULTA'
        AND (a.area_servicio ILIKE '%PSICOLOG%' OR a.area_servicio IS NULL)
        AND a.fecha_hora_ingreso >= CURRENT_DATE AND a.fecha_hora_ingreso < (CURRENT_DATE + INTERVAL '1 day')
      ORDER BY a.fecha_hora_ingreso ASC
    `;
    const result = await db.query(query);

    const hoy = new Date();
    const lista = result.rows.map(row => {
      const nac = new Date(row.fecha_nacimiento);
      let edad = hoy.getFullYear() - nac.getFullYear();
      if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
        edad--;
      }
      return { ...row, edad, es_menor: edad < 18 };
    });

    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar lista de espera de psicología: ' + err.message });
  }
});

// 0.1 GET /api/psicologia/atendidos-hoy (Pacientes atendidos en psicología hoy por turno)
router.get('/atendidos-hoy', async (req, res) => {
  try {
    const { turno } = req.query;
    let turnoCondition = '';
    if (turno) {
      const tLower = turno.toLowerCase();
      if (tLower.includes('mat')) {
        turnoCondition = ' AND EXTRACT(HOUR FROM cb.fecha_hora) >= 7 AND EXTRACT(HOUR FROM cb.fecha_hora) < 14';
      } else if (tLower.includes('vesp')) {
        turnoCondition = ' AND EXTRACT(HOUR FROM cb.fecha_hora) >= 14 AND EXTRACT(HOUR FROM cb.fecha_hora) < 22';
      }
    }

    const query = `
      SELECT a.id as atencion_id, a.fecha_hora_ingreso, a.tipo_atencion, a.estado, a.area_servicio,
             p.id as paciente_id, p.numero_expediente, p.curp, p.nombres, p.apellido_paterno, p.apellido_materno,
             p.fecha_nacimiento, p.sexo, p.derechohabiencia, p.enfermedades_previas,
             t.tension_arterial, t.frecuencia_cardiaca, t.frecuencia_respiratoria,
             t.temperatura, t.saturacion_oxigeno, t.glucosa_capilar, t.peso_kg, t.talla_metros, t.imc,
             cb.id as consulta_id, cb.fecha_hora as consulta_fecha_hora, cb.motivo_consulta, cb.observaciones,
             cp.evaluacion_clinica, cp.nota_evolucion, cp.plan_intervencion,
             u.nombre || ' ' || u.apellidos as especialista_nombre
      FROM atenciones_clinicas a
      JOIN pacientes p ON a.paciente_id = p.id
      JOIN consultas_base cb ON a.id = cb.atencion_id
      LEFT JOIN triaje_signos_vitales t ON a.id = t.atencion_id
      LEFT JOIN consultas_psicologia cp ON cb.id = cp.consulta_id
      LEFT JOIN usuarios u ON cb.especialista_id = u.id
      WHERE a.estado = 'FINALIZADA'
        AND cb.area_medica = 'PSICOLOGIA'
        AND cb.fecha_hora >= CURRENT_DATE AND cb.fecha_hora < (CURRENT_DATE + INTERVAL '1 day')
        ${turnoCondition}
      ORDER BY cb.fecha_hora DESC
    `;
    const result = await db.query(query);

    const hoy = new Date();
    const lista = result.rows.map(row => {
      const nac = new Date(row.fecha_nacimiento);
      let edad = hoy.getFullYear() - nac.getFullYear();
      if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
        edad--;
      }
      return { ...row, edad, es_menor: edad < 18 };
    });

    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar atendidos de psicología: ' + err.message });
  }
});

// 1. GET /api/psicologia/interconsultas (Derivaciones pendientes hacia Psicología)
router.get('/interconsultas', async (req, res) => {
  try {
    const query = `
      SELECT tc.id as tratamiento_cruzado_id, tc.area_origen, tc.area_destino, tc.prioridad,
             tc.motivo_derivacion, tc.fecha_hora_derivacion, tc.estado,
             ac.id as atencion_id, ac.paciente_id, ac.numero_expediente, ac.nombres, ac.apellido_paterno,
             ac.apellido_materno, ac.fecha_nacimiento, ac.sexo, ac.enfermedades_previas,
             ac.tutor_id, ac.tutor_nombre, ac.tutor_parentesco, ac.tutor_telefono
      FROM tratamientos_cruzados tc
      JOIN (
        SELECT a.id, a.paciente_id, p.numero_expediente, p.nombres, p.apellido_paterno, p.apellido_materno,
               p.fecha_nacimiento, p.sexo, p.enfermedades_previas,
               tu.id as tutor_id, tu.nombre_completo as tutor_nombre, tu.parentesco as tutor_parentesco, tu.telefono_contacto as tutor_telefono
        FROM atenciones_clinicas a
        JOIN pacientes p ON a.paciente_id = p.id
        LEFT JOIN tutores tu ON p.id = tu.paciente_id
      ) ac ON tc.atencion_origen_id = ac.id
      WHERE tc.area_destino = 'PSICOLOGIA' AND tc.estado = 'PENDIENTE'
      ORDER BY tc.prioridad DESC, tc.fecha_hora_derivacion ASC
    `;
    const result = await db.query(query);

    const hoy = new Date();
    const lista = result.rows.map(row => {
      const nac = new Date(row.fecha_nacimiento);
      let edad = hoy.getFullYear() - nac.getFullYear();
      if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
        edad--;
      }
      return { ...row, edad, es_menor: edad < 18 };
    });

    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar interconsultas de psicología: ' + err.message });
  }
});

// 2. GET /api/psicologia/historial/:paciente_id (Historial confidencial de notas de evolución terapéutica)
router.get('/historial/:paciente_id', async (req, res) => {
  const { paciente_id } = req.params;

  try {
    const query = `
      SELECT cb.id as consulta_id, cb.fecha_hora, cb.motivo_consulta, cb.observaciones,
             cp.evaluacion_clinica, cp.nota_evolucion, cp.plan_intervencion,
             u.nombre || ' ' || u.apellidos as psicologo_nombre, u.cedula_profesional as psicologo_cedula
      FROM consultas_base cb
      JOIN atenciones_clinicas ac ON cb.atencion_id = ac.id
      JOIN usuarios u ON cb.especialista_id = u.id
      JOIN consultas_psicologia cp ON cb.id = cp.consulta_id
      WHERE ac.paciente_id = $1 AND cb.area_medica = 'PSICOLOGIA'
      ORDER BY cb.fecha_hora DESC
    `;
    const result = await db.query(query, [paciente_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar historial psicológico: ' + err.message });
  }
});

// 3. POST /api/psicologia (Registro de Sesión Terapéutica + Consentimiento Informado + Tratamiento Cruzado)
router.post('/', async (req, res) => {
  const {
    atencion_id,
    tratamiento_cruzado_id, // Opcional si viene derivado
    motivo_consulta,
    observaciones,
    evaluacion_clinica,
    nota_evolucion,
    plan_intervencion,
    consentimiento, // Objeto opcional: { grupo_edad, texto_legal, firmado, tutor_id }
    derivar_a // Objeto opcional: { area_destino, prioridad, motivo_derivacion }
  } = req.body;

  if (!atencion_id || !motivo_consulta || !evaluacion_clinica || !nota_evolucion || !plan_intervencion) {
    return res.status(400).json({
      error: 'La atención clínica, motivo de consulta, evaluación clínica, nota de evolución y plan de intervención son obligatorios.'
    });
  }

  const psicologoId = req.user.id;
  const unidadMedicaId = req.user.unidad_medica_id || 1;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar atención y obtener paciente
    const atencionRes = await client.query(`
      SELECT a.id, a.paciente_id, p.fecha_nacimiento
      FROM atenciones_clinicas a
      JOIN pacientes p ON a.paciente_id = p.id
      WHERE a.id = $1
    `, [atencion_id]);

    if (atencionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'La atención clínica especificada no existe.' });
    }

    const pacienteInfo = atencionRes.rows[0];

    const hoy = new Date();
    const nac = new Date(pacienteInfo.fecha_nacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
      edad--;
    }

    // A. Insertar cabecera en consultas_base
    const insertBaseQuery = `
      INSERT INTO consultas_base (atencion_id, especialista_id, area_medica, motivo_consulta, observaciones)
      VALUES ($1, $2, 'PSICOLOGIA', $3, $4)
      RETURNING *
    `;
    const baseResult = await client.query(insertBaseQuery, [
      atencion_id, psicologoId, motivo_consulta.trim(), observaciones || null
    ]);
    const consultaBase = baseResult.rows[0];

    // B. Insertar nota psicológica confidencial
    const insertPsicoQuery = `
      INSERT INTO consultas_psicologia (consulta_id, evaluacion_clinica, nota_evolucion, plan_intervencion)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const psicoResult = await client.query(insertPsicoQuery, [
      consultaBase.id, evaluacion_clinica.trim(), nota_evolucion.trim(), plan_intervencion.trim()
    ]);
    const consultaPsico = psicoResult.rows[0];

    // C. Si venía de una interconsulta, marcarla como ATENDIDA
    if (tratamiento_cruzado_id) {
      await client.query(`
        UPDATE tratamientos_cruzados 
        SET estado = 'ATENDIDO' 
        WHERE id = $1 AND area_destino = 'PSICOLOGIA'
      `, [tratamiento_cruzado_id]);
    }

    // D. Registrar Consentimiento Informado específico de Psicología
    let consentGuardado = null;
    if (consentimiento && consentimiento.texto_legal) {
      const grupoEdad = consentimiento.grupo_edad || (edad < 12 ? 'INFANTIL' : (edad < 18 ? 'ADOLESCENTE' : 'ADULTO'));
      const insertConsentQuery = `
        INSERT INTO consentimientos_informados (
          consulta_id, paciente_id, tutor_id, grupo_edad, texto_legal, firmado
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const consentRes = await client.query(insertConsentQuery, [
        consultaBase.id, pacienteInfo.paciente_id, consentimiento.tutor_id || null,
        grupoEdad, consentimiento.texto_legal, consentimiento.firmado === true
      ]);
      consentGuardado = consentRes.rows[0];
    }

    // E. Si el psicólogo genera una derivación a otra área (ej. Medicina General por somatización)
    let derivacionSaliente = null;
    if (derivar_a && derivar_a.area_destino && derivar_a.motivo_derivacion) {
      const insertCruzadoQuery = `
        INSERT INTO tratamientos_cruzados (atencion_origen_id, area_origen, area_destino, prioridad, motivo_derivacion, estado)
        VALUES ($1, 'PSICOLOGIA', $2, $3, $4, 'PENDIENTE')
        RETURNING *
      `;
      const cruzadoRes = await client.query(insertCruzadoQuery, [
        atencion_id, derivar_a.area_destino, derivar_a.prioridad || 'NORMAL', derivar_a.motivo_derivacion.trim()
      ]);
      derivacionSaliente = cruzadoRes.rows[0];
    } else {
      // Si no deriva a otra área, finalizar la atención clínica
      await client.query("UPDATE atenciones_clinicas SET estado = 'FINALIZADA' WHERE id = $1", [atencion_id]);
    }

    // F. Incrementar bitácora de productividad diaria del psicólogo (+1)
    const upsertBitacoraQuery = `
      INSERT INTO bitacora_productividad_diaria (usuario_id, unidad_medica_id, fecha, total_atenciones)
      VALUES ($1, $2, CURRENT_DATE, 1)
      ON CONFLICT (usuario_id, fecha)
      DO UPDATE SET total_atenciones = bitacora_productividad_diaria.total_atenciones + 1
    `;
    await client.query(upsertBitacoraQuery, [psicologoId, unidadMedicaId]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Nota terapéutica de psicología registrada bajo estricta confidencialidad (NOM-004 / LGPDPPSO)',
      consulta: {
        ...consultaBase,
        detalle_psicologia: consultaPsico,
        consentimiento_informado: consentGuardado
      },
      interconsulta_atendida: !!tratamiento_cruzado_id,
      derivacion_generada: derivacionSaliente
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar sesión psicológica: ' + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
