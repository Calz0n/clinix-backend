// Plantilla HTML y Excel del Concentrado Mensual Oficial de Psicología
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
// Reproducción exacta de la hoja física oficial (WhatsApp Image 2026-10-07 at 12.02.05 (1).jpeg)

const { obtenerLogoHtml } = require('../common/logo');
const estilosPrint = require('../common/estilosPrint');
const { envolverHtmlParaExcel } = require('../common/excelWrapper');

const NOMBRES_MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

function renderizarMensualHtml(datos) {
  const { periodo, dias, totales, psicologo = 'Lic. Especialista en Psicología' } = datos;
  const { anio, mes, total_dias } = periodo;
  const nombreMes = NOMBRES_MESES[parseInt(mes, 10) - 1] || `MES ${mes}`;
  const logoHtml = obtenerLogoHtml({ height: 105 });

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Concentrado Mensual Psicología - ${nombreMes} ${anio}</title>
    <style>
      ${estilosPrint}
      .tabla-mensual-psico th {
        font-size: 9.8px;
        padding: 2px 1px;
        line-height: 1.1;
      }
      .tabla-mensual-psico td {
        font-size: 10.5px; font-weight: bold;
        height: 17px;
        padding: 1px 1px;
        text-align: center;
      }
      .rot-th {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
        font-size: 9px;
        font-weight: bold;
        padding: 4px 1px;
        max-height: 96px;
        margin: 0 auto;
      }
      .hdr-sec-pob {
        background-color: #f1f5f9;
        font-weight: bold;
        border-bottom: 2px solid #0f172a;
      }
      .hdr-sec-cau {
        background-color: #f8fafc;
        font-weight: bold;
        border-bottom: 2px solid #0f172a;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <a href="/api/estadisticas/mensual/excel?anio=${anio}&mes=${mes}&area=PSICOLOGIA" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
    </div>

    <div class="pagina-reporte">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">REPORTE MENSUAL DE PSICOLOGÍA</div>
          <div style="font-size: 8.5px; font-weight: bold; color: #475569; margin-top: 2px;">
            DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL &bull; COATZACOALCOS
          </div>
        </div>
      </div>

      <div class="meta-subbar" style="margin-bottom: 6px;">
        <div><strong>NOMBRE DEL PROFESIONISTA:</strong> <span style="text-decoration: underline; padding-left: 6px;">${psicologo}</span></div>
        <div><strong>REPORTE MENSUAL:</strong> <span style="font-weight: bold; text-decoration: underline; padding-left: 6px;">${nombreMes} ${anio}</span></div>
      </div>

      <table class="tabla-oficial tabla-mensual-psico">
        <thead>
          <!-- Fila 1: Títulos Mayores -->
          <tr>
            <th rowspan="4" style="width: 20px;">No.</th>
            <th rowspan="4" style="width: 50px;">FECHA</th>
            <th colspan="12" class="hdr-sec-pob">DIAGNÓSTICO DE POBLACIÓN</th>
            <th colspan="12" class="hdr-sec-cau">SERVICIOS OTORGADOS A POBLACIÓN CAUTIVA</th>
          </tr>
          <!-- Fila 2: Categorías Principales -->
          <tr>
            <th colspan="2">SEXO</th>
            <th colspan="2">TIPO</th>
            <th colspan="2">TOTAL DE PERSONAS</th>
            <th colspan="6">ETAPAS DE DESARROLLO</th>

            <th colspan="2">SEXO</th>
            <th colspan="2">TIPO</th>
            <th colspan="2">TOTAL DE PERSONAS</th>
            <th colspan="6">ETAPAS DE DESARROLLO</th>
          </tr>
          <!-- Fila 3: Subgrupos -->
          <tr>
            <th rowspan="2" class="rot-th">FEMENINO</th>
            <th rowspan="2" class="rot-th">MASCULINO</th>
            <th rowspan="2" class="rot-th">PRIMERA VEZ</th>
            <th rowspan="2" class="rot-th">SUBSECUENTE</th>
            <th rowspan="2" class="rot-th">SANAS</th>
            <th rowspan="2" class="rot-th">ENFERMAS</th>
            <th rowspan="2" class="rot-th">NIÑEZ</th>
            <th colspan="2">ADOLESCENCIA</th>
            <th colspan="3">ADULTEZ</th>

            <th rowspan="2" class="rot-th">FEMENINO</th>
            <th rowspan="2" class="rot-th">MASCULINO</th>
            <th rowspan="2" class="rot-th">PRIMERA VEZ</th>
            <th rowspan="2" class="rot-th">SUBSECUENTE</th>
            <th rowspan="2" class="rot-th">SANAS</th>
            <th rowspan="2" class="rot-th">ENFERMAS</th>
            <th rowspan="2" class="rot-th">NIÑEZ</th>
            <th colspan="2">ADOLESCENCIA</th>
            <th colspan="3">ADULTEZ</th>
          </tr>
          <!-- Fila 4: Sub-etapas de Desarrollo -->
          <tr>
            <th class="rot-th">TEMPRANA</th>
            <th class="rot-th">TARDÍA</th>
            <th class="rot-th">TEMPRANA</th>
            <th class="rot-th">MEDIA</th>
            <th class="rot-th">TARDÍA</th>

            <th class="rot-th">TEMPRANA</th>
            <th class="rot-th">TARDÍA</th>
            <th class="rot-th">TEMPRANA</th>
            <th class="rot-th">MEDIA</th>
            <th class="rot-th">TARDÍA</th>
          </tr>
        </thead>
        <tbody>
          ${dias.map((d, idx) => {
            const fechaStr = `${String(d.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
            return `
            <tr>
              <td><strong>${d.dia}</strong></td>
              <td>${fechaStr}</td>
              <!-- Diagnóstico de Población -->
              <td>${d.pob_f || ''}</td>
              <td>${d.pob_m || ''}</td>
              <td>${d.pob_1ra || ''}</td>
              <td>${d.pob_sub || ''}</td>
              <td>${d.pob_sanas || ''}</td>
              <td>${d.pob_enfermas || ''}</td>
              <td>${d.pob_ninez || ''}</td>
              <td>${d.pob_adol_temp || ''}</td>
              <td>${d.pob_adol_tard || ''}</td>
              <td>${d.pob_adul_temp || ''}</td>
              <td>${d.pob_adul_media || ''}</td>
              <td>${d.pob_adul_tard || ''}</td>

              <!-- Población Cautiva -->
              <td>${d.cau_f || ''}</td>
              <td>${d.cau_m || ''}</td>
              <td>${d.cau_1ra || ''}</td>
              <td>${d.cau_sub || ''}</td>
              <td>${d.cau_sanas || ''}</td>
              <td>${d.cau_enfermas || ''}</td>
              <td>${d.cau_ninez || ''}</td>
              <td>${d.cau_adol_temp || ''}</td>
              <td>${d.cau_adol_tard || ''}</td>
              <td>${d.cau_adul_temp || ''}</td>
              <td>${d.cau_adul_media || ''}</td>
              <td>${d.cau_adul_tard || ''}</td>
            </tr>
            `;
          }).join('')}
          <!-- Fila de Totales -->
          <tr class="row-total">
            <td colspan="2"><strong>TOTAL</strong></td>
            <!-- Totales Población -->
            <td><strong>${totales.pob_f || 0}</strong></td>
            <td><strong>${totales.pob_m || 0}</strong></td>
            <td><strong>${totales.pob_1ra || 0}</strong></td>
            <td><strong>${totales.pob_sub || 0}</strong></td>
            <td><strong>${totales.pob_sanas || 0}</strong></td>
            <td><strong>${totales.pob_enfermas || 0}</strong></td>
            <td><strong>${totales.pob_ninez || 0}</strong></td>
            <td><strong>${totales.pob_adol_temp || 0}</strong></td>
            <td><strong>${totales.pob_adol_tard || 0}</strong></td>
            <td><strong>${totales.pob_adul_temp || 0}</strong></td>
            <td><strong>${totales.pob_adul_media || 0}</strong></td>
            <td><strong>${totales.pob_adul_tard || 0}</strong></td>

            <!-- Totales Cautiva -->
            <td><strong>${totales.cau_f || 0}</strong></td>
            <td><strong>${totales.cau_m || 0}</strong></td>
            <td><strong>${totales.cau_1ra || 0}</strong></td>
            <td><strong>${totales.cau_sub || 0}</strong></td>
            <td><strong>${totales.cau_sanas || 0}</strong></td>
            <td><strong>${totales.cau_enfermas || 0}</strong></td>
            <td><strong>${totales.cau_ninez || 0}</strong></td>
            <td><strong>${totales.cau_adol_temp || 0}</strong></td>
            <td><strong>${totales.cau_adol_tard || 0}</strong></td>
            <td><strong>${totales.cau_adul_temp || 0}</strong></td>
            <td><strong>${totales.cau_adul_media || 0}</strong></td>
            <td><strong>${totales.cau_adul_tard || 0}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

function renderizarMensualExcel(datos) {
  const { periodo, dias, totales, psicologo = 'Lic. Especialista en Psicología' } = datos;
  const { anio, mes } = periodo;
  const nombreMes = NOMBRES_MESES[parseInt(mes, 10) - 1] || `MES ${mes}`;

  const tablaHtml = `
    <table>
      <tr>
        <th colspan="26" class="hdr-main">H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="26" class="hdr-sub">CONCENTRADO MENSUAL DE PSICOLOGÍA &bull; REPORTE: ${nombreMes} ${anio}</th>
      </tr>
      <tr>
        <td colspan="13" class="hdr-meta text-left"><strong>NOMBRE DEL PROFESIONISTA:</strong> ${psicologo}</td>
        <td colspan="13" class="hdr-meta text-right"><strong>TOTAL PACIENTES ATENDIDOS EN EL MES:</strong> ${totales.total_dia || 0}</td>
      </tr>
      <!-- Encabezados -->
      <tr>
        <th rowspan="3" class="th-super">No.</th>
        <th rowspan="3" class="th-super">FECHA</th>
        <th colspan="12" class="th-super">DIAGNÓSTICO DE POBLACIÓN</th>
        <th colspan="12" class="th-super">SERVICIOS OTORGADOS A POBLACIÓN CAUTIVA</th>
      </tr>
      <tr>
        <!-- Población Abierta -->
        <th colspan="2" class="th-col">SEXO</th>
        <th colspan="2" class="th-col">TIPO</th>
        <th colspan="2" class="th-col">TOTAL DE PERSONAS</th>
        <th colspan="6" class="th-col">ETAPAS DE DESARROLLO</th>
        <!-- Población Cautiva -->
        <th colspan="2" class="th-col">SEXO</th>
        <th colspan="2" class="th-col">TIPO</th>
        <th colspan="2" class="th-col">TOTAL DE PERSONAS</th>
        <th colspan="6" class="th-col">ETAPAS DE DESARROLLO</th>
      </tr>
      <tr>
        <!-- Pob Abierta Subcolumnas -->
        <th class="th-col">FEM</th>
        <th class="th-col">MASC</th>
        <th class="th-col">1RA VEZ</th>
        <th class="th-col">SUBSEC</th>
        <th class="th-col">SANAS</th>
        <th class="th-col">ENFERMAS</th>
        <th class="th-col">NIÑEZ</th>
        <th class="th-col">ADOL TEMP</th>
        <th class="th-col">ADOL TARD</th>
        <th class="th-col">ADUL TEMP</th>
        <th class="th-col">ADUL MED</th>
        <th class="th-col">ADUL TARD</th>
        <!-- Pob Cautiva Subcolumnas -->
        <th class="th-col">FEM</th>
        <th class="th-col">MASC</th>
        <th class="th-col">1RA VEZ</th>
        <th class="th-col">SUBSEC</th>
        <th class="th-col">SANAS</th>
        <th class="th-col">ENFERMAS</th>
        <th class="th-col">NIÑEZ</th>
        <th class="th-col">ADOL TEMP</th>
        <th class="th-col">ADOL TARD</th>
        <th class="th-col">ADUL TEMP</th>
        <th class="th-col">ADUL MED</th>
        <th class="th-col">ADUL TARD</th>
      </tr>
      <!-- Filas de Días -->
      ${dias.map(d => {
        const fechaStr = `${String(d.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
        return `
        <tr>
          <td>${d.dia}</td>
          <td>${fechaStr}</td>
          <td>${d.pob_f || 0}</td>
          <td>${d.pob_m || 0}</td>
          <td>${d.pob_1ra || 0}</td>
          <td>${d.pob_sub || 0}</td>
          <td>${d.pob_sanas || 0}</td>
          <td>${d.pob_enfermas || 0}</td>
          <td>${d.pob_ninez || 0}</td>
          <td>${d.pob_adol_temp || 0}</td>
          <td>${d.pob_adol_tard || 0}</td>
          <td>${d.pob_adul_temp || 0}</td>
          <td>${d.pob_adul_media || 0}</td>
          <td>${d.pob_adul_tard || 0}</td>

          <td>${d.cau_f || 0}</td>
          <td>${d.cau_m || 0}</td>
          <td>${d.cau_1ra || 0}</td>
          <td>${d.cau_sub || 0}</td>
          <td>${d.cau_sanas || 0}</td>
          <td>${d.cau_enfermas || 0}</td>
          <td>${d.cau_ninez || 0}</td>
          <td>${d.cau_adol_temp || 0}</td>
          <td>${d.cau_adol_tard || 0}</td>
          <td>${d.cau_adul_temp || 0}</td>
          <td>${d.cau_adul_media || 0}</td>
          <td>${d.cau_adul_tard || 0}</td>
        </tr>
        `;
      }).join('')}
      <!-- Fila de Totales -->
      <tr class="row-total">
        <td colspan="2">TOTAL</td>
        <td>${totales.pob_f || 0}</td>
        <td>${totales.pob_m || 0}</td>
        <td>${totales.pob_1ra || 0}</td>
        <td>${totales.pob_sub || 0}</td>
        <td>${totales.pob_sanas || 0}</td>
        <td>${totales.pob_enfermas || 0}</td>
        <td>${totales.pob_ninez || 0}</td>
        <td>${totales.pob_adol_temp || 0}</td>
        <td>${totales.pob_adol_tard || 0}</td>
        <td>${totales.pob_adul_temp || 0}</td>
        <td>${totales.pob_adul_media || 0}</td>
        <td>${totales.pob_adul_tard || 0}</td>

        <td>${totales.cau_f || 0}</td>
        <td>${totales.cau_m || 0}</td>
        <td>${totales.cau_1ra || 0}</td>
        <td>${totales.cau_sub || 0}</td>
        <td>${totales.cau_sanas || 0}</td>
        <td>${totales.cau_enfermas || 0}</td>
        <td>${totales.cau_ninez || 0}</td>
        <td>${totales.cau_adol_temp || 0}</td>
        <td>${totales.cau_adol_tard || 0}</td>
        <td>${totales.cau_adul_temp || 0}</td>
        <td>${totales.cau_adul_media || 0}</td>
        <td>${totales.cau_adul_tard || 0}</td>
      </tr>
    </table>
  `;

  return envolverHtmlParaExcel({
    titulo: `Concentrado Mensual Psicología ${nombreMes} ${anio}`,
    tablasHtml: tablaHtml
  });
}

module.exports = {
  renderizarMensualHtml,
  renderizarMensualExcel
};
