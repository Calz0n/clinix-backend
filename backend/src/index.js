const express = require('express');
const cors = require('cors');
const db = require('./db');
const { securityHeadersMiddleware, createRateLimiter } = require('./middleware/auth');

// Rutas Modulares
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const unidadesRoutes = require('./routes/unidades.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');
const pacientesRoutes = require('./routes/pacientes.routes');
const atencionesRoutes = require('./routes/atenciones.routes');
const triajeRoutes = require('./routes/triaje.routes');
const consultasRoutes = require('./routes/consultas.routes');
const nutricionRoutes = require('./routes/nutricion.routes');
const psicologiaRoutes = require('./routes/psicologia.routes');
const estadisticasRoutes = require('./routes/estadisticas.routes');
const odontologiaRoutes = require('./routes/odontologia.routes');
const medicosRoutes = require('./routes/medicosRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(securityHeadersMiddleware);
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: 'Límite de peticiones excedido temporalmente. Por favor espere unos minutos.'
});
app.use('/api', apiRateLimiter);

// Montar Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/admin/medicos', medicosRoutes);
app.use('/api/unidades', unidadesRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/atenciones', atencionesRoutes);
app.use('/api/triaje', triajeRoutes);
app.use('/api/consultas', consultasRoutes);
app.use('/api/nutricion', nutricionRoutes);
app.use('/api/psicologia', psicologiaRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/odontologia', odontologiaRoutes);

// Endpoint de Salud y Verificación
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() as now, version() as version');
    res.json({
      status: 'ok',
      service: 'Clinix Backend API',
      municipio: 'Dirección de Salud Pública Municipal de Coatzacoalcos',
      periodo: '2026-2029',
      database: 'connected',
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      service: 'Clinix Backend API',
      database: 'disconnected',
    });
  }
});

// Middleware 404 Estandarizado
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// Middleware Global de Manejo de Errores (Sanitización de errores internos)
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR HANDLER]', err);
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      error: 'El servicio de base de datos no se encuentra disponible temporalmente.'
    });
  }
  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Ocurrió un error interno en el servidor.';
  res.status(status).json({ error: message });
});

// Migraciones automáticas seguras para soporte de Invitaciones, Activación y Tablas Normativas OMS
async function inicializarMigraciones() {
  try {
    await db.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_activacion VARCHAR(255);
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_expiracion TIMESTAMP;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS turno VARCHAR(30);
      ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;

      CREATE TABLE IF NOT EXISTS oms_referencia_imc (
        edad INT NOT NULL,
        sexo VARCHAR(1) NOT NULL,
        sd_menos_3 NUMERIC(5,2) NOT NULL,
        sd_menos_2 NUMERIC(5,2) NOT NULL,
        sd_menos_1 NUMERIC(5,2) NOT NULL,
        mediana NUMERIC(5,2) NOT NULL,
        sd_mas_1 NUMERIC(5,2) NOT NULL,
        sd_mas_2 NUMERIC(5,2) NOT NULL,
        sd_mas_3 NUMERIC(5,2) NOT NULL,
        PRIMARY KEY (edad, sexo)
      );

      INSERT INTO oms_referencia_imc (edad, sexo, sd_menos_3, sd_menos_2, sd_menos_1, mediana, sd_mas_1, sd_mas_2, sd_mas_3) VALUES
        (5, 'F', 11.8, 12.7, 13.9, 15.3, 16.9, 18.9, 21.5),
        (6, 'F', 11.9, 12.8, 14.0, 15.5, 17.3, 19.6, 22.6),
        (7, 'F', 12.0, 12.9, 14.2, 15.8, 17.8, 20.3, 23.7),
        (8, 'F', 12.1, 13.1, 14.4, 16.2, 18.3, 21.0, 24.8),
        (9, 'F', 12.3, 13.3, 14.8, 16.7, 19.0, 22.1, 26.5),
        (10, 'F', 12.5, 13.6, 15.2, 17.2, 19.8, 23.2, 28.2),
        (11, 'F', 12.8, 14.0, 15.7, 17.9, 20.7, 24.5, 30.0),
        (12, 'F', 13.2, 14.5, 16.3, 18.7, 21.7, 25.8, 31.8),
        (13, 'F', 13.6, 15.0, 16.9, 19.4, 22.6, 26.8, 33.0),
        (14, 'F', 14.0, 15.5, 17.5, 20.1, 23.4, 27.7, 34.0),
        (15, 'F', 14.4, 16.0, 18.1, 20.8, 24.2, 28.6, 35.0),
        (16, 'F', 14.5, 16.2, 18.3, 21.0, 24.5, 28.9, 35.4),
        (17, 'F', 14.6, 16.3, 18.5, 21.2, 24.7, 29.2, 35.8),
        (18, 'F', 14.7, 16.4, 18.6, 21.3, 24.9, 29.5, 36.1),
        (19, 'F', 14.8, 16.5, 18.7, 21.4, 25.0, 29.7, 36.3),
        (5, 'M', 12.1, 13.0, 14.1, 15.3, 16.6, 18.3, 20.5),
        (6, 'M', 12.2, 13.1, 14.2, 15.5, 17.0, 19.0, 21.6),
        (7, 'M', 12.3, 13.2, 14.3, 15.7, 17.4, 19.7, 22.8),
        (8, 'M', 12.4, 13.3, 14.5, 16.0, 17.9, 20.5, 24.0),
        (9, 'M', 12.6, 13.5, 14.8, 16.4, 18.4, 21.3, 25.4),
        (10, 'M', 12.8, 13.8, 15.1, 16.8, 19.0, 22.2, 26.8),
        (11, 'M', 13.1, 14.1, 15.5, 17.4, 19.9, 23.4, 28.5),
        (12, 'M', 13.4, 14.5, 16.0, 18.0, 20.8, 24.6, 30.2),
        (13, 'M', 13.7, 14.9, 16.6, 18.7, 21.6, 25.6, 31.7),
        (14, 'M', 14.0, 15.4, 17.2, 19.4, 22.4, 26.6, 33.2),
        (15, 'M', 14.4, 15.9, 17.8, 20.2, 23.3, 27.7, 34.8),
        (16, 'M', 14.8, 16.4, 18.3, 20.8, 23.9, 28.3, 35.2),
        (17, 'M', 15.2, 16.8, 18.8, 21.3, 24.5, 28.9, 35.6),
        (18, 'M', 15.7, 17.3, 19.3, 21.9, 25.1, 29.5, 36.0),
        (19, 'M', 15.9, 17.5, 19.5, 22.2, 25.4, 29.8, 36.3)
      ON CONFLICT (edad, sexo) DO NOTHING;
    `);
    console.log('[DB] Migraciones y tablas normativas OMS verificadas exitosamente.');
  } catch (err) {
    console.warn('[DB WARNING] No se ejecutaron migraciones automáticas:', err.message);
  }
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Clinix Backend API escuchando en http://0.0.0.0:${PORT}`);
  inicializarMigraciones();
});

// Apagado limpio (Graceful Shutdown) ante SIGTERM / SIGINT en Podman
async function cerrarServidor(signal) {
  console.log(`[${signal}] Cerrando servidor y liberando pool de PostgreSQL...`);
  server.close(async () => {
    try {
      await db.pool.end();
    } catch (_) {}
    process.exit(0);
  });
}

process.on('SIGTERM', () => cerrarServidor('SIGTERM'));
process.on('SIGINT', () => cerrarServidor('SIGINT'));
