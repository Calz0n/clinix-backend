const CAMPOS = ['diabetes', 'hipertension', 'dislipidemia', 'enfermedad_renal', 'cardiopatia', 'hipotiroidismo', 'embarazo_lactancia'];

function validarAntecedentes(value) {
  if (value === undefined) return null; // Compatibilidad con clientes anteriores.
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'antecedentes_patologicos debe ser un objeto de valores verdadero/falso.';
  for (const [campo, valor] of Object.entries(value)) {
    if (!CAMPOS.includes(campo)) return `Antecedente no reconocido: ${campo}.`;
    if (typeof valor !== 'boolean') return `El antecedente ${campo} debe ser verdadero o falso.`;
  }
  return null;
}

function normalizarAntecedentes(value = {}) {
  return Object.fromEntries(CAMPOS.map(campo => [campo, value[campo] === true]));
}

module.exports = { validarAntecedentes, normalizarAntecedentes };
