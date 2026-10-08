// Envoltorio HTML compatible con Microsoft Excel (.xls)
// Asegura visualización de cuadrículas, estilos de celdas y codificación UTF-8 con BOM

function envolverHtmlParaExcel({ titulo = 'Reporte Oficial', tablasHtml = '', estilosAdicionales = '' }) {
  return `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8">
    <!--[if gte mso 9]>
    <xml>
      <x:ExcelWorkbook>
        <x:ExcelWorksheets>
          <x:ExcelWorksheet>
            <x:Name>${titulo.substring(0, 31)}</x:Name>
            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
          </x:ExcelWorksheet>
        </x:ExcelWorksheets>
      </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 8.5pt; margin-bottom: 25px; }
      th, td { border: 1px solid #000000; padding: 4px 3px; text-align: center; vertical-align: middle; }
      .hdr-main { background-color: #701128; color: #ffffff; font-size: 12pt; font-weight: bold; text-align: center; }
      .hdr-sub { background-color: #f7f7f7; color: #701128; font-size: 10pt; font-weight: bold; text-align: center; }
      .hdr-meta { background-color: #eaeaea; font-size: 8.5pt; font-weight: bold; }
      .th-super { background-color: #d9d9d9; font-weight: bold; font-size: 8pt; color: #000000; }
      .th-col { background-color: #f0f0f0; font-weight: bold; font-size: 7.5pt; color: #000000; }
      .row-total { background-color: #e6e6e6; font-weight: bold; }
      .text-left { text-align: left; }
      .text-right { text-align: right; }
      ${estilosAdicionales}
    </style>
  </head>
  <body>
    ${tablasHtml}
  </body>
  </html>
  `;
}

module.exports = {
  envolverHtmlParaExcel
};
