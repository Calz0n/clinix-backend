const CODIGO_CIE10 = /^[A-Z][0-9]{2}(\.[A-Z0-9]{1,4})?$/;

class ErrorDiagnosticos extends Error {
  constructor(message) { super(message); this.status = 400; }
}

function resumenDiagnosticos(diagnosticos, estado, anterior = '') {
  if (estado === 'EN_EVALUACION') return 'En evaluación / sin diagnóstico establecido.';
  if (!Array.isArray(diagnosticos) || !diagnosticos.length) return anterior;
  return [...diagnosticos].sort((a, b) => Number(b.principal) - Number(a.principal))
    .map(d => `${d.principal ? 'Principal' : 'Secundario'}: ${d.cie10} — ${d.descripcion}`).join('\n');
}

function validarDiagnosticos(body) {
  const tieneLista = Object.hasOwn(body, 'diagnosticos');
  const tieneEstado = Object.hasOwn(body, 'estado_diagnostico');
  // Compatibilidad con notas/clientes anteriores: conservar el texto íntegro,
  // sin extraer códigos ni asignar diagnósticos que no eligió el profesional.
  if (!tieneLista && !tieneEstado) {
    if (typeof body.evaluacion_clinica !== 'string' || !body.evaluacion_clinica.trim() || body.evaluacion_clinica.trim() === '-') {
      throw new ErrorDiagnosticos('Agrega un diagnóstico o indica que la sesión está en evaluación.');
    }
    return { diagnosticos: [], estado: 'LEGADO', resumen: body.evaluacion_clinica.trim() };
  }
  if (!tieneLista || !tieneEstado || !Array.isArray(body.diagnosticos) || body.diagnosticos.length > 20) {
    throw new ErrorDiagnosticos('Envía el estado y una lista válida de hasta 20 diagnósticos.');
  }
  const estado = body.estado_diagnostico;
  if (!['REGISTRADO', 'EN_EVALUACION'].includes(estado)) throw new ErrorDiagnosticos('El estado del diagnóstico no es válido.');
  const codigos = new Set();
  const diagnosticos = body.diagnosticos.map(d => {
    if (!d || typeof d !== 'object' || Array.isArray(d) || typeof d.cie10 !== 'string' || typeof d.descripcion !== 'string' || typeof d.principal !== 'boolean') {
      throw new ErrorDiagnosticos('Cada diagnóstico debe indicar código CIE-10, descripción y si es principal.');
    }
    const cie10 = d.cie10.trim().toUpperCase();
    const descripcion = d.descripcion.trim();
    if (!CODIGO_CIE10.test(cie10) || !descripcion || descripcion.length > 200) throw new ErrorDiagnosticos('Revisa el código CIE-10 y la descripción de cada diagnóstico (máximo 200 caracteres).');
    if (codigos.has(cie10)) throw new ErrorDiagnosticos(`El código ${cie10} está repetido. Conserva un solo registro por sesión.`);
    codigos.add(cie10);
    return { cie10, descripcion, principal: d.principal };
  });
  if (estado === 'EN_EVALUACION' && diagnosticos.length) throw new ErrorDiagnosticos('Una sesión en evaluación no debe incluir diagnósticos establecidos.');
  if (estado === 'REGISTRADO' && (!diagnosticos.length || diagnosticos.filter(d => d.principal).length !== 1)) {
    throw new ErrorDiagnosticos('Selecciona exactamente un diagnóstico principal; los demás son secundarios.');
  }
  return { diagnosticos, estado, resumen: resumenDiagnosticos(diagnosticos, estado) };
}

module.exports = { validarDiagnosticos, resumenDiagnosticos, ErrorDiagnosticos };
