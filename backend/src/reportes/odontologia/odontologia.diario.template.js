// Plantilla HTML y Excel de la Hoja Diaria Oficial de Odontología
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
// Reproducción exacta de la hoja física oficial

const { obtenerLogoHtml } = require('../common/logo');
const estilosPrint = require('../common/estilosPrint');
const { envolverHtmlParaExcel } = require('../common/excelWrapper');

function renderizarDiarioHtml(datos) {
  const { fecha, odontologo, pacientes, total_pacientes } = datos;
  const [anio, mes, dia] = fecha.split('-');
  const logoHtml = obtenerLogoHtml({ height: 105 });

  // Rellenar hasta 15 filas mínimas
  const filasCompletas = [...pacientes];
  while (filasCompletas.length < 15) {
    filasCompletas.push({
      numero: filasCompletas.length + 1,
      nombre: '', diagnostico: '', edad: '', sexo_f: '', sexo_m: '', primera_vez: '', subsecuente: '', preventiva: '',
      det_absceso: '', det_caries: '', det_gingivitis: '', det_periodontitis: '', det_abrasion: '', det_bruxismo: '',
      det_cepillado: '', det_hilo: '', det_placa: '', det_fluor: '',
      trat_profilaxis: '', trat_curetaje: '', trat_farmaco: '', trat_desensibilizante: '', trat_amalgama: '', trat_resina: '', trat_extraccion: '',
      gab_biometria: '', gab_coagulacion: '', gab_pruebas_rapidas: '', gab_panoramica: '', gab_periapical: ''
    });
  }

  // Totales
  const totF = pacientes.filter(p => p.sexo_f === 'X').length;
  const totM = pacientes.filter(p => p.sexo_m === 'X').length;
  const tot1ra = pacientes.filter(p => p.primera_vez === 'X').length;
  const totSub = pacientes.filter(p => p.subsecuente === 'X').length;
  const totPrev = pacientes.filter(p => p.preventiva === 'X').length;

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Hoja Diaria de Odontología - ${fecha}</title>
    <style>
      ${estilosPrint}
      .tabla-hd-odonto th {
        font-size: 6px;
        padding: 2px 0.5px;
      }
      .tabla-hd-odonto td {
        font-size: 7px;
        height: 18px;
        padding: 1.5px 0.5px;
      }
      .rot-col-hd {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
        font-size: 6px;
        font-weight: bold;
        padding: 3px 0.5px;
        max-height: 75px;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <a href="/api/estadisticas/diario/excel?fecha=${fecha}&area=ODONTOLOGIA" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
    </div>

    <div class="pagina-reporte">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">HOJA DIARIA DE ODONTOLOGÍA</div>
          <div class="fecha-box-container">
            <div class="fecha-cell">DÍA<strong>${dia}</strong></div>
            <div class="fecha-cell">MES<strong>${mes}</strong></div>
            <div class="fecha-cell">AÑO<strong>${anio}</strong></div>
          </div>
        </div>
      </div>

      <div class="meta-subbar">
        <div><strong>Nombre del Dr. (a):</strong> <span style="text-decoration: underline; padding-left: 6px;">${odontologo}</span></div>
        <div><strong>Total Pacientes Registrados:</strong> ${total_pacientes}</div>
      </div>

      <table class="tabla-oficial tabla-hd-odonto">
        <thead>
          <tr>
            <th rowspan="2" style="width: 20px;">No.</th>
            <th rowspan="2" style="width: 140px;">NOMBRE</th>
            <th rowspan="2" style="width: 130px;">DIAGNÓSTICO</th>
            <th rowspan="2" style="width: 28px;">EDAD</th>
            <th colspan="2" style="width: 36px;">SEXO</th>
            <th colspan="3" style="width: 90px;">TIPO ATENCIÓN</th>
            <th colspan="10" class="th-super">DETECCIONES</th>
            <th colspan="7" class="th-super">TRATAMIENTO</th>
            <th colspan="5" class="th-super">ESTUDIOS DE GABINETE</th>
          </tr>
          <tr>
            <th style="width: 18px;">F</th>
            <th style="width: 18px;">M</th>
            <th style="width: 28px;"><div class="rot-col-hd">1RA VEZ</div></th>
            <th style="width: 32px;"><div class="rot-col-hd">SUBSECUENTE</div></th>
            <th style="width: 30px;"><div class="rot-col-hd">PREVENTIVA</div></th>

            <!-- Detecciones (10) -->
            <th style="width: 32px;"><div class="rot-col-hd">ABSCESO PERIODONTAL</div></th>
            <th style="width: 26px;"><div class="rot-col-hd">CARIES</div></th>
            <th style="width: 28px;"><div class="rot-col-hd">GINGIVITIS</div></th>
            <th style="width: 30px;"><div class="rot-col-hd">PERIODONTITIS</div></th>
            <th style="width: 30px;"><div class="rot-col-hd">ABRASIÓN DENTAL</div></th>
            <th style="width: 28px;"><div class="rot-col-hd">BRUXISMO</div></th>
            <th style="width: 32px;"><div class="rot-col-hd">TÉCNICA DE CEPILLADO</div></th>
            <th style="width: 30px;"><div class="rot-col-hd">USO DE HILO DENTAL</div></th>
            <th style="width: 30px;"><div class="rot-col-hd">DETECCIÓN DE PLACA</div></th>
            <th style="width: 32px;"><div class="rot-col-hd">APLICACIÓN DE FLÚOR</div></th>

            <!-- Tratamiento (7) -->
            <th style="width: 30px;"><div class="rot-col-hd">PROFILAXIS</div></th>
            <th style="width: 32px;"><div class="rot-col-hd">CURETAJE PERIAPICAL</div></th>
            <th style="width: 32px;"><div class="rot-col-hd">FARMACOTERAPIA</div></th>
            <th style="width: 32px;"><div class="rot-col-hd">DESENSIBILIZANTE</div></th>
            <th style="width: 28px;"><div class="rot-col-hd">AMALGAMA</div></th>
            <th style="width: 26px;"><div class="rot-col-hd">RESINA</div></th>
            <th style="width: 32px;"><div class="rot-col-hd">EXTRACCIÓN DENTAL</div></th>

            <!-- Gabinete (5) -->
            <th style="width: 34px;"><div class="rot-col-hd">BIOMETRÍA HEMÁTICA</div></th>
            <th style="width: 32px;"><div class="rot-col-hd">TIEMPO COAGULACIÓN</div></th>
            <th style="width: 32px;"><div class="rot-col-hd">PRUEBAS RÁPIDAS</div></th>
            <th style="width: 34px;"><div class="rot-col-hd">RAD. PANORÁMICA</div></th>
            <th style="width: 32px;"><div class="rot-col-hd">RAD. PERIAPICAL</div></th>
          </tr>
        </thead>
        <tbody>
          ${filasCompletas.map(f => `
            <tr>
              <td><strong>${f.numero}</strong></td>
              <td class="text-left">${f.nombre}</td>
              <td class="text-left">${f.diagnostico}</td>
              <td>${f.edad !== '' ? f.edad : ''}</td>
              <td><strong>${f.sexo_f}</strong></td>
              <td><strong>${f.sexo_m}</strong></td>
              <td><strong>${f.primera_vez}</strong></td>
              <td><strong>${f.subsecuente}</strong></td>
              <td><strong>${f.preventiva}</strong></td>

              <td>${f.det_absceso}</td>
              <td>${f.det_caries}</td>
              <td>${f.det_gingivitis}</td>
              <td>${f.det_periodontitis}</td>
              <td>${f.det_abrasion}</td>
              <td>${f.det_bruxismo}</td>
              <td>${f.det_cepillado}</td>
              <td>${f.det_hilo}</td>
              <td>${f.det_placa}</td>
              <td>${f.det_fluor}</td>

              <td>${f.trat_profilaxis}</td>
              <td>${f.trat_curetaje}</td>
              <td>${f.trat_farmaco}</td>
              <td>${f.trat_desensibilizante}</td>
              <td>${f.trat_amalgama}</td>
              <td>${f.trat_resina}</td>
              <td>${f.trat_extraccion}</td>

              <td>${f.gab_biometria}</td>
              <td>${f.gab_coagulacion}</td>
              <td>${f.gab_pruebas_rapidas}</td>
              <td>${f.gab_panoramica}</td>
              <td>${f.gab_periapical}</td>
            </tr>
          `).join('')}
          <tr class="row-total">
            <td colspan="4"><strong>TOTAL</strong></td>
            <td><strong>${totF}</strong></td>
            <td><strong>${totM}</strong></td>
            <td><strong>${tot1ra}</strong></td>
            <td><strong>${totSub}</strong></td>
            <td><strong>${totPrev}</strong></td>
            <td colspan="22">-</td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

function renderizarDiarioExcel(datos) {
  const { fecha, odontologo, pacientes, total_pacientes } = datos;
  const [anio, mes, dia] = fecha.split('-');

  const filasCompletas = [...pacientes];
  while (filasCompletas.length < 15) {
    filasCompletas.push({
      numero: filasCompletas.length + 1,
      nombre: '', diagnostico: '', edad: '', sexo_f: '', sexo_m: '', primera_vez: '', subsecuente: '', preventiva: '',
      det_absceso: '', det_caries: '', det_gingivitis: '', det_periodontitis: '', det_abrasion: '', det_bruxismo: '',
      det_cepillado: '', det_hilo: '', det_placa: '', det_fluor: '',
      trat_profilaxis: '', trat_curetaje: '', trat_farmaco: '', trat_desensibilizante: '', trat_amalgama: '', trat_resina: '', trat_extraccion: '',
      gab_biometria: '', gab_coagulacion: '', gab_pruebas_rapidas: '', gab_panoramica: '', gab_periapical: ''
    });
  }

  const totF = pacientes.filter(p => p.sexo_f === 'X').length;
  const totM = pacientes.filter(p => p.sexo_m === 'X').length;
  const tot1ra = pacientes.filter(p => p.primera_vez === 'X').length;
  const totSub = pacientes.filter(p => p.subsecuente === 'X').length;
  const totPrev = pacientes.filter(p => p.preventiva === 'X').length;

  const tablaHtml = `
    <table>
      <tr>
        <th colspan="31" class="hdr-main">GOBIERNO DE LA CIUDAD DE COATZACOALCOS 2026 - 2029 &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="31" class="hdr-sub">HOJA DIARIA DE ODONTOLOGÍA &bull; FECHA: ${dia}/${mes}/${anio}</th>
      </tr>
      <tr>
        <td colspan="16" class="hdr-meta text-left"><strong>Odontólogo(a):</strong> ${odontologo}</td>
        <td colspan="15" class="hdr-meta text-right"><strong>TOTAL PACIENTES:</strong> ${total_pacientes}</td>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">No.</th>
        <th rowspan="2" class="th-super">NOMBRE</th>
        <th rowspan="2" class="th-super">DIAGNÓSTICO</th>
        <th rowspan="2" class="th-super">EDAD</th>
        <th colspan="2" class="th-super">SEXO</th>
        <th colspan="3" class="th-super">TIPO ATENCIÓN</th>
        <th colspan="10" class="th-super">DETECCIONES</th>
        <th colspan="7" class="th-super">TRATAMIENTO</th>
        <th colspan="5" class="th-super">ESTUDIOS DE GABINETE</th>
      </tr>
      <tr>
        <th class="th-col">F</th><th class="th-col">M</th>
        <th class="th-col">1RA VEZ</th><th class="th-col">SUBSEC</th><th class="th-col">PREVENTIVA</th>
        <th class="th-col">ABSCESO</th><th class="th-col">CARIES</th><th class="th-col">GINGIVITIS</th><th class="th-col">PERIODONTITIS</th><th class="th-col">ABRASIÓN</th><th class="th-col">BRUXISMO</th><th class="th-col">CEPILLADO</th><th class="th-col">HILO DENTAL</th><th class="th-col">PLACA</th><th class="th-col">FLÚOR</th>
        <th class="th-col">PROFILAXIS</th><th class="th-col">CURETAJE</th><th class="th-col">FÁRMACO</th><th class="th-col">DESENSIBILIZANTE</th><th class="th-col">AMALGAMA</th><th class="th-col">RESINA</th><th class="th-col">EXTRACCIÓN</th>
        <th class="th-col">BIOMETRÍA</th><th class="th-col">COAGULACIÓN</th><th class="th-col">P. RÁPIDAS</th><th class="th-col">R. PANORÁMICA</th><th class="th-col">R. PERIAPICAL</th>
      </tr>
      ${filasCompletas.map(f => `
        <tr>
          <td>${f.numero}</td>
          <td class="text-left">${f.nombre}</td>
          <td class="text-left">${f.diagnostico}</td>
          <td>${f.edad !== '' ? f.edad : ''}</td>
          <td>${f.sexo_f}</td><td>${f.sexo_m}</td>
          <td>${f.primera_vez}</td><td>${f.subsecuente}</td><td>${f.preventiva}</td>
          <td>${f.det_absceso}</td><td>${f.det_caries}</td><td>${f.det_gingivitis}</td><td>${f.det_periodontitis}</td><td>${f.det_abrasion}</td><td>${f.det_bruxismo}</td><td>${f.det_cepillado}</td><td>${f.det_hilo}</td><td>${f.det_placa}</td><td>${f.det_fluor}</td>
          <td>${f.trat_profilaxis}</td><td>${f.trat_curetaje}</td><td>${f.trat_farmaco}</td><td>${f.trat_desensibilizante}</td><td>${f.trat_amalgama}</td><td>${f.trat_resina}</td><td>${f.trat_extraccion}</td>
          <td>${f.gab_biometria}</td><td>${f.gab_coagulacion}</td><td>${f.gab_pruebas_rapidas}</td><td>${f.gab_panoramica}</td><td>${f.gab_periapical}</td>
        </tr>
      `).join('')}
      <tr class="row-total">
        <td colspan="4">TOTAL</td>
        <td>${totF}</td><td>${totM}</td>
        <td>${tot1ra}</td><td>${totSub}</td><td>${totPrev}</td>
        <td colspan="22">-</td>
      </tr>
    </table>
  `;

  return envolverHtmlParaExcel({
    titulo: `Hoja Diaria Odontología ${fecha}`,
    tablasHtml: tablaHtml
  });
}

module.exports = {
  renderizarDiarioHtml,
  renderizarDiarioExcel
};
