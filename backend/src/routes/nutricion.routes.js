const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

// Funciones utilitarias clínicas
function clasificarIMC(imc) {
  if (imc < 18.5) return 'Bajo peso';
  if (imc < 25.0) return 'Normal';
  if (imc < 30.0) return 'Sobrepeso';
  if (imc < 35.0) return 'Obesidad Clase I';
  if (imc < 40.0) return 'Obesidad Clase II';
  return 'Obesidad Clase III';
}

function calcularRiesgoCinturaCadera(cintura, cadera, sexo = 'M') {
  if (!cintura || !cadera || cadera <= 0) return null;
  const rcc = Number((cintura / cadera).toFixed(2));
  const esHombre = (sexo || 'M').toUpperCase() === 'M';
  const riesgo = esHombre 
    ? (rcc > 0.90 ? 'ALTO' : 'NORMAL') 
    : (rcc > 0.85 ? 'ALTO' : 'NORMAL');
  return { rcc, riesgo };
}

// 1. POST /api/nutricion/evaluar-antropometria (Utilidad sin persistencia)
router.post('/evaluar-antropometria', (req, res) => {
  const { peso_kg, talla_metros, cintura_cm, cadera_cm, sexo = 'M' } = req.body;

  if (!peso_kg || !talla_metros || talla_metros <= 0) {
    return res.status(400).json({ error: 'peso_kg y talla_metros son obligatorios y deben ser mayores a 0.' });
  }

  const imc = Number((peso_kg / (talla_metros * talla_metros)).toFixed(1));
  const clasificacion = clasificarIMC(imc);
  const rccData = calcularRiesgoCinturaCadera(cintura_cm, cadera_cm, sexo);

  res.json({
    peso_kg,
    talla_metros,
    imc,
    clasificacion_imc: clasificacion,
    relacion_cintura_cadera: rccData ? rccData.rcc : null,
    riesgo_cardiovascular: rccData ? rccData.riesgo : 'NO_DETERMINADO'
  });
});

// 2. POST /api/nutricion (Registrar consulta completa en base de datos)
router.post('/', authenticateToken, requireRoles('NUTRIOLOGO', 'DIRECCION'), async (req, res) => {
  const {
    atencion_id,
    motivo_consulta,
    observaciones,
    circunferencia_cintura,
    circunferencia_cadera,
    circunferencia_brazo,
    porcentaje_grasa,
    porcentaje_musculo,
    consumo_agua_litros,
    frecuencia_ejercicio,
    recordatorio_24h,
    curva_oms // Opcional para menores: { rango_edad_oms, zscore_peso_edad, zscore_talla_edad, zscore_imc_edad, percentil_calculado }
  } = req.body;

  if (!atencion_id || !motivo_consulta) {
    return res.status(400).json({ error: 'atencion_id y motivo_consulta son campos obligatorios.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 2.1 Insertar consulta base
    const baseRes = await client.query(`
      INSERT INTO consultas_base (atencion_id, especialista_id, area_medica, motivo_consulta, observaciones)
      VALUES ($1, $2, 'NUTRICION', $3, $4)
      RETURNING id, fecha_hora
    `, [atencion_id, req.user.id, motivo_consulta, observaciones || null]);
    const consultaId = baseRes.rows[0].id;

    // 2.2 Insertar datos específicos de nutrición
    const nutriRes = await client.query(`
      INSERT INTO consultas_nutricion (
        consulta_id, circunferencia_cintura, circunferencia_cadera, circunferencia_brazo,
        porcentaje_grasa, porcentaje_musculo, consumo_agua_litros, frecuencia_ejercicio, recordatorio_24h
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      consultaId,
      circunferencia_cintura || null,
      circunferencia_cadera || null,
      circunferencia_brazo || null,
      porcentaje_grasa || null,
      porcentaje_musculo || null,
      consumo_agua_litros || null,
      frecuencia_ejercicio || null,
      recordatorio_24h ? JSON.stringify(recordatorio_24h) : null
    ]);
    const consultaNutriId = nutriRes.rows[0].id;

    // 2.3 Si incluye datos de curva pediátrica OMS
    let curvaId = null;
    if (curva_oms && curva_oms.rango_edad_oms) {
      const curvaRes = await client.query(`
        INSERT INTO curvas_crecimiento_oms (
          consulta_nutricion_id, rango_edad_oms, zscore_peso_edad, zscore_talla_edad,
          zscore_imc_edad, percentil_calculado
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        consultaNutriId,
        curva_oms.rango_edad_oms,
        curva_oms.zscore_peso_edad || null,
        curva_oms.zscore_talla_edad || null,
        curva_oms.zscore_imc_edad || null,
        curva_oms.percentil_calculado || null
      ]);
      curvaId = curvaRes.rows[0].id;
    }

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Consulta de nutrición registrada exitosamente.',
      consulta_id: consultaId,
      consulta_nutricion_id: consultaNutriId,
      curva_oms_id: curvaId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar consulta de nutrición: ' + error.message });
  } finally {
    client.release();
  }
});

// 3. GET /api/nutricion/consulta/:id (Lectura completa)
router.get('/consulta/:id', authenticateToken, async (req, res) => {
  try {
    const consultaRes = await db.query(`
      SELECT cb.id as consulta_id, cb.fecha_hora, cb.motivo_consulta, cb.observaciones,
             cn.id as consulta_nutricion_id, cn.circunferencia_cintura, cn.circunferencia_cadera,
             cn.circunferencia_brazo, cn.porcentaje_grasa, cn.porcentaje_musculo,
             cn.consumo_agua_litros, cn.frecuencia_ejercicio, cn.recordatorio_24h,
             u.nombre as nutriologo_nombre, u.apellidos as nutriologo_apellidos,
             co.rango_edad_oms, co.zscore_peso_edad, co.zscore_talla_edad, co.zscore_imc_edad, co.percentil_calculado
      FROM consultas_base cb
      JOIN consultas_nutricion cn ON cn.consulta_id = cb.id
      JOIN usuarios u ON u.id = cb.especialista_id
      LEFT JOIN curvas_crecimiento_oms co ON co.consulta_nutricion_id = cn.id
      WHERE cb.id = $1
    `, [req.params.id]);

    if (consultaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Consulta de nutrición no encontrada.' });
    }

    res.json(consultaRes.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
