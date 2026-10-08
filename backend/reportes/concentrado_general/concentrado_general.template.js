// Plantilla HTML y Excel del Concentrado General Mensual
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
// Reporte Maestro Ejecutivo de Productividad Municipal

const { obtenerLogoHtml } = require('../common/logo');
const estilosPrint = require('../common/estilosPrint');
const { envolverHtmlParaExcel } = require('../common/excelWrapper');

const NOMBRES_MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

function renderizarMensualHtml(datos) {
  const { periodo, dias, totales, resumen_ejecutivo } = datos;
  const { anio, mes } = periodo;
  const nombreMes = NOMBRES_MESES[parseInt(mes, 10) - 1] || `MES ${mes}`;
  const logoHtml = obtenerLogoHtml({ height: 105 });

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Concentrado General Mensual - ${nombreMes} ${anio}</title>
    <style>
      ${estilosPrint}
      .tabla-gen th {
        font-size: 9.8px;
        padding: 2px 1px;
        line-height: 1.05;
      }
      .tabla-gen td {
        font-size: 10.5px; font-weight: bold;
        height: 17px;
        padding: 1px 1px;
        text-align: center;
      }
      .rot-th-gen {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
        font-size: 9px;
        font-weight: bold;
        padding: 3px 1px;
        max-height: 96px;
        margin: 0 auto;
      }
      .hdr-sec-gen {
        background-color: #f1f5f9;
        font-weight: bold;
        border-bottom: 2px solid #0f172a;
      }
      .hdr-sec-esp {
        background-color: #e2e8f0;
        font-weight: bold;
        border-bottom: 2px solid #0f172a;
      }
      .hdr-sec-salud {
        background-color: #f8fafc;
        font-weight: bold;
        border-bottom: 2px solid #0f172a;
      }
      .th-total-col {
        background-color: #0f172a !important;
        color: #ffffff !important;
        font-weight: bold;
      }
      .cards-ejecutivas {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 8px;
      }
      .card-item {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        padding: 4px 6px;
        font-size: 9px;
      }
      .card-title {
        color: #64748b;
        font-size: 9px;
        font-weight: bold;
        text-transform: uppercase;
      }
      .card-val {
        font-size: 13px;
        font-weight: bold;
        color: #0f172a;
        margin-top: 1px;
      }
      .card-sub {
        font-size: 9px;
        color: #475569;
        margin-top: 1px;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <a href="/api/estadisticas/mensual/excel?anio=${anio}&mes=${mes}&area=GENERAL" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
    </div>

    <div class="pagina-reporte">
      <div class="header-institucional">
        <div class="header-brand">
          ${logoHtml}
        </div>
        <div class="header-meta-right">
          <div class="titulo-reporte-oficial">CONCENTRADO GENERAL MENSUAL</div>
          <div style="font-size: 8.5px; font-weight: bold; color: #475569; margin-top: 1px;">
            DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL &bull; COATZACOALCOS
          </div>
          <div style="display: inline-block; border: 1.5px solid #0f172a; border-radius: 4px; padding: 2px 8px; margin-top: 2px; background-color: #f8fafc;">
            <span style="font-size: 9.8px; font-weight: bold; color: #64748b;">PERIODO:</span>
            <strong style="font-size: 8.5px; color: #0f172a; margin-left: 4px;">${nombreMes} ${anio}</strong>
          </div>
        </div>
      </div>

      <!-- Tarjetas de Resumen Ejecutivo -->
      <div class="cards-ejecutivas">
        <div class="card-item">
          <div class="card-title">Total General Atenciones</div>
          <div class="card-val">${totales.total_dia || 0}</div>
          <div class="card-sub">Pacientes atendidos en el mes</div>
        </div>
        <div class="card-item">
          <div class="card-title">Área con Mayor Demanda</div>
          <div class="card-val" style="font-size: 11px;">${resumen_ejecutivo.top_especialidad.nombre}</div>
          <div class="card-sub">${resumen_ejecutivo.top_especialidad.total} consultas (${resumen_ejecutivo.top_especialidad.pct}% del total)</div>
        </div>
        <div class="card-item">
          <div class="card-title">Distribución por Sexo</div>
          <div class="card-val" style="font-size: 11px;">F: ${resumen_ejecutivo.pct_femenino}% &bull; M: ${resumen_ejecutivo.pct_masculino}%</div>
          <div class="card-sub">${totales.sexo_f} Mujeres &bull; ${totales.sexo_m} Hombres</div>
        </div>
        <div class="card-item">
          <div class="card-title">Cobertura Poblacional</div>
          <div class="card-val" style="font-size: 11px;">Abierta: ${resumen_ejecutivo.pct_abierta}%</div>
          <div class="card-sub">Comunidad: ${totales.pob_abierta} &bull; Cautiva: ${totales.pob_cautiva}</div>
        </div>
      </div>

      <!-- Tabla Matriz Consolidada -->
      <table class="tabla-oficial tabla-gen">
        <thead>
          <tr>
            <th rowspan="3" style="width: 18px;">No.</th>
            <th rowspan="3" style="width: 50px;">FECHA</th>
            <th colspan="4" class="hdr-sec-gen">DATOS DEL PACIENTE</th>
            <th colspan="2" class="hdr-sec-gen">TIPO DE POBLACIÓN</th>
            <th colspan="5" class="hdr-sec-esp">ATENCIONES POR ESPECIALIDAD</th>
            <th colspan="4" class="hdr-sec-salud">SALUD PÚBLICA E INDICADORES</th>
            <th rowspan="3" class="th-total-col" style="width: 36px;">TOTAL DÍA</th>
          </tr>
          <tr>
            <th colspan="2">SEXO</th>
            <th colspan="2">TIPO CONSULTA</th>
            <th colspan="2">POBLACIÓN</th>
            <th colspan="5">ÁREAS DE SERVICIO</th>
            <th colspan="4">ACCIONES DE IMPACTO</th>
          </tr>
          <tr>
            <th class="rot-th-gen">FEMENINO</th>
            <th class="rot-th-gen">MASCULINO</th>
            <th class="rot-th-gen">1RA VEZ</th>
            <th class="rot-th-gen">SUBSECUENTE</th>
            <th class="rot-th-gen">ABIERTA</th>
            <th class="rot-th-gen">CAUTIVA</th>
            <th class="rot-th-gen">MEDICINA GENERAL</th>
            <th class="rot-th-gen">TRIAJE Y ENFERMERÍA</th>
            <th class="rot-th-gen">ODONTOLOGÍA</th>
            <th class="rot-th-gen">NUTRICIÓN</th>
            <th class="rot-th-gen">PSICOLOGÍA</th>
            <th class="rot-th-gen">DETECCIÓN RIESGO</th>
            <th class="rot-th-gen">PROCEDIMIENTOS</th>
            <th class="rot-th-gen">CANALIZACIONES</th>
            <th class="rot-th-gen">CERTIFICADOS</th>
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
              <td>${d.tipo_1ra || ''}</td>
              <td>${d.tipo_sub || ''}</td>
              <td>${d.pob_abierta || ''}</td>
              <td>${d.pob_cautiva || ''}</td>
              <td><strong>${d.medicina_general || ''}</strong></td>
              <td><strong>${d.enfermeria || ''}</strong></td>
              <td><strong>${d.odontologia || ''}</strong></td>
              <td><strong>${d.nutricion || ''}</strong></td>
              <td><strong>${d.psicologia || ''}</strong></td>
              <td>${d.det_riesgo || ''}</td>
              <td>${d.procedimientos || ''}</td>
              <td>${d.canalizaciones || ''}</td>
              <td>${d.certificados || ''}</td>
              <td style="font-weight: bold; background-color: #f1f5f9;">${d.total_dia || ''}</td>
            </tr>
            `;
          }).join('')}
          <tr class="row-total">
            <td colspan="2"><strong>TOTAL</strong></td>
            <td><strong>${totales.sexo_f || 0}</strong></td>
            <td><strong>${totales.sexo_m || 0}</strong></td>
            <td><strong>${totales.tipo_1ra || 0}</strong></td>
            <td><strong>${totales.tipo_sub || 0}</strong></td>
            <td><strong>${totales.pob_abierta || 0}</strong></td>
            <td><strong>${totales.pob_cautiva || 0}</strong></td>
            <td><strong>${totales.medicina_general || 0}</strong></td>
            <td><strong>${totales.enfermeria || 0}</strong></td>
            <td><strong>${totales.odontologia || 0}</strong></td>
            <td><strong>${totales.nutricion || 0}</strong></td>
            <td><strong>${totales.psicologia || 0}</strong></td>
            <td><strong>${totales.det_riesgo || 0}</strong></td>
            <td><strong>${totales.procedimientos || 0}</strong></td>
            <td><strong>${totales.canalizaciones || 0}</strong></td>
            <td><strong>${totales.certificados || 0}</strong></td>
            <td style="background-color: #0f172a; color: #ffffff;"><strong>${totales.total_dia || 0}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

function renderizarMensualExcel(datos) {
  const { periodo, dias, totales, resumen_ejecutivo } = datos;
  const { anio, mes } = periodo;
  const nombreMes = NOMBRES_MESES[parseInt(mes, 10) - 1] || `MES ${mes}`;

  const tablaHtml = `
    <table>
      <tr>
        <th colspan="18" class="hdr-main">H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
      </tr>
      <tr>
        <th colspan="18" class="hdr-sub">CONCENTRADO GENERAL MENSUAL DE SERVICIOS Y ATENCIONES DE SALUD &bull; ${nombreMes} ${anio}</th>
      </tr>
      <tr>
        <td colspan="9" class="hdr-meta text-left"><strong>TOTAL ATENCIONES MENSUALES:</strong> ${totales.total_dia || 0}</td>
        <td colspan="9" class="hdr-meta text-right"><strong>ÁREA LÍDER EN CONSULTAS:</strong> ${resumen_ejecutivo.top_especialidad.nombre} (${resumen_ejecutivo.top_especialidad.pct}%)</td>
      </tr>
      <tr>
        <th rowspan="2" class="th-super">No.</th>
        <th rowspan="2" class="th-super">FECHA</th>
        <th colspan="2" class="th-super">SEXO</th>
        <th colspan="2" class="th-super">TIPO CONSULTA</th>
        <th colspan="2" class="th-super">TIPO POBLACIÓN</th>
        <th colspan="5" class="th-super">ATENCIONES POR ESPECIALIDAD</th>
        <th colspan="4" class="th-super">SALUD PÚBLICA E INDICADORES</th>
        <th rowspan="2" class="th-super">TOTAL DÍA</th>
      </tr>
      <tr>
        <th class="th-col">FEM</th>
        <th class="th-col">MASC</th>
        <th class="th-col">1RA VEZ</th>
        <th class="th-col">SUBSEC</th>
        <th class="th-col">ABIERTA</th>
        <th class="th-col">CAUTIVA</th>
        <th class="th-col">MEDICINA</th>
        <th class="th-col">ENFERMERÍA</th>
        <th class="th-col">ODONTOLOGÍA</th>
        <th class="th-col">NUTRICIÓN</th>
        <th class="th-col">PSICOLOGÍA</th>
        <th class="th-col">DETECCIONES</th>
        <th class="th-col">PROCEDIMIENTOS</th>
        <th class="th-col">CANALIZACIONES</th>
        <th class="th-col">CERTIFICADOS</th>
      </tr>
      ${dias.map(d => {
        const fechaStr = `${String(d.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
        return `
        <tr>
          <td>${d.dia}</td>
          <td>${fechaStr}</td>
          <td>${d.sexo_f || 0}</td>
          <td>${d.sexo_m || 0}</td>
          <td>${d.tipo_1ra || 0}</td>
          <td>${d.tipo_sub || 0}</td>
          <td>${d.pob_abierta || 0}</td>
          <td>${d.pob_cautiva || 0}</td>
          <td>${d.medicina_general || 0}</td>
          <td>${d.enfermeria || 0}</td>
          <td>${d.odontologia || 0}</td>
          <td>${d.nutricion || 0}</td>
          <td>${d.psicologia || 0}</td>
          <td>${d.det_riesgo || 0}</td>
          <td>${d.procedimientos || 0}</td>
          <td>${d.canalizaciones || 0}</td>
          <td>${d.certificados || 0}</td>
          <td>${d.total_dia || 0}</td>
        </tr>
        `;
      }).join('')}
      <tr class="row-total">
        <td colspan="2">TOTAL</td>
        <td>${totales.sexo_f || 0}</td>
        <td>${totales.sexo_m || 0}</td>
        <td>${totales.tipo_1ra || 0}</td>
        <td>${totales.tipo_sub || 0}</td>
        <td>${totales.pob_abierta || 0}</td>
        <td>${totales.pob_cautiva || 0}</td>
        <td>${totales.medicina_general || 0}</td>
        <td>${totales.enfermeria || 0}</td>
        <td>${totales.odontologia || 0}</td>
        <td>${totales.nutricion || 0}</td>
        <td>${totales.psicologia || 0}</td>
        <td>${totales.det_riesgo || 0}</td>
        <td>${totales.procedimientos || 0}</td>
        <td>${totales.canalizaciones || 0}</td>
        <td>${totales.certificados || 0}</td>
        <td>${totales.total_dia || 0}</td>
      </tr>
    </table>
  `;

  return envolverHtmlParaExcel({
    titulo: `Concentrado General Mensual ${nombreMes} ${anio}`,
    tablasHtml: tablaHtml
  });
}

module.exports = {
  renderizarMensualHtml,
  renderizarMensualExcel
};
