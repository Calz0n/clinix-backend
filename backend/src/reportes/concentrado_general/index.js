// Módulo Oficial del Concentrado General Mensual
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const queries = require('./concentrado_general.queries');
const template = require('./concentrado_general.template');

module.exports = {
  obtenerDatosMensuales: queries.obtenerDatosMensuales,
  renderizarMensualHtml: template.renderizarMensualHtml,
  renderizarMensualExcel: template.renderizarMensualExcel
};
