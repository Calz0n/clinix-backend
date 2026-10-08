// Módulo Oficial de Reportes de Psicología
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const queries = require('./psicologia.queries');
const diarioTemplate = require('./psicologia.diario.template');
const mensualTemplate = require('./psicologia.mensual.template');

module.exports = {
  // Reporte Diario
  obtenerDatosDiarios: queries.obtenerDatosDiarios,
  renderizarDiarioHtml: diarioTemplate.renderizarDiarioHtml,
  renderizarDiarioExcel: diarioTemplate.renderizarDiarioExcel,

  // Concentrado Mensual
  obtenerDatosMensuales: queries.obtenerDatosMensuales,
  renderizarMensualHtml: mensualTemplate.renderizarMensualHtml,
  renderizarMensualExcel: mensualTemplate.renderizarMensualExcel
};
