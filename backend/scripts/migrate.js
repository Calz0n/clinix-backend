require('dotenv').config();
const { aplicarMigraciones } = require('../src/migrations');
const db = require('../src/db');

async function main() {
  try {
    await aplicarMigraciones(db);
    console.log('Migraciones de pacientes, nutrición y diagnósticos de psicología aplicadas. Se conservaron los registros existentes.');
  } finally {
    await db.pool.end();
  }
}

main().catch(err => {
  console.error('No se pudo aplicar la migración:', err.message);
  process.exitCode = 1;
});
