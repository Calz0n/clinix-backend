const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken, requireRoles, createRateLimiter } = require('../middleware/auth');
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: 'Demasiados intentos de inicio de sesión. Intente en 15 minutos.' });

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'clinix_jwt_secret_coatzacoalcos_2026';

// POST /api/auth/register (Registro de usuarios con password hasheada en Bcrypt)
router.post('/register', authenticateToken, requireRoles('DIRECCION'), async (req, res) => {
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
    // 1. Cifrar contraseña con Bcrypt (cost factor 12)
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // 2. Insertar en la base de datos
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
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado.' });
    }
    res.status(500).json({ error: 'Error al registrar usuario: ' + err.message });
  }
});

// POST /api/auth/login (Inicio de sesión con validación Bcrypt y generación de JWT)
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo electrónico y contraseña requeridos.' });
  }

  try {
    // 1. Buscar usuario activo por correo
    const query = `
      SELECT u.*, um.nombre as unidad_medica_nombre
      FROM usuarios u
      LEFT JOIN unidades_medicas um ON u.unidad_medica_id = um.id
      WHERE LOWER(u.email) = LOWER($1)
    `;
    const result = await db.query(query, [email.trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];

    if (!user.activo) {
      return res.status(403).json({ error: 'Esta cuenta de usuario se encuentra inactiva. Contacte a Dirección.' });
    }

    // 2. Validar contraseña con Bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // 3. Generar token JWT con vigencia de 8 horas (Jornada laboral - RNF-11)
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

    // 4. Actualizar fecha de último acceso
    await db.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1', [user.id]);

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: payload
    });
  } catch (err) {
    console.error('[AUTH LOGIN ERROR]', err);
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: 'El servicio de base de datos no está disponible en este momento. Por favor contacte al administrador.'
      });
    }
    res.status(500).json({ error: 'No fue posible iniciar sesión en este momento. Por favor intente más tarde.' });
  }
});

// GET /api/auth/me (Obtener perfil del usuario autenticado)
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    user: req.user
  });
});

// GET /api/auth/admin-only (Ejemplo de ruta protegida por rol de Dirección)
router.get('/admin-only', authenticateToken, requireRoles('DIRECCION'), (req, res) => {
  res.json({
    message: 'Bienvenido al panel administrativo de Dirección de Salud Pública.',
    user: req.user
  });
});

// =========================================================================
// RUTAS PÚBLICAS DE ACTIVACIÓN Y RECUPERACIÓN (NOM-004-SSA3-2012 / LGPDPPSO)
// =========================================================================
const medicosController = require('../controllers/medicosController');

// GET /api/auth/validar-token-activacion?token=...
router.get('/validar-token-activacion', medicosController.validarToken);

// POST /api/auth/activar-cuenta (Recibe token y nueva contraseña)
router.post('/activar-cuenta', medicosController.activarCuenta);

// POST /api/auth/recuperar-password y /api/auth/olvide-password (Solicitud de recuperación por correo)
router.post('/recuperar-password', medicosController.solicitarRecuperacionPassword);
router.post('/olvide-password', medicosController.solicitarRecuperacionPassword);

// POST /api/auth/restablecer-password (Establecer nueva contraseña tras olvido)
router.post('/restablecer-password', medicosController.activarCuenta);

module.exports = router;
