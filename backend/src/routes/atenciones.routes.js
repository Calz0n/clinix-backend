const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// 1. POST /api/atenciones (Registrar visita de paciente existente -> Subsecuente a Triaje)
router.post('/', requireRoles('RECEPCION', 'DIRECCION'), async (req, res) => {
  const { paciente_id } = req.body;

  if (!paciente_id) {
    return res.status(400).json({ error: 'El ID del paciente es obligatorio.' });
  }

  const unidadMedicaId = req.user.unidad_medica_id || 1;
  const usuarioRecepcionId = req.user.id;

  try {
    // Verificar que el paciente exista
    const pacienteRes = await db.query('SELECT id, nombres, apellido_paterno FROM pacientes WHERE id = $1', [paciente_id]);
    if (pacienteRes.rows.length === 0) {
      return res.status(404).json({ error: 'El paciente especificado no existe.' });
    }

    // Verificar si el paciente ya tiene una atención activa en el día de hoy (que no esté FINALIZADA)
    const activaRes = await db.query(`
      SELECT id, estado, fecha_hora_ingreso 
      FROM atenciones_clinicas 
      WHERE paciente_id = $1 AND estado != 'FINALIZADA' AND DATE(fecha_hora_ingreso) = CURRENT_DATE
    `, [paciente_id]);

    if (activaRes.rows.length > 0) {
      return res.status(400).json({
        error: `El paciente ya cuenta con una atención activa en curso hoy (Estado actual: ${activaRes.rows[0].estado}).`
      });
    }

    // Insertar nueva visita como subsecuente
    const insertQuery = `
      INSERT INTO atenciones_clinicas (paciente_id, unidad_medica_id, usuario_recepcion_id, tipo_atencion, estado)
      VALUES ($1, $2, $3, 'SUBSECUENTE', 'TRIAJE')
      RETURNING *
    `;
    const result = await db.query(insertQuery, [paciente_id, unidadMedicaId, usuarioRecepcionId]);

    res.status(201).json({
      message: 'Visita subsecuente registrada y canalizada a Triaje',
      atencion: result.rows[0],
      paciente: pacienteRes.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar atención: ' + err.message });
  }
});

// 2. GET /api/atenciones/sala-espera (Lista de pacientes en sala de espera en tiempo real)
router.get('/sala-espera', async (req, res) => {
  const { estado } = req.query; // Opcional: filtrar por TRIAJE o EN_CONSULTA

  try {
    let query = `
      SELECT a.id as atencion_id, a.fecha_hora_ingreso, a.tipo_atencion, a.estado,
             p.id as paciente_id, p.numero_expediente, p.curp, p.nombres, p.apellido_paterno, p.apellido_materno,
             p.fecha_nacimiento, p.sexo,
             u.nombre || ' ' || u.apellidos as recepcionista_nombre
      FROM atenciones_clinicas a
      JOIN pacientes p ON a.paciente_id = p.id
      JOIN usuarios u ON a.usuario_recepcion_id = u.id
      WHERE a.estado != 'FINALIZADA' AND DATE(a.fecha_hora_ingreso) = CURRENT_DATE
    `;
    const params = [];

    if (estado) {
      query += ` AND a.estado = $1`;
      params.push(estado.toUpperCase());
    }

    query += ` ORDER BY a.fecha_hora_ingreso ASC`;

    const result = await db.query(query, params);

    // Calcular edad para cada paciente en espera
    const hoy = new Date();
    const lista = result.rows.map(row => {
      const nac = new Date(row.fecha_nacimiento);
      let edad = hoy.getFullYear() - nac.getFullYear();
      if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
        edad--;
      }
      return {
        ...row,
        edad,
        es_menor: edad < 18
      };
    });

    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar sala de espera: ' + err.message });
  }
});

module.exports = router;
