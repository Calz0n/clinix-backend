// Plantilla HTML y Excel de la Hoja Diaria Oficial de Psicología
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
// Reproducción exacta de la hoja física oficial (WhatsApp Image 2026-10-07 at 12.02.05.jpeg)

const { obtenerLogoHtml } = require('../common/logo');
const estilosPrint = require('../common/estilosPrint');
const { envolverHtmlParaExcel } = require('../common/excelWrapper');

function renderizarDiarioHtml(datos) {
  const { fecha, psicologo, pacientes, total_pacientes } = datos;
  const [anio, mes, dia] = fecha.split('-');
  const logoHtml = obtenerLogoHtml({ height: 105 });

  // Rellenar hasta 15 filas mínimas como en el formato impreso oficial
  const filasCompletas = [...pacientes];
  while (filasCompletas.length < 15) {
    filasCompletas.push({
      numero: filasCompletas.length + 1,
      nombre: '', edad: '', sexo_f: '', sexo_m: '', primera_vez: '', subsecuente: '',
      ta: '', fc: '', fr: '', peso: '', talla: '', imc: '', spo2: '', glucosa: '', diagnostico: ''
    });
  }

  const totF = pacientes.filter(p => p.sexo_f === 'X').length;
  const totM = pacientes.filter(p => p.sexo_m === 'X').length;
  const tot1ra = pacientes.filter(p => p.primera_vez === 'X').length;
  const totSub = pacientes.filter(p => p.subsecuente === 'X').length;

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Hoja Diaria de Psicología - ${fecha}</title>
    <style>
      ${estilosPrint}
      .tabla-hd-psico th {
        font-size: 10.5px;
        padding: 3px 1px;
      }
      .tabla-hd-psico td {
        font-size: 11.5px; font-weight: bold;
        height: 22px;
        padding: 2px 1px;
      }
      .rot-col-hd {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
        font-size: 10px;
        font-weight: bold;
        padding: 4px 1px;
        max-height: 98px;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button class="btn-print" style="background-color: #701128 !important; color: #ffffff !important; border: none !important; padding: 8px 18px !important; font-size: 12px !important; border-radius: 4px !important; font-weight: bold !important; display: inline-flex !important; align-items: center !important; gap: 6px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important; cursor: pointer !important;" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <a href="/api/estadisticas/diario/excel?fecha=${fecha}&area=PSICOLOGIA" class="btn-excel" style="background-color: #107c41 !important; color: #ffffff !important; text-decoration: none !important; padding: 8px 18px !important; font-size: 12px !important; border-radius: 4px !important; font-weight: bold !important; display: inline-flex !important; align-items: center !important; gap: 6px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;">📊 Descargar en Excel Formateado (.xls)</a>
    </div>

    <div class="pagina-reporte">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">HOJA DIARIA DE PSICOLOGÍA</div>
          <div class="fecha-box-container">
            <div class="fecha-cell">DÍA<strong>${dia}</strong></div>
            <div class="fecha-cell">MES<strong>${mes}</strong></div>
            <div class="fecha-cell">AÑO<strong>${anio}</strong></div>
          </div>
        </div>
      </div>

      <div class="meta-subbar">
        <div><strong>Nombre del Profesional:</strong> <span style="text-decoration: underline; padding-left: 6px;">${psicologo}</span></div>
        <div><strong>Total Pacientes Registrados:</strong> ${total_pacientes}</div>
      </div>

      <table class="tabla-oficial tabla-hd-psico">
        <thead>
          <tr>
            <th rowspan="2" style="width: 24px;">No.</th>
            <th rowspan="2" style="width: 200px;">NOMBRE</th>
            <th rowspan="2" style="width: 48px;">EDAD (AÑOS)</th>
            <th colspan="2" style="width: 56px;">SEXO</th>
            <th rowspan="2" style="width: 55px;"><div class="rot-col-hd">PRIMERA VEZ</div></th>
            <th rowspan="2" style="width: 55px;"><div class="rot-col-hd">SUBSECUENTE</div></th>
            <th rowspan="2" style="width: 50px;">T/A</th>
            <th rowspan="2" style="width: 38px;">F.C.</th>
            <th rowspan="2" style="width: 38px;">F.R.</th>
            <th rowspan="2" style="width: 42px;">PESO</th>
            <th rowspan="2" style="width: 42px;">TALLA</th>
            <th rowspan="2" style="width: 42px;">I.M.C.</th>
            <th rowspan="2" style="width: 45px;">SAT O2</th>
            <th rowspan="2" style="width: 45px;">GLUCOSA</th>
            <th rowspan="2" style="width: 230px;">DIAGNÓSTICO</th>
          </tr>
          <tr>
            <th style="width: 28px;">F</th>
            <th style="width: 28px;">M</th>
          </tr>
        </thead>
        <tbody>
          ${filasCompletas.map(f => `
            <tr>
              <td><strong>${f.numero}</strong></td>
              <td class="text-left">${f.nombre}</td>
              <td>${f.edad !== '' ? f.edad : ''}</td>
              <td><strong>${f.sexo_f}</strong></td>
              <td><strong>${f.sexo_m}</strong></td>
              <td><strong>${f.primera_vez}</strong></td>
              <td><strong>${f.subsecuente}</strong></td>
              <td>${f.ta}</td>
              <td>${f.fc}</td>
              <td>${f.fr}</td>
              <td>${f.peso}</td>
              <td>${f.talla}</td>
              <td>${f.imc}</td>
              <td>${f.spo2}</td>
              <td>${f.glucosa}</td>
              <td class="text-left">${f.diagnostico}</td>
            </tr>
          `).join('')}
          <tr class="row-total">
            <td colspan="3"><strong>TOTAL</strong></td>
            <td><strong>${totF}</strong></td>
            <td><strong>${totM}</strong></td>
            <td><strong>${tot1ra}</strong></td>
            <td><strong>${totSub}</strong></td>
            <td colspan="8"></td>
            <td class="text-left"><strong>${total_pacientes} Atenciones</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

function renderizarDiarioExcel(datos) {
  const { fecha, psicologo, pacientes, total_pacientes } = datos;
  const [anio, mes, dia] = fecha.split('-');

  const filasCompletas = [...pacientes];
  while (filasCompletas.length < 15) {
    filasCompletas.push({
      numero: filasCompletas.length + 1,
      nombre: '', edad: '', sexo_f: '', sexo_m: '', primera_vez: '', subsecuente: '',
      ta: '', fc: '', fr: '', peso: '', talla: '', imc: '', spo2: '', glucosa: '', diagnostico: ''
    });
  }

  const totF = pacientes.filter(p => p.sexo_f === 'X').length;
  const totM = pacientes.filter(p => p.sexo_m === 'X').length;
  const tot1ra = pacientes.filter(p => p.primera_vez === 'X').length;
  const totSub = pacientes.filter(p => p.subsecuente === 'X').length;

  const tablaHtml = `
    <table>
      <tr>
        <th colspan="16" class="hdr-main">GOBIERNO DE LA CIUDAD DE COATZACOALCOS 2026 - 2029 &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="16" class="hdr-sub">HOJA DIARIA DE PSICOLOGÍA &bull; FECHA: ${dia}/${mes}/${anio}</th>
      </tr>
      <tr>
        <td colspan="8" class="hdr-meta text-left"><strong>Profesional:</strong> ${psicologo}</td>
        <td colspan="8" class="hdr-meta text-right"><strong>TOTAL PACIENTES:</strong> ${total_pacientes}</td>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">No.</th>
        <th rowspan="2" class="th-super">NOMBRE DEL PACIENTE</th>
        <th rowspan="2" class="th-super">EDAD (AÑOS)</th>
        <th colspan="2" class="th-super">SEXO</th>
        <th rowspan="2" class="th-super">PRIMERA VEZ</th>
        <th rowspan="2" class="th-super">SUBSECUENTE</th>
        <th rowspan="2" class="th-super">T/A</th>
        <th rowspan="2" class="th-super">F.C.</th>
        <th rowspan="2" class="th-super">F.R.</th>
        <th rowspan="2" class="th-super">PESO</th>
        <th rowspan="2" class="th-super">TALLA</th>
        <th rowspan="2" class="th-super">I.M.C.</th>
        <th rowspan="2" class="th-super">SAT O2</th>
        <th rowspan="2" class="th-super">GLUCOSA</th>
        <th rowspan="2" class="th-super">DIAGNÓSTICO</th>
      </tr>
      <tr>
        <th class="th-col">F</th>
        <th class="th-col">M</th>
      </tr>
      ${filasCompletas.map(f => `
        <tr>
          <td>${f.numero}</td>
          <td class="text-left">${f.nombre}</td>
          <td>${f.edad !== '' ? f.edad : ''}</td>
          <td>${f.sexo_f}</td><td>${f.sexo_m}</td>
          <td>${f.primera_vez}</td><td>${f.subsecuente}</td>
          <td>${f.ta}</td><td>${f.fc}</td><td>${f.fr}</td><td>${f.peso}</td><td>${f.talla}</td><td>${f.imc}</td><td>${f.spo2}</td><td>${f.glucosa}</td>
          <td class="text-left">${f.diagnostico}</td>
        </tr>
      `).join('')}
      <tr class="row-total">
        <td colspan="3">TOTAL</td>
        <td>${totF}</td><td>${totM}</td>
        <td>${tot1ra}</td><td>${totSub}</td>
        <td colspan="8"></td>
        <td class="text-left"><strong>${total_pacientes} Atenciones</strong></td>
      </tr>
    </table>
  `;

  return envolverHtmlParaExcel({
    titulo: `Hoja Diaria Psicología ${fecha}`,
    tablasHtml: tablaHtml
  });
}

module.exports = {
  renderizarDiarioHtml,
  renderizarDiarioExcel
};
