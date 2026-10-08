// Estilos oficiales de impresión y visualización web para reportes institucionales
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

const estilosPrint = `
  @page {
    size: landscape;
    margin: 4mm 5mm;
  }
  @page :left {
    margin: 4mm 5mm;
  }
  @page :right {
    margin: 4mm 5mm;
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

  /* Encabezado oficial en pantalla (Más abajo, con separación superior elegante) */
  .header-institucional {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2.5px solid #701128;
    padding-bottom: 6px;
    margin-bottom: 6px;
    margin-top: 12px;
    min-height: 65px;
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .header-brand img {
    height: 52px;
    max-width: 320px;
    object-fit: contain;
    display: block;
  }
  .header-meta-right {
    text-align: right;
  }
  .titulo-reporte-oficial {
    font-size: 13px;
    font-weight: bold;
    color: #701128;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 2px;
  }
  .subtitulo-institucion {
    font-size: 8px;
    font-weight: bold;
    color: #231F20;
    text-transform: uppercase;
  }

  /* Grid de fecha oficial */
  .fecha-box-container {
    display: inline-flex;
    border: 1px solid #000000;
    margin-top: 1px;
  }
  .fecha-cell {
    border-left: 1px solid #000000;
    padding: 1px 6px;
    text-align: center;
    font-size: 7px;
    font-weight: bold;
  }
  .fecha-cell:first-child {
    border-left: none;
  }
  .fecha-cell strong {
    display: block;
    font-size: 9px;
  }

  /* Subbarra de metadatos */
  .meta-subbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 8px;
    color: #111111;
    margin-bottom: 3px;
    padding: 1px 0;
  }

  /* Tablas oficiales institucionales */
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
  }
  .tabla-oficial td {
    text-align: center;
    vertical-align: middle;
  }
  .total-row, .row-total {
    background-color: #e2e8f0 !important;
    font-weight: bold;
    border-top: 2px solid #000000 !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* Reglas específicas de impresión para encajar 31 días + TOTAL en EXACTAMENTE 1 sola hoja */
  @media print {
    @page {
      size: landscape;
      margin: 4mm 5mm !important;
    }
    .no-print {
      display: none !important;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
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
      min-height: 44px !important;
      height: 44px !important;
      margin-top: 6px !important;
      padding-bottom: 2px !important;
      margin-bottom: 2px !important;
    }
    .header-brand img {
      height: 36px !important;
      max-width: 240px !important;
    }
    .logo-texto-dept {
      font-size: 7px !important;
      line-height: 1.15 !important;
      padding-left: 6px !important;
    }
    .titulo-reporte-oficial {
      font-size: 10.5px !important;
      margin-bottom: 1px !important;
    }
    .meta-subbar {
      font-size: 7.5px !important;
      margin-bottom: 2px !important;
    }
    .th-rot-col, .th-rot-diario {
      height: 52px !important;
      padding: 1px 0.5px !important;
    }
    .rot-th-mg, .rot-col-med {
      max-height: 48px !important;
      font-size: 4.8px !important;
      line-height: 0.95 !important;
    }
    .tabla-oficial {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .tabla-oficial th {
      font-size: 5.5px !important;
      padding: 1px 0.5px !important;
      line-height: 1.0 !important;
    }
    .tabla-oficial td {
      font-size: 6.2px !important;
      height: 11px !important;
      padding: 0 0.5px !important;
      line-height: 1.0 !important;
    }
    .tabla-oficial tr {
      height: 11px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .total-row, .row-total {
      height: 12px !important;
      font-size: 6.5px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }
`;

module.exports = estilosPrint;
