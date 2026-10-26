const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { enviarCorreoInvitacion } = require('../services/emailService');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

const ROLES_VALIDOS = [
  'RECEPCION', 'ENFERMERIA', 'MEDICO_GENERAL',
  'ODONTOLOGO', 'NUTRIOLOGO', 'PSICOLOGO', 'DIRECCION'
];

// 1. GET /api/usuarios (Listar personal clínico y administrativo)
router.get('/', async (req, res) => {
  const { rol, activo, unidad_id, q } = req.query;

  try {
    let query = `
      SELECT u.id, u.nombre, u.apellidos,
             (u.nombre || ' ' || u.apellidos) as nombre_completo,
             u.email, u.rol, u.cedula_profesional, u.activo, u.ultimo_acceso,
             u.unidad_medica_id,
             COALESCE(um.nombre, 'Dirección de Salud Pública Municipal - Sede Central') as unidad_medica_nombre
      FROM usuarios u
      LEFT JOIN unidades_medicas um ON u.unidad_medica_id = um.id
      WHERE 1=1
    `;
    const params = [];

    if (rol) {
      params.push(rol.toUpperCase().trim());
      query += ` AND u.rol = $${params.length}`;
    }

    if (activo !== undefined && activo !== null && activo !== '') {
      params.push(activo === 'true' || activo === true || activo === '1');
      query += ` AND u.activo = $${params.length}`;
    }

    if (unidad_id) {
      params.push(parseInt(unidad_id, 10));
      query += ` AND u.unidad_medica_id = $${params.length}`;
    }

    if (q && q.trim() !== '') {
      params.push(`%${q.trim()}%`);
      query += ` AND (u.nombre ILIKE $${params.length} OR u.apellidos ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.cedula_profesional ILIKE $${params.length})`;
    }

    query += ` ORDER BY u.activo DESC, u.nombre ASC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar catálogo de personal: ' + err.message });
  }
});

// 2. GET /api/usuarios/:id (Detalle de un usuario/profesional específico)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT u.id, u.nombre, u.apellidos,
             (u.nombre || ' ' || u.apellidos) as nombre_completo,
             u.email, u.rol, u.cedula_profesional, u.activo, u.ultimo_acceso,
             u.unidad_medica_id,
             COALESCE(um.nombre, 'Dirección de Salud Pública Municipal - Sede Central') as unidad_medica_nombre
      FROM usuarios u
      LEFT JOIN unidades_medicas um ON u.unidad_medica_id = um.id
      WHERE u.id = $1
    `;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuario: ' + err.message });
  }
});

// 3. POST /api/usuarios (Crear / Dar de alta nuevo personal - Exclusivo Dirección)
router.post('/', requireRoles('DIRECCION'), async (req, res) => {
  const {
    unidad_medica_id,
    nombre,
    apellidos,
    email,
    password,
    rol,
    cedula_profesional
  } = req.body;

  if (!nombre || !apellidos || !email || !rol) {
    return res.status(400).json({ error: 'Nombre, apellidos, email y rol son obligatorios.' });
  }

  const rolLimpio = rol.toUpperCase().trim();
  if (!ROLES_VALIDOS.includes(rolLimpio)) {
    return res.status(400).json({
      error: `Rol inválido: "${rol}". Valores autorizados: ${ROLES_VALIDOS.join(', ')}`
    });
  }

  const passFinal = password ? password.trim() : null;
  const unidadFinal = unidad_medica_id ? parseInt(unidad_medica_id, 10) : 1;

  try {
    const saltRounds = 12;
    let password_hash = null;
    let activo = false;
    if (passFinal) {
      password_hash = await bcrypt.hash(passFinal, saltRounds);
      activo = true;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiracion = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const insertQuery = `
      INSERT INTO usuarios (
        unidad_medica_id, nombre, apellidos, email, password_hash, rol,
        cedula_profesional, activo, token_activacion, token_expiracion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, nombre, apellidos, email, rol, cedula_profesional, activo, unidad_medica_id
    `;
    const values = [
      unidadFinal,
      nombre.trim(),
      apellidos.trim(),
      email.toLowerCase().trim(),
      password_hash,
      rolLimpio,
      cedula_profesional ? cedula_profesional.trim() : null,
      activo,
      token,
      expiracion
    ];
    const result = await db.query(insertQuery, values);
    const usuarioCreado = result.rows[0];

    // Obtener nombre de clínica
    let nombreClinica = 'Dirección de Salud Pública Municipal - Sede Central';
    try {
      const qUni = await db.query('SELECT nombre FROM unidades_medicas WHERE id = $1', [unidadFinal]);
      if (qUni.rows.length > 0) nombreClinica = qUni.rows[0].nombre;
    } catch (_) {}

    // Despachar correo de invitación con Nodemailer
    let emailResult = null;
    try {
      emailResult = await enviarCorreoInvitacion({
        nombre: `${usuarioCreado.nombre} ${usuarioCreado.apellidos}`.trim(),
        email: usuarioCreado.email,
        especialidad: rolLimpio,
        clinica: nombreClinica,
        token: token,
        baseUrl: req.headers.origin
      });
    } catch (mailErr) {
      console.warn('[AVISO] Correo no enviado:', mailErr.message);
    }

    res.status(201).json({
      message: 'Personal clínico registrado exitosamente.',
      usuario: {
        ...usuarioCreado,
        nombre_completo: `${usuarioCreado.nombre} ${usuarioCreado.apellidos}`.trim()
      },
      urlActivacion: emailResult ? emailResult.url : null
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado para otro usuario.' });
    }
    res.status(500).json({ error: 'Error al registrar usuario: ' + err.message });
  }
});

// 4. PUT /api/usuarios/:id (Modificar datos de un profesional - Exclusivo Dirección)
router.put('/:id', requireRoles('DIRECCION'), async (req, res) => {
  const { id } = req.params;
  const {
    unidad_medica_id,
    nombre,
    apellidos,
    email,
    password,
    rol,
    cedula_profesional,
    activo,
    turno
  } = req.body;

  try {
    const userExist = await db.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (userExist.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const current = userExist.rows[0];
    let newHash = current.password_hash;
    if (password && password.trim() !== '') {
      newHash = await bcrypt.hash(password.trim(), 12);
    }

    let rolFinal = current.rol;
    if (rol) {
      const rolUpper = rol.toUpperCase().trim();
      if (!ROLES_VALIDOS.includes(rolUpper)) {
        return res.status(400).json({ error: `Rol inválido. Valores autorizados: ${ROLES_VALIDOS.join(', ')}` });
      }
      rolFinal = rolUpper;
    }

    const updateQuery = `
      UPDATE usuarios SET
        nombre = COALESCE($1, nombre),
        apellidos = COALESCE($2, apellidos),
        email = COALESCE($3, email),
        password_hash = $4,
        rol = $5,
        cedula_profesional = $6,
        unidad_medica_id = COALESCE($7, unidad_medica_id),
        activo = COALESCE($8, activo),
        turno = COALESCE($9, turno)
      WHERE id = $10
      RETURNING id, nombre, apellidos, email, rol, cedula_profesional, activo, unidad_medica_id, turno
    `;
    const values = [
      nombre ? nombre.trim() : null,
      apellidos ? apellidos.trim() : null,
      email ? email.toLowerCase().trim() : null,
      newHash,
      rolFinal,
      cedula_profesional !== undefined ? (cedula_profesional ? cedula_profesional.trim() : null) : current.cedula_profesional,
      unidad_medica_id ? parseInt(unidad_medica_id, 10) : null,
      activo !== undefined ? Boolean(activo) : null,
      turno !== undefined ? (turno ? turno.trim() : null) : current.turno,
      id
    ];

    const result = await db.query(updateQuery, values);

    res.json({
      message: 'Datos del personal actualizados exitosamente.',
      usuario: {
        ...result.rows[0],
        nombre_completo: `${result.rows[0].nombre} ${result.rows[0].apellidos}`
      }
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El correo electrónico ya pertenece a otro usuario registrado.' });
    }
    res.status(500).json({ error: 'Error al actualizar usuario: ' + err.message });
  }
});

// 5. PATCH /api/usuarios/:id/status (Pausar o activar cuenta médica)
const patchStatusHandler = async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  try {
    const userExist = await db.query('SELECT id, activo, nombre, apellidos FROM usuarios WHERE id = $1', [id]);
    if (userExist.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const nuevoEstado = (activo !== undefined && activo !== null)
      ? Boolean(activo)
      : !userExist.rows[0].activo;

    await db.query('UPDATE usuarios SET activo = $1 WHERE id = $2', [nuevoEstado, id]);

    res.json({
      message: `Cuenta del profesional ${nuevoEstado ? 'activada' : 'pausada / suspendida'} exitosamente.`,
      id: parseInt(id, 10),
      activo: nuevoEstado,
      nombre_completo: `${userExist.rows[0].nombre} ${userExist.rows[0].apellidos}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar estado de cuenta: ' + err.message });
  }
};

router.patch('/:id/status', requireRoles('DIRECCION'), patchStatusHandler);
router.patch('/:id/estado', requireRoles('DIRECCION'), patchStatusHandler);

// 6. DELETE /api/usuarios/:id (Baja lógica del profesional)
router.delete('/:id', requireRoles('DIRECCION'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      'UPDATE usuarios SET activo = false WHERE id = $1 RETURNING id, nombre, apellidos, activo',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({
      message: 'Personal dado de baja correctamente (cuenta inhabilitada conforme a NOM-004).',
      usuario: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al dar de baja usuario: ' + err.message });
  }
});

// 7. POST /api/usuarios/:id/restablecer-password (Envío de correo de restablecimiento por Dirección)
const medicosController = require('../controllers/medicosController');
router.post('/:id/restablecer-password', requireRoles('DIRECCION'), medicosController.adminEnviarRestablecimiento);

module.exports = router;
