// Plantilla HTML y Excel de la Hoja Diaria Oficial de Nutrición
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const { obtenerLogoHtml } = require('../common/logo');
const estilosPrint = require('../common/estilosPrint');
const { envolverHtmlParaExcel } = require('../common/excelWrapper');

function renderizarDiarioHtml(datos) {
  const { fecha, nutriologo, pacientes, total_pacientes } = datos;
  const [anio, mes, dia] = fecha.split('-');
  const logoHtml = obtenerLogoHtml({ height: 105 });

  // Rellenar hasta 15 filas mínimas como en el formato impreso oficial
  const filasCompletas = [...pacientes];
  while (filasCompletas.length < 15) {
    filasCompletas.push({
      numero: filasCompletas.length + 1,
      nombre: '', edad: '', sexo_f: '', sexo_m: '', primera_vez: '', subsecuente: '',
      trab_mpio: '', pob_abierta: '', talla: '', peso: '', imc: '', c_cintura: '', c_cadera: '',
      ta: '', glucosa: '', puntuacion_z: '', laboratoriales: '', diagnostico: ''
    });
  }

  // Conteos para totales
  const totF = pacientes.filter(p => p.sexo_f === 'X').length;
  const totM = pacientes.filter(p => p.sexo_m === 'X').length;
  const tot1ra = pacientes.filter(p => p.primera_vez === 'X').length;
  const totSub = pacientes.filter(p => p.subsecuente === 'X').length;
  const totTrab = pacientes.filter(p => p.trab_mpio === 'X').length;
  const totPobAb = pacientes.filter(p => p.pob_abierta === 'X').length;

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Hoja Diaria de Nutrición - ${fecha}</title>
    <style>
      ${estilosPrint}
      .tabla-hd-nutricion th {
        font-size: 10.5px;
        padding: 3px 1px;
      }
      .tabla-hd-nutricion td {
        font-size: 11.5px; font-weight: bold;
        height: 22px;
        padding: 2px 1px;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <a href="/api/estadisticas/diario/excel?fecha=${fecha}&area=NUTRICION" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
    </div>

    <div class="pagina-reporte">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">HOJA DIARIA DE NUTRICIÓN</div>
          <div class="fecha-box-container">
            <div class="fecha-cell">DÍA<strong>${dia}</strong></div>
            <div class="fecha-cell">MES<strong>${mes}</strong></div>
            <div class="fecha-cell">AÑO<strong>${anio}</strong></div>
          </div>
        </div>
      </div>

      <div class="meta-subbar">
        <div><strong>Nombre del Nutriólogo (a):</strong> <span style="text-decoration: underline; padding-left: 6px;">${nutriologo}</span></div>
        <div><strong>Total Pacientes Registrados:</strong> ${total_pacientes}</div>
      </div>

      <table class="tabla-oficial tabla-hd-nutricion">
        <thead>
          <tr>
            <th rowspan="2" style="width: 24px;">No.</th>
            <th rowspan="2" style="width: 200px;">NOMBRE</th>
            <th rowspan="2" style="width: 42px;">EDAD (AÑOS)</th>
            <th colspan="2" style="width: 50px;">SEXO</th>
            <th rowspan="2" style="width: 55px;">PRIMERA VEZ</th>
            <th rowspan="2" style="width: 55px;">SUBSECUENTE</th>
            <th rowspan="2" style="width: 60px;">TRAB. DEL MPIO.</th>
            <th rowspan="2" style="width: 58px;">POB. ABIERTA</th>
            <th rowspan="2" style="width: 38px;">TALLA</th>
            <th rowspan="2" style="width: 38px;">PESO</th>
            <th rowspan="2" style="width: 38px;">IMC</th>
            <th rowspan="2" style="width: 46px;">C. CINTURA</th>
            <th rowspan="2" style="width: 46px;">C. CADERA</th>
            <th rowspan="2" style="width: 46px;">T/A</th>
            <th rowspan="2" style="width: 46px;">GLUCOSA</th>
            <th rowspan="2" style="width: 68px;">PUNTUACIÓN Z / PERCENTIL</th>
            <th rowspan="2" style="width: 70px;">LABORATORIALES</th>
            <th rowspan="2" style="width: 170px;">DIAGNÓSTICO</th>
          </tr>
          <tr>
            <th style="width: 25px;">F</th>
            <th style="width: 25px;">M</th>
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
              <td><strong>${f.trab_mpio}</strong></td>
              <td><strong>${f.pob_abierta}</strong></td>
              <td>${f.talla}</td>
              <td>${f.peso}</td>
              <td>${f.imc}</td>
              <td>${f.c_cintura}</td>
              <td>${f.c_cadera}</td>
              <td>${f.ta}</td>
              <td>${f.glucosa}</td>
              <td>${f.puntuacion_z}</td>
              <td>${f.laboratoriales}</td>
              <td class="text-left">${f.diagnostico}</td>
            </tr>
          `).join('')}
          <tr class="row-total">
            <td colspan="3"><strong>TOTAL</strong></td>
            <td><strong>${totF}</strong></td>
            <td><strong>${totM}</strong></td>
            <td><strong>${tot1ra}</strong></td>
            <td><strong>${totSub}</strong></td>
            <td><strong>${totTrab}</strong></td>
            <td><strong>${totPobAb}</strong></td>
            <td colspan="9">-</td>
            <td><strong>${total_pacientes}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

function renderizarDiarioExcel(datos) {
  const { fecha, nutriologo, pacientes, total_pacientes } = datos;
  const [anio, mes, dia] = fecha.split('-');

  const filasCompletas = [...pacientes];
  while (filasCompletas.length < 15) {
    filasCompletas.push({
      numero: filasCompletas.length + 1,
      nombre: '', edad: '', sexo_f: '', sexo_m: '', primera_vez: '', subsecuente: '',
      trab_mpio: '', pob_abierta: '', talla: '', peso: '', imc: '', c_cintura: '', c_cadera: '',
      ta: '', glucosa: '', puntuacion_z: '', laboratoriales: '', diagnostico: ''
    });
  }

  const totF = pacientes.filter(p => p.sexo_f === 'X').length;
  const totM = pacientes.filter(p => p.sexo_m === 'X').length;
  const tot1ra = pacientes.filter(p => p.primera_vez === 'X').length;
  const totSub = pacientes.filter(p => p.subsecuente === 'X').length;
  const totTrab = pacientes.filter(p => p.trab_mpio === 'X').length;
  const totPobAb = pacientes.filter(p => p.pob_abierta === 'X').length;

  const tablaHtml = `
    <table>
      <tr>
        <th colspan="19" class="hdr-main">GOBIERNO DE LA CIUDAD DE COATZACOALCOS 2026 - 2029 &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="19" class="hdr-sub">HOJA DIARIA DE NUTRICIÓN &bull; FECHA: ${dia}/${mes}/${anio}</th>
      </tr>
      <tr>
        <td colspan="10" class="hdr-meta text-left"><strong>Nutriólogo(a):</strong> ${nutriologo}</td>
        <td colspan="9" class="hdr-meta text-right"><strong>TOTAL PACIENTES:</strong> ${total_pacientes}</td>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">No.</th>
        <th rowspan="2" class="th-super">NOMBRE DEL PACIENTE</th>
        <th rowspan="2" class="th-super">EDAD</th>
        <th colspan="2" class="th-super">SEXO</th>
        <th rowspan="2" class="th-super">PRIMERA VEZ</th>
        <th rowspan="2" class="th-super">SUBSECUENTE</th>
        <th rowspan="2" class="th-super">TRAB. DEL MPIO.</th>
        <th rowspan="2" class="th-super">POB. ABIERTA</th>
        <th rowspan="2" class="th-super">TALLA</th>
        <th rowspan="2" class="th-super">PESO</th>
        <th rowspan="2" class="th-super">IMC</th>
        <th rowspan="2" class="th-super">C. CINTURA</th>
        <th rowspan="2" class="th-super">C. CADERA</th>
        <th rowspan="2" class="th-super">T/A</th>
        <th rowspan="2" class="th-super">GLUCOSA</th>
        <th rowspan="2" class="th-super">PUNTUACIÓN Z</th>
        <th rowspan="2" class="th-super">LABORATORIALES</th>
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
          <td>${f.sexo_f}</td>
          <td>${f.sexo_m}</td>
          <td>${f.primera_vez}</td>
          <td>${f.subsecuente}</td>
          <td>${f.trab_mpio}</td>
          <td>${f.pob_abierta}</td>
          <td>${f.talla}</td>
          <td>${f.peso}</td>
          <td>${f.imc}</td>
          <td>${f.c_cintura}</td>
          <td>${f.c_cadera}</td>
          <td>${f.ta}</td>
          <td>${f.glucosa}</td>
          <td>${f.puntuacion_z}</td>
          <td>${f.laboratoriales}</td>
          <td class="text-left">${f.diagnostico}</td>
        </tr>
      `).join('')}
      <tr class="row-total">
        <td colspan="3">TOTAL</td>
        <td>${totF}</td>
        <td>${totM}</td>
        <td>${tot1ra}</td>
        <td>${totSub}</td>
        <td>${totTrab}</td>
        <td>${totPobAb}</td>
        <td colspan="9">-</td>
        <td>${total_pacientes}</td>
      </tr>
    </table>
  `;

  return envolverHtmlParaExcel({
    titulo: `Hoja Diaria Nutrición ${fecha}`,
    tablasHtml: tablaHtml
  });
}

module.exports = {
  renderizarDiarioHtml,
  renderizarDiarioExcel
};
