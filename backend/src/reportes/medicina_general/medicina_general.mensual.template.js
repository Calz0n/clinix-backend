// Plantilla HTML y Excel del Concentrado Mensual Oficial de Medicina General (3 Hojas Físicas)
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
// Reproducción exacta de:
// Hoja 1: WhatsApp Image 2026-10-07 at 11.43.46 (1).jpeg (Resumen Total Mensual Médicos)
// Hoja 2: WhatsApp Image 2026-10-07 at 11.43.46 (2).jpeg (Padecimientos de Primera Vez)
// Hoja 3: WhatsApp Image 2026-10-07 at 11.43.46 (3).jpeg (Medidas Preventivas)

const { obtenerLogoHtml } = require('../common/logo');
const estilosPrint = require('../common/estilosPrint');
const { envolverHtmlParaExcel } = require('../common/excelWrapper');

const NOMBRES_MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

function renderizarMensualHtml(datos) {
  const { periodo, dias, totales, medico = 'Dr. Especialista en Medicina General' } = datos;
  const { anio, mes } = periodo;
  const nombreMes = NOMBRES_MESES[parseInt(mes, 10) - 1] || `MES ${mes}`;
  const logoHtml = obtenerLogoHtml({ height: 105 });

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Concentrado Mensual Medicina General - ${nombreMes} ${anio}</title>
    <style>
      ${estilosPrint}
      .tabla-m-mg th {
        font-size: 5.8px;
        padding: 1px 0.5px;
        line-height: 1.05;
        vertical-align: bottom;
      }
      .tabla-m-mg td {
        font-size: 6.8px;
        height: 14px;
        padding: 1px 0.5px;
        text-align: center;
      }
      .th-rot-col {
        height: 110px;
        vertical-align: bottom !important;
        padding: 2px 1px !important;
        overflow: hidden;
      }
      .rot-th-mg {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: normal;
        font-size: 5.2px;
        font-weight: bold;
        line-height: 1.0;
        max-height: 104px;
        margin: 0 auto;
        text-align: left;
        overflow: hidden;
      }
      .hdr-sec-a {
        background-color: #f1f5f9;
        font-weight: bold;
        border-bottom: 2px solid #0f172a;
      }
      .hdr-sec-b {
        background-color: #f8fafc;
        font-weight: bold;
        border-bottom: 2px solid #0f172a;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF (3 Hojas Oficiales)</button>
      <a href="/api/estadisticas/mensual/excel?anio=${anio}&mes=${mes}&area=MEDICINA_GENERAL" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
    </div>

    <!-- ========================================== -->
    <!-- HOJA 1: RESUMEN TOTAL MENSUAL MÉDICOS     -->
    <!-- ========================================== -->
    <div class="pagina-reporte">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">RESUMEN TOTAL MENSUAL MÉDICOS</div>
          <div style="font-size: 8px; font-weight: bold; color: #475569; margin-top: 1px;">
            H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL
          </div>
        </div>
      </div>

      <div class="meta-subbar" style="margin-bottom: 4px;">
        <div><strong>MÉDICO:</strong> <span style="text-decoration: underline; padding-left: 6px;">${medico}</span></div>
        <div><strong>MES/AÑO:</strong> <span style="font-weight: bold; text-decoration: underline; padding-left: 6px;">${nombreMes} ${anio}</span></div>
      </div>

      <table class="tabla-oficial tabla-m-mg">
        <thead>
          <tr>
            <th rowspan="3" style="width: 18px;">No.</th>
            <th rowspan="3" style="width: 50px;">FECHA</th>
            <th colspan="10" class="hdr-sec-a">DIAGNÓSTICO DE POBLACIÓN</th>
            <th colspan="7" class="hdr-sec-b">SERVICIOS OTORGADOS A POBLACIÓN CAUTIVA</th>
          </tr>
          <tr>
            <!-- Diagnóstico de Población -->
            <th colspan="2">SEXO</th>
            <th rowspan="2" class="th-rot-col"><div class="rot-th-mg">1RA VEZ</div></th>
            <th rowspan="2" class="th-rot-col"><div class="rot-th-mg">SUBSECUENTE</div></th>
            <th colspan="2">TOTAL DE CONSULTAS</th>
            <th colspan="2">TOTAL DE PERSONAS</th>
            <th colspan="2">CANALIZAR</th>
            <!-- Población Cautiva -->
            <th colspan="2">SEXO</th>
            <th colspan="2">POBLACIÓN</th>
            <th rowspan="2" class="th-rot-col"><div class="rot-th-mg">ENFERM. TRANS.<br>SEXUAL</div></th>
            <th rowspan="2" class="th-rot-col"><div class="rot-th-mg">OTRAS<br>ENFERMEDADES</div></th>
            <th rowspan="2" class="th-rot-col"><div class="rot-th-mg">CERTIFICADO<br>MÉDICO</div></th>
          </tr>
          <tr style="height: 110px;">
            <!-- Pob Sub -->
            <th class="th-rot-col"><div class="rot-th-mg">F</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">M</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">USUARIAS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">COMUNIDAD</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">SANAS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">ENFERMAS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">CLÍNICA DE<br>DISPLASIA</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">CAPASITS</div></th>
            <!-- Cautiva Sub -->
            <th class="th-rot-col"><div class="rot-th-mg">FEMENINO</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">MASCULINO</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">SANAS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">ENFERMAS</div></th>
          </tr>
        </thead>
        <tbody>
          ${dias.map(d => {
            const fechaStr = `${String(d.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
            return `
            <tr>
              <td><strong>${d.dia}</strong></td>
              <td>${fechaStr}</td>
              <!-- Pob Abierta -->
              <td>${d.pob_f || ''}</td>
              <td>${d.pob_m || ''}</td>
              <td>${d.pob_1ra || ''}</td>
              <td>${d.pob_sub || ''}</td>
              <td>${d.pob_usuarias || ''}</td>
              <td>${d.pob_comunidad || ''}</td>
              <td>${d.pob_sanas || ''}</td>
              <td>${d.pob_enfermas || ''}</td>
              <td>${d.pob_displasia || ''}</td>
              <td>${d.pob_capasits || ''}</td>
              <!-- Cautiva -->
              <td>${d.cau_f || ''}</td>
              <td>${d.cau_m || ''}</td>
              <td>${d.cau_sanas || ''}</td>
              <td>${d.cau_enfermas || ''}</td>
              <td>${d.cau_ets || ''}</td>
              <td>${d.cau_otras_enf || ''}</td>
              <td>${d.cau_certificado || ''}</td>
            </tr>
            `;
          }).join('')}
          <tr class="row-total">
            <td colspan="2"><strong>TOTAL</strong></td>
            <td><strong>${totales.pob_f || 0}</strong></td>
            <td><strong>${totales.pob_m || 0}</strong></td>
            <td><strong>${totales.pob_1ra || 0}</strong></td>
            <td><strong>${totales.pob_sub || 0}</strong></td>
            <td><strong>${totales.pob_usuarias || 0}</strong></td>
            <td><strong>${totales.pob_comunidad || 0}</strong></td>
            <td><strong>${totales.pob_sanas || 0}</strong></td>
            <td><strong>${totales.pob_enfermas || 0}</strong></td>
            <td><strong>${totales.pob_displasia || 0}</strong></td>
            <td><strong>${totales.pob_capasits || 0}</strong></td>
            <td><strong>${totales.cau_f || 0}</strong></td>
            <td><strong>${totales.cau_m || 0}</strong></td>
            <td><strong>${totales.cau_sanas || 0}</strong></td>
            <td><strong>${totales.cau_enfermas || 0}</strong></td>
            <td><strong>${totales.cau_ets || 0}</strong></td>
            <td><strong>${totales.cau_otras_enf || 0}</strong></td>
            <td><strong>${totales.cau_certificado || 0}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ========================================== -->
    <!-- HOJA 2: PADECIMIENTOS DE PRIMERA VEZ       -->
    <!-- ========================================== -->
    <div class="pagina-reporte" style="page-break-before: always;">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">PADECIMIENTOS DE PRIMERA VEZ</div>
          <div style="font-size: 8px; font-weight: bold; color: #475569; margin-top: 1px;">
            H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL
          </div>
        </div>
      </div>

      <div class="meta-subbar" style="margin-bottom: 4px;">
        <div><strong>MÉDICO:</strong> <span style="text-decoration: underline; padding-left: 6px;">${medico}</span></div>
        <div><strong>MES/AÑO:</strong> <span style="font-weight: bold; text-decoration: underline; padding-left: 6px;">${nombreMes} ${anio}</span></div>
      </div>

      <table class="tabla-oficial tabla-m-mg">
        <thead>
          <tr>
            <th rowspan="2" style="width: 16px;">No.</th>
            <th rowspan="2" style="width: 44px;">FECHA</th>
            <th colspan="12" class="hdr-sec-a">ENFERMEDADES DE TRANSMISIÓN SEXUAL</th>
            <th colspan="3" class="hdr-sec-b">ENFERM. GINE</th>
            <th colspan="18" class="hdr-sec-a">OTRAS ENFERMEDADES</th>
          </tr>
          <tr style="height: 110px;">
            <!-- ETS (12) -->
            <th class="th-rot-col"><div class="rot-th-mg">GARDNERELLA<br>VAGINALIS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">CANDIDIASIS<br>VAGINAL</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">TRICOMONIASIS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">BLENORRAGIA</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">CERVICOVAGINITIS<br>INESPECÍFICA</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">CONDILOMATOSIS<br>PERIVULVAR</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">CONDILOMATOSIS<br>BALANOPREPUCIAL</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">SÍFILIS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">VIH</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">V.P.H.</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">DISPLASIA /<br>EVERSIÓN GLAND.</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">OTROS DX.</div></th>
            <!-- Gine (3) -->
            <th class="th-rot-col"><div class="rot-th-mg">ANEXITIS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">TUMORACIONES<br>OVÁRICAS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">OTRAS</div></th>
            <!-- Otras Enfermedades (18) -->
            <th class="th-rot-col"><div class="rot-th-mg">ENF. DEL<br>S.N.C.</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">OFTALMO-<br>LÓGICAS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">ENF. RESPIRA-<br>TORIAS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">HIPERTENSIÓN<br>ARTERIAL</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">DIABETES<br>MELLITUS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">CARDIO-<br>VASCULARES</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">APARATO<br>DIGESTIVO</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">MÚSCULO-<br>ESQUELÉTICO</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">DERMATO-<br>LÓGICO</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">VÍAS<br>URINARIAS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">VASCULAR-<br>PERIFÉRICOS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">NEFROLÓGICAS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">SALMONELOSIS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">BRUCELOSIS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">AMIBIASIS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">GIARDIASIS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">ASCARIS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">OTRAS</div></th>
          </tr>
        </thead>
        <tbody>
          ${dias.map(d => {
            const fechaStr = `${String(d.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
            return `
            <tr>
              <td><strong>${d.dia}</strong></td>
              <td>${fechaStr}</td>
              <!-- ETS -->
              <td>${d.ets_gardnerella || ''}</td>
              <td>${d.ets_candidiasis || ''}</td>
              <td>${d.ets_tricomoniasis || ''}</td>
              <td>${d.ets_blenorragia || ''}</td>
              <td>${d.ets_cervicovaginitis || ''}</td>
              <td>${d.ets_condiloma_peri || ''}</td>
              <td>${d.ets_condiloma_balano || ''}</td>
              <td>${d.ets_sifilis || ''}</td>
              <td>${d.ets_vih || ''}</td>
              <td>${d.ets_vph || ''}</td>
              <td>${d.ets_displasia || ''}</td>
              <td>${d.ets_otros || ''}</td>
              <!-- Gine -->
              <td>${d.gine_anexitis || ''}</td>
              <td>${d.gine_tumor_ovario || ''}</td>
              <td>${d.gine_otras || ''}</td>
              <!-- Otras -->
              <td>${d.enf_snc || ''}</td>
              <td>${d.enf_oftalmologicas || ''}</td>
              <td>${d.enf_respiratorias || ''}</td>
              <td>${d.enf_hta || ''}</td>
              <td>${d.enf_diabetes || ''}</td>
              <td>${d.enf_cardiovasculares || ''}</td>
              <td>${d.enf_digestivo || ''}</td>
              <td>${d.enf_musculoesqueletico || ''}</td>
              <td>${d.enf_dermatologico || ''}</td>
              <td>${d.enf_urinarias || ''}</td>
              <td>${d.enf_vascular_periferico || ''}</td>
              <td>${d.enf_nefrologicas || ''}</td>
              <td>${d.enf_salmonelosis || ''}</td>
              <td>${d.enf_brucelosis || ''}</td>
              <td>${d.enf_amibiasis || ''}</td>
              <td>${d.enf_giardiasis || ''}</td>
              <td>${d.enf_ascaris || ''}</td>
              <td>${d.enf_otras || ''}</td>
            </tr>
            `;
          }).join('')}
          <tr class="row-total">
            <td colspan="2"><strong>TOTAL</strong></td>
            <td><strong>${totales.ets_gardnerella || 0}</strong></td>
            <td><strong>${totales.ets_candidiasis || 0}</strong></td>
            <td><strong>${totales.ets_tricomoniasis || 0}</strong></td>
            <td><strong>${totales.ets_blenorragia || 0}</strong></td>
            <td><strong>${totales.ets_cervicovaginitis || 0}</strong></td>
            <td><strong>${totales.ets_condiloma_peri || 0}</strong></td>
            <td><strong>${totales.ets_condiloma_balano || 0}</strong></td>
            <td><strong>${totales.ets_sifilis || 0}</strong></td>
            <td><strong>${totales.ets_vih || 0}</strong></td>
            <td><strong>${totales.ets_vph || 0}</strong></td>
            <td><strong>${totales.ets_displasia || 0}</strong></td>
            <td><strong>${totales.ets_otros || 0}</strong></td>
            <td><strong>${totales.gine_anexitis || 0}</strong></td>
            <td><strong>${totales.gine_tumor_ovario || 0}</strong></td>
            <td><strong>${totales.gine_otras || 0}</strong></td>
            <td><strong>${totales.enf_snc || 0}</strong></td>
            <td><strong>${totales.enf_oftalmologicas || 0}</strong></td>
            <td><strong>${totales.enf_respiratorias || 0}</strong></td>
            <td><strong>${totales.enf_hta || 0}</strong></td>
            <td><strong>${totales.enf_diabetes || 0}</strong></td>
            <td><strong>${totales.enf_cardiovasculares || 0}</strong></td>
            <td><strong>${totales.enf_digestivo || 0}</strong></td>
            <td><strong>${totales.enf_musculoesqueletico || 0}</strong></td>
            <td><strong>${totales.enf_dermatologico || 0}</strong></td>
            <td><strong>${totales.enf_urinarias || 0}</strong></td>
            <td><strong>${totales.enf_vascular_periferico || 0}</strong></td>
            <td><strong>${totales.enf_nefrologicas || 0}</strong></td>
            <td><strong>${totales.enf_salmonelosis || 0}</strong></td>
            <td><strong>${totales.enf_brucelosis || 0}</strong></td>
            <td><strong>${totales.enf_amibiasis || 0}</strong></td>
            <td><strong>${totales.enf_giardiasis || 0}</strong></td>
            <td><strong>${totales.enf_ascaris || 0}</strong></td>
            <td><strong>${totales.enf_otras || 0}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ========================================== -->
    <!-- HOJA 3: MEDIDAS PREVENTIVAS               -->
    <!-- ========================================== -->
    <div class="pagina-reporte" style="page-break-before: always;">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">MEDIDAS PREVENTIVAS</div>
          <div style="font-size: 8px; font-weight: bold; color: #475569; margin-top: 1px;">
            H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL
          </div>
        </div>
      </div>

      <div class="meta-subbar" style="margin-bottom: 4px;">
        <div><strong>MÉDICO:</strong> <span style="text-decoration: underline; padding-left: 6px;">${medico}</span></div>
        <div><strong>MES/AÑO:</strong> <span style="font-weight: bold; text-decoration: underline; padding-left: 6px;">${nombreMes} ${anio}</span></div>
      </div>

      <table class="tabla-oficial tabla-m-mg">
        <thead>
          <tr>
            <th rowspan="2" style="width: 18px;">No.</th>
            <th rowspan="2" style="width: 50px;">FECHA</th>
            <th colspan="6" class="hdr-sec-a">DETECCIONES</th>
            <th colspan="6" class="hdr-sec-b">PLANIFICACIÓN FAMILIAR</th>
            <th colspan="4" class="hdr-sec-a">PRESERVATIVOS</th>
            <th colspan="6" class="hdr-sec-b">ESTUDIOS DE GABINETES (LAB. EN SANGRE)</th>
          </tr>
          <tr style="height: 110px;">
            <!-- Detecciones (6) -->
            <th class="th-rot-col"><div class="rot-th-mg">DETECCIÓN<br>OPORTUNA CACU</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">DETECCIÓN CA<br>DE MAMA</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">PRUEBAS RÁPIDAS<br>DE VIH</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">FERIAS SOBRE-<br>PESO Y OBESIDAD</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">HTA</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">DIABETES</div></th>
            <!-- Planificación Familiar (6) -->
            <th class="th-rot-col"><div class="rot-th-mg">DIU</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">PRESERVATIVOS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">HORMONALES<br>ORALES</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">HORMONALES<br>INYECTABLES</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">OBSTR. TUBARIA<br>(OTB)</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">DISPOSITIVO<br>INTRADÉRMICO</div></th>
            <!-- Preservativos (4) -->
            <th class="th-rot-col"><div class="rot-th-mg">OTORGADOS EN<br>CONSULTA</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">EN PLÁTICAS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">FERIAS</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">OPERATIVOS</div></th>
            <!-- Estudios Gabinete / Lab (6) -->
            <th class="th-rot-col"><div class="rot-th-mg">VIH</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">VDRL</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">PRUEBAS RÁP.<br>EN LA UNIDAD</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">EXUDADOS<br>VAGINALES</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">DOC</div></th>
            <th class="th-rot-col"><div class="rot-th-mg">HEPATITIS C</div></th>
          </tr>
        </thead>
        <tbody>
          ${dias.map(d => {
            const fechaStr = `${String(d.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
            return `
            <tr>
              <td><strong>${d.dia}</strong></td>
              <td>${fechaStr}</td>
              <!-- Detecciones -->
              <td>${d.det_cacu || ''}</td>
              <td>${d.det_mama || ''}</td>
              <td>${d.det_vih || ''}</td>
              <td>${d.det_obesidad || ''}</td>
              <td>${d.det_hta || ''}</td>
              <td>${d.det_diabetes || ''}</td>
              <!-- PF -->
              <td>${d.pf_diu || ''}</td>
              <td>${d.pf_preservativos || ''}</td>
              <td>${d.pf_hormonal_oral || ''}</td>
              <td>${d.pf_hormonal_inyec || ''}</td>
              <td>${d.pf_otb || ''}</td>
              <td>${d.pf_subdermico || ''}</td>
              <!-- Preservativos -->
              <td>${d.pres_consulta || ''}</td>
              <td>${d.pres_platicas || ''}</td>
              <td>${d.pres_ferias || ''}</td>
              <td>${d.pres_operativos || ''}</td>
              <!-- Lab -->
              <td>${d.lab_vih || ''}</td>
              <td>${d.lab_vdrl || ''}</td>
              <td>${d.lab_rapidas_unidad || ''}</td>
              <td>${d.lab_exudados || ''}</td>
              <td>${d.lab_doc || ''}</td>
              <td>${d.lab_hepatitis_c || ''}</td>
            </tr>
            `;
          }).join('')}
          <tr class="row-total">
            <td colspan="2"><strong>TOTAL</strong></td>
            <td><strong>${totales.det_cacu || 0}</strong></td>
            <td><strong>${totales.det_mama || 0}</strong></td>
            <td><strong>${totales.det_vih || 0}</strong></td>
            <td><strong>${totales.det_obesidad || 0}</strong></td>
            <td><strong>${totales.det_hta || 0}</strong></td>
            <td><strong>${totales.det_diabetes || 0}</strong></td>
            <td><strong>${totales.pf_diu || 0}</strong></td>
            <td><strong>${totales.pf_preservativos || 0}</strong></td>
            <td><strong>${totales.pf_hormonal_oral || 0}</strong></td>
            <td><strong>${totales.pf_hormonal_inyec || 0}</strong></td>
            <td><strong>${totales.pf_otb || 0}</strong></td>
            <td><strong>${totales.pf_subdermico || 0}</strong></td>
            <td><strong>${totales.pres_consulta || 0}</strong></td>
            <td><strong>${totales.pres_platicas || 0}</strong></td>
            <td><strong>${totales.pres_ferias || 0}</strong></td>
            <td><strong>${totales.pres_operativos || 0}</strong></td>
            <td><strong>${totales.lab_vih || 0}</strong></td>
            <td><strong>${totales.lab_vdrl || 0}</strong></td>
            <td><strong>${totales.lab_rapidas_unidad || 0}</strong></td>
            <td><strong>${totales.lab_exudados || 0}</strong></td>
            <td><strong>${totales.lab_doc || 0}</strong></td>
            <td><strong>${totales.lab_hepatitis_c || 0}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

function renderizarMensualExcel(datos) {
  const { periodo, dias, totales, medico = 'Dr. Especialista en Medicina General' } = datos;
  const { anio, mes } = periodo;
  const nombreMes = NOMBRES_MESES[parseInt(mes, 10) - 1] || `MES ${mes}`;

  const tablaHtml = `
    <!-- HOJA 1: RESUMEN TOTAL -->
    <table>
      <tr>
        <th colspan="19" class="hdr-main">H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="19" class="hdr-sub">RESUMEN TOTAL MENSUAL MÉDICOS &bull; REPORTE: ${nombreMes} ${anio}</th>
      </tr>
      <tr>
        <td colspan="10" class="hdr-meta text-left"><strong>MÉDICO:</strong> ${medico}</td>
        <td colspan="9" class="hdr-meta text-right"><strong>TOTAL CONSULTAS:</strong> ${totales.total_dia || 0}</td>
      </tr>
      <tr>
        <th rowspan="3" class="th-super">No.</th>
        <th rowspan="3" class="th-super">FECHA</th>
        <th colspan="10" class="th-super">DIAGNÓSTICO DE POBLACIÓN</th>
        <th colspan="7" class="th-super">SERVICIOS OTORGADOS A POBLACIÓN CAUTIVA</th>
      </tr>
      <tr>
        <th colspan="2" class="th-col">SEXO</th>
        <th rowspan="2" class="th-col">1RA VEZ</th>
        <th rowspan="2" class="th-col">SUBSEC</th>
        <th colspan="2" class="th-col">TOTAL CONSULTAS</th>
        <th colspan="2" class="th-col">TOTAL PERSONAS</th>
        <th colspan="2" class="th-col">CANALIZAR</th>
        <th colspan="2" class="th-col">SEXO</th>
        <th colspan="2" class="th-col">POBLACIÓN</th>
        <th rowspan="2" class="th-col">E.T.S.</th>
        <th rowspan="2" class="th-col">OTRAS ENF.</th>
        <th rowspan="2" class="th-col">CERT. MÉDICO</th>
      </tr>
      <tr>
        <th class="th-col">F</th><th class="th-col">M</th>
        <th class="th-col">USUARIAS</th><th class="th-col">COMUNIDAD</th>
        <th class="th-col">SANAS</th><th class="th-col">ENFERMAS</th>
        <th class="th-col">DISPLASIA</th><th class="th-col">CAPASITS</th>
        <th class="th-col">FEM</th><th class="th-col">MASC</th>
        <th class="th-col">SANAS</th><th class="th-col">ENFERMAS</th>
      </tr>
      ${dias.map(d => {
        const fechaStr = `${String(d.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
        return `
        <tr>
          <td>${d.dia}</td><td>${fechaStr}</td>
          <td>${d.pob_f || 0}</td><td>${d.pob_m || 0}</td>
          <td>${d.pob_1ra || 0}</td><td>${d.pob_sub || 0}</td>
          <td>${d.pob_usuarias || 0}</td><td>${d.pob_comunidad || 0}</td>
          <td>${d.pob_sanas || 0}</td><td>${d.pob_enfermas || 0}</td>
          <td>${d.pob_displasia || 0}</td><td>${d.pob_capasits || 0}</td>
          <td>${d.cau_f || 0}</td><td>${d.cau_m || 0}</td>
          <td>${d.cau_sanas || 0}</td><td>${d.cau_enfermas || 0}</td>
          <td>${d.cau_ets || 0}</td><td>${d.cau_otras_enf || 0}</td><td>${d.cau_certificado || 0}</td>
        </tr>
        `;
      }).join('')}
      <tr class="row-total">
        <td colspan="2">TOTAL</td>
        <td>${totales.pob_f || 0}</td><td>${totales.pob_m || 0}</td>
        <td>${totales.pob_1ra || 0}</td><td>${totales.pob_sub || 0}</td>
        <td>${totales.pob_usuarias || 0}</td><td>${totales.pob_comunidad || 0}</td>
        <td>${totales.pob_sanas || 0}</td><td>${totales.pob_enfermas || 0}</td>
        <td>${totales.pob_displasia || 0}</td><td>${totales.pob_capasits || 0}</td>
        <td>${totales.cau_f || 0}</td><td>${totales.cau_m || 0}</td>
        <td>${totales.cau_sanas || 0}</td><td>${totales.cau_enfermas || 0}</td>
        <td>${totales.cau_ets || 0}</td><td>${totales.cau_otras_enf || 0}</td><td>${totales.cau_certificado || 0}</td>
      </tr>
    </table>

    <br/><br/>

    <!-- HOJA 2: PADECIMIENTOS DE PRIMERA VEZ -->
    <table>
      <tr>
        <th colspan="35" class="hdr-main">H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="35" class="hdr-sub">PADECIMIENTOS DE PRIMERA VEZ &bull; REPORTE: ${nombreMes} ${anio}</th>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">No.</th>
        <th rowspan="2" class="th-super">FECHA</th>
        <th colspan="12" class="th-super">ENFERMEDADES DE TRANSMISIÓN SEXUAL</th>
        <th colspan="3" class="th-super">ENFERM. GINE</th>
        <th colspan="18" class="th-super">OTRAS ENFERMEDADES</th>
      </tr>
      <tr>
        <th class="th-col">GARDNERELLA</th><th class="th-col">CANDIDIASIS</th><th class="th-col">TRICOMONIASIS</th>
        <th class="th-col">BLENORRAGIA</th><th class="th-col">CERVICOVAG.</th><th class="th-col">CONDILOMA P.</th>
        <th class="th-col">CONDILOMA B.</th><th class="th-col">SÍFILIS</th><th class="th-col">VIH</th>
        <th class="th-col">V.P.H.</th><th class="th-col">DISPLASIA</th><th class="th-col">OTROS ETS</th>
        <th class="th-col">ANEXITIS</th><th class="th-col">TUMOR OVAR.</th><th class="th-col">OTRAS GINE</th>
        <th class="th-col">S.N.C.</th><th class="th-col">OFTALMOL.</th><th class="th-col">RESPIRAT.</th>
        <th class="th-col">H.T.A.</th><th class="th-col">DIABETES</th><th class="th-col">CARDIOVAS.</th>
        <th class="th-col">DIGESTIVO</th><th class="th-col">MUSCULOESQ.</th><th class="th-col">DERMATOL.</th>
        <th class="th-col">URINARIAS</th><th class="th-col">VASC. PERIF.</th><th class="th-col">NEFROLÓG.</th>
        <th class="th-col">SALMONELLA</th><th class="th-col">BRUCELLA</th><th class="th-col">AMIBIASIS</th>
        <th class="th-col">GIARDIASIS</th><th class="th-col">ASCARIS</th><th class="th-col">OTRAS ENF.</th>
      </tr>
      ${dias.map(d => {
        const fechaStr = `${String(d.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
        return `
        <tr>
          <td>${d.dia}</td><td>${fechaStr}</td>
          <td>${d.ets_gardnerella || 0}</td><td>${d.ets_candidiasis || 0}</td><td>${d.ets_tricomoniasis || 0}</td>
          <td>${d.ets_blenorragia || 0}</td><td>${d.ets_cervicovaginitis || 0}</td><td>${d.ets_condiloma_peri || 0}</td>
          <td>${d.ets_condiloma_balano || 0}</td><td>${d.ets_sifilis || 0}</td><td>${d.ets_vih || 0}</td>
          <td>${d.ets_vph || 0}</td><td>${d.ets_displasia || 0}</td><td>${d.ets_otros || 0}</td>
          <td>${d.gine_anexitis || 0}</td><td>${d.gine_tumor_ovario || 0}</td><td>${d.gine_otras || 0}</td>
          <td>${d.enf_snc || 0}</td><td>${d.enf_oftalmologicas || 0}</td><td>${d.enf_respiratorias || 0}</td>
          <td>${d.enf_hta || 0}</td><td>${d.enf_diabetes || 0}</td><td>${d.enf_cardiovasculares || 0}</td>
          <td>${d.enf_digestivo || 0}</td><td>${d.enf_musculoesqueletico || 0}</td><td>${d.enf_dermatologico || 0}</td>
          <td>${d.enf_urinarias || 0}</td><td>${d.enf_vascular_periferico || 0}</td><td>${d.enf_nefrologicas || 0}</td>
          <td>${d.enf_salmonelosis || 0}</td><td>${d.enf_brucelosis || 0}</td><td>${d.enf_amibiasis || 0}</td>
          <td>${d.enf_giardiasis || 0}</td><td>${d.enf_ascaris || 0}</td><td>${d.enf_otras || 0}</td>
        </tr>
        `;
      }).join('')}
      <tr class="row-total">
        <td colspan="2">TOTAL</td>
        <td>${totales.ets_gardnerella || 0}</td><td>${totales.ets_candidiasis || 0}</td><td>${totales.ets_tricomoniasis || 0}</td>
        <td>${totales.ets_blenorragia || 0}</td><td>${totales.ets_cervicovaginitis || 0}</td><td>${totales.ets_condiloma_peri || 0}</td>
        <td>${totales.ets_condiloma_balano || 0}</td><td>${totales.ets_sifilis || 0}</td><td>${totales.ets_vih || 0}</td>
        <td>${totales.ets_vph || 0}</td><td>${totales.ets_displasia || 0}</td><td>${totales.ets_otros || 0}</td>
        <td>${totales.gine_anexitis || 0}</td><td>${totales.gine_tumor_ovario || 0}</td><td>${totales.gine_otras || 0}</td>
        <td>${totales.enf_snc || 0}</td><td>${totales.enf_oftalmologicas || 0}</td><td>${totales.enf_respiratorias || 0}</td>
        <td>${totales.enf_hta || 0}</td><td>${totales.enf_diabetes || 0}</td><td>${totales.enf_cardiovasculares || 0}</td>
        <td>${totales.enf_digestivo || 0}</td><td>${totales.enf_musculoesqueletico || 0}</td><td>${totales.enf_dermatologico || 0}</td>
        <td>${totales.enf_urinarias || 0}</td><td>${totales.enf_vascular_periferico || 0}</td><td>${totales.enf_nefrologicas || 0}</td>
        <td>${totales.enf_salmonelosis || 0}</td><td>${totales.enf_brucelosis || 0}</td><td>${totales.enf_amibiasis || 0}</td>
        <td>${totales.enf_giardiasis || 0}</td><td>${totales.enf_ascaris || 0}</td><td>${totales.enf_otras || 0}</td>
      </tr>
    </table>

    <br/><br/>

    <!-- HOJA 3: MEDIDAS PREVENTIVAS -->
    <table>
      <tr>
        <th colspan="24" class="hdr-main">H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="24" class="hdr-sub">MEDIDAS PREVENTIVAS &bull; REPORTE: ${nombreMes} ${anio}</th>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">No.</th>
        <th rowspan="2" class="th-super">FECHA</th>
        <th colspan="6" class="th-super">DETECCIONES</th>
        <th colspan="6" class="th-super">PLANIFICACIÓN FAMILIAR</th>
        <th colspan="4" class="th-super">PRESERVATIVOS</th>
        <th colspan="6" class="th-super">ESTUDIOS DE GABINETES (LABORATORIO EN SANGRE)</th>
      </tr>
      <tr>
        <th class="th-col">CACU</th><th class="th-col">MAMA</th><th class="th-col">VIH</th><th class="th-col">OBESIDAD</th><th class="th-col">HTA</th><th class="th-col">DIABETES</th>
        <th class="th-col">DIU</th><th class="th-col">PRESERV.</th><th class="th-col">HORMONAL O.</th><th class="th-col">HORMONAL I.</th><th class="th-col">OTB</th><th class="th-col">INTRADÉRM.</th>
        <th class="th-col">CONSULTA</th><th class="th-col">PLÁTICAS</th><th class="th-col">FERIAS</th><th class="th-col">OPERATIVOS</th>
        <th class="th-col">VIH</th><th class="th-col">VDRL</th><th class="th-col">RÁPIDAS</th><th class="th-col">EXUDADOS</th><th class="th-col">DOC</th><th class="th-col">HEPATITIS C</th>
      </tr>
      ${dias.map(d => {
        const fechaStr = `${String(d.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
        return `
        <tr>
          <td>${d.dia}</td><td>${fechaStr}</td>
          <td>${d.det_cacu || 0}</td><td>${d.det_mama || 0}</td><td>${d.det_vih || 0}</td>
          <td>${d.det_obesidad || 0}</td><td>${d.det_hta || 0}</td><td>${d.det_diabetes || 0}</td>
          <td>${d.pf_diu || 0}</td><td>${d.pf_preservativos || 0}</td><td>${d.pf_hormonal_oral || 0}</td>
          <td>${d.pf_hormonal_inyec || 0}</td><td>${d.pf_otb || 0}</td><td>${d.pf_subdermico || 0}</td>
          <td>${d.pres_consulta || 0}</td><td>${d.pres_platicas || 0}</td><td>${d.pres_ferias || 0}</td><td>${d.pres_operativos || 0}</td>
          <td>${d.lab_vih || 0}</td><td>${d.lab_vdrl || 0}</td><td>${d.lab_rapidas_unidad || 0}</td>
          <td>${d.lab_exudados || 0}</td><td>${d.lab_doc || 0}</td><td>${d.lab_hepatitis_c || 0}</td>
        </tr>
        `;
      }).join('')}
      <tr class="row-total">
        <td colspan="2">TOTAL</td>
        <td>${totales.det_cacu || 0}</td><td>${totales.det_mama || 0}</td><td>${totales.det_vih || 0}</td>
        <td>${totales.det_obesidad || 0}</td><td>${totales.det_hta || 0}</td><td>${totales.det_diabetes || 0}</td>
        <td>${totales.pf_diu || 0}</td><td>${totales.pf_preservativos || 0}</td><td>${totales.pf_hormonal_oral || 0}</td>
        <td>${totales.pf_hormonal_inyec || 0}</td><td>${totales.pf_otb || 0}</td><td>${totales.pf_subdermico || 0}</td>
        <td>${totales.pres_consulta || 0}</td><td>${totales.pres_platicas || 0}</td><td>${totales.pres_ferias || 0}</td><td>${totales.pres_operativos || 0}</td>
        <td>${totales.lab_vih || 0}</td><td>${totales.lab_vdrl || 0}</td><td>${totales.lab_rapidas_unidad || 0}</td>
        <td>${totales.lab_exudados || 0}</td><td>${totales.lab_doc || 0}</td><td>${totales.lab_hepatitis_c || 0}</td>
      </tr>
    </table>
  `;

  return envolverHtmlParaExcel({
    titulo: `Concentrado Mensual Medicina General ${nombreMes} ${anio}`,
    tablasHtml: tablaHtml
  });
}

module.exports = {
  renderizarMensualHtml,
  renderizarMensualExcel
};
