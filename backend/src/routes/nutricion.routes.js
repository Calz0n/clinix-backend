const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Función auxiliar para determinar z-score y percentil estimado OMS según IMC y edad
function calcularMetricasOMS(edad, sexo, imc, peso, talla) {
  // Rango de edad OMS
  const rango_edad_oms = edad <= 5 ? '2_A_5_ANOS' : '5_A_19_ANOS';
  
  // Puntuación Z aproximada para IMC infantil según tablas de referencia de la OMS
  // Para niños de 7 años, la mediana OMS es aprox 15.5 kg/m2 con DE de 1.5
  const medianaIMC = edad === 7 ? 15.5 : (14.0 + (edad * 0.3));
  const desvEstandar = 1.6;
  const zscore_imc_edad = parseFloat(((imc - medianaIMC) / desvEstandar).toFixed(2));
  
  // Mediana de peso y talla
  const medianaPeso = edad === 7 ? 23.0 : (10.0 + (edad * 2.2));
  const zscore_peso_edad = parseFloat(((peso - medianaPeso) / 3.0).toFixed(2));
  
  const medianaTalla = edad === 7 ? 1.22 : (0.85 + (edad * 0.05));
  const zscore_talla_edad = parseFloat(((talla - medianaTalla) / 0.06).toFixed(2));

  // Estimación de percentil a partir del Z-score
  let percentil = 50;
  if (zscore_imc_edad <= -2) percentil = 3;
  else if (zscore_imc_edad <= -1) percentil = 15;
  else if (zscore_imc_edad < 1) percentil = 50;
  else if (zscore_imc_edad < 2) percentil = 85;
  else percentil = 97;

  return {
    rango_edad_oms,
    zscore_imc_edad,
    zscore_peso_edad,
    zscore_talla_edad,
    percentil_calculado: percentil
  };
}

// 1. GET /api/nutricion/interconsultas (Pacientes derivados por Medicina General vía Tratamiento Cruzado)
router.get('/interconsultas', requireRoles('NUTRIOLOGO', 'DIRECCION'), async (req, res) => {
  try {
    const query = `
      SELECT tc.id as tratamiento_cruzado_id, tc.area_origen, tc.area_destino, tc.prioridad,
             tc.motivo_derivacion, tc.fecha_hora_derivacion, tc.estado,
             ac.id as atencion_id, ac.paciente_id, ac.numero_expediente, ac.nombres, ac.apellido_paterno,
             ac.apellido_materno, ac.fecha_nacimiento, ac.sexo, ac.enfermedades_previas,
             ac.tension_arterial, ac.peso_kg, ac.talla_metros, ac.imc, ac.clasificacion_imc,
             ac.tutor_nombre, ac.tutor_parentesco, ac.tutor_telefono
      FROM tratamientos_cruzados tc
      JOIN (
        SELECT a.id, a.paciente_id, p.numero_expediente, p.nombres, p.apellido_paterno, p.apellido_materno,
               p.fecha_nacimiento, p.sexo, p.enfermedades_previas,
               t.tension_arterial, t.peso_kg, t.talla_metros, t.imc, t.clasificacion_imc,
               tu.nombre_completo as tutor_nombre, tu.parentesco as tutor_parentesco, tu.telefono_contacto as tutor_telefono
        FROM atenciones_clinicas a
        JOIN pacientes p ON a.paciente_id = p.id
        LEFT JOIN triaje_signos_vitales t ON a.id = t.atencion_id
        LEFT JOIN tutores tu ON p.id = tu.paciente_id
      ) ac ON tc.atencion_origen_id = ac.id
      WHERE tc.area_destino = 'NUTRICION' AND tc.estado = 'PENDIENTE'
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
    res.status(500).json({ error: 'Error al consultar interconsultas de nutrición: ' + err.message });
  }
});

// 2. GET /api/nutricion/historial/:paciente_id (Historial antropométrico y curvas previas)
router.get('/historial/:paciente_id', async (req, res) => {
  const { paciente_id } = req.params;

  try {
    const query = `
      SELECT cb.id as consulta_id, cb.fecha_hora, cb.motivo_consulta,
             cn.circunferencia_cintura, cn.circunferencia_cadera, cn.circunferencia_brazo,
             cn.porcentaje_grasa, cn.porcentaje_musculo, cn.consumo_agua_litros,
             cn.frecuencia_ejercicio, cn.recordatorio_24h,
             co.rango_edad_oms, co.zscore_peso_edad, co.zscore_talla_edad, co.zscore_imc_edad,
             co.percentil_calculado,
             u.nombre || ' ' || u.apellidos as nutriologo_nombre, u.cedula_profesional as nutriologo_cedula
      FROM consultas_base cb
      JOIN atenciones_clinicas ac ON cb.atencion_id = ac.id
      JOIN usuarios u ON cb.especialista_id = u.id
      LEFT JOIN consultas_nutricion cn ON cb.id = cn.consulta_id
      LEFT JOIN curvas_crecimiento_oms co ON cn.id = co.consulta_nutricion_id
      WHERE ac.paciente_id = $1 AND cb.area_medica = 'NUTRICION'
      ORDER BY cb.fecha_hora DESC
    `;
    const result = await db.query(query, [paciente_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar historial nutricional: ' + err.message });
  }
});

// 3. POST /api/nutricion (Registro de Evaluación Nutricional + Curvas OMS + Consentimiento Informado)
// Roles permitidos: NUTRIOLOGO o DIRECCION
router.post('/', requireRoles('NUTRIOLOGO', 'DIRECCION'), async (req, res) => {
  const {
    atencion_id,
    tratamiento_cruzado_id, // Opcional, si viene de una interconsulta
    motivo_consulta,
    observaciones,
    circunferencia_cintura,
    circunferencia_cadera,
    circunferencia_brazo,
    porcentaje_grasa,
    porcentaje_musculo,
    consumo_agua_litros,
    frecuencia_ejercicio,
    recordatorio_24h, // Objeto JSONB { desayuno, colacion_mat, comida, colacion_vesp, cena }
    consentimiento // Objeto opcional: { grupo_edad, texto_legal, firmado, tutor_id }
  } = req.body;

  if (!atencion_id || !motivo_consulta) {
    return res.status(400).json({ error: 'La atención médica y el motivo de consulta son obligatorios.' });
  }

  const nutriologoId = req.user.id;
  const unidadMedicaId = req.user.unidad_medica_id || 1;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener datos del paciente y de la atención clínica
    const atencionRes = await client.query(`
      SELECT a.id, a.paciente_id, p.fecha_nacimiento, p.sexo,
             t.peso_kg, t.talla_metros, t.imc
      FROM atenciones_clinicas a
      JOIN pacientes p ON a.paciente_id = p.id
      LEFT JOIN triaje_signos_vitales t ON a.id = t.atencion_id
      WHERE a.id = $1
    `, [atencion_id]);

    if (atencionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'La atención clínica especificada no existe.' });
    }

    const pacienteInfo = atencionRes.rows[0];

    // Calcular edad
    const hoy = new Date();
    const nac = new Date(pacienteInfo.fecha_nacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
      edad--;
    }

    // 2. Insertar cabecera en consultas_base
    const insertBaseQuery = `
      INSERT INTO consultas_base (atencion_id, especialista_id, area_medica, motivo_consulta, observaciones)
      VALUES ($1, $2, 'NUTRICION', $3, $4)
      RETURNING *
    `;
    const baseResult = await client.query(insertBaseQuery, [
      atencion_id, nutriologoId, motivo_consulta.trim(), observaciones || null
    ]);
    const consultaBase = baseResult.rows[0];

    // 3. Insertar detalle en consultas_nutricion
    const insertNutriQuery = `
      INSERT INTO consultas_nutricion (
        consulta_id, circunferencia_cintura, circunferencia_cadera, circunferencia_brazo,
        porcentaje_grasa, porcentaje_musculo, consumo_agua_litros, frecuencia_ejercicio, recordatorio_24h
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const nutriValues = [
      consultaBase.id,
      circunferencia_cintura ? parseFloat(circunferencia_cintura) : null,
      circunferencia_cadera ? parseFloat(circunferencia_cadera) : null,
      circunferencia_brazo ? parseFloat(circunferencia_brazo) : null,
      porcentaje_grasa ? parseFloat(porcentaje_grasa) : null,
      porcentaje_musculo ? parseFloat(porcentaje_musculo) : null,
      consumo_agua_litros ? parseFloat(consumo_agua_litros) : null,
      frecuencia_ejercicio ? frecuencia_ejercicio.trim() : null,
      recordatorio_24h ? JSON.stringify(recordatorio_24h) : null
    ];
    const nutriResult = await client.query(insertNutriQuery, nutriValues);
    const consultaNutri = nutriResult.rows[0];

    // 4. Si el paciente es menor de 19 años, calcular y almacenar Curvas de Crecimiento OMS (RF-05)
    let curvaOMSGuardada = null;
    if (edad <= 19 && pacienteInfo.peso_kg && pacienteInfo.talla_metros && pacienteInfo.imc) {
      const metricas = calcularMetricasOMS(
        edad,
        pacienteInfo.sexo,
        parseFloat(pacienteInfo.imc),
        parseFloat(pacienteInfo.peso_kg),
        parseFloat(pacienteInfo.talla_metros)
      );

      const insertCurvaQuery = `
        INSERT INTO curvas_crecimiento_oms (
          consulta_nutricion_id, rango_edad_oms, zscore_peso_edad, zscore_talla_edad,
          zscore_imc_edad, percentil_calculado
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const curvaRes = await client.query(insertCurvaQuery, [
        consultaNutri.id, metricas.rango_edad_oms, metricas.zscore_peso_edad,
        metricas.zscore_talla_edad, metricas.zscore_imc_edad, metricas.percentil_calculado
      ]);
      curvaOMSGuardada = curvaRes.rows[0];
    }

    // 5. Si venía de un tratamiento cruzado, actualizarlo a ATENDIDO
    if (tratamiento_cruzado_id) {
      await client.query(`
        UPDATE tratamientos_cruzados 
        SET estado = 'ATENDIDO' 
        WHERE id = $1 AND area_destino = 'NUTRICION'
      `, [tratamiento_cruzado_id]);
    }

    // 6. Registrar Consentimiento Informado si se proporcionó
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

    // 7. Incrementar bitácora diaria de productividad del nutriólogo (+1)
    const upsertBitacoraQuery = `
      INSERT INTO bitacora_productividad_diaria (usuario_id, unidad_medica_id, fecha, total_atenciones)
      VALUES ($1, $2, CURRENT_DATE, 1)
      ON CONFLICT (usuario_id, fecha)
      DO UPDATE SET total_atenciones = bitacora_productividad_diaria.total_atenciones + 1
    `;
    await client.query(upsertBitacoraQuery, [nutriologoId, unidadMedicaId]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Consulta nutricional registrada exitosamente',
      consulta: {
        ...consultaBase,
        antropometria: consultaNutri,
        curva_oms_pediatrica: curvaOMSGuardada,
        consentimiento_informado: consentGuardado
      },
      interconsulta_atendida: !!tratamiento_cruzado_id
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar consulta nutricional: ' + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
