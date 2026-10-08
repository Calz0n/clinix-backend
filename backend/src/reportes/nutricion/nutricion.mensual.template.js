// Plantilla HTML y Excel del Concentrado Mensual Oficial de Nutrición
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
// Reproduce con exactitud las 3 Hojas Oficiales del Padrón de Nutrición

const { obtenerLogoHtml } = require('../common/logo');
const estilosPrint = require('../common/estilosPrint');
const { envolverHtmlParaExcel } = require('../common/excelWrapper');

const MESES = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

function renderizarMensualHtml(datos) {
  const { periodo, hoja1, hoja2, hoja3, total_general_mes } = datos;
  const { anio, mes } = periodo;
  const nombreMes = MESES[parseInt(mes, 10)] || `MES ${mes}`;
  const logoHtml = obtenerLogoHtml({ height: 105 });

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Concentrado Mensual de Nutrición - ${nombreMes} ${anio}</title>
    <style>
      ${estilosPrint}
      .tabla-mensual-nutricion th {
        font-size: 6.5px;
        padding: 2.5px 0.5px;
      }
      .tabla-mensual-nutricion td {
        font-size: 7px;
        height: 14px;
        padding: 1px 0.5px;
      }
      .rot-col {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
        font-size: 6.5px;
        font-weight: bold;
        padding: 4px 1px;
        max-height: 80px;
      }
      .page-break {
        page-break-before: always;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF (3 Hojas)</button>
      <a href="/api/estadisticas/mensual/excel?anio=${anio}&mes=${mes}&area=NUTRICION" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
    </div>

    <!-- ======================================================== -->
    <!-- HOJA 1: DIAGNÓSTICO DE POBLACIÓN Y SERVICIOS CAUTIVA     -->
    <!-- ======================================================== -->
    <div class="pagina-reporte">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">H. AYUNTAMIENTO DE COATZACOALCOS</div>
          <div class="subtitulo-institucion">DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</div>
          <div class="fecha-box-container">
            <div class="fecha-cell">ÁREA<strong>NUTRICIÓN</strong></div>
            <div class="fecha-cell">MES<strong>${nombreMes}</strong></div>
            <div class="fecha-cell">AÑO<strong>${anio}</strong></div>
          </div>
        </div>
      </div>

      <div class="meta-subbar">
        <div><strong>HOJA 1 DE 3:</strong> DIAGNÓSTICO DE POBLACIÓN ABIERTA Y POBLACIÓN CAUTIVA</div>
        <div><strong>TOTAL ATENCIONES DEL MES:</strong> ${total_general_mes}</div>
      </div>

      <table class="tabla-oficial tabla-mensual-nutricion">
        <thead>
          <tr>
            <th rowspan="3" style="width: 30px;">FECHA</th>
            <th colspan="8" class="th-super">DIAGNÓSTICO DE POBLACIÓN (POBLACIÓN ABIERTA)</th>
            <th colspan="8" class="th-super">SERVICIOS OTORGADOS A POBLACIÓN CAUTIVA (TRABAJADORES DEL MUNICIPIO)</th>
            <th rowspan="3" style="width: 45px;">TOTAL DÍA</th>
          </tr>
          <tr>
            <th colspan="2">SEXO</th>
            <th rowspan="2" style="width: 38px;">1RA VEZ</th>
            <th rowspan="2" style="width: 44px;">SUBSECUENTE</th>
            <th colspan="2">POBLACIÓN</th>
            <th colspan="2">CANALIZAR</th>

            <th colspan="2">SEXO</th>
            <th rowspan="2" style="width: 38px;">1RA VEZ</th>
            <th rowspan="2" style="width: 44px;">SUBSECUENTE</th>
            <th colspan="2">POBLACIÓN</th>
            <th colspan="2">CANALIZAR</th>
          </tr>
          <tr>
            <th style="width: 20px;">F</th>
            <th style="width: 20px;">M</th>
            <th style="width: 32px;">SANA</th>
            <th style="width: 38px;">ENFERMA</th>
            <th style="width: 48px;">MEDICINA GENERAL</th>
            <th style="width: 48px;">ESPECIALISTA</th>

            <th style="width: 20px;">F</th>
            <th style="width: 20px;">M</th>
            <th style="width: 32px;">SANA</th>
            <th style="width: 38px;">ENFERMA</th>
            <th style="width: 48px;">MEDICINA GENERAL</th>
            <th style="width: 48px;">ESPECIALISTA</th>
          </tr>
        </thead>
        <tbody>
          ${hoja1.dias.map(d => `
            <tr>
              <td><strong>${d.dia}</strong></td>
              <td>${d.pob_f || 0}</td>
              <td>${d.pob_m || 0}</td>
              <td>${d.pob_1ra || 0}</td>
              <td>${d.pob_sub || 0}</td>
              <td>${d.pob_sana || 0}</td>
              <td>${d.pob_enferma || 0}</td>
              <td>${d.pob_med || 0}</td>
              <td>${d.pob_esp || 0}</td>
              <td>${d.cau_f || 0}</td>
              <td>${d.cau_m || 0}</td>
              <td>${d.cau_1ra || 0}</td>
              <td>${d.cau_sub || 0}</td>
              <td>${d.cau_sana || 0}</td>
              <td>${d.cau_enferma || 0}</td>
              <td>${d.cau_med || 0}</td>
              <td>${d.cau_esp || 0}</td>
              <td><strong>${d.total_dia || 0}</strong></td>
            </tr>
          `).join('')}
          <tr class="row-total">
            <td>TOTAL</td>
            <td>${hoja1.totales.pob_f}</td>
            <td>${hoja1.totales.pob_m}</td>
            <td>${hoja1.totales.pob_1ra}</td>
            <td>${hoja1.totales.pob_sub}</td>
            <td>${hoja1.totales.pob_sana}</td>
            <td>${hoja1.totales.pob_enferma}</td>
            <td>${hoja1.totales.pob_med}</td>
            <td>${hoja1.totales.pob_esp}</td>
            <td>${hoja1.totales.cau_f}</td>
            <td>${hoja1.totales.cau_m}</td>
            <td>${hoja1.totales.cau_1ra}</td>
            <td>${hoja1.totales.cau_sub}</td>
            <td>${hoja1.totales.cau_sana}</td>
            <td>${hoja1.totales.cau_enferma}</td>
            <td>${hoja1.totales.cau_med}</td>
            <td>${hoja1.totales.cau_esp}</td>
            <td>${hoja1.totales.total_dia}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ======================================================== -->
    <!-- HOJA 2: PADECIMIENTOS (DIGESTIVAS, ECD, OTRAS)          -->
    <!-- ======================================================== -->
    <div class="pagina-reporte page-break">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">H. AYUNTAMIENTO DE COATZACOALCOS</div>
          <div class="subtitulo-institucion">DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</div>
          <div class="fecha-box-container">
            <div class="fecha-cell">ÁREA<strong>NUTRICIÓN</strong></div>
            <div class="fecha-cell">MES<strong>${nombreMes}</strong></div>
            <div class="fecha-cell">AÑO<strong>${anio}</strong></div>
          </div>
        </div>
      </div>

      <div class="meta-subbar">
        <div><strong>HOJA 2 DE 3:</strong> PADECIMIENTOS NUTRICIONALES Y CRÓNICOS</div>
        <div><strong>PERIODO:</strong> ${nombreMes} ${anio}</div>
      </div>

      <table class="tabla-oficial tabla-mensual-nutricion">
        <thead>
          <tr>
            <th rowspan="2" style="width: 26px;">FECHA</th>
            <th colspan="8" class="th-super">ENFERMEDADES DIGESTIVAS</th>
            <th colspan="7" class="th-super">ECD (CRÓNICO DEGENERATIVAS)</th>
            <th colspan="11" class="th-super">OTRAS ENFERMEDADES</th>
            <th rowspan="2" style="width: 38px;">TOTAL</th>
          </tr>
          <tr>
            <th style="width: 36px;"><div class="rot-col">ESTREÑIMIENTO</div></th>
            <th style="width: 36px;"><div class="rot-col">DIVERTICULOSIS</div></th>
            <th style="width: 32px;"><div class="rot-col">COLITIS</div></th>
            <th style="width: 32px;"><div class="rot-col">GASTRITIS</div></th>
            <th style="width: 38px;"><div class="rot-col">CÁLCULOS BILIARES</div></th>
            <th style="width: 36px;"><div class="rot-col">E. CELÍACA</div></th>
            <th style="width: 38px;"><div class="rot-col">REFLUJO GÁSTRICO</div></th>
            <th style="width: 30px;"><div class="rot-col">ETAS</div></th>

            <th style="width: 38px;"><div class="rot-col">HIPERTENSIÓN</div></th>
            <th style="width: 34px;"><div class="rot-col">DIABETES</div></th>
            <th style="width: 34px;"><div class="rot-col">OBESIDAD</div></th>
            <th style="width: 36px;"><div class="rot-col">SOBREPESO</div></th>
            <th style="width: 36px;"><div class="rot-col">HÍGADO GRASO</div></th>
            <th style="width: 36px;"><div class="rot-col">DAÑO RENAL</div></th>
            <th style="width: 34px;"><div class="rot-col">E. RENAL</div></th>

            <th style="width: 38px;"><div class="rot-col">HIPOTIROIDISMO</div></th>
            <th style="width: 32px;"><div class="rot-col">HIPER.</div></th>
            <th style="width: 38px;"><div class="rot-col">I. ALIMENTARIA</div></th>
            <th style="width: 32px;"><div class="rot-col">ANEMIA</div></th>
            <th style="width: 36px;"><div class="rot-col">OSTEOPOROSIS</div></th>
            <th style="width: 42px;"><div class="rot-col">TRASTORNOS ALIM.</div></th>
            <th style="width: 36px;"><div class="rot-col">DESNUTRICIÓN</div></th>
            <th style="width: 36px;"><div class="rot-col">ONCOLÓGICAS</div></th>
            <th style="width: 28px;"><div class="rot-col">VIH</div></th>
            <th style="width: 38px;"><div class="rot-col">DISLIPIDEMIAS</div></th>
            <th style="width: 30px;"><div class="rot-col">ECV</div></th>
          </tr>
        </thead>
        <tbody>
          ${hoja2.dias.map(d => `
            <tr>
              <td><strong>${d.dia}</strong></td>
              <td>${d.estrenimiento || 0}</td>
              <td>${d.diverticulosis || 0}</td>
              <td>${d.colitis || 0}</td>
              <td>${d.gastritis || 0}</td>
              <td>${d.calculos || 0}</td>
              <td>${d.celiaca || 0}</td>
              <td>${d.reflujo || 0}</td>
              <td>${d.etas || 0}</td>

              <td>${d.hipertension || 0}</td>
              <td>${d.diabetes || 0}</td>
              <td>${d.obesidad || 0}</td>
              <td>${d.sobrepeso || 0}</td>
              <td>${d.higado_graso || 0}</td>
              <td>${d.dano_renal || 0}</td>
              <td>${d.e_renal || 0}</td>

              <td>${d.hipotiroidismo || 0}</td>
              <td>${d.hiper || 0}</td>
              <td>${d.i_alimentaria || 0}</td>
              <td>${d.anemia || 0}</td>
              <td>${d.osteoporosis || 0}</td>
              <td>${d.trastornos_alim || 0}</td>
              <td>${d.desnutricion || 0}</td>
              <td>${d.oncologicas || 0}</td>
              <td>${d.vih || 0}</td>
              <td>${d.dislipidemias || 0}</td>
              <td>${d.ecv || 0}</td>
              <td><strong>${d.total_dia || 0}</strong></td>
            </tr>
          `).join('')}
          <tr class="row-total">
            <td>TOTAL</td>
            <td>${hoja2.totales.estrenimiento}</td>
            <td>${hoja2.totales.diverticulosis}</td>
            <td>${hoja2.totales.colitis}</td>
            <td>${hoja2.totales.gastritis}</td>
            <td>${hoja2.totales.calculos}</td>
            <td>${hoja2.totales.celiaca}</td>
            <td>${hoja2.totales.reflujo}</td>
            <td>${hoja2.totales.etas}</td>

            <td>${hoja2.totales.hipertension}</td>
            <td>${hoja2.totales.diabetes}</td>
            <td>${hoja2.totales.obesidad}</td>
            <td>${hoja2.totales.sobrepeso}</td>
            <td>${hoja2.totales.higado_graso}</td>
            <td>${hoja2.totales.dano_renal}</td>
            <td>${hoja2.totales.e_renal}</td>

            <td>${hoja2.totales.hipotiroidismo}</td>
            <td>${hoja2.totales.hiper}</td>
            <td>${hoja2.totales.i_alimentaria}</td>
            <td>${hoja2.totales.anemia}</td>
            <td>${hoja2.totales.osteoporosis}</td>
            <td>${hoja2.totales.trastornos_alim}</td>
            <td>${hoja2.totales.desnutricion}</td>
            <td>${hoja2.totales.oncologicas}</td>
            <td>${hoja2.totales.vih}</td>
            <td>${hoja2.totales.dislipidemias}</td>
            <td>${hoja2.totales.ecv}</td>
            <td>${hoja2.totales.total_dia}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ======================================================== -->
    <!-- HOJA 3: PEDIATRÍA Y LABORATORIO CLÍNICO EN SANGRE        -->
    <!-- ======================================================== -->
    <div class="pagina-reporte page-break">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">H. AYUNTAMIENTO DE COATZACOALCOS</div>
          <div class="subtitulo-institucion">DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</div>
          <div class="fecha-box-container">
            <div class="fecha-cell">ÁREA<strong>NUTRICIÓN</strong></div>
            <div class="fecha-cell">MES<strong>${nombreMes}</strong></div>
            <div class="fecha-cell">AÑO<strong>${anio}</strong></div>
          </div>
        </div>
      </div>

      <div class="meta-subbar">
        <div><strong>HOJA 3 DE 3:</strong> EVALUACIÓN PEDIÁTRICA Y CONTROL LABORATORIAL</div>
        <div><strong>PERIODO:</strong> ${nombreMes} ${anio}</div>
      </div>

      <table class="tabla-oficial tabla-mensual-nutricion">
        <thead>
          <tr>
            <th rowspan="2" style="width: 35px;">FECHA</th>
            <th colspan="5" class="th-super">ESTADO NUTRICIONAL EN PEDIATRÍA</th>
            <th colspan="4" class="th-super">LABORATORIO CLÍNICO EN SANGRE</th>
            <th rowspan="2" style="width: 60px;">TOTAL PEDIATRÍA</th>
            <th rowspan="2" style="width: 60px;">TOTAL LABS</th>
          </tr>
          <tr>
            <th style="width: 75px;"><div class="rot-col">DESNUTRICIÓN</div></th>
            <th style="width: 75px;"><div class="rot-col">RIESGO DE DESNUT.</div></th>
            <th style="width: 75px;"><div class="rot-col">NORMOPESO</div></th>
            <th style="width: 75px;"><div class="rot-col">RIESGO DE OBESIDAD</div></th>
            <th style="width: 75px;"><div class="rot-col">OBESIDAD</div></th>

            <th style="width: 60px;"><div class="rot-col">BH</div></th>
            <th style="width: 60px;"><div class="rot-col">QS</div></th>
            <th style="width: 70px;"><div class="rot-col">PERFIL DE LÍPIDOS</div></th>
            <th style="width: 60px;"><div class="rot-col">HbA1c</div></th>
          </tr>
        </thead>
        <tbody>
          ${hoja3.dias.map(d => `
            <tr>
              <td><strong>${d.dia}</strong></td>
              <td>${d.ped_desnutricion || 0}</td>
              <td>${d.ped_riesgo_desnut || 0}</td>
              <td>${d.ped_normopeso || 0}</td>
              <td>${d.ped_riesgo_obesidad || 0}</td>
              <td>${d.ped_obesidad || 0}</td>

              <td>${d.lab_bh || 0}</td>
              <td>${d.lab_qs || 0}</td>
              <td>${d.lab_lipidos || 0}</td>
              <td>${d.lab_hba1c || 0}</td>
              <td><strong>${d.total_pediatria || 0}</strong></td>
              <td><strong>${d.total_labs || 0}</strong></td>
            </tr>
          `).join('')}
          <tr class="row-total">
            <td>TOTAL</td>
            <td>${hoja3.totales.ped_desnutricion}</td>
            <td>${hoja3.totales.ped_riesgo_desnut}</td>
            <td>${hoja3.totales.ped_normopeso}</td>
            <td>${hoja3.totales.ped_riesgo_obesidad}</td>
            <td>${hoja3.totales.ped_obesidad}</td>

            <td>${hoja3.totales.lab_bh}</td>
            <td>${hoja3.totales.lab_qs}</td>
            <td>${hoja3.totales.lab_lipidos}</td>
            <td>${hoja3.totales.lab_hba1c}</td>
            <td>${hoja3.totales.total_pediatria}</td>
            <td>${hoja3.totales.total_labs}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

function renderizarMensualExcel(datos) {
  const { periodo, hoja1, hoja2, hoja3, total_general_mes } = datos;
  const { anio, mes } = periodo;
  const nombreMes = MESES[parseInt(mes, 10)] || `MES ${mes}`;

  const tablasHtml = `
    <!-- TABLA 1: DIAGNÓSTICO DE POBLACIÓN Y SERVICIOS CAUTIVA -->
    <table>
      <tr>
        <th colspan="18" class="hdr-main">H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="18" class="hdr-sub">CONCENTRADO MENSUAL DE NUTRICIÓN (PARTE 1: POBLACIÓN Y SERVICIOS) &bull; PERIODO: ${nombreMes} ${anio}</th>
      </tr>
      <tr>
        <td colspan="9" class="hdr-meta text-left"><strong>Área:</strong> Nutrición &nbsp;|&nbsp; <strong>Unidad:</strong> Sede Central Malpica</td>
        <td colspan="9" class="hdr-meta text-right"><strong>TOTAL DEL MES:</strong> ${total_general_mes} atenciones</td>
      </tr>
      <tr>
        <th rowspan="3" class="th-super">FECHA</th>
        <th colspan="8" class="th-super">DIAGNÓSTICO DE POBLACIÓN (POBLACIÓN ABIERTA)</th>
        <th colspan="8" class="th-super">SERVICIOS OTORGADOS A POBLACIÓN CAUTIVA</th>
        <th rowspan="3" class="th-super">TOTAL DÍA</th>
      </tr>
      <tr>
        <th colspan="2" class="th-col">SEXO</th>
        <th rowspan="2" class="th-col">1RA VEZ</th>
        <th rowspan="2" class="th-col">SUBSECUENTE</th>
        <th colspan="2" class="th-col">POBLACIÓN</th>
        <th colspan="2" class="th-col">CANALIZAR</th>
        <th colspan="2" class="th-col">SEXO</th>
        <th rowspan="2" class="th-col">1RA VEZ</th>
        <th rowspan="2" class="th-col">SUBSECUENTE</th>
        <th colspan="2" class="th-col">POBLACIÓN</th>
        <th colspan="2" class="th-col">CANALIZAR</th>
      </tr>
      <tr>
        <th class="th-col">F</th><th class="th-col">M</th>
        <th class="th-col">SANA</th><th class="th-col">ENFERMA</th>
        <th class="th-col">MED. GENERAL</th><th class="th-col">ESPECIALISTA</th>
        <th class="th-col">F</th><th class="th-col">M</th>
        <th class="th-col">SANA</th><th class="th-col">ENFERMA</th>
        <th class="th-col">MED. GENERAL</th><th class="th-col">ESPECIALISTA</th>
      </tr>
      ${hoja1.dias.map(d => `
        <tr>
          <td><strong>${d.dia}</strong></td>
          <td>${d.pob_f || 0}</td><td>${d.pob_m || 0}</td>
          <td>${d.pob_1ra || 0}</td><td>${d.pob_sub || 0}</td>
          <td>${d.pob_sana || 0}</td><td>${d.pob_enferma || 0}</td>
          <td>${d.pob_med || 0}</td><td>${d.pob_esp || 0}</td>
          <td>${d.cau_f || 0}</td><td>${d.cau_m || 0}</td>
          <td>${d.cau_1ra || 0}</td><td>${d.cau_sub || 0}</td>
          <td>${d.cau_sana || 0}</td><td>${d.cau_enferma || 0}</td>
          <td>${d.cau_med || 0}</td><td>${d.cau_esp || 0}</td>
          <td>${d.total_dia || 0}</td>
        </tr>
      `).join('')}
      <tr class="row-total">
        <td>TOTAL</td>
        <td>${hoja1.totales.pob_f}</td><td>${hoja1.totales.pob_m}</td>
        <td>${hoja1.totales.pob_1ra}</td><td>${hoja1.totales.pob_sub}</td>
        <td>${hoja1.totales.pob_sana}</td><td>${hoja1.totales.pob_enferma}</td>
        <td>${hoja1.totales.pob_med}</td><td>${hoja1.totales.pob_esp}</td>
        <td>${hoja1.totales.cau_f}</td><td>${hoja1.totales.cau_m}</td>
        <td>${hoja1.totales.cau_1ra}</td><td>${hoja1.totales.cau_sub}</td>
        <td>${hoja1.totales.cau_sana}</td><td>${hoja1.totales.cau_enferma}</td>
        <td>${hoja1.totales.cau_med}</td><td>${hoja1.totales.cau_esp}</td>
        <td>${hoja1.totales.total_dia}</td>
      </tr>
    </table>

    <br><br>

    <!-- TABLA 2: PADECIMIENTOS -->
    <table>
      <tr>
        <th colspan="28" class="hdr-main">H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="28" class="hdr-sub">CONCENTRADO MENSUAL DE NUTRICIÓN (PARTE 2: PADECIMIENTOS) &bull; PERIODO: ${nombreMes} ${anio}</th>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">FECHA</th>
        <th colspan="8" class="th-super">ENFERMEDADES DIGESTIVAS</th>
        <th colspan="7" class="th-super">ECD (CRÓNICO DEGENERATIVAS)</th>
        <th colspan="11" class="th-super">OTRAS ENFERMEDADES</th>
        <th rowspan="2" class="th-super">TOTAL</th>
      </tr>
      <tr>
        <th class="th-col">ESTREÑIMIENTO</th><th class="th-col">DIVERTICULOSIS</th><th class="th-col">COLITIS</th><th class="th-col">GASTRITIS</th>
        <th class="th-col">CÁLCULOS BILIARES</th><th class="th-col">E. CELÍACA</th><th class="th-col">REFLUJO GÁSTRICO</th><th class="th-col">ETAS</th>
        <th class="th-col">HIPERTENSIÓN</th><th class="th-col">DIABETES</th><th class="th-col">OBESIDAD</th><th class="th-col">SOBREPESO</th>
        <th class="th-col">HÍGADO GRASO</th><th class="th-col">DAÑO RENAL</th><th class="th-col">E. RENAL</th>
        <th class="th-col">HIPOTIROIDISMO</th><th class="th-col">HIPER.</th><th class="th-col">I. ALIMENTARIA</th><th class="th-col">ANEMIA</th>
        <th class="th-col">OSTEOPOROSIS</th><th class="th-col">TRASTORNOS ALIM.</th><th class="th-col">DESNUTRICIÓN</th><th class="th-col">ONCOLÓGICAS</th>
        <th class="th-col">VIH</th><th class="th-col">DISLIPIDEMIAS</th><th class="th-col">ECV</th>
      </tr>
      ${hoja2.dias.map(d => `
        <tr>
          <td><strong>${d.dia}</strong></td>
          <td>${d.estrenimiento || 0}</td><td>${d.diverticulosis || 0}</td><td>${d.colitis || 0}</td><td>${d.gastritis || 0}</td>
          <td>${d.calculos || 0}</td><td>${d.celiaca || 0}</td><td>${d.reflujo || 0}</td><td>${d.etas || 0}</td>
          <td>${d.hipertension || 0}</td><td>${d.diabetes || 0}</td><td>${d.obesidad || 0}</td><td>${d.sobrepeso || 0}</td>
          <td>${d.higado_graso || 0}</td><td>${d.dano_renal || 0}</td><td>${d.e_renal || 0}</td>
          <td>${d.hipotiroidismo || 0}</td><td>${d.hiper || 0}</td><td>${d.i_alimentaria || 0}</td><td>${d.anemia || 0}</td>
          <td>${d.osteoporosis || 0}</td><td>${d.trastornos_alim || 0}</td><td>${d.desnutricion || 0}</td><td>${d.oncologicas || 0}</td>
          <td>${d.vih || 0}</td><td>${d.dislipidemias || 0}</td><td>${d.ecv || 0}</td>
          <td>${d.total_dia || 0}</td>
        </tr>
      `).join('')}
      <tr class="row-total">
        <td>TOTAL</td>
        <td>${hoja2.totales.estrenimiento}</td><td>${hoja2.totales.diverticulosis}</td><td>${hoja2.totales.colitis}</td><td>${hoja2.totales.gastritis}</td>
        <td>${hoja2.totales.calculos}</td><td>${hoja2.totales.celiaca}</td><td>${hoja2.totales.reflujo}</td><td>${hoja2.totales.etas}</td>
        <td>${hoja2.totales.hipertension}</td><td>${hoja2.totales.diabetes}</td><td>${hoja2.totales.obesidad}</td><td>${hoja2.totales.sobrepeso}</td>
        <td>${hoja2.totales.higado_graso}</td><td>${hoja2.totales.dano_renal}</td><td>${hoja2.totales.e_renal}</td>
        <td>${hoja2.totales.hipotiroidismo}</td><td>${hoja2.totales.hiper}</td><td>${hoja2.totales.i_alimentaria}</td><td>${hoja2.totales.anemia}</td>
        <td>${hoja2.totales.osteoporosis}</td><td>${hoja2.totales.trastornos_alim}</td><td>${hoja2.totales.desnutricion}</td><td>${hoja2.totales.oncologicas}</td>
        <td>${hoja2.totales.vih}</td><td>${hoja2.totales.dislipidemias}</td><td>${hoja2.totales.ecv}</td>
        <td>${hoja2.totales.total_dia}</td>
      </tr>
    </table>

    <br><br>

    <!-- TABLA 3: PEDIATRÍA Y LABORATORIOS -->
    <table>
      <tr>
        <th colspan="12" class="hdr-main">H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="12" class="hdr-sub">CONCENTRADO MENSUAL DE NUTRICIÓN (PARTE 3: PEDIATRÍA Y LABORATORIOS) &bull; PERIODO: ${nombreMes} ${anio}</th>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">FECHA</th>
        <th colspan="5" class="th-super">ESTADO NUTRICIONAL EN PEDIATRÍA</th>
        <th colspan="4" class="th-super">LABORATORIO CLÍNICO EN SANGRE</th>
        <th rowspan="2" class="th-super">TOTAL PEDIATRÍA</th>
        <th rowspan="2" class="th-super">TOTAL LABS</th>
      </tr>
      <tr>
        <th class="th-col">DESNUTRICIÓN</th><th class="th-col">RIESGO DESNUT.</th><th class="th-col">NORMOPESO</th>
        <th class="th-col">RIESGO OBESIDAD</th><th class="th-col">OBESIDAD</th>
        <th class="th-col">BH</th><th class="th-col">QS</th><th class="th-col">PERFIL LÍPIDOS</th><th class="th-col">HbA1c</th>
      </tr>
      ${hoja3.dias.map(d => `
        <tr>
          <td><strong>${d.dia}</strong></td>
          <td>${d.ped_desnutricion || 0}</td><td>${d.ped_riesgo_desnut || 0}</td><td>${d.ped_normopeso || 0}</td>
          <td>${d.ped_riesgo_obesidad || 0}</td><td>${d.ped_obesidad || 0}</td>
          <td>${d.lab_bh || 0}</td><td>${d.lab_qs || 0}</td><td>${d.lab_lipidos || 0}</td><td>${d.lab_hba1c || 0}</td>
          <td>${d.total_pediatria || 0}</td><td>${d.total_labs || 0}</td>
        </tr>
      `).join('')}
      <tr class="row-total">
        <td>TOTAL</td>
        <td>${hoja3.totales.ped_desnutricion}</td><td>${hoja3.totales.ped_riesgo_desnut}</td><td>${hoja3.totales.ped_normopeso}</td>
        <td>${hoja3.totales.ped_riesgo_obesidad}</td><td>${hoja3.totales.ped_obesidad}</td>
        <td>${hoja3.totales.lab_bh}</td><td>${hoja3.totales.lab_qs}</td><td>${hoja3.totales.lab_lipidos}</td><td>${hoja3.totales.lab_hba1c}</td>
        <td>${hoja3.totales.total_pediatria}</td><td>${hoja3.totales.total_labs}</td>
      </tr>
    </table>
  `;

  return envolverHtmlParaExcel({
    titulo: `Concentrado Mensual Nutrición ${nombreMes}`,
    tablasHtml
  });
}

module.exports = {
  renderizarMensualHtml,
  renderizarMensualExcel
};
