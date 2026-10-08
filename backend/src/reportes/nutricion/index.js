// Módulo Oficial de Reportes de Nutrición
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const queries = require('./nutricion.queries');
const diarioTemplate = require('./nutricion.diario.template');
const mensualTemplate = require('./nutricion.mensual.template');

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
