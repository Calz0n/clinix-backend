const fs = require('node:fs');
const path = require('node:path');

async function aplicarMigraciones(db) {
  for (const nombre of ['04_pacientes_datos_completos.sql', '05_antecedentes_nutricion.sql', '06_ampliar_campos_pacientes.sql', '07_diagnosticos_psicologia.sql']) {
    await db.query(fs.readFileSync(path.join(__dirname, '../init_db', nombre), 'utf8'));
  }
}

module.exports = { aplicarMigraciones };
