// Plantilla HTML y Excel de la Hoja Diaria Oficial de Enfermería
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
// Reproducción exacta de la hoja física oficial (WhatsApp Image 2026-10-07 at 12.03.17.jpeg)

const { obtenerLogoHtml } = require('../common/logo');
const estilosPrint = require('../common/estilosPrint');
const { envolverHtmlParaExcel } = require('../common/excelWrapper');

function renderizarDiarioHtml(datos) {
  const { fecha, enfermero, pacientes, total_pacientes } = datos;
  const [anio, mes, dia] = fecha.split('-');
  const logoHtml = obtenerLogoHtml({ height: 105 });

  // Rellenar hasta 15 filas mínimas como en el formato impreso oficial
  const filasCompletas = [...pacientes];
  while (filasCompletas.length < 15) {
    filasCompletas.push({
      numero: filasCompletas.length + 1,
      nombre: '', edad_f: '', edad_m: '',
      ta: '', fc: '', fr: '', temp: '', spo2: '', peso: '', talla: '', imc: '',
      glucosa: '', cintura: '', cadera: '',
      det_has: '', det_dm: '', det_mama: '',
      proc_puntos: '', proc_inyeccion: '', proc_curacion: '', proc_prueba: '', proc_jornada: ''
    });
  }

  // Conteos para totales
  const totF = pacientes.filter(p => p.sexo === 'F').length;
  const totM = pacientes.filter(p => p.sexo === 'M').length;
  const totHas = pacientes.filter(p => p.det_has === 'X').length;
  const totDm = pacientes.filter(p => p.det_dm === 'X').length;
  const totMama = pacientes.filter(p => p.det_mama === 'X').length;
  const totPuntos = pacientes.filter(p => p.proc_puntos === 'X').length;
  const totInyec = pacientes.filter(p => p.proc_inyeccion === 'X').length;
  const totCurac = pacientes.filter(p => p.proc_curacion === 'X').length;
  const totPrueba = pacientes.filter(p => p.proc_prueba === 'X').length;
  const totJornada = pacientes.filter(p => p.proc_jornada === 'X').length;

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Hoja Diaria de Enfermería - ${fecha}</title>
    <style>
      ${estilosPrint}
      .tabla-hd-enf th {
        font-size: 10.5px;
        padding: 2px 1px;
        line-height: 1.05;
      }
      .tabla-hd-enf td {
        font-size: 10.5px; font-weight: 500;
        height: 22px;
        padding: 1px 1px;
        text-align: center;
      }
      .rot-col-enf {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
        font-size: 10px;
        font-weight: bold;
        padding: 3px 1px;
        max-height: 98px;
        margin: 0 auto;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <a href="/api/estadisticas/diario/excel?fecha=${fecha}&area=ENFERMERIA" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
    </div>

    <div class="pagina-reporte">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">HOJA DIARIA DE ENFERMERÍA</div>
          <div style="font-size: 10px; font-weight: bold; color: #475569; margin-bottom: 2px;">
            DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL &bull; COATZACOALCOS
          </div>
          <div class="fecha-box-container">
            <div class="fecha-cell">DÍA<strong>${dia}</strong></div>
            <div class="fecha-cell">MES<strong>${mes}</strong></div>
            <div class="fecha-cell">AÑO<strong>${anio}</strong></div>
          </div>
        </div>
      </div>

      <div class="meta-subbar" style="margin-bottom: 4px;">
        <div><strong>Nombre del Enfermero (a):</strong> <span style="text-decoration: underline; padding-left: 6px;">${enfermero}</span></div>
        <div><strong>Total Pacientes Atendidos:</strong> <strong>${total_pacientes}</strong></div>
      </div>

      <table class="tabla-oficial tabla-hd-enf">
        <thead>
          <tr>
            <th rowspan="2" style="width: 20px;">No.</th>
            <th rowspan="2" style="width: 170px;">NOMBRE</th>
            <th colspan="2" style="width: 44px;">EDAD</th>
            <th rowspan="2" style="width: 38px;">T/A</th>
            <th rowspan="2" style="width: 30px;">FC</th>
            <th rowspan="2" style="width: 30px;">FR</th>
            <th rowspan="2" style="width: 32px;">TEMP</th>
            <th rowspan="2" style="width: 34px;">SAT O2</th>
            <th rowspan="2" style="width: 34px;">PESO</th>
            <th rowspan="2" style="width: 34px;">TALLA</th>
            <th rowspan="2" style="width: 34px;">IMC</th>
            <th rowspan="2" style="width: 40px;"><div class="rot-col-enf">GLUCOSA DE CONTROL</div></th>
            <th rowspan="2" style="width: 36px;"><div class="rot-col-enf">CINTURA (cm)</div></th>
            <th rowspan="2" style="width: 36px;"><div class="rot-col-enf">CADERA (cm)</div></th>
            <th colspan="3" style="background-color: #f8fafc;">DETECCIÓN</th>
            <th rowspan="2" style="width: 32px;"><div class="rot-col-enf">RETIRO DE PUNTOS</div></th>
            <th rowspan="2" style="width: 32px;"><div class="rot-col-enf">APLIC. DE INYECCIONES</div></th>
            <th rowspan="2" style="width: 32px;"><div class="rot-col-enf">CURACIÓN</div></th>
            <th rowspan="2" style="width: 32px;"><div class="rot-col-enf">PRUEBA RÁPIDA</div></th>
            <th rowspan="2" style="width: 32px;"><div class="rot-col-enf">ACT. EN JORNADA</div></th>
          </tr>
          <tr>
            <th style="width: 22px;">F</th>
            <th style="width: 22px;">M</th>
            <th style="width: 26px;"><div class="rot-col-enf">HAS</div></th>
            <th style="width: 26px;"><div class="rot-col-enf">DM</div></th>
            <th style="width: 30px;"><div class="rot-col-enf">EXP. MAMA</div></th>
          </tr>
        </thead>
        <tbody>
          ${filasCompletas.map(f => `
            <tr>
              <td><strong>${f.numero}</strong></td>
              <td class="text-left" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">${f.nombre}</td>
              <td>${f.edad_f}</td>
              <td>${f.edad_m}</td>
              <td>${f.ta}</td>
              <td>${f.fc}</td>
              <td>${f.fr}</td>
              <td>${f.temp}</td>
              <td>${f.spo2}</td>
              <td>${f.peso}</td>
              <td>${f.talla}</td>
              <td>${f.imc}</td>
              <td>${f.glucosa}</td>
              <td>${f.cintura}</td>
              <td>${f.cadera}</td>
              <td><strong>${f.det_has}</strong></td>
              <td><strong>${f.det_dm}</strong></td>
              <td><strong>${f.det_mama}</strong></td>
              <td><strong>${f.proc_puntos}</strong></td>
              <td><strong>${f.proc_inyeccion}</strong></td>
              <td><strong>${f.proc_curacion}</strong></td>
              <td><strong>${f.proc_prueba}</strong></td>
              <td><strong>${f.proc_jornada}</strong></td>
            </tr>
          `).join('')}
          <tr class="row-total">
            <td colspan="2"><strong>TOTAL</strong></td>
            <td><strong>${totF}</strong></td>
            <td><strong>${totM}</strong></td>
            <td colspan="11"><strong>${total_pacientes} Atenciones</strong></td>
            <td><strong>${totHas}</strong></td>
            <td><strong>${totDm}</strong></td>
            <td><strong>${totMama}</strong></td>
            <td><strong>${totPuntos}</strong></td>
            <td><strong>${totInyec}</strong></td>
            <td><strong>${totCurac}</strong></td>
            <td><strong>${totPrueba}</strong></td>
            <td><strong>${totJornada}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

function renderizarDiarioExcel(datos) {
  const { fecha, enfermero, pacientes, total_pacientes } = datos;
  const [anio, mes, dia] = fecha.split('-');

  const filasCompletas = [...pacientes];
  while (filasCompletas.length < 15) {
    filasCompletas.push({
      numero: filasCompletas.length + 1,
      nombre: '', edad_f: '', edad_m: '',
      ta: '', fc: '', fr: '', temp: '', spo2: '', peso: '', talla: '', imc: '',
      glucosa: '', cintura: '', cadera: '',
      det_has: '', det_dm: '', det_mama: '',
      proc_puntos: '', proc_inyeccion: '', proc_curacion: '', proc_prueba: '', proc_jornada: ''
    });
  }

  const totF = pacientes.filter(p => p.sexo === 'F').length;
  const totM = pacientes.filter(p => p.sexo === 'M').length;
  const totHas = pacientes.filter(p => p.det_has === 'X').length;
  const totDm = pacientes.filter(p => p.det_dm === 'X').length;
  const totMama = pacientes.filter(p => p.det_mama === 'X').length;
  const totPuntos = pacientes.filter(p => p.proc_puntos === 'X').length;
  const totInyec = pacientes.filter(p => p.proc_inyeccion === 'X').length;
  const totCurac = pacientes.filter(p => p.proc_curacion === 'X').length;
  const totPrueba = pacientes.filter(p => p.proc_prueba === 'X').length;
  const totJornada = pacientes.filter(p => p.proc_jornada === 'X').length;

  const tablaHtml = `
    <table>
      <tr>
        <th colspan="23" class="hdr-main">GOBIERNO DE LA CIUDAD DE COATZACOALCOS 2026 - 2029 &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="23" class="hdr-sub">HOJA DIARIA DE ENFERMERÍA &bull; FECHA: ${dia}/${mes}/${anio}</th>
      </tr>
      <tr>
        <td colspan="12" class="hdr-meta text-left"><strong>Enfermero (a):</strong> ${enfermero}</td>
        <td colspan="11" class="hdr-meta text-right"><strong>TOTAL PACIENTES:</strong> ${total_pacientes}</td>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">No.</th>
        <th rowspan="2" class="th-super">NOMBRE</th>
        <th colspan="2" class="th-super">EDAD</th>
        <th rowspan="2" class="th-super">T/A</th>
        <th rowspan="2" class="th-super">FC</th>
        <th rowspan="2" class="th-super">FR</th>
        <th rowspan="2" class="th-super">TEMP</th>
        <th rowspan="2" class="th-super">SAT O2</th>
        <th rowspan="2" class="th-super">PESO</th>
        <th rowspan="2" class="th-super">TALLA</th>
        <th rowspan="2" class="th-super">IMC</th>
        <th rowspan="2" class="th-super">GLUCOSA DE CONTROL</th>
        <th rowspan="2" class="th-super">CINTURA (cm)</th>
        <th rowspan="2" class="th-super">CADERA (cm)</th>
        <th colspan="3" class="th-super">DETECCIÓN</th>
        <th rowspan="2" class="th-super">RETIRO DE PUNTOS</th>
        <th rowspan="2" class="th-super">APLIC. INYECCIONES</th>
        <th rowspan="2" class="th-super">CURACIÓN</th>
        <th rowspan="2" class="th-super">PRUEBA RÁPIDA</th>
        <th rowspan="2" class="th-super">ACT. EN JORNADA</th>
      </tr>
      <tr>
        <th class="th-col">F</th>
        <th class="th-col">M</th>
        <th class="th-col">HAS</th>
        <th class="th-col">DM</th>
        <th class="th-col">EXP. MAMA</th>
      </tr>
      ${filasCompletas.map(f => `
        <tr>
          <td>${f.numero}</td>
          <td class="text-left">${f.nombre}</td>
          <td>${f.edad_f}</td><td>${f.edad_m}</td>
          <td>${f.ta}</td><td>${f.fc}</td><td>${f.fr}</td><td>${f.temp}</td><td>${f.spo2}</td>
          <td>${f.peso}</td><td>${f.talla}</td><td>${f.imc}</td><td>${f.glucosa}</td>
          <td>${f.cintura}</td><td>${f.cadera}</td>
          <td>${f.det_has}</td><td>${f.det_dm}</td><td>${f.det_mama}</td>
          <td>${f.proc_puntos}</td><td>${f.proc_inyeccion}</td><td>${f.proc_curacion}</td>
          <td>${f.proc_prueba}</td><td>${f.proc_jornada}</td>
        </tr>
      `).join('')}
      <tr class="row-total">
        <td colspan="2">TOTAL</td>
        <td>${totF}</td><td>${totM}</td>
        <td colspan="11">${total_pacientes}</td>
        <td>${totHas}</td><td>${totDm}</td><td>${totMama}</td>
        <td>${totPuntos}</td><td>${totInyec}</td><td>${totCurac}</td><td>${totPrueba}</td><td>${totJornada}</td>
      </tr>
    </table>
  `;

  return envolverHtmlParaExcel({
    titulo: `Hoja Diaria Enfermería ${fecha}`,
    tablasHtml: tablaHtml
  });
}

module.exports = {
  renderizarDiarioHtml,
  renderizarDiarioExcel
};
