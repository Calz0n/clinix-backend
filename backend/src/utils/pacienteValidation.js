const DERECHOHABIENCIAS = ['IMSS', 'ISSSTE', 'PEMEX', 'SEDENA', 'SEMAR', 'IMSS-Bienestar', 'Ninguna'];
const PARENTESCOS = ['Madre', 'Padre', 'Tutor Legal', 'Abuelo/a', 'Otro'];

// Valida el contrato HTTP antes de llegar a PostgreSQL.
function validarPaciente(body, parcial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Los datos del paciente deben ser un objeto JSON.';
  const obligatorios = ['nombres', 'apellido_paterno', 'curp', 'fecha_nacimiento', 'sexo', 'calle_numero', 'colonia', 'derechohabiencia'];
  for (const campo of obligatorios) {
    if ((!parcial || campo in body) && (typeof body[campo] !== 'string' || !body[campo].trim())) {
      return `El campo ${campo} es obligatorio y debe ser texto.`;
    }
  }
  const limites = {
    nombres: 80, apellido_paterno: 60, apellido_materno: 60,
    numero_expediente: 30, calle_numero: 150, colonia: 100,
    codigo_postal: 5, telefono: 15, estado_civil: 25, escolaridad: 40,
    numero_afiliacion: 100, grupo_sanguineo: 50, religion: 100,
    ocupacion: 100, tipo_poblacion: 100, area: 100, area_servicio: 100,
    nombre_programa: 100, enfermedades_previas: 10000,
  };
  for (const [campo, max] of Object.entries(limites)) {
    if (body[campo] != null && (typeof body[campo] !== 'string' || body[campo].trim().length > max)) {
      return `El campo ${campo} debe ser texto de hasta ${max} caracteres.`;
    }
  }
  if ('curp' in body && !/^[A-Z0-9]{18}$/.test(body.curp.trim().toUpperCase())) return 'La CURP debe tener exactamente 18 caracteres: letras y números.';
  if (body.telefono != null && body.telefono !== '' && !/^\d{10}$/.test(body.telefono.trim())) return 'El teléfono debe contener exactamente 10 números, sin espacios ni guiones.';
  if ('sexo' in body && !['M', 'F'].includes(body.sexo)) return 'El sexo debe ser M o F.';
  if ('derechohabiencia' in body && !DERECHOHABIENCIAS.includes(body.derechohabiencia)) return 'Derechohabiencia no permitida.';
  if ('fecha_nacimiento' in body) {
    const fecha = body.fecha_nacimiento;
    const parsed = new Date(`${fecha}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== fecha || fecha > new Date().toISOString().slice(0, 10)) {
      return 'La fecha de nacimiento debe ser válida, no futura y tener formato AAAA-MM-DD.';
    }
  }
  if ('num_personas_vivienda' in body && (!Number.isInteger(body.num_personas_vivienda) || body.num_personas_vivienda < 1 || body.num_personas_vivienda > 32767)) return 'El número de personas en la vivienda debe ser un entero mayor que cero.';
  if ('beneficiario_programa' in body && typeof body.beneficiario_programa !== 'boolean') return 'beneficiario_programa debe ser verdadero o falso.';
  if (body.tipo_consulta != null && !['Primera vez', 'Subsecuente'].includes(body.tipo_consulta)) return 'Tipo de consulta no permitido.';
  if (body.tipo_atencion != null && !['PRIMERA_VEZ', 'SUBSECUENTE'].includes(body.tipo_atencion)) return 'Tipo de atención no permitido.';
  if (body.tutor != null) {
    const tutor = body.tutor;
    const campos = {nombre_completo: 150, parentesco: 40, telefono_contacto: 15, tipo_identificacion: 50};
    for (const [campo, max] of Object.entries(campos)) {
      if (typeof tutor[campo] !== 'string' || !tutor[campo].trim() || tutor[campo].length > max) return `El campo ${campo} del tutor es obligatorio (máximo ${max} caracteres).`;
    }
    if (!/^\d{10}$/.test(tutor.telefono_contacto.trim())) return 'El teléfono del tutor debe contener exactamente 10 números.';
    if (!PARENTESCOS.includes(tutor.parentesco)) return 'Parentesco del tutor no permitido.';
    if (tutor.numero_identificacion != null && (typeof tutor.numero_identificacion !== 'string' || tutor.numero_identificacion.length > 50)) return 'Identificación del tutor no válida.';
  }
  return null;
}

module.exports = { validarPaciente };
