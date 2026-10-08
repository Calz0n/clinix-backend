// Módulo Oficial de Reportes de Enfermería
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const queries = require('./enfermeria.queries');
const diarioTemplate = require('./enfermeria.diario.template');
const mensualTemplate = require('./enfermeria.mensual.template');

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
