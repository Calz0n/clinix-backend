// Estilos oficiales de impresión y visualización web para reportes institucionales
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const estilosPrint = `
  @page {
    size: landscape;
    margin: 2mm 3mm !important;
  }
  @page :left {
    margin: 2mm 3mm !important;
  }
  @page :right {
    margin: 2mm 3mm !important;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    margin: 0;
    padding: 0;
    color: #000000;
    background: #ffffff;
  }
  .pagina-reporte {
    width: 100%;
    page-break-after: always;
    page-break-inside: avoid;
    break-inside: avoid;
    position: relative;
    padding-bottom: 2px;
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
    color: #ffffff !important;
    border: none;
    padding: 8px 18px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
    font-weight: bold;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  .btn-print:hover {
    background: #540c1d;
  }
  .btn-excel {
    background: #107c41;
    color: #ffffff !important;
    text-decoration: none !important;
    padding: 8px 18px;
    font-size: 12px;
    border-radius: 4px;
    font-weight: bold;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  .btn-excel:hover {
    background: #0b5e31;
    color: #ffffff !important;
    text-decoration: none !important;
  }
  .header-institucional {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2.2px solid #701128;
    padding-bottom: 3px;
    margin-bottom: 3px;
    margin-top: 4px;
    min-height: 48px;
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header-brand img {
    height: 46px;
    max-width: 290px;
    object-fit: contain;
    display: block;
  }
  .logo-texto-dept {
    font-size: 9.5px;
    font-weight: bold;
    color: #701128;
    line-height: 1.22;
    text-transform: uppercase;
    border-left: 2.5px solid #b38e5d;
    padding-left: 8px;
    text-align: left;
  }
  .header-meta-right {
    text-align: right;
  }
  .titulo-reporte-oficial {
    font-size: 15px;
    font-weight: 800;
    color: #701128;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 1px;
  }
  .subtitulo-institucion {
    font-size: 9.5px;
    font-weight: bold;
    color: #1e293b;
    text-transform: uppercase;
  }
  .fecha-box-container {
    display: inline-flex;
    border: 1px solid #000000;
    margin-top: 1px;
  }
  .fecha-cell {
    border-left: 1px solid #000000;
    padding: 1px 7px;
    text-align: center;
    font-size: 8.5px;
    font-weight: bold;
  }
  .fecha-cell:first-child {
    border-left: none;
  }
  .fecha-cell strong {
    display: block;
    font-size: 11px;
  }
  .meta-subbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    font-weight: bold;
    color: #000000;
    margin-bottom: 3px;
    padding: 1px 0;
  }
  .tabla-oficial {
    width: 100%;
    border-collapse: collapse;
    margin-top: 2px;
    border: 1.5px solid #000000;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .tabla-oficial th, .tabla-oficial td {
    border: 1px solid #000000;
  }
  .tabla-oficial th {
    background-color: #f1f5f9;
    font-weight: bold;
    text-align: center;
    vertical-align: middle;
    color: #000000;
    font-size: 9.5px;
  }
  .tabla-oficial td {
    text-align: center;
    vertical-align: middle;
    color: #000000;
    font-size: 10.5px;
    font-weight: bold;
  }
  .total-row, .row-total {
    background-color: #e2e8f0 !important;
    font-weight: 900 !important;
    font-size: 11px !important;
    color: #000000 !important;
    border-top: 2px solid #000000 !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  @media print {
    @page {
      size: landscape;
      margin: 2mm 3mm !important;
    }
    .no-print {
      display: none !important;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      color: #000000 !important;
      font-size: 10.5px !important;
    }
    .pagina-reporte {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      padding: 0 !important;
      margin: 0 !important;
      height: auto !important;
      max-height: 100% !important;
    }
    .header-institucional {
      min-height: 46px !important;
      height: 46px !important;
      margin-top: 1px !important;
      padding-bottom: 2px !important;
      margin-bottom: 2px !important;
      border-bottom: 2px solid #701128 !important;
    }
    .header-brand img {
      height: 42px !important;
      max-width: 270px !important;
    }
    .logo-texto-dept {
      font-size: 9.5px !important;
      line-height: 1.2 !important;
      padding-left: 7px !important;
      color: #701128 !important;
    }
    .titulo-reporte-oficial {
      font-size: 15px !important;
      margin-bottom: 1px !important;
      color: #701128 !important;
      font-weight: 800 !important;
    }
    .subtitulo-institucion {
      font-size: 9.5px !important;
    }
    .meta-subbar {
      font-size: 11px !important;
      margin-bottom: 2px !important;
      color: #000000 !important;
      font-weight: bold !important;
    }
    .tabla-oficial {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .tabla-oficial th {
      font-size: 9.5px !important;
      padding: 1.5px 0.5px !important;
      line-height: 1.1 !important;
      color: #000000 !important;
      font-weight: bold !important;
    }
    .tabla-oficial td {
      font-size: 10.5px !important;
      height: 17px !important;
      padding: 0 0.5px !important;
      line-height: 1.1 !important;
      color: #000000 !important;
      font-weight: bold !important;
    }
    .tabla-oficial tr {
      height: 17px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .total-row, .row-total {
      height: 19px !important;
      font-size: 11px !important;
      font-weight: 900 !important;
      color: #000000 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .th-rot-col, .th-rot-diario {
      height: 100px !important;
      padding: 1px 0.5px !important;
    }
    .rot-th-mg, .rot-col-med, .rot-th-gen, .rot-col-enf, .rot-th-enf, .rot-col, .rot-col-hd, .rot-col-mensual, .rot-th {
      max-height: 96px !important;
      font-size: 9px !important;
      line-height: 1.05 !important;
      font-weight: bold !important;
    }
  }
`;
module.exports = estilosPrint;