// Plantilla HTML y Excel del Concentrado Mensual Oficial de Odontología
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
// Reproducción exacta de la hoja física oficial (WhatsApp Image 2026-10-07 at 11.56.55 (1).jpeg)

const { obtenerLogoHtml } = require('../common/logo');
const estilosPrint = require('../common/estilosPrint');
const { envolverHtmlParaExcel } = require('../common/excelWrapper');

const MESES = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

function renderizarMensualHtml(datos) {
  const { periodo, dias, totales, total_general_mes } = datos;
  const { anio, mes } = periodo;
  const nombreMes = MESES[parseInt(mes, 10)] || `MES ${mes}`;
  const logoHtml = obtenerLogoHtml({ height: 76 });

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Concentrado Mensual de Odontología - ${nombreMes} ${anio}</title>
    <style>
      ${estilosPrint}
      .tabla-mensual-odonto th {
        font-size: 6px;
        padding: 2px 0.5px;
      }
      .tabla-mensual-odonto td {
        font-size: 7px;
        height: 14px;
        padding: 1px 0.5px;
      }
      .rot-col-mensual {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
        font-size: 6.2px;
        font-weight: bold;
        padding: 4px 1px;
        max-height: 80px;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <a href="/api/estadisticas/mensual/excel?anio=${anio}&mes=${mes}&area=ODONTOLOGIA" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
    </div>

    <div class="pagina-reporte">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">CONCENTRADO MENSUAL DE ODONTOLOGÍA</div>
          <div class="subtitulo-institucion">GOBIERNO DE LA CIUDAD DE COATZACOALCOS &bull; SALUD PÚBLICA MUNICIPAL</div>
          <div class="fecha-box-container">
            <div class="fecha-cell">ÁREA<strong>ODONTOLOGÍA</strong></div>
            <div class="fecha-cell">MES<strong>${nombreMes}</strong></div>
            <div class="fecha-cell">AÑO<strong>${anio}</strong></div>
          </div>
        </div>
      </div>

      <div class="meta-subbar">
        <div><strong>Nombre del Dr. (a):</strong> <span style="text-decoration: underline; padding-left: 6px;">C.D. Especialista en Estomatología</span></div>
        <div><strong>TOTAL ATENCIONES DEL MES:</strong> ${total_general_mes}</div>
      </div>

      <table class="tabla-oficial tabla-mensual-odonto">
        <thead>
          <tr>
            <th rowspan="2" style="width: 28px;">FECHA</th>
            <th colspan="10" class="th-super">DETECCIONES</th>
            <th colspan="7" class="th-super">TRATAMIENTO</th>
            <th colspan="5" class="th-super">ESTUDIOS DE GABINETE</th>
            <th rowspan="2" style="width: 45px;">TOTAL DÍA</th>
          </tr>
          <tr>
            <!-- Detecciones (10) -->
            <th style="width: 32px;"><div class="rot-col-mensual">ABSCESO PERIODONTAL</div></th>
            <th style="width: 26px;"><div class="rot-col-mensual">CARIES</div></th>
            <th style="width: 28px;"><div class="rot-col-mensual">GINGIVITIS</div></th>
            <th style="width: 30px;"><div class="rot-col-mensual">PERIODONTITIS</div></th>
            <th style="width: 30px;"><div class="rot-col-mensual">ABRASIÓN DENTAL</div></th>
            <th style="width: 28px;"><div class="rot-col-mensual">BRUXISMO</div></th>
            <th style="width: 32px;"><div class="rot-col-mensual">TÉCNICA DE CEPILLADO</div></th>
            <th style="width: 30px;"><div class="rot-col-mensual">USO DE HILO DENTAL</div></th>
            <th style="width: 30px;"><div class="rot-col-mensual">DETECCIÓN DE PLACA</div></th>
            <th style="width: 32px;"><div class="rot-col-mensual">APLICACIÓN DE FLÚOR</div></th>

            <!-- Tratamiento (7) -->
            <th style="width: 30px;"><div class="rot-col-mensual">PROFILAXIS</div></th>
            <th style="width: 32px;"><div class="rot-col-mensual">CURETAJE PERIAPICAL</div></th>
            <th style="width: 32px;"><div class="rot-col-mensual">FARMACOTERAPIA</div></th>
            <th style="width: 32px;"><div class="rot-col-mensual">DESENSIBILIZANTE</div></th>
            <th style="width: 28px;"><div class="rot-col-mensual">AMALGAMA</div></th>
            <th style="width: 26px;"><div class="rot-col-mensual">RESINA</div></th>
            <th style="width: 32px;"><div class="rot-col-mensual">EXTRACCIÓN DENTAL</div></th>

            <!-- Gabinete (5) -->
            <th style="width: 34px;"><div class="rot-col-mensual">BIOMETRÍA HEMÁTICA</div></th>
            <th style="width: 32px;"><div class="rot-col-mensual">TIEMPO COAGULACIÓN</div></th>
            <th style="width: 32px;"><div class="rot-col-mensual">PRUEBAS RÁPIDAS</div></th>
            <th style="width: 34px;"><div class="rot-col-mensual">RAD. PANORÁMICA</div></th>
            <th style="width: 32px;"><div class="rot-col-mensual">RAD. PERIAPICAL</div></th>
          </tr>
        </thead>
        <tbody>
          ${dias.map(d => `
            <tr>
              <td><strong>${d.dia}</strong></td>
              <td>${d.absceso || 0}</td>
              <td>${d.caries || 0}</td>
              <td>${d.gingivitis || 0}</td>
              <td>${d.periodontitis || 0}</td>
              <td>${d.abrasion || 0}</td>
              <td>${d.bruxismo || 0}</td>
              <td>${d.tecnica_cepillado || 0}</td>
              <td>${d.hilo_dental || 0}</td>
              <td>${d.deteccion_placa || 0}</td>
              <td>${d.aplicacion_fluor || 0}</td>

              <td>${d.profilaxis || 0}</td>
              <td>${d.curetaje || 0}</td>
              <td>${d.farmacoterapia || 0}</td>
              <td>${d.desensibilizante || 0}</td>
              <td>${d.amalgama || 0}</td>
              <td>${d.resina || 0}</td>
              <td>${d.extraccion || 0}</td>

              <td>${d.biometria_hematica || 0}</td>
              <td>${d.tiempo_coagulacion || 0}</td>
              <td>${d.pruebas_rapidas || 0}</td>
              <td>${d.radio_panoramica || 0}</td>
              <td>${d.radio_periapical || 0}</td>
              <td><strong>${d.total_dia || 0}</strong></td>
            </tr>
          `).join('')}
          <tr class="row-total">
            <td>TOTAL</td>
            <td>${totales.absceso}</td>
            <td>${totales.caries}</td>
            <td>${totales.gingivitis}</td>
            <td>${totales.periodontitis}</td>
            <td>${totales.abrasion}</td>
            <td>${totales.bruxismo}</td>
            <td>${totales.tecnica_cepillado}</td>
            <td>${totales.hilo_dental}</td>
            <td>${totales.deteccion_placa}</td>
            <td>${totales.aplicacion_fluor}</td>

            <td>${totales.profilaxis}</td>
            <td>${totales.curetaje}</td>
            <td>${totales.farmacoterapia}</td>
            <td>${totales.desensibilizante}</td>
            <td>${totales.amalgama}</td>
            <td>${totales.resina}</td>
            <td>${totales.extraccion}</td>

            <td>${totales.biometria_hematica}</td>
            <td>${totales.tiempo_coagulacion}</td>
            <td>${totales.pruebas_rapidas}</td>
            <td>${totales.radio_panoramica}</td>
            <td>${totales.radio_periapical}</td>
            <td>${total_general_mes}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

function renderizarMensualExcel(datos) {
  const { periodo, dias, totales, total_general_mes } = datos;
  const { anio, mes } = periodo;
  const nombreMes = MESES[parseInt(mes, 10)] || `MES ${mes}`;

  const tablaHtml = `
    <table>
      <tr>
        <th colspan="24" class="hdr-main">H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="24" class="hdr-sub">CONCENTRADO MENSUAL DE ODONTOLOGÍA &bull; PERIODO: ${nombreMes} ${anio}</th>
      </tr>
      <tr>
        <td colspan="12" class="hdr-meta text-left"><strong>Área:</strong> Odontología &nbsp;|&nbsp; <strong>Unidad:</strong> Sede Central Malpica</td>
        <td colspan="12" class="hdr-meta text-right"><strong>TOTAL DEL MES:</strong> ${total_general_mes} atenciones</td>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">FECHA</th>
        <th colspan="10" class="th-super">DETECCIONES</th>
        <th colspan="7" class="th-super">TRATAMIENTO</th>
        <th colspan="5" class="th-super">ESTUDIOS DE GABINETE</th>
        <th rowspan="2" class="th-super">TOTAL DÍA</th>
      </tr>
      <tr>
        <th class="th-col">ABSCESO</th><th class="th-col">CARIES</th><th class="th-col">GINGIVITIS</th><th class="th-col">PERIODONTITIS</th><th class="th-col">ABRASIÓN</th><th class="th-col">BRUXISMO</th><th class="th-col">CEPILLADO</th><th class="th-col">HILO DENTAL</th><th class="th-col">PLACA</th><th class="th-col">FLÚOR</th>
        <th class="th-col">PROFILAXIS</th><th class="th-col">CURETAJE</th><th class="th-col">FÁRMACO</th><th class="th-col">DESENSIBILIZANTE</th><th class="th-col">AMALGAMA</th><th class="th-col">RESINA</th><th class="th-col">EXTRACCIÓN</th>
        <th class="th-col">BIOMETRÍA</th><th class="th-col">COAGULACIÓN</th><th class="th-col">P. RÁPIDAS</th><th class="th-col">R. PANORÁMICA</th><th class="th-col">R. PERIAPICAL</th>
      </tr>
      ${dias.map(d => `
        <tr>
          <td><strong>${d.dia}</strong></td>
          <td>${d.absceso || 0}</td><td>${d.caries || 0}</td><td>${d.gingivitis || 0}</td><td>${d.periodontitis || 0}</td><td>${d.abrasion || 0}</td><td>${d.bruxismo || 0}</td><td>${d.tecnica_cepillado || 0}</td><td>${d.hilo_dental || 0}</td><td>${d.deteccion_placa || 0}</td><td>${d.aplicacion_fluor || 0}</td>
          <td>${d.profilaxis || 0}</td><td>${d.curetaje || 0}</td><td>${d.farmacoterapia || 0}</td><td>${d.desensibilizante || 0}</td><td>${d.amalgama || 0}</td><td>${d.resina || 0}</td><td>${d.extraccion || 0}</td>
          <td>${d.biometria_hematica || 0}</td><td>${d.tiempo_coagulacion || 0}</td><td>${d.pruebas_rapidas || 0}</td><td>${d.radio_panoramica || 0}</td><td>${d.radio_periapical || 0}</td>
          <td><strong>${d.total_dia || 0}</strong></td>
        </tr>
      `).join('')}
      <tr class="row-total">
        <td>TOTAL</td>
        <td>${totales.absceso}</td><td>${totales.caries}</td><td>${totales.gingivitis}</td><td>${totales.periodontitis}</td><td>${totales.abrasion}</td><td>${totales.bruxismo}</td><td>${totales.tecnica_cepillado}</td><td>${totales.hilo_dental}</td><td>${totales.deteccion_placa}</td><td>${totales.aplicacion_fluor}</td>
        <td>${totales.profilaxis}</td><td>${totales.curetaje}</td><td>${totales.farmacoterapia}</td><td>${totales.desensibilizante}</td><td>${totales.amalgama}</td><td>${totales.resina}</td><td>${totales.extraccion}</td>
        <td>${totales.biometria_hematica}</td><td>${totales.tiempo_coagulacion}</td><td>${totales.pruebas_rapidas}</td><td>${totales.radio_panoramica}</td><td>${totales.radio_periapical}</td>
        <td>${total_general_mes}</td>
      </tr>
    </table>
  `;

  return envolverHtmlParaExcel({
    titulo: `Concentrado Mensual Odontología ${nombreMes}`,
    tablasHtml: tablaHtml
  });
}

module.exports = {
  renderizarMensualHtml,
  renderizarMensualExcel
};
