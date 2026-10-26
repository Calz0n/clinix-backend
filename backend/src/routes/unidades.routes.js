const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

// Asegurar columnas de consultorios y especialidades en PostgreSQL
(async () => {
  try {
    await db.query(`
      ALTER TABLE unidades_medicas ADD COLUMN IF NOT EXISTS consultorios INT DEFAULT 4;
      ALTER TABLE unidades_medicas ADD COLUMN IF NOT EXISTS especialidades_activas JSONB DEFAULT '["Medicina General", "Odontología", "Nutrición", "Psicología", "Enfermería / Triaje"]'::jsonb;
      ALTER TABLE unidades_medicas ADD COLUMN IF NOT EXISTS medicos_por_especialidad JSONB DEFAULT '{}'::jsonb;
    `);
  } catch (e) {
    console.error('Error al inicializar columnas en unidades_medicas:', e.message);
  }
})();

// 1. GET /api/unidades (Listado completo de sedes con módulos y doctores asignados)
router.get('/', async (req, res) => {
  const { todas } = req.query;

  try {
    let query = `
      SELECT u.id, u.nombre, u.clave_oficial, u.direccion, u.colonia, u.telefono, u.georreferencia, u.activo,
             COALESCE(u.consultorios, 4) as consultorios,
             COALESCE(u.especialidades_activas, '["Medicina General", "Odontología", "Nutrición", "Psicología", "Enfermería / Triaje"]'::jsonb) as especialidades_activas,
             COALESCE(u.medicos_por_especialidad, '{}'::jsonb) as medicos_por_especialidad,
             COUNT(usr.id) FILTER (WHERE usr.activo = true) as total_personal_activo
      FROM unidades_medicas u
      LEFT JOIN usuarios usr ON usr.unidad_medica_id = u.id
      WHERE 1=1
    `;

    if (todas !== 'true') {
      query += ` AND u.activo = true`;
    }

    query += ` GROUP BY u.id ORDER BY u.id ASC`;

    const result = await db.query(query);

    // Obtener todos los usuarios activos y su unidad médica asignada para sincronización bidireccional
    const usuariosRes = await db.query(
      `SELECT id, nombre, apellidos, rol, unidad_medica_id FROM usuarios WHERE activo = true`
    );

    const ROL_A_ESP = {
      'MEDICO_GENERAL': 'Medicina General',
      'ODONTOLOGO': 'Odontología',
      'NUTRIOLOGO': 'Nutrición',
      'PSICOLOGO': 'Psicología',
      'ENFERMERIA': 'Enfermería / Triaje',
      'RECEPCION': 'Recepción'
    };

    const unidades = result.rows.map(row => {
      let medicosMap = row.medicos_por_especialidad || {};
      if (typeof medicosMap !== 'object') medicosMap = {};

      // Si hay un médico asignado a esta unidad médica en la tabla usuarios, sincronizarlo si no está fijado
      usuariosRes.rows.forEach(u => {
        if (u.unidad_medica_id === row.id) {
          const esp = ROL_A_ESP[u.rol];
          if (esp && (!medicosMap[esp] || medicosMap[esp] === '')) {
            medicosMap[esp] = u.id.toString();
          }
        }
      });

      return {
        ...row,
        medicos_por_especialidad: medicosMap
      };
    });

    res.json(unidades);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar sedes médicas: ' + err.message });
  }
});

// 2. GET /api/unidades/:id (Detalle de una sede)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT id, nombre, clave_oficial, direccion, colonia, telefono, georreferencia, activo,
              COALESCE(consultorios, 4) as consultorios,
              COALESCE(especialidades_activas, '["Medicina General", "Odontología", "Nutrición", "Psicología", "Enfermería / Triaje"]'::jsonb) as especialidades_activas,
              COALESCE(medicos_por_especialidad, '{}'::jsonb) as medicos_por_especialidad
       FROM unidades_medicas WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sede médica no encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sede: ' + err.message });
  }
});

// 3. POST /api/unidades (Alta de nueva sede - Exclusivo Dirección)
router.post('/', authenticateToken, requireRoles('DIRECCION'), async (req, res) => {
  const { nombre, clave_oficial, direccion, colonia, telefono, georreferencia, consultorios, especialidades_activas } = req.body;

  if (!nombre || !direccion) {
    return res.status(400).json({ error: 'Nombre y dirección son obligatorios.' });
  }

  const claveGenerada = clave_oficial
    ? clave_oficial.trim().toUpperCase()
    : 'DSPM-' + Date.now().toString().slice(-6);

  const numConsultorios = parseInt(consultorios, 10) || 4;
  const espActivasJson = JSON.stringify(especialidades_activas || [
    'Medicina General', 'Odontología', 'Nutrición', 'Psicología', 'Enfermería / Triaje'
  ]);

  try {
    const insertQuery = `
      INSERT INTO unidades_medicas (nombre, clave_oficial, direccion, colonia, telefono, georreferencia, consultorios, especialidades_activas, medicos_por_especialidad, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, '{}'::jsonb, true)
      RETURNING *
    `;
    const values = [
      nombre.trim(),
      claveGenerada,
      direccion.trim(),
      colonia ? colonia.trim() : 'Coatzacoalcos Centro',
      telefono ? telefono.trim() : null,
      georreferencia ? georreferencia.trim() : null,
      numConsultorios,
      espActivasJson
    ];
    const result = await db.query(insertQuery, values);

    res.status(201).json({
      message: 'Unidad médica registrada exitosamente.',
      unidad: result.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'La clave oficial ya se encuentra registrada para otra unidad.' });
    }
    res.status(500).json({ error: 'Error al crear unidad médica: ' + err.message });
  }
});

// 4. PUT /api/unidades/:id/modulos (Guardar módulos activos y asignación de doctores - Exclusivo Dirección)
router.put('/:id/modulos', authenticateToken, requireRoles('DIRECCION'), async (req, res) => {
  const { id } = req.params;
  const { especialidades_activas, medicos_por_especialidad } = req.body;

  try {
    const espJson = JSON.stringify(especialidades_activas || []);
    const medJson = JSON.stringify(medicos_por_especialidad || {});

    const updateQuery = `
      UPDATE unidades_medicas SET
        especialidades_activas = $1::jsonb,
        medicos_por_especialidad = $2::jsonb
      WHERE id = $3
      RETURNING *
    `;
    const result = await db.query(updateQuery, [espJson, medJson, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unidad médica no encontrada.' });
    }

    // Actualizar unidad_medica_id de los médicos asignados en la tabla usuarios
    if (medicos_por_especialidad && typeof medicos_por_especialidad === 'object') {
      for (const [esp, medId] of Object.entries(medicos_por_especialidad)) {
        if (medId) {
          const idNum = parseInt(medId, 10);
          if (!isNaN(idNum)) {
            await db.query('UPDATE usuarios SET unidad_medica_id = $1 WHERE id = $2', [id, idNum]);
          }
        }
      }
    }

    res.json({
      message: 'Módulos y asignaciones de doctores actualizados correctamente.',
      unidad: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar módulos y doctores: ' + err.message });
  }
});

// 5. PUT /api/unidades/:id (Actualizar datos generales de sede - Exclusivo Dirección)
router.put('/:id', authenticateToken, requireRoles('DIRECCION'), async (req, res) => {
  const { id } = req.params;
  const { nombre, clave_oficial, direccion, colonia, telefono, georreferencia, consultorios, activo } = req.body;

  try {
    const updateQuery = `
      UPDATE unidades_medicas SET
        nombre = COALESCE($1, nombre),
        clave_oficial = COALESCE($2, clave_oficial),
        direccion = COALESCE($3, direccion),
        colonia = COALESCE($4, colonia),
        telefono = COALESCE($5, telefono),
        georreferencia = COALESCE($6, georreferencia),
        consultorios = COALESCE($7, consultorios),
        activo = COALESCE($8, activo)
      WHERE id = $9
      RETURNING *
    `;
    const values = [
      nombre ? nombre.trim() : null,
      clave_oficial ? clave_oficial.trim().toUpperCase() : null,
      direccion ? direccion.trim() : null,
      colonia ? colonia.trim() : null,
      telefono ? telefono.trim() : null,
      georreferencia ? georreferencia.trim() : null,
      consultorios ? parseInt(consultorios, 10) : null,
      activo !== undefined ? Boolean(activo) : null,
      id
    ];

    const result = await db.query(updateQuery, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unidad médica no encontrada.' });
    }

    res.json({
      message: 'Unidad médica actualizada exitosamente.',
      unidad: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar unidad médica: ' + err.message });
  }
});

module.exports = router;
