const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'clinix_jwt_secret_coatzacoalcos_2026';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const rawToken = typeof authHeader === 'string'
    ? authHeader.replace(/^Bearer\s+/i, '')
    : req.query?.token;
  if (typeof rawToken !== 'string' || !rawToken.trim()) {
    return res.status(401).json({ error: 'Acceso denegado: Token de autenticación requerido.' });
  }
  let user;
  try {
    user = jwt.verify(rawToken.trim(), JWT_SECRET);
    if (!user || typeof user !== 'object' || !Number.isInteger(Number(user.id)) || Number(user.id) < 1) throw new Error('Usuario no válido');
  } catch (_) {
    return res.status(401).json({ error: 'Token inválido o expirado. Inicia sesión nuevamente.' });
  }
  try {
    const result = await db.query('SELECT id, activo, rol, unidad_medica_id FROM usuarios WHERE id = $1', [user.id]);
    const actual = result.rows[0];
    if (!actual || !actual.activo) {
      return res.status(403).json({ error: 'Esta cuenta ha sido desactivada o ya no existe.' });
    }
    // Tomar rol y sede actuales, aunque hayan cambiado desde el login.
    req.user = { ...user, ...actual };
    next();
  } catch (err) {
    console.error('[AUTH DB]', err.message);
    return res.status(503).json({ error: 'No se pudo verificar la sesión. Intenta nuevamente en unos momentos.' });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.rol) {
      return res.status(403).json({ error: 'Acceso denegado: Rol no identificado.' });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        error: `Acceso restringido: Se requiere rol de [${allowedRoles.join(', ')}].`
      });
    }

    next();
  };
}

function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 30, message = 'Demasiadas solicitudes. Intente más tarde.' } = {}) {
  const hits = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }, Math.min(windowMs, 5 * 60 * 1000));

  if (cleanup.unref) cleanup.unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const record = (hits.get(ip) || []).filter(t => now - t < windowMs);

    if (record.length >= max) {
      return res.status(429).json({ error: message });
    }

    record.push(now);
    hits.set(ip, record);
    next();
  };
}

function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

module.exports = {
  authenticateToken,
  requireRoles,
  createRateLimiter,
  securityHeadersMiddleware,
};
