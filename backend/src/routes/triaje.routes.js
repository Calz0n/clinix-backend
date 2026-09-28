const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

// 1. Funciones utilitarias clínicas
function calcularIMC(peso, talla) {
  const imc = Number((peso / (talla * talla)).toFixed(1));
  let clasificacion = 'Normal';
  if (imc < 18.5) clasificacion = 'Bajo peso';
  else if (imc < 25.0) clasificacion = 'Normal';
  else if (imc < 30.0) clasificacion = 'Sobrepeso';
  else if (imc < 35.0) clasificacion = 'Obesidad Grado I';
  else if (imc < 40.0) clasificacion = 'Obesidad Grado II';
  else clasificacion = 'Obesidad Grado III';
  return { imc, clasificacion };
}

function evaluarSemaforoTriaje(ta, fc, fr, temp, satO2) {
  const alertas = [];
  let prioridad = 'VERDE';

  const partesTA = (ta || '').split('/');
  if (partesTA.length === 2) {
    const sistolica = parseInt(partesTA[0], 10);
    const diastolica = parseInt(partesTA, 10);

    if (sistolica >= 180 || diastolica >= 110) {
      alertas.push('Crisis hipertensiva');
      prioridad = 'ROJO';
    } else if (sistolica >= 140 || diastolica >= 90) {
      alertas.push('Hipertensión arterial');
      if (prioridad !== 'ROJO') prioridad = 'AMARILLO';
    }
  }

  if (satO2 < 90) {
    alertas.push('Desaturación severa (Hipoxia)');
    prioridad = 'ROJO';
  } else if (satO2 <= 93) {
    alertas.push('Saturación limítrofe');
    if (prioridad !== 'ROJO') prioridad = 'AMARILLO';
  }

  if (temp >= 39.0) {
    alertas.push('Fiebre alta');
    prioridad = 'ROJO';
  } else if (temp >= 38.0) {
    alertas.push('Fiebre');
    if (prioridad !== 'ROJO') prioridad = 'AMARILLO';
  }

  if (fc >= 120 || fc <= 45) {
    alertas.push('Frecuencia cardíaca crítica');
    prioridad = 'ROJO';
  } else if (fc >= 100 || fc < 60) {
    alertas.push('Frecuencia cardíaca fuera de rango');
    if (prioridad !== 'ROJO') prioridad = 'AMARILLO';
  }

  return { prioridad, alertas };
}

// 2. POST /api/triaje/evaluar-signos (Cálculo y semáforo instantáneo)
router.post('/evaluar-signos', (req, res) => {
  const { tension_arterial, frecuencia_cardiaca, frecuencia_respiratoria, temperatura, saturacion_oxigeno, peso_kg, talla_metros } = req.body;

  if (!peso_kg || !talla_metros) {
    return res.status(400).json({ error: 'peso_kg y talla_metros son requeridos para evaluar.' });
  }

  const { imc, clasificacion } = calcularIMC(peso_kg, talla_metros);
  const { prioridad, alertas } = evaluarSemaforoTriaje(
    tension_arterial,
    frecuencia_cardiaca,
    frecuencia_respiratoria,
    temperatura,
    saturacion_oxigeno
  );

  res.json({
    imc,
    clasificacion_imc: clasificacion,
    prioridad_triaje: prioridad,
    alertas_clinicas: alertas
  });
});

// 3. POST /api/triaje (Guardar somatometría, signos y procedimientos)
router.post('/', authenticateToken, requireRoles('ENFERMERIA', 'DIRECCION'), async (req, res) => {
  const {
    atencion_id,
    tension_arterial,
    frecuencia_cardiaca,
    frecuencia_respiratoria,
    temperatura,
    saturacion_oxigeno,
    glucosa_capilar,
    peso_kg,
    talla_metros,
    detecciones_riesgo,
    procedimientos = []
  } = req.body;

  if (!atencion_id || !tension_arterial || !frecuencia_cardiaca || !frecuencia_respiratoria || !temperatura || !saturacion_oxigeno || !peso_kg || !talla_metros) {
    return res.status(400).json({ error: 'Todos los signos vitales y datos de somatometría son obligatorios.' });
  }

  const { imc, clasificacion } = calcularIMC(peso_kg, talla_metros);
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 3.1 Insertar signos vitales
    const triajeRes = await client.query(`
      INSERT INTO triaje_signos_vitales (
        atencion_id, enfermero_id, tension_arterial, frecuencia_cardiaca,
        frecuencia_respiratoria, temperatura, saturacion_oxigeno, glucosa_capilar,
        peso_kg, talla_metros, imc, clasificacion_imc, detecciones_riesgo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, fecha_hora
    `, [
      atencion_id,
      req.user.id,
      tension_arterial,
      frecuencia_cardiaca,
      frecuencia_respiratoria,
      temperatura,
      saturacion_oxigeno,
      glucosa_capilar || null,
      peso_kg,
      talla_metros,
      imc,
      clasificacion,
      detecciones_riesgo || null
    ]);
    const triajeId = triajeRes.rows[0].id;

    // 3.2 Insertar procedimientos de enfermería si aplican
    for (const proc of procedimientos) {
      await client.query(`
        INSERT INTO procedimientos_enfermeria (triaje_id, tipo_procedimiento, cantidad, observaciones)
        VALUES ($1, $2, $3, $4)
      `, [
        triajeId,
        proc.tipo_procedimiento,
        proc.cantidad || 1,
        proc.observaciones || null
      ]);
    }

    // 3.3 Pasar estado de atención a EN_CONSULTA para canalizar al médico
    await client.query(`
      UPDATE atenciones_clinicas
      SET estado = 'EN_CONSULTA'
      WHERE id = $1
    `, [atencion_id]);

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Signos vitales y somatometría registrados exitosamente.',
      triaje_id: triajeId,
      imc,
      clasificacion_imc: clasificacion,
      procedimientos_registrados: procedimientos.length,
      nuevo_estado_atencion: 'EN_CONSULTA'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar triaje: ' + error.message });
  } finally {
    client.release();
  }
});

// 4. GET /api/triaje/atencion/:atencionId (Consulta de signos para el médico)
router.get('/atencion/:atencionId', authenticateToken, async (req, res) => {
  try {
    const triajeRes = await db.query(`
      SELECT t.*, u.nombre as enfermero_nombre, u.apellidos as enfermero_apellidos
      FROM triaje_signos_vitales t
      JOIN usuarios u ON u.id = t.enfermero_id
      WHERE t.atencion_id = $1
    `, [req.params.atencionId]);

    if (triajeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Signos vitales no encontrados para esta atención.' });
    }

    const triaje = triajeRes.rows[0];
    const procRes = await db.query(`
      SELECT tipo_procedimiento, cantidad, observaciones
      FROM procedimientos_enfermeria
      WHERE triaje_id = $1
    `, [triaje.id]);

    triaje.procedimientos = procRes.rows;
    res.json(triaje);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
