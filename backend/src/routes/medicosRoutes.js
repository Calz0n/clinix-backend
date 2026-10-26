// src/routes/medicosRoutes.js
// Rutas de administración para gestión y alta de personal médico con invitación
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const express = require('express');
const router = express.Router();
const medicosController = require('../controllers/medicosController');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// Middleware opcional de autenticación si se requiere proteger por rol de DIRECCION
// Se puede permitir con token o llamada interna de administración
router.use((req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    return authenticateToken(req, res, next);
  }
  // Permitir si se invoca desde la interfaz administrativa directa
  next();
});

// POST /api/admin/medicos (Alta de nuevo médico sin contraseña y despacho de invitación)
router.post('/', medicosController.crearMedico);

// POST /api/admin/medicos/:id/reenviar-invitacion (Reenvío de invitación con nuevo token de 48h)
router.post('/:id/reenviar-invitacion', medicosController.reenviarInvitacion);

// POST /api/admin/medicos/:id/restablecer-password (Envío de enlace de recuperación a un médico específico)
router.post('/:id/restablecer-password', medicosController.adminEnviarRestablecimiento);

module.exports = router;
