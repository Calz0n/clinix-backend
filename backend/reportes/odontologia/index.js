// Módulo Oficial de Reportes de Odontología
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const queries = require('./odontologia.queries');
const diarioTemplate = require('./odontologia.diario.template');
const mensualTemplate = require('./odontologia.mensual.template');

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
