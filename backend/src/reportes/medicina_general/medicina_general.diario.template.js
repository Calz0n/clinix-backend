// Plantilla HTML y Excel de la Hoja Diaria Oficial de Medicina General (Consulta General)
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
// Reproducción exacta de la hoja física oficial (WhatsApp Image 2026-10-07 at 11.43.46.jpeg)

const { obtenerLogoHtml } = require('../common/logo');
const estilosPrint = require('../common/estilosPrint');
const { envolverHtmlParaExcel } = require('../common/excelWrapper');

function renderizarDiarioHtml(datos) {
  const { fecha, medico, pacientes, total_pacientes } = datos;
  const [anio, mes, dia] = fecha.split('-');
  const logoHtml = obtenerLogoHtml({ height: 105 });

  // Rellenar hasta 15 filas mínimas como en el formato impreso oficial
  const filasCompletas = [...pacientes];
  while (filasCompletas.length < 15) {
    filasCompletas.push({
      numero: filasCompletas.length + 1,
      nombre: '', edad: '', sexo_f: '', sexo_m: '', primera_vez: '', subsecuente: '',
      usuaria: '', serv_comunidad: '', diagnostico: '', referido: '',
      enf_ets: '', enf_gine: '', enf_obst: '', enf_snc: '', enf_resp: '', enf_dige: '',
      enf_ofta: '', enf_derm: '', enf_card: '', enf_urin: '', enf_musc: '', enf_otros: '',
      ac_vdrl: '', ac_vih: '', ac_exudado: '', ac_pap: '', ac_otros: ''
    });
  }

  // Conteos para totales
  const totF = pacientes.filter(p => p.sexo_f === 'X').length;
  const totM = pacientes.filter(p => p.sexo_m === 'X').length;
  const tot1ra = pacientes.filter(p => p.primera_vez === 'X').length;
  const totSub = pacientes.filter(p => p.subsecuente === 'X').length;
  const totUsuaria = pacientes.filter(p => p.usuaria === 'X').length;
  const totComunidad = pacientes.filter(p => p.serv_comunidad === 'X').length;

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Hoja Diaria de Consulta - Medicina General - ${fecha}</title>
    <style>
      ${estilosPrint}
      .tabla-hd-medicina th {
        font-size: 10.5px;
        padding: 2px 1px;
        line-height: 1.05;
        vertical-align: bottom;
      }
      .tabla-hd-medicina td {
        font-size: 10.5px; font-weight: 500;
        height: 22px;
        padding: 1px 1px;
        text-align: center;
      }
      .th-rot-diario {
        height: 105px;
        vertical-align: bottom !important;
        padding: 2px 1px !important;
        overflow: hidden;
      }
      .rot-col-med {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: normal;
        font-size: 10px;
        font-weight: bold;
        line-height: 1.0;
        max-height: 100px;
        margin: 0 auto;
        text-align: left;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button class="btn-print" style="background-color: #701128 !important; color: #ffffff !important; border: none !important; padding: 8px 18px !important; font-size: 12px !important; border-radius: 4px !important; font-weight: bold !important; display: inline-flex !important; align-items: center !important; gap: 6px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important; cursor: pointer !important;" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <a href="/api/estadisticas/diario/excel?fecha=${fecha}&area=MEDICINA_GENERAL" class="btn-excel" style="background-color: #107c41 !important; color: #ffffff !important; text-decoration: none !important; padding: 8px 18px !important; font-size: 12px !important; border-radius: 4px !important; font-weight: bold !important; display: inline-flex !important; align-items: center !important; gap: 6px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;">📊 Descargar en Excel Formateado (.xls)</a>
    </div>

    <div class="pagina-reporte">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">HOJA DIARIA DE CONSULTA</div>
          <div style="font-size: 8px; font-weight: bold; color: #475569; margin-bottom: 3px;">
            INFORME DIARIO MÉDICO &bull; CONSULTA GENERAL
          </div>
          <div class="fecha-box-container">
            <div class="fecha-cell">DÍA<strong>${dia}</strong></div>
            <div class="fecha-cell">MES<strong>${mes}</strong></div>
            <div class="fecha-cell">AÑO<strong>${anio}</strong></div>
          </div>
        </div>
      </div>

      <div class="meta-subbar" style="margin-bottom: 4px;">
        <div><strong>Nombre del Dr. (a):</strong> <span style="text-decoration: underline; padding-left: 6px;">${medico}</span></div>
        <div><strong>Total Pacientes Atendidos:</strong> <strong>${total_pacientes}</strong></div>
      </div>

      <table class="tabla-oficial tabla-hd-medicina">
        <thead>
          <tr>
            <th rowspan="2" style="width: 18px;">No.</th>
            <th rowspan="2" style="width: 140px;">NOMBRE</th>
            <th rowspan="2" style="width: 32px;"><div class="rot-col-med">EDAD (AÑOS)</div></th>
            <th colspan="2" style="width: 36px;">SEXO</th>
            <th rowspan="2" style="width: 28px;"><div class="rot-col-med">PRIMERA VEZ</div></th>
            <th rowspan="2" style="width: 28px;"><div class="rot-col-med">SUBSECUENTE</div></th>
            <th rowspan="2" style="width: 28px;"><div class="rot-col-med">USUARIA</div></th>
            <th rowspan="2" style="width: 28px;"><div class="rot-col-med">SERV. COMUNIDAD</div></th>
            <th rowspan="2" style="width: 150px;">DIAGNÓSTICO</th>
            <th rowspan="2" style="width: 32px;"><div class="rot-col-med">REFERIDO</div></th>
            <th colspan="12" style="background-color: #f8fafc;">CLASIFICACIÓN DE ENFERMEDADES</th>
            <th colspan="5" style="background-color: #f1f5f9;">ANÁLISIS CLÍNICOS</th>
          </tr>
          <tr style="height: 105px;">
            <th style="width: 18px;">F</th>
            <th style="width: 18px;">M</th>
            <!-- Clasificación de enfermedades -->
            <th class="th-rot-diario" style="width: 20px;"><div class="rot-col-med">E.T.S.</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">ENF. GINECO-<br>LÓGICA</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">ENF. OBSTÉ-<br>TRICA</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">ENF. DEL<br>S.N.C.</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">ENF. RESPI-<br>RATORIA</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">ENF. DIGES-<br>TIVA</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">ENF. OFTAL-<br>MOLÓGICA</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">ENF. DERMA-<br>TOLÓGICA</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">ENF. CARDIO-<br>VASCULAR</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">ENF. VÍAS<br>URINARIAS</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">ENF. MÚSCULO-<br>ESQUELÉTICO</div></th>
            <th class="th-rot-diario" style="width: 20px;"><div class="rot-col-med">OTROS</div></th>
            <!-- Análisis Clínicos -->
            <th class="th-rot-diario" style="width: 20px;"><div class="rot-col-med">V.D.R.L.</div></th>
            <th class="th-rot-diario" style="width: 20px;"><div class="rot-col-med">VIH</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">EXUDADO<br>VAGINAL</div></th>
            <th class="th-rot-diario" style="width: 22px;"><div class="rot-col-med">PAPANICO-<br>LAOU</div></th>
            <th class="th-rot-diario" style="width: 20px;"><div class="rot-col-med">OTROS</div></th>
          </tr>
        </thead>
        <tbody>
          ${filasCompletas.map(f => `
            <tr>
              <td><strong>${f.numero}</strong></td>
              <td class="text-left" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${f.nombre}</td>
              <td>${f.edad !== '' ? f.edad : ''}</td>
              <td><strong>${f.sexo_f}</strong></td>
              <td><strong>${f.sexo_m}</strong></td>
              <td><strong>${f.primera_vez}</strong></td>
              <td><strong>${f.subsecuente}</strong></td>
              <td><strong>${f.usuaria}</strong></td>
              <td><strong>${f.serv_comunidad}</strong></td>
              <td class="text-left" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${f.diagnostico}</td>
              <td>${f.referido}</td>
              <!-- Clasificación -->
              <td><strong>${f.enf_ets}</strong></td>
              <td><strong>${f.enf_gine}</strong></td>
              <td><strong>${f.enf_obst}</strong></td>
              <td><strong>${f.enf_snc}</strong></td>
              <td><strong>${f.enf_resp}</strong></td>
              <td><strong>${f.enf_dige}</strong></td>
              <td><strong>${f.enf_ofta}</strong></td>
              <td><strong>${f.enf_derm}</strong></td>
              <td><strong>${f.enf_card}</strong></td>
              <td><strong>${f.enf_urin}</strong></td>
              <td><strong>${f.enf_musc}</strong></td>
              <td><strong>${f.enf_otros}</strong></td>
              <!-- Análisis -->
              <td><strong>${f.ac_vdrl}</strong></td>
              <td><strong>${f.ac_vih}</strong></td>
              <td><strong>${f.ac_exudado}</strong></td>
              <td><strong>${f.ac_pap}</strong></td>
              <td><strong>${f.ac_otros}</strong></td>
            </tr>
          `).join('')}
          <tr class="row-total">
            <td colspan="3"><strong>TOTAL</strong></td>
            <td><strong>${totF}</strong></td>
            <td><strong>${totM}</strong></td>
            <td><strong>${tot1ra}</strong></td>
            <td><strong>${totSub}</strong></td>
            <td><strong>${totUsuaria}</strong></td>
            <td><strong>${totComunidad}</strong></td>
            <td class="text-left"><strong>${total_pacientes} Atenciones</strong></td>
            <td colspan="18"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

function renderizarDiarioExcel(datos) {
  const { fecha, medico, pacientes, total_pacientes } = datos;
  const [anio, mes, dia] = fecha.split('-');

  const filasCompletas = [...pacientes];
  while (filasCompletas.length < 15) {
    filasCompletas.push({
      numero: filasCompletas.length + 1,
      nombre: '', edad: '', sexo_f: '', sexo_m: '', primera_vez: '', subsecuente: '',
      usuaria: '', serv_comunidad: '', diagnostico: '', referido: '',
      enf_ets: '', enf_gine: '', enf_obst: '', enf_snc: '', enf_resp: '', enf_dige: '',
      enf_ofta: '', enf_derm: '', enf_card: '', enf_urin: '', enf_musc: '', enf_otros: '',
      ac_vdrl: '', ac_vih: '', ac_exudado: '', ac_pap: '', ac_otros: ''
    });
  }

  const totF = pacientes.filter(p => p.sexo_f === 'X').length;
  const totM = pacientes.filter(p => p.sexo_m === 'X').length;
  const tot1ra = pacientes.filter(p => p.primera_vez === 'X').length;
  const totSub = pacientes.filter(p => p.subsecuente === 'X').length;
  const totUsuaria = pacientes.filter(p => p.usuaria === 'X').length;
  const totComunidad = pacientes.filter(p => p.serv_comunidad === 'X').length;

  const tablaHtml = `
    <table>
      <tr>
        <th colspan="28" class="hdr-main">GOBIERNO DE LA CIUDAD DE COATZACOALCOS 2026 - 2029 &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="28" class="hdr-sub">HOJA DIARIA DE CONSULTA &bull; MEDICINA GENERAL &bull; FECHA: ${dia}/${mes}/${anio}</th>
      </tr>
      <tr>
        <td colspan="14" class="hdr-meta text-left"><strong>Médico:</strong> ${medico}</td>
        <td colspan="14" class="hdr-meta text-right"><strong>TOTAL PACIENTES:</strong> ${total_pacientes}</td>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">No.</th>
        <th rowspan="2" class="th-super">NOMBRE</th>
        <th rowspan="2" class="th-super">EDAD</th>
        <th colspan="2" class="th-super">SEXO</th>
        <th rowspan="2" class="th-super">1RA VEZ</th>
        <th rowspan="2" class="th-super">SUBSEC</th>
        <th rowspan="2" class="th-super">USUARIA</th>
        <th rowspan="2" class="th-super">COMUNIDAD</th>
        <th rowspan="2" class="th-super">DIAGNÓSTICO</th>
        <th rowspan="2" class="th-super">REFERIDO</th>
        <th colspan="12" class="th-super">CLASIFICACIÓN DE ENFERMEDADES</th>
        <th colspan="5" class="th-super">ANÁLISIS CLÍNICOS</th>
      </tr>
      <tr>
        <th class="th-col">F</th>
        <th class="th-col">M</th>
        <th class="th-col">E.T.S.</th>
        <th class="th-col">GINECOL.</th>
        <th class="th-col">OBSTÉTR.</th>
        <th class="th-col">S.N.C.</th>
        <th class="th-col">RESPIRAT.</th>
        <th class="th-col">DIGESTIV.</th>
        <th class="th-col">OFTALMOL.</th>
        <th class="th-col">DERMATOL.</th>
        <th class="th-col">CARDIOVAS.</th>
        <th class="th-col">VÍAS URIN.</th>
        <th class="th-col">MUSCULOESQ.</th>
        <th class="th-col">OTROS</th>
        <th class="th-col">V.D.R.L.</th>
        <th class="th-col">VIH</th>
        <th class="th-col">EXUDADO</th>
        <th class="th-col">PAP</th>
        <th class="th-col">OTROS</th>
      </tr>
      ${filasCompletas.map(f => `
        <tr>
          <td>${f.numero}</td>
          <td class="text-left">${f.nombre}</td>
          <td>${f.edad !== '' ? f.edad : ''}</td>
          <td>${f.sexo_f}</td><td>${f.sexo_m}</td>
          <td>${f.primera_vez}</td><td>${f.subsecuente}</td>
          <td>${f.usuaria}</td><td>${f.serv_comunidad}</td>
          <td class="text-left">${f.diagnostico}</td>
          <td>${f.referido}</td>
          <td>${f.enf_ets}</td><td>${f.enf_gine}</td><td>${f.enf_obst}</td><td>${f.enf_snc}</td>
          <td>${f.enf_resp}</td><td>${f.enf_dige}</td><td>${f.enf_ofta}</td><td>${f.enf_derm}</td>
          <td>${f.enf_card}</td><td>${f.enf_urin}</td><td>${f.enf_musc}</td><td>${f.enf_otros}</td>
          <td>${f.ac_vdrl}</td><td>${f.ac_vih}</td><td>${f.ac_exudado}</td><td>${f.ac_pap}</td><td>${f.ac_otros}</td>
        </tr>
      `).join('')}
      <tr class="row-total">
        <td colspan="3">TOTAL</td>
        <td>${totF}</td><td>${totM}</td>
        <td>${tot1ra}</td><td>${totSub}</td>
        <td>${totUsuaria}</td><td>${totComunidad}</td>
        <td class="text-left"><strong>${total_pacientes}</strong></td>
        <td colspan="18"></td>
      </tr>
    </table>
  `;

  return envolverHtmlParaExcel({
    titulo: `Hoja Diaria Medicina General ${fecha}`,
    tablasHtml: tablaHtml
  });
}

module.exports = {
  renderizarDiarioHtml,
  renderizarDiarioExcel
};
