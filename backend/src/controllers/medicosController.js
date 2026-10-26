// src/controllers/medicosController.js
// Controlador para alta de personal médico, activación de cuentas y restablecimiento de contraseña
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { enviarCorreoInvitacion, enviarCorreoRecuperacion } = require('../services/emailService');

const HORAS_VIGENCIA = 48;

function obtenerUrlOrigen(req) {
  if (req.body && req.body.frontendUrl) return req.body.frontendUrl;
  if (req.headers && req.headers.origin) return req.headers.origin;
  if (req.headers && req.headers.referer) {
    try {
      const u = new URL(req.headers.referer);
      return u.origin;
    } catch (_) {}
  }
  return process.env.FRONTEND_URL || 'http://localhost:3000';
}

const JWT_SECRET = process.env.JWT_SECRET || 'clinix_jwt_secret_coatzacoalcos_2026';
const COOLDOWN_MINUTOS = 5;
const MAX_SOLICITUDES_IP = 5;
const VENTANA_IP_MINUTOS = 15;
const ipRecoveryAttempts = new Map();
const _cleanupInterval = setInterval(() => {
  const ahora = Date.now();
  for (const [ip, intentos] of ipRecoveryAttempts.entries()) {
    const vigentes = intentos.filter(t => (ahora - t) < (VENTANA_IP_MINUTOS * 60 * 1000));
    if (vigentes.length === 0) ipRecoveryAttempts.delete(ip);
    else ipRecoveryAttempts.set(ip, vigentes);
  }
}, 5 * 60 * 1000);
if (_cleanupInterval.unref) _cleanupInterval.unref();


const ROL_MAP = {
  'MEDICO GENERAL': 'MEDICO_GENERAL',
  'MEDICINA GENERAL': 'MEDICO_GENERAL',
  'MEDICINA': 'MEDICO_GENERAL',
  'MEDICO_GENERAL': 'MEDICO_GENERAL',
  'ODONTOLOGÍA': 'ODONTOLOGO',
  'ODONTOLOGIA': 'ODONTOLOGO',
  'ODONTOLOGO': 'ODONTOLOGO',
  'NUTRICIÓN': 'NUTRIOLOGO',
  'NUTRICION': 'NUTRIOLOGO',
  'NUTRIOLOGO': 'NUTRIOLOGO',
  'PSICOLOGÍA': 'PSICOLOGO',
  'PSICOLOGIA': 'PSICOLOGO',
  'PSICOLOGO': 'PSICOLOGO',
  'ENFERMERÍA': 'ENFERMERIA',
  'ENFERMERIA': 'ENFERMERIA',
  'RECEPCIÓN': 'RECEPCION',
  'RECEPCION': 'RECEPCION',
  'DIRECCIÓN': 'DIRECCION',
  'DIRECCION': 'DIRECCION'
};

/**
 * 1. POST /api/admin/medicos
 * Da de alta a un médico/profesional sin contraseña y despacha el correo vía Nodemailer
 */
async function crearMedico(req, res) {
  const {
    nombre,
    apellidos,
    email,
    especialidad,
    rol,
    cedula,
    cedula_profesional,
    turno,
    clinicaAsignada,
    unidad_medica_id
  } = req.body;

  if (!nombre || !email) {
    return res.status(400).json({ error: 'Nombre y correo electrónico son obligatorios.' });
  }

  const emailLimpio = email.toLowerCase().trim();
  const espRaw = (especialidad || rol || 'MEDICINA GENERAL').toUpperCase().trim();
  const rolFinal = ROL_MAP[espRaw] || 'MEDICO_GENERAL';
  const cedulaFinal = (cedula || cedula_profesional || '').trim() || null;
  const turnoFinal = turno ? turno.trim() : 'Matutino';

  try {
    // 1. Validar que el correo no esté registrado previamente
    const existe = await db.query('SELECT id FROM usuarios WHERE email = $1', [emailLimpio]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado para otro usuario.' });
    }

    // 2. Determinar la unidad médica (por ID o por nombre asignado)
    let unidadId = unidad_medica_id ? parseInt(unidad_medica_id, 10) : 1;
    let nombreClinica = 'Dirección de Salud Pública Municipal - Sede Central';

    if (clinicaAsignada && !unidad_medica_id) {
      const qUni = await db.query(
        'SELECT id, nombre FROM unidades_medicas WHERE nombre ILIKE $1 LIMIT 1',
        [`%${clinicaAsignada.trim()}%`]
      );
      if (qUni.rows.length > 0) {
        unidadId = qUni.rows[0].id;
        nombreClinica = qUni.rows[0].nombre;
      } else {
        nombreClinica = clinicaAsignada.trim();
      }
    } else if (unidad_medica_id) {
      const qUni = await db.query('SELECT nombre FROM unidades_medicas WHERE id = $1', [unidadId]);
      if (qUni.rows.length > 0) {
        nombreClinica = qUni.rows[0].nombre;
      }
    }

    // 3. Generar token criptográfico único con vigencia de 48 horas
    const token = crypto.randomBytes(32).toString('hex');
    const expiracion = new Date(Date.now() + HORAS_VIGENCIA * 60 * 60 * 1000);

    // 4. Insertar el profesional en la base de datos (activo = false, password_hash = NULL)
    const insertQuery = `
      INSERT INTO usuarios (
        unidad_medica_id, nombre, apellidos, email, password_hash, rol,
        cedula_profesional, activo, token_activacion, token_expiracion, turno
      )
      VALUES ($1, $2, $3, $4, NULL, $5, $6, false, $7, $8, $9)
      RETURNING id, nombre, apellidos, email, rol, cedula_profesional, activo, unidad_medica_id
    `;
    const insertValues = [
      unidadId,
      nombre.trim(),
      (apellidos || '').trim(),
      emailLimpio,
      rolFinal,
      cedulaFinal,
      token,
      expiracion,
      turnoFinal
    ];
    const result = await db.query(insertQuery, insertValues);
    const usuarioCreado = result.rows[0];

    // 5. Despachar correo de invitación vía Nodemailer
    const emailResult = await enviarCorreoInvitacion({
      nombre: `${usuarioCreado.nombre} ${usuarioCreado.apellidos}`.trim(),
      email: usuarioCreado.email,
      especialidad: especialidad || rolFinal,
      clinica: nombreClinica,
      token: token,
      baseUrl: req.headers.origin
    });

    return res.status(201).json({
      mensaje: 'Personal médico registrado exitosamente. Se ha enviado el correo de activación.',
      usuario: {
        ...usuarioCreado,
        nombre_completo: `${usuarioCreado.nombre} ${usuarioCreado.apellidos}`.trim(),
        clinica: nombreClinica
      },
      urlActivacion: emailResult.url
    });
  } catch (err) {
    console.error('[CREAR MEDICO ERROR]', err);
    return res.status(500).json({ error: 'Error al registrar médico: ' + err.message });
  }
}

/**
 * 2. POST /api/admin/medicos/:id/reenviar-invitacion
 * Genera un nuevo token de 48 horas y reenvía el correo vía Nodemailer
 */
async function reenviarInvitacion(req, res) {
  const { id } = req.params;

  try {
    const qUser = await db.query(`
      SELECT u.id, u.nombre, u.apellidos, u.email, u.rol, u.activo, u.unidad_medica_id,
             COALESCE(um.nombre, 'Dirección de Salud Pública Municipal - Sede Central') as clinica_nombre
      FROM usuarios u
      LEFT JOIN unidades_medicas um ON u.unidad_medica_id = um.id
      WHERE u.id = $1
    `, [id]);

    if (qUser.rows.length === 0) {
      return res.status(404).json({ error: 'Profesional de salud no encontrado.' });
    }

    const user = qUser.rows[0];
    if (user.activo) {
      return res.status(400).json({ error: 'La cuenta del usuario ya se encuentra activa.' });
    }

    // Generar nuevo token seguro y extender 48 horas
    const nuevoToken = crypto.randomBytes(32).toString('hex');
    const nuevaExpiracion = new Date(Date.now() + HORAS_VIGENCIA * 60 * 60 * 1000);

    await db.query(`
      UPDATE usuarios
      SET token_activacion = $1, token_expiracion = $2
      WHERE id = $3
    `, [nuevoToken, nuevaExpiracion, id]);

    // Despachar nuevo correo con Nodemailer
    const emailResult = await enviarCorreoInvitacion({
      nombre: `${user.nombre} ${user.apellidos}`.trim(),
      email: user.email,
      especialidad: user.rol,
      clinica: user.clinica_nombre,
      token: nuevoToken,
      baseUrl: req.headers.origin
    });

    return res.json({
      mensaje: 'Invitación reenviada exitosamente.',
      urlActivacion: emailResult.url
    });
  } catch (err) {
    console.error('[REENVIAR INVITACION ERROR]', err);
    return res.status(500).json({ error: 'Error al reenviar invitación: ' + err.message });
  }
}

/**
 * 3. GET /api/auth/validar-token-activacion?token=...
 * Valida si el token existe y aún no ha expirado
 */
async function validarToken(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token no proporcionado.' });
  }

  try {
    const q = await db.query(`
      SELECT id, nombre, apellidos, email, rol, activo, token_expiracion
      FROM usuarios
      WHERE token_activacion = $1
    `, [token]);

    if (q.rows.length > 0) {
      const user = q.rows[0];
      if (user.token_expiracion && new Date() > new Date(user.token_expiracion)) {
        return res.status(410).json({
          error: 'El enlace ha expirado. Solicite un nuevo enlace a la administración.'
        });
      }
      return res.json({
        valido: true,
        email: user.email,
        nombre: `${user.nombre} ${user.apellidos}`.trim(),
        rol: user.rol
      });
    }

    // Verificación de token formato {id}-{timestamp}
    if (token.includes('-')) {
      const partes = token.split('-');
      const uId = parseInt(partes[0], 10);
      const ts = parseInt(partes[1], 10);
      if (!isNaN(uId) && !isNaN(ts)) {
        const horas = (Date.now() - ts) / (1000 * 60 * 60);
        if (horas <= 48) {
          const qFallback = await db.query(
            'SELECT id, nombre, apellidos, email, rol FROM usuarios WHERE id = $1',
            [uId]
          );
          if (qFallback.rows.length > 0) {
            const u = qFallback.rows[0];
            return res.json({
              valido: true,
              email: u.email,
              nombre: `${u.nombre} ${u.apellidos}`.trim(),
              rol: u.rol
            });
          }
        }
      }
    }

    return res.status(400).json({ error: 'Token inválido o expirado.' });
  } catch (err) {
    console.error('[VALIDAR TOKEN ERROR]', err);
    return res.status(500).json({ error: 'Error al validar token: ' + err.message });
  }
}

/**
 * 4. POST /api/auth/activar-cuenta y POST /api/auth/restablecer-password
 * Guarda la contraseña personal con hash Bcrypt (12 rounds) y activa la cuenta
 */
async function activarCuenta(req, res) {
  const { token, nuevaContrasena, password } = req.body;
  const pass = nuevaContrasena || password;

  if (!token || !pass) {
    return res.status(400).json({ error: 'El token y la nueva contraseña son obligatorios.' });
  }

  if (pass.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe contener al menos 8 caracteres.' });
  }

  try {
    let user = null;

    // 1. Buscar por token criptográfico exacto
    const qUser = await db.query(`
      SELECT id, nombre, apellidos, email, rol, unidad_medica_id, token_expiracion
      FROM usuarios
      WHERE token_activacion = $1
    `, [token]);

    if (qUser.rows.length > 0) {
      user = qUser.rows[0];
      if (user.token_expiracion && new Date() > new Date(user.token_expiracion)) {
        return res.status(410).json({
          error: 'El enlace ha expirado. Solicite un nuevo correo de restablecimiento.'
        });
      }
    } else if (token.includes('-')) {
      // 2. Soporte de tokens generados en cliente formato {usuario_id}-{timestamp}
      const partes = token.split('-');
      const uId = parseInt(partes[0], 10);
      const ts = parseInt(partes[1], 10);

      if (!isNaN(uId) && !isNaN(ts)) {
        const horas = (Date.now() - ts) / (1000 * 60 * 60);
        if (horas > 48) {
          return res.status(410).json({ error: 'El enlace ha expirado (vigencia máxima superada).' });
        }
        const qFallback = await db.query(
          'SELECT id, nombre, apellidos, email, rol, unidad_medica_id FROM usuarios WHERE id = $1',
          [uId]
        );
        if (qFallback.rows.length > 0) {
          user = qFallback.rows[0];
        }
      }
    }

    if (!user) {
      return res.status(400).json({ error: 'Token inválido o expirado. Contacte a la administración.' });
    }

    // Hashear contraseña con Bcrypt (cost factor 12)
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(pass.trim(), saltRounds);

    // Actualizar usuario: activar y limpiar token
    await db.query(`
      UPDATE usuarios
      SET password_hash = $1,
          activo = true,
          token_activacion = NULL,
          token_expiracion = NULL,
          ultimo_acceso = NOW()
      WHERE id = $2
    `, [password_hash, user.id]);

    // Generar token JWT para ingreso automático inmediato (8 horas)
    const payload = {
      id: user.id,
      nombre: user.nombre,
      apellidos: user.apellidos,
      email: user.email,
      rol: user.rol,
      unidad_medica_id: user.unidad_medica_id
    };
    const jwtToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    return res.status(200).json({
      mensaje: '¡Contraseña actualizada exitosamente! Su cuenta se encuentra activa conforme a la NOM-004.',
      token: jwtToken,
      usuario: payload
    });
  } catch (err) {
    console.error('[ACTIVAR/RESTABLECER CUENTA ERROR]', err);
    return res.status(500).json({ error: 'Error al actualizar contraseña: ' + err.message });
  }
}

/**
 * 5. POST /api/auth/recuperar-password (o /api/auth/olvide-password)
 * Genera token de recuperación de 2 horas y envía correo vía Nodemailer
 */
async function solicitarRecuperacionPassword(req, res) {
  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Debe ingresar su correo electrónico institucional.' });
  }

  const emailLimpio = email.toLowerCase().trim();
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  // 1. Rate Limiting por IP (Máximo 5 solicitudes cada 15 minutos)
  const ahora = Date.now();
  const registroIp = ipRecoveryAttempts.get(clientIp) || [];
  const intentosRecientes = registroIp.filter(t => (ahora - t) < (VENTANA_IP_MINUTOS * 60 * 1000));

  if (intentosRecientes.length >= MAX_SOLICITUDES_IP) {
    return res.status(429).json({
      error: 'Demasiadas solicitudes de recuperación desde este dispositivo. Por seguridad, por favor espera 15 minutos.'
    });
  }

  intentosRecientes.push(ahora);
  ipRecoveryAttempts.set(clientIp, intentosRecientes);

  try {
    const qUser = await db.query(
      'SELECT id, nombre, apellidos, email, activo, token_expiracion FROM usuarios WHERE LOWER(email) = $1',
      [emailLimpio]
    );

    // Por seguridad, si el usuario no existe, se responde con éxito genérico para evitar enumeración de cuentas
    if (qUser.rows.length === 0) {
      return res.json({
        mensaje: 'Si el correo electrónico se encuentra registrado en el sistema, recibirás las instrucciones para restablecer tu contraseña.'
      });
    }

    const user = qUser.rows[0];

    // 2. Cooldown de 5 minutos por usuario para evitar saturación de correo y cuota SMTP
    if (user.token_expiracion) {
      const tiempoRestanteToken = new Date(user.token_expiracion).getTime() - ahora;
      // Vigencia base de 2 horas (7,200,000 ms). Si han pasado menos de 5 min (300,000 ms):
      const tiempoTranscurrido = (2 * 60 * 60 * 1000) - tiempoRestanteToken;
      if (tiempoTranscurrido >= 0 && tiempoTranscurrido < (COOLDOWN_MINUTOS * 60 * 1000)) {
        const minutosRestantes = Math.ceil(((COOLDOWN_MINUTOS * 60 * 1000) - tiempoTranscurrido) / 60000);
        return res.status(429).json({
          error: `Ya se ha enviado un correo recientemente a esta cuenta. Por favor espera ${minutosRestantes > 0 ? minutosRestantes : 1} minuto(s) antes de solicitar otro enlace o revisa tu carpeta de spam.`
        });
      }
    }

    // Generar token seguro de recuperación con vigencia de 2 horas
    const token = crypto.randomBytes(32).toString('hex');
    const expiracion = new Date(ahora + 2 * 60 * 60 * 1000); // 2 horas

    await db.query(`
      UPDATE usuarios
      SET token_activacion = $1, token_expiracion = $2
      WHERE id = $3
    `, [token, expiracion, user.id]);

    // Despachar correo de recuperación con Nodemailer
    await enviarCorreoRecuperacion({
      nombre: `${user.nombre} ${user.apellidos}`.trim(),
      email: user.email,
      token: token,
      baseUrl: req.headers.origin
    });

    return res.json({
      mensaje: 'Si el correo electrónico se encuentra registrado en el sistema, recibirás las instrucciones para restablecer tu contraseña.'
    });
  } catch (err) {
    console.error('[RECUPERAR PASSWORD ERROR]', err);
    return res.status(500).json({ error: 'Error al procesar solicitud de recuperación: ' + err.message });
  }
}

/**
 * 6. POST /api/admin/medicos/:id/restablecer-password
 * Permite que Dirección envíe el correo de restablecimiento a un médico en específico
 */
async function adminEnviarRestablecimiento(req, res) {
  const { id } = req.params;

  try {
    const qUser = await db.query(
      'SELECT id, nombre, apellidos, email, activo FROM usuarios WHERE id = $1',
      [id]
    );

    if (qUser.rows.length === 0) {
      return res.status(404).json({ error: 'Profesional de salud no encontrado.' });
    }

    const user = qUser.rows[0];

    const token = crypto.randomBytes(32).toString('hex');
    const expiracion = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas para solicitud de admin

    await db.query(`
      UPDATE usuarios
      SET token_activacion = $1, token_expiracion = $2
      WHERE id = $3
    `, [token, expiracion, user.id]);

    const mailResult = await enviarCorreoRecuperacion({
      nombre: `${user.nombre} ${user.apellidos}`.trim(),
      email: user.email,
      token: token,
      baseUrl: req.headers.origin
    });

    return res.json({
      mensaje: `Correo de restablecimiento enviado exitosamente a ${user.email}.`,
      urlRecuperacion: mailResult.url
    });
  } catch (err) {
    console.error('[ADMIN RESTABLECER ERROR]', err);
    return res.status(500).json({ error: 'Error al enviar restablecimiento: ' + err.message });
  }
}

module.exports = {
  crearMedico,
  reenviarInvitacion,
  validarToken,
  activarCuenta,
  restablecerPassword: activarCuenta,
  solicitarRecuperacionPassword,
  adminEnviarRestablecimiento
};
