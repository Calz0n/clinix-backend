// Módulo Oficial de Reportes de Medicina General (Consulta General)
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const queries = require('./medicina_general.queries');
const diarioTemplate = require('./medicina_general.diario.template');
const mensualTemplate = require('./medicina_general.mensual.template');

module.exports = {
  // Reporte Diario
  obtenerDatosDiarios: queries.obtenerDatosDiarios,
  renderizarDiarioHtml: diarioTemplate.renderizarDiarioHtml,
  renderizarDiarioExcel: diarioTemplate.renderizarDiarioExcel,

  // Concentrado Mensual (3 Hojas Físicas Oficiales)
  obtenerDatosMensuales: queries.obtenerDatosMensuales,
  renderizarMensualHtml: mensualTemplate.renderizarMensualHtml,
  renderizarMensualExcel: mensualTemplate.renderizarMensualExcel
};
