// Módulo Oficial de Certificados (solo Medicina General y Nutrición)
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const { renderizarCertificadoMedicoHtml } = require('./certificado.medico.template');
const { renderizarCertificadoNutricionHtml } = require('./certificado.nutricion.template');

module.exports = {
  renderizarCertificadoMedicoHtml,
  renderizarCertificadoNutricionHtml,
};
