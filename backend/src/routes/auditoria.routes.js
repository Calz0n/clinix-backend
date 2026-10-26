const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(requireRoles('DIRECCION'));

// 1. GET /api/auditoria/accesos (Trazabilidad de accesos y sesiones activas)
router.get('/accesos', async (req, res) => {
  const { limite = 50 } = req.query;

  try {
    const query = `
      SELECT u.id as usuario_id,
             u.nombre || ' ' || u.apellidos as nombre_completo,
             u.email, u.rol, u.cedula_profesional, u.activo,
             u.ultimo_acceso,
             um.nombre as unidad_medica_nombre
      FROM usuarios u
      LEFT JOIN unidades_medicas um ON u.unidad_medica_id = um.id
      ORDER BY u.ultimo_acceso DESC NULLS LAST
      LIMIT $1
    `;
    const result = await db.query(query, [parseInt(limite, 10)]);

    res.json({
      norma_aplicable: 'NOM-004-SSA3-2012 (Control de Identificación de Usuarios)',
      total_registros: result.rows.length,
      accesos: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar auditoría de accesos: ' + err.message });
  }
});

// 2. GET /api/auditoria/expedientes (Trazabilidad cronológica de notas médicas y aperturas de expediente)
router.get('/expedientes', async (req, res) => {
  const { limite = 50, fecha_inicio, fecha_fin, area } = req.query;

  try {
    let query = `
      SELECT cb.id as consulta_id,
             cb.fecha_hora,
             cb.area_medica,
             cb.motivo_consulta,
             p.id as paciente_id,
             p.numero_expediente,
             p.curp,
             p.nombres || ' ' || p.apellido_paterno || ' ' || COALESCE(p.apellido_materno, '') as paciente_nombre,
             u.id as profesional_id,
             u.nombre || ' ' || u.apellidos as profesional_nombre,
             u.rol as profesional_rol,
             u.cedula_profesional,
             ac.tipo_atencion,
             ac.unidad_medica_id,
             um.nombre as unidad_medica_nombre
      FROM consultas_base cb
      JOIN pacientes p ON cb.paciente_id = p.id
      JOIN usuarios u ON cb.especialista_id = u.id
      JOIN atenciones_clinicas ac ON cb.atencion_id = ac.id
      LEFT JOIN unidades_medicas um ON ac.unidad_medica_id = um.id
      WHERE 1=1
    `;
    const params = [];

    if (area) {
      params.push(area.toUpperCase().trim());
      query += ` AND cb.area_medica = $${params.length}`;
    }

    if (fecha_inicio) {
      params.push(fecha_inicio);
      query += ` AND DATE(cb.fecha_hora) >= $${params.length}`;
    }

    if (fecha_fin) {
      params.push(fecha_fin);
      query += ` AND DATE(cb.fecha_hora) <= $${params.length}`;
    }

    query += ` ORDER BY cb.fecha_hora DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limite, 10));

    const result = await db.query(query, params);

    res.json({
      norma_aplicable: 'NOM-004-SSA3-2012 (Trazabilidad y Autoría de Notas Médicas)',
      total_registros: result.rows.length,
      eventos_clinicos: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar auditoría de expedientes: ' + err.message });
  }
});

// 3. GET /api/auditoria/resumen (Dashboard de métricas globales e integridad del sistema)
router.get('/resumen', async (req, res) => {
  try {
    const totalPacientes = await db.query('SELECT COUNT(*) FROM pacientes');
    const totalConsultas = await db.query('SELECT COUNT(*) FROM consultas_base');
    const totalTriajes = await db.query('SELECT COUNT(*) FROM triaje_signos_vitales');
    const personalActivo = await db.query('SELECT COUNT(*) FROM usuarios WHERE activo = true');
    const personalInactivo = await db.query('SELECT COUNT(*) FROM usuarios WHERE activo = false');
    const sedesActivas = await db.query('SELECT COUNT(*) FROM unidades_medicas WHERE activo = true');

    res.json({
      municipio: 'Coatzacoalcos, Veracruz',
      periodo: '2026-2029',
      sistema: 'Clinix - Control Estadístico y Clínico Municipal',
      cumplimiento_normativo: {
        nom_004_ssa3_2012: 'VIGENTE - Expediente Clínico Digital',
        nom_024_ssa3_2012: 'VIGENTE - Sistemas de Información de Registro Electrónico'
      },
      estadisticas_globales: {
        total_expedientes_pacientes: parseInt(totalPacientes.rows[0].count, 10),
        total_consultas_especialidad: parseInt(totalConsultas.rows[0].count, 10),
        total_triajes_enfermeria: parseInt(totalTriajes.rows[0].count, 10),
        personal_salud_activo: parseInt(personalActivo.rows[0].count, 10),
        personal_salud_pausado: parseInt(personalInactivo.rows[0].count, 10),
        unidades_medicas_operativas: parseInt(sedesActivas.rows[0].count, 10)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar resumen de auditoría: ' + err.message });
  }
});

module.exports = router;
