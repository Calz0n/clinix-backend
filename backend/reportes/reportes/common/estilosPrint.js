// Estilos oficiales de impresión y visualización web para reportes institucionales
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const estilosPrint = `
  @page {
    size: landscape;
    margin: 5mm 6mm;
  }
  @page :left {
    margin: 5mm 6mm;
  }
  @page :right {
    margin: 5mm 6mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8px;
    margin: 0;
    padding: 0;
    color: #111111;
    background: #ffffff;
  }
  .pagina-reporte {
    width: 100%;
    min-height: 100%;
    page-break-after: always;
    position: relative;
    padding-bottom: 8px;
  }
  .pagina-reporte:last-child {
    page-break-after: auto;
  }
  .no-print {
    margin: 10px 0 14px 0;
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .btn-print {
    background: #701128;
    color: #ffffff;
    border: none;
    padding: 7px 16px;
    font-size: 11.5px;
    cursor: pointer;
    border-radius: 4px;
    font-weight: bold;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-print:hover {
    background: #540c1d;
  }
  .btn-excel {
    background: #107c41;
    color: #ffffff;
    text-decoration: none;
    padding: 7px 16px;
    font-size: 11.5px;
    border-radius: 4px;
    font-weight: bold;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-excel:hover {
    background: #0b5e31;
  }
  @media print {
    .no-print {
      display: none !important;
    }
  }

  /* Encabezado oficial */
  .header-institucional {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2.5px solid #701128;
    padding-bottom: 6px;
    margin-bottom: 6px;
    min-height: 82px;
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header-meta-right {
    text-align: right;
  }
  .titulo-reporte-oficial {
    font-size: 14px;
    font-weight: bold;
    color: #701128;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 3px;
  }
  .subtitulo-institucion {
    font-size: 9px;
    font-weight: bold;
    color: #231F20;
    text-transform: uppercase;
  }

  /* Grid de fecha oficial */
  .fecha-box-container {
    display: inline-flex;
    border: 1px solid #000000;
    margin-top: 2px;
  }
  .fecha-cell {
    border-left: 1px solid #000000;
    padding: 1px 8px;
    text-align: center;
    font-size: 7.5px;
    font-weight: bold;
  }
  .fecha-cell:first-child {
    border-left: none;
  }
  .fecha-cell strong {
    display: block;
    font-size: 10px;
    font-weight: 800;
  }

  /* Barra de metadatos */
  .meta-subbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8.5px;
    margin: 4px 0;
    font-weight: bold;
    color: #231F20;
  }

  /* Tablas de reportes oficiales */
  table.tabla-oficial {
    width: 100%;
    border-collapse: collapse;
    margin-top: 3px;
  }
  table.tabla-oficial th,
  table.tabla-oficial td {
    border: 1px solid #000000;
    padding: 2.5px 1px;
    text-align: center;
    vertical-align: middle;
    font-size: 7.5px;
  }
  table.tabla-oficial th {
    background-color: #f2f2f2;
    font-weight: bold;
    color: #000000;
    font-size: 7px;
  }
  table.tabla-oficial .th-super {
    background-color: #e5e5e5;
    font-size: 7.5px;
    font-weight: bold;
  }
  table.tabla-oficial .th-vertical {
    height: 75px;
    white-space: nowrap;
    padding: 0;
  }
  table.tabla-oficial .th-vertical > div {
    transform: rotate(-90deg);
    width: 20px;
    margin: auto;
    font-size: 7px;
    font-weight: bold;
  }
  table.tabla-oficial .row-total {
    background-color: #e0e0e0;
    font-weight: bold;
    font-size: 8px;
  }
  table.tabla-oficial .text-left {
    text-align: left;
    padding-left: 4px;
  }
`;

module.exports = estilosPrint;
