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
    const pacienteRes = await db.query('SELECT id, nombres, apellido_paterno FROM pacientes WHERE id = $1', [paciente_id]);
    if (pacienteRes.rows.length === 0) {
      return res.status(404).json({ error: 'El paciente especificado no existe.' });
    }

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

// 2. GET /api/atenciones/sala-espera (Lista de espera en tiempo real)
router.get('/sala-espera', async (req, res) => {
  const { estado } = req.query;

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

// 3. POST /api/atenciones/tratamiento-cruzado (Generar interconsulta interna)
router.post('/tratamiento-cruzado', requireRoles('MEDICO_GENERAL', 'ODONTOLOGO', 'NUTRIOLOGO', 'PSICOLOGO', 'DIRECCION'), async (req, res) => {
  const { atencion_origen_id, area_origen, area_destino, prioridad = 'NORMAL', motivo_derivacion } = req.body;

  if (!atencion_origen_id || !area_origen || !area_destino || !motivo_derivacion) {
    return res.status(400).json({
      error: 'Campos requeridos incompletos: atencion_origen_id, area_origen, area_destino y motivo_derivacion son obligatorios.'
    });
  }

  const areasValidas = ['MEDICINA_GENERAL', 'ODONTOLOGIA', 'NUTRICION', 'PSICOLOGIA'];
  if (!areasValidas.includes(area_destino.toUpperCase())) {
    return res.status(400).json({ error: `Área de destino inválida. Valores permitidos: ${areasValidas.join(', ')}` });
  }

  if (area_origen.toUpperCase() === area_destino.toUpperCase()) {
    return res.status(400).json({ error: 'El área de origen y de destino no pueden ser iguales en un tratamiento cruzado.' });
  }

  try {
    const atencionCheck = await db.query('SELECT id, paciente_id FROM atenciones_clinicas WHERE id = $1', [atencion_origen_id]);
    if (atencionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'La atención clínica de origen no existe.' });
    }

    const prioridadNorm = ['NORMAL', 'URGENTE'].includes((prioridad || '').toUpperCase()) ? prioridad.toUpperCase() : 'NORMAL';

    const insertQuery = `
      INSERT INTO tratamientos_cruzados (atencion_origen_id, area_origen, area_destino, prioridad, motivo_derivacion, estado)
      VALUES ($1, $2, $3, $4, $5, 'PENDIENTE')
      RETURNING id, atencion_origen_id, area_origen, area_destino, prioridad, motivo_derivacion, estado, fecha_hora_derivacion
    `;
    const result = await db.query(insertQuery, [
      atencion_origen_id,
      area_origen.toUpperCase(),
      area_destino.toUpperCase(),
      prioridadNorm,
      motivo_derivacion
    ]);

    res.status(201).json({
      mensaje: 'Interconsulta generada exitosamente.',
      tratamiento_cruzado: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar tratamiento cruzado: ' + err.message });
  }
});

// 4. GET /api/atenciones/tratamientos-cruzados (Bandeja de interconsultas con filtro y prioridad)
router.get('/tratamientos-cruzados', async (req, res) => {
  const { area_destino, estado } = req.query;

  try {
    let query = `
      SELECT tc.id as tratamiento_cruzado_id, tc.atencion_origen_id, tc.area_origen, tc.area_destino,
             tc.prioridad, tc.motivo_derivacion, tc.estado, tc.fecha_hora_derivacion,
             p.id as paciente_id, p.numero_expediente, p.nombres, p.apellido_paterno, p.apellido_materno,
             p.fecha_nacimiento, p.sexo
      FROM tratamientos_cruzados tc
      JOIN atenciones_clinicas ac ON ac.id = tc.atencion_origen_id
      JOIN pacientes p ON p.id = ac.paciente_id
      WHERE 1=1
    `;
    const params = [];

    if (area_destino) {
      params.push(area_destino.toUpperCase());
      query += ` AND tc.area_destino = $${params.length}`;
    }

    if (estado) {
      params.push(estado.toUpperCase());
      query += ` AND tc.estado = $${params.length}`;
    }

    // Ordenar: primero los URGENTES y luego por antigüedad
    query += ` ORDER BY CASE WHEN tc.prioridad = 'URGENTE' THEN 1 ELSE 2 END, tc.fecha_hora_derivacion ASC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar tratamientos cruzados: ' + err.message });
  }
});

// 5. PATCH /api/atenciones/tratamientos-cruzados/:id/estado (Atender o cancelar derivación)
router.patch('/tratamientos-cruzados/:id/estado', requireRoles('MEDICO_GENERAL', 'ODONTOLOGO', 'NUTRIOLOGO', 'PSICOLOGO', 'DIRECCION'), async (req, res) => {
  const { id } = req.params;
  const { nuevo_estado } = req.body;

  const estadosValidos = ['PENDIENTE', 'ATENDIDO', 'CANCELADO'];
  if (!nuevo_estado || !estadosValidos.includes(nuevo_estado.toUpperCase())) {
    return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}` });
  }

  try {
    const updateRes = await db.query(`
      UPDATE tratamientos_cruzados
      SET estado = $1
      WHERE id = $2
      RETURNING *
    `, [nuevo_estado.toUpperCase(), id]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Tratamiento cruzado no encontrado.' });
    }

    res.json({
      mensaje: `Tratamiento cruzado actualizado a ${nuevo_estado.toUpperCase()}`,
      tratamiento_cruzado: updateRes.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado del tratamiento cruzado: ' + err.message });
  }
});

module.exports = router;
