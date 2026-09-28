const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

// Catálogo base de consulta rápida CIE-10 (primer nivel de atención ambulatoria)
const CATALOGO_CIE10 = [
  { codigo: 'J00', descripcion: 'Rinofaringitis aguda [resfriado común]', morbilidad: 'Infecciones respiratorias agudas' },
  { codigo: 'J02.9', descripcion: 'Faringitis aguda, no especificada', morbilidad: 'Infecciones respiratorias agudas' },
  { codigo: 'J20.9', descripcion: 'Bronquitis aguda, no especificada', morbilidad: 'Infecciones respiratorias agudas' },
  { codigo: 'I10', descripcion: 'Hipertensión esencial [primaria]', morbilidad: 'Enfermedades cardiovasculares' },
  { codigo: 'E11.9', descripcion: 'Diabetes mellitus tipo 2 sin mención de complicación', morbilidad: 'Enfermedades endocrinas y metabólicas' },
  { codigo: 'K29.7', descripcion: 'Gastritis, no especificada', morbilidad: 'Enfermedades del sistema digestivo' },
  { codigo: 'A09', descripcion: 'Gastroenteritis y colitis de origen infeccioso', morbilidad: 'Enfermedades infecciosas intestinales' },
  { codigo: 'N39.0', descripcion: 'Infección de vías urinarias, sitio no especificado', morbilidad: 'Enfermedades del sistema genitourinario' },
  { codigo: 'M54.5', descripcion: 'Lumbago no especificado', morbilidad: 'Enfermedades osteomusculares' },
  { codigo: 'Z00.0', descripcion: 'Examen médico general [certificado médico]', morbilidad: 'Consulta de personas sanas' }
];

// 1. GET /api/consultas/cie10 (Búsqueda de diagnósticos)
router.get('/cie10', (req, res) => {
  const query = (req.query.q || '').toLowerCase().trim();
  if (!query) {
    return res.json(CATALOGO_CIE10);
  }
  const filtrados = CATALOGO_CIE10.filter(item => 
    item.codigo.toLowerCase().includes(query) || 
    item.descripcion.toLowerCase().includes(query) ||
    item.morbilidad.toLowerCase().includes(query)
  );
  res.json(filtrados);
});

// 2. POST /api/consultas/medicina-general (Registrar nota SOAP y consulta)
router.post('/medicina-general', authenticateToken, requireRoles('MEDICO_GENERAL', 'DIRECCION'), async (req, res) => {
  const {
    atencion_id,
    motivo_consulta,
    observaciones,
    nota_subjetivo,
    nota_objetivo,
    nota_analisis,
    nota_plan,
    diagnostico_cie10,
    diagnostico_descripcion,
    clasificacion_morbilidad,
    pruebas_rapidas,
    canalizacion_externa,
    emite_certificado = false
  } = req.body;

  // Validación de campos obligatorios según norma médica
  if (!atencion_id || !motivo_consulta || !nota_subjetivo || !nota_objetivo || !nota_analisis || !nota_plan || !diagnostico_cie10 || !diagnostico_descripcion || !clasificacion_morbilidad) {
    return res.status(400).json({
      error: 'Campos obligatorios incompletos. Se requiere atencion_id, motivo_consulta, notas SOAP completas y diagnóstico CIE-10.'
    });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 2.1 Insertar en consultas_base
    const baseRes = await client.query(`
      INSERT INTO consultas_base (atencion_id, especialista_id, area_medica, motivo_consulta, observaciones)
      VALUES ($1, $2, 'MEDICINA_GENERAL', $3, $4)
      RETURNING id, fecha_hora
    `, [atencion_id, req.user.id, motivo_consulta, observaciones || null]);
    const consultaId = baseRes.rows[0].id;

    // 2.2 Insertar en consultas_medicina_general
    const medRes = await client.query(`
      INSERT INTO consultas_medicina_general (
        consulta_id, nota_subjetivo, nota_objetivo, nota_analisis, nota_plan,
        diagnostico_cie10, diagnostico_descripcion, clasificacion_morbilidad,
        pruebas_rapidas, canalizacion_externa, emite_certificado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      consultaId,
      nota_subjetivo,
      nota_objetivo,
      nota_analisis,
      nota_plan,
      diagnostico_cie10,
      diagnostico_descripcion,
      clasificacion_morbilidad,
      pruebas_rapidas || null,
      canalizacion_externa || null,
      Boolean(emite_certificado)
    ]);
    const consultaMedId = medRes.rows[0].id;

    // 2.3 Actualizar estado de la atención clínica a FINALIZADA
    await client.query(`
      UPDATE atenciones_clinicas
      SET estado = 'FINALIZADA'
      WHERE id = $1
    `, [atencion_id]);

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Consulta de Medicina General registrada exitosamente.',
      consulta_id: consultaId,
      consulta_medicina_general_id: consultaMedId,
      diagnostico: `${diagnostico_cie10} - ${diagnostico_descripcion}`,
      estado_atencion: 'FINALIZADA'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar la consulta médica: ' + error.message });
  } finally {
    client.release();
  }
});

// 3. GET /api/consultas/medicina-general/:id (Detalle de la consulta)
router.get('/medicina-general/:id', authenticateToken, async (req, res) => {
  try {
    const consultaRes = await db.query(`
      SELECT cb.id as consulta_id, cb.fecha_hora, cb.motivo_consulta, cb.observaciones,
             cm.nota_subjetivo, cm.nota_objetivo, cm.nota_analisis, cm.nota_plan,
             cm.diagnostico_cie10, cm.diagnostico_descripcion, cm.clasificacion_morbilidad,
             cm.pruebas_rapidas, cm.canalizacion_externa, cm.emite_certificado,
             u.nombre as medico_nombre, u.apellidos as medico_apellidos, u.cedula_profesional,
             p.nombres as paciente_nombres, p.apellido_paterno as paciente_apellido_paterno,
             p.numero_expediente, p.curp
      FROM consultas_base cb
      JOIN consultas_medicina_general cm ON cm.consulta_id = cb.id
      JOIN usuarios u ON u.id = cb.especialista_id
      JOIN atenciones_clinicas ac ON ac.id = cb.atencion_id
      JOIN pacientes p ON p.id = ac.paciente_id
      WHERE cb.id = $1
    `, [req.params.id]);

    if (consultaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Consulta médica no encontrada.' });
    }

    res.json(consultaRes.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
