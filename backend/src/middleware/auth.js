const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'clinix_jwt_secret_coatzacoalcos_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'Acceso denegado: Token de autenticación requerido.' });
  }

  // Extraer la cadena limpia del token (removiendo el prefijo Bearer)
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token || token.trim() === '') {
    return res.status(401).json({ error: 'Acceso denegado: Token vacío.' });
  }

  jwt.verify(token.trim(), JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado. Inicia sesión nuevamente.' });
    }
    req.user = user;
    next();
  });
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.rol) {
      return res.status(403).json({ error: 'Acceso denegado: Rol no identificado.' });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        error: `Acceso restringido: Se requiere rol de [${allowedRoles.join(', ')}]. Tu rol actual es: ${req.user.rol}`
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRoles,
};
