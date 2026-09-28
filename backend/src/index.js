const express = require('express');
const cors = require('cors');
const db = require('./db');

const authRoutes = require('./routes/auth.routes');
const pacientesRoutes = require('./routes/pacientes.routes');
const atencionesRoutes = require('./routes/atenciones.routes');
const triajeRoutes = require('./routes/triaje.routes');
const consultasRoutes = require('./routes/consultas.routes');
const nutricionRoutes = require('./routes/nutricion.routes');
const psicologiaRoutes = require('./routes/psicologia.routes');
const estadisticasRoutes = require('./routes/estadisticas.routes');
const odontologiaRoutes = require('./routes/odontologia.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Montar Rutas Modulares
app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/atenciones', atencionesRoutes);
app.use('/api/triaje', triajeRoutes);
app.use('/api/consultas', consultasRoutes);
app.use('/api/nutricion', nutricionRoutes);
app.use('/api/psicologia', psicologiaRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/odontologia', odontologiaRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() as now, version() as version');
    res.json({
      status: 'ok',
      service: 'Clinix Backend API',
      database: 'connected',
      db_version: result.rows[0].version,
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      service: 'Clinix Backend API',
      database: 'disconnected',
      error: err.message,
    });
  }
});

app.get('/api/unidades', async (req, res) => {
  try {
    const result = await db.query('SELECT id, nombre, clave_oficial, direccion, telefono FROM unidades_medicas WHERE activo = true');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Clinix Backend API escuchando en http://0.0.0.0:${PORT}`);
});
