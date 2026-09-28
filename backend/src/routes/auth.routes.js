const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'clinix_jwt_secret_coatzacoalcos_2026';

// POST /api/auth/register (Alta de personal con password Bcrypt)
router.post('/register', async (req, res) => {
  const {
    unidad_medica_id,
    nombre,
    apellidos,
    email,
    password,
    rol,
    cedula_profesional
  } = req.body;

  if (!unidad_medica_id || !nombre || !apellidos || !email || !password || !rol) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben ser proporcionados.' });
  }

  const validRoles = [
    'RECEPCION', 'ENFERMERIA', 'MEDICO_GENERAL',
    'ODONTOLOGO', 'NUTRIOLOGO', 'PSICOLOGO', 'DIRECCION'
  ];

  if (!validRoles.includes(rol)) {
    return res.status(400).json({ error: `Rol inválido. Roles permitidos: ${validRoles.join(', ')}` });
  }

  try {
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const query = `
      INSERT INTO usuarios (unidad_medica_id, nombre, apellidos, email, password_hash, rol, cedula_profesional, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING id, nombre, apellidos, email, rol, cedula_profesional, activo
    `;
    const values = [unidad_medica_id, nombre, apellidos, email.toLowerCase().trim(), password_hash, rol, cedula_profesional || null];
    const result = await db.query(query, values);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: result.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado.' });
    }
    res.status(500).json({ error: 'Error al registrar usuario: ' + err.message });
  }
});

// POST /api/auth/login (Inicio de sesión y entrega de JWT)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
  }

  try {
    const query = `
      SELECT u.id, u.unidad_medica_id, u.nombre, u.apellidos, u.email, u.password_hash, u.rol, u.cedula_profesional, u.activo,
             m.nombre as unidad_medica_nombre
      FROM usuarios u
      JOIN unidades_medicas m ON u.unidad_medica_id = m.id
      WHERE u.email = $1
    `;
    const result = await db.query(query, [email.toLowerCase().trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];

    if (!user.activo) {
      return res.status(403).json({ error: 'Esta cuenta se encuentra inactiva.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const payload = {
      id: user.id,
      nombre: user.nombre,
      apellidos: user.apellidos,
      email: user.email,
      rol: user.rol,
      unidad_medica_id: user.unidad_medica_id,
      unidad_medica_nombre: user.unidad_medica_nombre
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    await db.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1', [user.id]);

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: payload
    });
  } catch (err) {
    res.status(500).json({ error: 'Error durante el inicio de sesión: ' + err.message });
  }
});

// GET /api/auth/me (Datos de la sesión activa)
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/direccion-only (Prueba de control de acceso RBAC)
router.get('/direccion-only', authenticateToken, requireRoles('DIRECCION'), (req, res) => {
  res.json({
    message: 'Bienvenido al panel exclusivo de Dirección de Salud Pública.',
    user: req.user
  });
});

module.exports = router;
