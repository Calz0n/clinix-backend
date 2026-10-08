// Plantilla HTML y Excel del Concentrado Mensual Oficial de Enfermería
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
// Reproducción exacta de la hoja física oficial (WhatsApp Image 2026-10-07 at 12.03.17 (1).jpeg)

const { obtenerLogoHtml } = require('../common/logo');
const estilosPrint = require('../common/estilosPrint');
const { envolverHtmlParaExcel } = require('../common/excelWrapper');

const NOMBRES_MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

function renderizarMensualHtml(datos) {
  const { periodo, dias, totales, enfermero = 'Enf. Personal de Enfermería' } = datos;
  const { anio, mes } = periodo;
  const nombreMes = NOMBRES_MESES[parseInt(mes, 10) - 1] || `MES ${mes}`;
  const logoHtml = obtenerLogoHtml({ height: 76 });

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Concentrado Mensual de Enfermería - ${nombreMes} ${anio}</title>
    <style>
      ${estilosPrint}
      .tabla-m-enf th {
        font-size: 6px;
        padding: 2px 1px;
        line-height: 1.05;
      }
      .tabla-m-enf td {
        font-size: 7px;
        height: 15px;
        padding: 1px 1px;
        text-align: center;
      }
      .rot-th-enf {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
        font-size: 5.8px;
        font-weight: bold;
        padding: 3px 1px;
        max-height: 80px;
        margin: 0 auto;
      }
      .hdr-sec-enf-a {
        background-color: #f1f5f9;
        font-weight: bold;
        border-bottom: 2px solid #0f172a;
      }
      .hdr-sec-enf-b {
        background-color: #f8fafc;
        font-weight: bold;
        border-bottom: 2px solid #0f172a;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <a href="/api/estadisticas/mensual/excel?anio=${anio}&mes=${mes}&area=ENFERMERIA" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
    </div>

    <div class="pagina-reporte">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">CONCENTRADO MENSUAL DE ENFERMERÍA</div>
          <div style="font-size: 8px; font-weight: bold; color: #475569; margin-top: 1px;">
            DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL &bull; COATZACOALCOS
          </div>
          <div style="display: inline-block; border: 1.5px solid #0f172a; border-radius: 4px; padding: 2px 8px; margin-top: 3px; background-color: #f8fafc;">
            <span style="font-size: 7.5px; font-weight: bold; color: #64748b;">PERIODO:</span>
            <strong style="font-size: 8.5px; color: #0f172a; margin-left: 4px;">${nombreMes} ${anio}</strong>
          </div>
        </div>
      </div>

      <div class="meta-subbar" style="margin-bottom: 4px;">
        <div><strong>Nombre del enfermero (a):</strong> <span style="text-decoration: underline; padding-left: 6px;">${enfermero}</span></div>
        <div><strong>Total Atenciones en el Mes:</strong> <strong>${totales.total_dia || 0}</strong></div>
      </div>

      <table class="tabla-oficial tabla-m-enf">
        <thead>
          <tr>
            <th rowspan="2" style="width: 18px;">No.</th>
            <th rowspan="2" style="width: 50px;">FECHA</th>
            <th colspan="2" style="width: 40px;">SEXO</th>
            <th rowspan="2" style="width: 32px;"><div class="rot-th-enf">T/A</div></th>
            <th rowspan="2" style="width: 34px;"><div class="rot-th-enf">GLUCOSA</div></th>
            <th rowspan="2" style="width: 28px;"><div class="rot-th-enf">FC</div></th>
            <th rowspan="2" style="width: 28px;"><div class="rot-th-enf">FR</div></th>
            <th rowspan="2" style="width: 32px;"><div class="rot-th-enf">TEMPERATURA</div></th>
            <th rowspan="2" style="width: 32px;"><div class="rot-th-enf">SAT DE O2</div></th>
            <th colspan="2" class="hdr-sec-enf-a">SOMATOMETRÍA</th>
            <th colspan="2" class="hdr-sec-enf-b">DETECCIONES</th>
            <th colspan="8" class="hdr-sec-enf-a">OTROS SERVICIOS</th>
          </tr>
          <tr>
            <th style="width: 20px;">F</th>
            <th style="width: 20px;">M</th>
            <!-- Somatometría -->
            <th style="width: 30px;"><div class="rot-th-enf">PESO</div></th>
            <th style="width: 30px;"><div class="rot-th-enf">TALLA</div></th>
            <!-- Detecciones -->
            <th style="width: 30px;"><div class="rot-th-enf">HAS</div></th>
            <th style="width: 30px;"><div class="rot-th-enf">DM</div></th>
            <!-- Otros Servicios -->
            <th style="width: 34px;"><div class="rot-th-enf">RETIRO DE PUNTOS</div></th>
            <th style="width: 34px;"><div class="rot-th-enf">INYECCIONES</div></th>
            <th style="width: 34px;"><div class="rot-th-enf">CURACIONES</div></th>
            <th style="width: 34px;"><div class="rot-th-enf">NEBULIZACIONES</div></th>
            <th style="width: 34px;"><div class="rot-th-enf">PRUEBAS RÁPIDAS</div></th>
            <th style="width: 34px;"><div class="rot-th-enf">EXP. MAMA</div></th>
            <th style="width: 34px;"><div class="rot-th-enf">JORNADAS</div></th>
            <th style="width: 30px;"><div class="rot-th-enf">OTROS</div></th>
          </tr>
        </thead>
        <tbody>
          ${dias.map(d => {
            const fechaStr = `${String(d.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
            return `
            <tr>
              <td><strong>${d.dia}</strong></td>
              <td>${fechaStr}</td>
              <td>${d.sexo_f || ''}</td>
              <td>${d.sexo_m || ''}</td>
              <td>${d.toma_ta || ''}</td>
              <td>${d.toma_glucosa || ''}</td>
              <td>${d.toma_fc || ''}</td>
              <td>${d.toma_fr || ''}</td>
              <td>${d.toma_temp || ''}</td>
              <td>${d.toma_spo2 || ''}</td>
              <td>${d.toma_peso || ''}</td>
              <td>${d.toma_talla || ''}</td>
              <td>${d.det_has || ''}</td>
              <td>${d.det_dm || ''}</td>
              <td>${d.proc_puntos || ''}</td>
              <td>${d.proc_inyeccion || ''}</td>
              <td>${d.proc_curacion || ''}</td>
              <td>${d.proc_nebulizacion || ''}</td>
              <td>${d.proc_pruebas_rapidas || ''}</td>
              <td>${d.proc_exp_mama || ''}</td>
              <td>${d.proc_jornada || ''}</td>
              <td>${d.proc_otros || ''}</td>
            </tr>
            `;
          }).join('')}
          <tr class="row-total">
            <td colspan="2"><strong>TOTAL</strong></td>
            <td><strong>${totales.sexo_f || 0}</strong></td>
            <td><strong>${totales.sexo_m || 0}</strong></td>
            <td><strong>${totales.toma_ta || 0}</strong></td>
            <td><strong>${totales.toma_glucosa || 0}</strong></td>
            <td><strong>${totales.toma_fc || 0}</strong></td>
            <td><strong>${totales.toma_fr || 0}</strong></td>
            <td><strong>${totales.toma_temp || 0}</strong></td>
            <td><strong>${totales.toma_spo2 || 0}</strong></td>
            <td><strong>${totales.toma_peso || 0}</strong></td>
            <td><strong>${totales.toma_talla || 0}</strong></td>
            <td><strong>${totales.det_has || 0}</strong></td>
            <td><strong>${totales.det_dm || 0}</strong></td>
            <td><strong>${totales.proc_puntos || 0}</strong></td>
            <td><strong>${totales.proc_inyeccion || 0}</strong></td>
            <td><strong>${totales.proc_curacion || 0}</strong></td>
            <td><strong>${totales.proc_nebulizacion || 0}</strong></td>
            <td><strong>${totales.proc_pruebas_rapidas || 0}</strong></td>
            <td><strong>${totales.proc_exp_mama || 0}</strong></td>
            <td><strong>${totales.proc_jornada || 0}</strong></td>
            <td><strong>${totales.proc_otros || 0}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

function renderizarMensualExcel(datos) {
  const { periodo, dias, totales, enfermero = 'Enf. Personal de Enfermería' } = datos;
  const { anio, mes } = periodo;
  const nombreMes = NOMBRES_MESES[parseInt(mes, 10) - 1] || `MES ${mes}`;

  const tablaHtml = `
    <table>
      <tr>
        <th colspan="22" class="hdr-main">GOBIERNO DE LA CIUDAD DE COATZACOALCOS 2026 - 2029 &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="22" class="hdr-sub">CONCENTRADO MENSUAL DE ENFERMERÍA &bull; PERIODO: ${nombreMes} ${anio}</th>
      </tr>
      <tr>
        <td colspan="11" class="hdr-meta text-left"><strong>Nombre del enfermero (a):</strong> ${enfermero}</td>
        <td colspan="11" class="hdr-meta text-right"><strong>TOTAL ATENCIONES EN EL MES:</strong> ${totales.total_dia || 0}</td>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">No.</th>
        <th rowspan="2" class="th-super">FECHA</th>
        <th colspan="2" class="th-super">SEXO</th>
        <th rowspan="2" class="th-super">T/A</th>
        <th rowspan="2" class="th-super">GLUCOSA</th>
        <th rowspan="2" class="th-super">FC</th>
        <th rowspan="2" class="th-super">FR</th>
        <th rowspan="2" class="th-super">TEMPERATURA</th>
        <th rowspan="2" class="th-super">SAT DE O2</th>
        <th colspan="2" class="th-super">SOMATOMETRÍA</th>
        <th colspan="2" class="th-super">DETECCIONES</th>
        <th colspan="8" class="th-super">OTROS SERVICIOS</th>
      </tr>
      <tr>
        <th class="th-col">F</th>
        <th class="th-col">M</th>
        <th class="th-col">PESO</th>
        <th class="th-col">TALLA</th>
        <th class="th-col">HAS</th>
        <th class="th-col">DM</th>
        <th class="th-col">RET. PUNTOS</th>
        <th class="th-col">INYECCIONES</th>
        <th class="th-col">CURACIONES</th>
        <th class="th-col">NEBULIZAC.</th>
        <th class="th-col">P. RÁPIDAS</th>
        <th class="th-col">EXP. MAMA</th>
        <th class="th-col">JORNADAS</th>
        <th class="th-col">OTROS</th>
      </tr>
      ${dias.map(d => {
        const fechaStr = `${String(d.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
        return `
        <tr>
          <td>${d.dia}</td>
          <td>${fechaStr}</td>
          <td>${d.sexo_f || 0}</td>
          <td>${d.sexo_m || 0}</td>
          <td>${d.toma_ta || 0}</td>
          <td>${d.toma_glucosa || 0}</td>
          <td>${d.toma_fc || 0}</td>
          <td>${d.toma_fr || 0}</td>
          <td>${d.toma_temp || 0}</td>
          <td>${d.toma_spo2 || 0}</td>
          <td>${d.toma_peso || 0}</td>
          <td>${d.toma_talla || 0}</td>
          <td>${d.det_has || 0}</td>
          <td>${d.det_dm || 0}</td>
          <td>${d.proc_puntos || 0}</td>
          <td>${d.proc_inyeccion || 0}</td>
          <td>${d.proc_curacion || 0}</td>
          <td>${d.proc_nebulizacion || 0}</td>
          <td>${d.proc_pruebas_rapidas || 0}</td>
          <td>${d.proc_exp_mama || 0}</td>
          <td>${d.proc_jornada || 0}</td>
          <td>${d.proc_otros || 0}</td>
        </tr>
        `;
      }).join('')}
      <tr class="row-total">
        <td colspan="2">TOTAL</td>
        <td>${totales.sexo_f || 0}</td>
        <td>${totales.sexo_m || 0}</td>
        <td>${totales.toma_ta || 0}</td>
        <td>${totales.toma_glucosa || 0}</td>
        <td>${totales.toma_fc || 0}</td>
        <td>${totales.toma_fr || 0}</td>
        <td>${totales.toma_temp || 0}</td>
        <td>${totales.toma_spo2 || 0}</td>
        <td>${totales.toma_peso || 0}</td>
        <td>${totales.toma_talla || 0}</td>
        <td>${totales.det_has || 0}</td>
        <td>${totales.det_dm || 0}</td>
        <td>${totales.proc_puntos || 0}</td>
        <td>${totales.proc_inyeccion || 0}</td>
        <td>${totales.proc_curacion || 0}</td>
        <td>${totales.proc_nebulizacion || 0}</td>
        <td>${totales.proc_pruebas_rapidas || 0}</td>
        <td>${totales.proc_exp_mama || 0}</td>
        <td>${totales.proc_jornada || 0}</td>
        <td>${totales.proc_otros || 0}</td>
      </tr>
    </table>
  `;

  return envolverHtmlParaExcel({
    titulo: `Concentrado Mensual Enfermería ${nombreMes} ${anio}`,
    tablasHtml: tablaHtml
  });
}

module.exports = {
  renderizarMensualHtml,
  renderizarMensualExcel
};
