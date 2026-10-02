const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

const ROLES_VALIDOS = [
  { rol: 'RECEPCION', descripcion: 'Recepción y Registro de Pacientes' },
  { rol: 'ENFERMERIA', descripcion: 'Enfermería y Triaje' },
  { rol: 'MEDICO_GENERAL', descripcion: 'Medicina General' },
  { rol: 'ODONTOLOGO', descripcion: 'Odontología' },
  { rol: 'NUTRIOLOGO', descripcion: 'Nutrición Clínica' },
  { rol: 'PSICOLOGO', descripcion: 'Psicología y Salud Mental' },
  { rol: 'DIRECCION', descripcion: 'Dirección y Supervisión de Unidad' }
];

// 1. GET /api/usuarios/roles/catalogo (Público autenticado para selects en frontend)
router.get('/roles/catalogo', authenticateToken, (req, res) => {
  res.json(ROLES_VALIDOS);
});

// Rutas administrativas protegidas para DIRECCION
router.use(authenticateToken);
router.use(requireRoles('DIRECCION'));

// 2. GET /api/usuarios (Listado con filtros y búsqueda)
router.get('/', async (req, res) => {
  const { rol, activo, q } = req.query;

  try {
    let query = `
      SELECT u.id, u.unidad_medica_id, u.nombre, u.apellidos, u.email,
             u.rol, u.cedula_profesional, u.activo, u.ultimo_acceso,
             um.nombre as unidad_nombre
      FROM usuarios u
      JOIN unidades_medicas um ON um.id = u.unidad_medica_id
      WHERE 1=1
    `;
    const params = [];

    if (rol) {
      params.push(rol.toUpperCase());
      query += ` AND u.rol = $${params.length}`;
    }

    if (activo !== undefined) {
      params.push(activo === 'true' || activo === true);
      query += ` AND u.activo = $${params.length}`;
    }

    if (q && q.trim() !== '') {
      params.push(`%${q.trim()}%`);
      query += ` AND (u.nombre || ' ' || u.apellidos ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.cedula_profesional ILIKE $${params.length})`;
    }

    query += ` ORDER BY u.activo DESC, u.nombre ASC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar personal: ' + err.message });
  }
});

// 3. GET /api/usuarios/:id (Detalle de un usuario)
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.unidad_medica_id, u.nombre, u.apellidos, u.email,
             u.rol, u.cedula_profesional, u.activo, u.ultimo_acceso,
             um.nombre as unidad_nombre
      FROM usuarios u
      JOIN unidades_medicas um ON um.id = u.unidad_medica_id
      WHERE u.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST /api/usuarios (Alta de nuevo personal)
router.post('/', async (req, res) => {
  const {
    nombre,
    apellidos,
    email,
    password,
    rol,
    cedula_profesional,
    unidad_medica_id = 1
  } = req.body;

  if (!nombre || !apellidos || !email || !password || !rol) {
    return res.status(400).json({ error: 'nombre, apellidos, email, password y rol son campos obligatorios.' });
  }

  const rolValido = ROLES_VALIDOS.some(r => r.rol === rol.toUpperCase());
  if (!rolValido) {
    return res.status(400).json({
      error: `Rol inválido: "${rol}". Valores permitidos: ${ROLES_VALIDOS.map(r => r.rol).join(', ')}`
    });
  }

  try {
    const emailNormalizado = email.toLowerCase().trim();
    const existe = await db.query('SELECT id FROM usuarios WHERE email = $1', [emailNormalizado]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const insertQuery = `
      INSERT INTO usuarios (
        unidad_medica_id, nombre, apellidos, email, password_hash, rol, cedula_profesional, activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING id, unidad_medica_id, nombre, apellidos, email, rol, cedula_profesional, activo, ultimo_acceso
    `;
    const result = await db.query(insertQuery, [
      unidad_medica_id,
      nombre.trim(),
      apellidos.trim(),
      emailNormalizado,
      password_hash,
      rol.toUpperCase(),
      cedula_profesional ? cedula_profesional.trim() : null
    ]);

    res.status(201).json({
      mensaje: 'Profesional de la salud registrado exitosamente.',
      usuario: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar usuario: ' + err.message });
  }
});

// 5. PUT /api/usuarios/:id (Actualizar datos del profesional)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, apellidos, rol, cedula_profesional, password, unidad_medica_id } = req.body;

  try {
    const userCheck = await db.query('SELECT id, password_hash FROM usuarios WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    let nuevoHash = userCheck.rows[0].password_hash;
    if (password && password.trim() !== '') {
      nuevoHash = await bcrypt.hash(password, 10);
    }

    const updateQuery = `
      UPDATE usuarios
      SET nombre = COALESCE($1, nombre),
          apellidos = COALESCE($2, apellidos),
          rol = COALESCE($3, rol),
          cedula_profesional = COALESCE($4, cedula_profesional),
          password_hash = $5,
          unidad_medica_id = COALESCE($6, unidad_medica_id)
      WHERE id = $7
      RETURNING id, unidad_medica_id, nombre, apellidos, email, rol, cedula_profesional, activo, ultimo_acceso
    `;

    const result = await db.query(updateQuery, [
      nombre ? nombre.trim() : null,
      apellidos ? apellidos.trim() : null,
      rol ? rol.toUpperCase() : null,
      cedula_profesional !== undefined ? cedula_profesional : null,
      nuevoHash,
      unidad_medica_id || null,
      id
    ]);

    res.json({
      mensaje: 'Datos del profesional actualizados exitosamente.',
      usuario: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario: ' + err.message });
  }
});

// 6. PATCH /api/usuarios/:id/estado (Activar / Desactivar personal)
router.patch('/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  if (activo === undefined) {
    return res.status(400).json({ error: 'El campo booleano "activo" es obligatorio.' });
  }

  try {
    const result = await db.query(`
      UPDATE usuarios
      SET activo = $1
      WHERE id = $2
      RETURNING id, nombre, apellidos, email, rol, activo
    `, [Boolean(activo), id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const u = result.rows[0];
    res.json({
      mensaje: `Usuario ${u.nombre} ${u.apellidos} ${u.activo ? 'activado' : 'desactivado'} exitosamente.`,
      usuario: u
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
