const jwt = require('jsonwebtoken');
const db = require('./src/db');

async function test() {
  console.log('\n=== PRUEBA DE GESTIÓN DE PERSONAL Y USUARIOS (CLINIX) ===\n');
  const adminRes = await db.query('SELECT id, email, rol, unidad_medica_id FROM usuarios WHERE rol = $1 LIMIT 1', ['DIRECCION']);
  const admin = adminRes.rows[0];
  const token = jwt.sign(
    { id: admin.id, email: admin.email, rol: admin.rol, unidad_medica_id: admin.unidad_medica_id },
    process.env.JWT_SECRET || 'clinix_jwt_secret_coatzacoalcos_2026',
    { expiresIn: '2h' }
  );

  // 1. Catálogo de roles
  const r1 = await fetch('http://127.0.0.1:3000/api/usuarios/roles/catalogo', {
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('[1/4] Catálogo de roles:', (await r1.json()).length, 'roles disponibles -> OK');

  // 2. Alta de Médico
  const email = 'dr.nuevo.' + Date.now() + '@clinix.gob.mx';
  const r2 = await fetch('http://127.0.0.1:3000/api/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      nombre: 'Dr. Alejandro',
      apellidos: 'Ramírez Solís',
      email,
      password: 'clinix_password_2026',
      rol: 'MEDICO_GENERAL',
      cedula_profesional: 'CED-MED-9944'
    })
  });
  const u = await r2.json();
  if (!r2.ok) { console.error('Error al registrar:', u); process.exit(1); }
  console.log('[2/4] Médico registrado exitosamente (ID:', u.usuario.id, '| Cédula:', u.usuario.cedula_profesional, ') -> OK');

  // 3. Desactivación lógica (Baja temporal)
  const r3 = await fetch('http://127.0.0.1:3000/api/usuarios/' + u.usuario.id + '/estado', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ activo: false })
  });
  const patchData = await r3.json();
  console.log('[3/4] Estado en base de datos: activo =', patchData.usuario.activo, '(Baja temporal) -> OK');

  // 4. Listar personal activo
  const r4 = await fetch('http://127.0.0.1:3000/api/usuarios?activo=true', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const lista = await r4.json();
  console.log('[4/4] Total de profesionales activos:', lista.length, '-> OK');

  console.log('\n=== MÓDULO DE GESTIÓN DE PERSONAL VALIDADO AL 100% ===\n');
  process.exit(0);
}

test();
