// Helper oficial para resolver dinámicamente el nombre del profesionista de la sesión o área
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

function decodificarTokenJwtSeguro(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const partes = token.trim().split('.');
    if (partes.length < 2) return null;
    const payloadBase64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

function obtenerPrefijoProfesion(rolOArea) {
  const r = (rolOArea || '').toUpperCase();
  if (r.includes('PSICO')) return 'Lic.';
  if (r.includes('NUTRI')) return 'L.N.';
  if (r.includes('ODONTO')) return 'C.D.';
  if (r.includes('ENFERM')) return 'Enf.';
  if (r.includes('MEDIC') || r.includes('DIR') || r.includes('GENERAL')) return 'Dr.';
  return '';
}

async function resolverNombreProfesional(db, req, area) {
  const q = (req && req.query) ? req.query : {};

  // 1. Parámetros explícitos pasados por query (URL desde Flutter Web o navegador)
  const param = q.profesional || q.profesionista || q.medico || 
                q.enfermero || q.nutriologo || q.psicologo || 
                q.odontologo || q.usuario || q.nombre || q.user || q.especialista;
  if (param && param.trim() !== '') {
    const p = param.trim();
    const prefijo = obtenerPrefijoProfesion(area);
    if (prefijo && !p.toLowerCase().startsWith(prefijo.toLowerCase().replace('.', ''))) {
      return (prefijo + ' ' + p).trim();
    }
    return p;
  }

  // 2. Token JWT en query string (?token=...) o en cabecera Authorization (Bearer ...)
  let token = q.token;
  if (!token && req && req.headers && req.headers['authorization']) {
    const auth = req.headers['authorization'];
    token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  }
  if (token) {
    const decoded = decodificarTokenJwtSeguro(token);
    if (decoded && (decoded.nombre || decoded.apellidos)) {
      const prefijo = obtenerPrefijoProfesion(decoded.rol || area);
      const nom = `${decoded.nombre || ''} ${decoded.apellidos || ''}`.trim();
      return `${prefijo} ${nom}`.trim();
    }
  }

  // 3. Buscar en PostgreSQL el usuario activo asignado al rol del área
  if (db && typeof db.query === 'function') {
    try {
      let rolBuscado = 'MEDICO_GENERAL';
      const a = (area || '').toUpperCase();
      if (a === 'PSICOLOGIA') rolBuscado = 'PSICOLOGO';
      else if (a === 'NUTRICION') rolBuscado = 'NUTRIOLOGO';
      else if (a === 'ODONTOLOGIA') rolBuscado = 'ODONTOLOGO';
      else if (a === 'ENFERMERIA') rolBuscado = 'ENFERMERIA';
      else if (a === 'GENERAL' || a === 'CONCENTRADO_GENERAL') rolBuscado = 'DIRECCION';

      const uRes = await db.query(
        `SELECT nombre, apellidos, rol, cedula_profesional 
         FROM usuarios 
         WHERE rol = $1 AND activo = true 
         ORDER BY id DESC LIMIT 1`,
        [rolBuscado]
      );

      if (uRes.rows.length > 0) {
        const u = uRes.rows[0];
        const prefijo = obtenerPrefijoProfesion(u.rol || area);
        const cedula = u.cedula_profesional ? ` (Céd. Prof. ${u.cedula_profesional})` : '';
        return `${prefijo} ${u.nombre} ${u.apellidos || ''}${cedula}`.trim();
      }

      // 4. Buscar el último especialista que haya registrado consultas en esta área
      const cRes = await db.query(
        `SELECT u.nombre, u.apellidos, u.rol, u.cedula_profesional
         FROM consultas_base cb
         JOIN usuarios u ON u.id = cb.especialista_id
         WHERE cb.area_medica = $1
         ORDER BY cb.fecha_hora DESC LIMIT 1`,
        [area]
      );
      if (cRes.rows.length > 0) {
        const u = cRes.rows[0];
        const prefijo = obtenerPrefijoProfesion(u.rol || area);
        return `${prefijo} ${u.nombre} ${u.apellidos || ''}`.trim();
      }
    } catch (err) {
      console.error('Error al resolver nombre de profesionista:', err.message);
    }
  }

  // 5. Títulos institucionales por defecto
  const a = (area || '').toUpperCase();
  if (a === 'PSICOLOGIA') return 'Lic. Especialista en Psicología';
  if (a === 'NUTRICION') return 'L.N. Especialista en Nutrición';
  if (a === 'ODONTOLOGIA') return 'C.D. Cirujano Dentista';
  if (a === 'MEDICINA_GENERAL' || a === 'MEDICINA') return 'Dr. Médico General';
  if (a === 'ENFERMERIA') return 'Enf. Personal de Enfermería';
  return 'Dirección de Salud Pública Municipal';
}

module.exports = {
  resolverNombreProfesional,
  obtenerPrefijoProfesion,
  decodificarTokenJwtSeguro
};
