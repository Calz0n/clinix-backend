const estilosPrint = `
  @page {
    size: letter landscape;
    margin: 5mm 10mm !important;
  }
  @page :left {
    margin: 5mm 10mm !important;
  }
  @page :right {
    margin: 5mm 10mm !important;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    margin: 0 auto;
    padding: 8px 14px;
    box-sizing: border-box;
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
    box-sizing: border-box;
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
    margin-bottom: 4px;
    margin-top: 2px;
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .header-brand img {
    height: 48px;
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
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .titulo-reporte-oficial {
    font-size: 14px;
    font-weight: 800;
    color: #701128;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 1px;
    line-height: 1.15;
  }
  .subtitulo-institucion {
    font-size: 9.5px;
    font-weight: bold;
    color: #1e293b;
    text-transform: uppercase;
    margin-bottom: 2px;
    line-height: 1.15;
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
    font-size: 8px;
    font-weight: bold;
    line-height: 1.1;
  }
  .fecha-cell:first-child {
    border-left: none;
  }
  .fecha-cell strong {
    display: block;
    font-size: 10px;
  }
  .meta-subbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    font-weight: bold;
    color: #000000;
    margin-bottom: 4px;
    padding: 2px 0;
    clear: both;
  }
  
  th.th-rot-header, th.th-rot-col, th.th-rot-diario, .th-rot-enf, th:has([class*="rot-"]) {
    height: 80px !important;
    max-height: 80px !important;
    vertical-align: bottom !important;
    padding: 1px 0.5px 3px 0.5px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  .rot-th-mg, .rot-col-med, .rot-th-gen, .rot-col-enf, .rot-th-enf, .rot-col, .rot-col-hd, .rot-col-mensual, .rot-th {
    writing-mode: vertical-rl !important;
    transform: rotate(180deg) !important;
    white-space: nowrap !important;
    font-size: 7.2px !important;
    line-height: 1.0 !important;
    letter-spacing: -0.2px !important;
    max-height: 72px !important;
    margin: 0 auto !important;
    display: block !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    box-sizing: border-box !important;
  }

  .tabla-oficial {
    width: 100%;
    border-collapse: collapse;
    margin-top: 2px;
    border: 1.5px solid #000000;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    box-sizing: border-box;
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
    font-size: 9px;
  }
  .tabla-oficial td {
    text-align: center;
    vertical-align: middle;
    color: #000000;
    font-size: 9.5px;
    font-weight: bold;
  }
  .total-row, .row-total {
    background-color: #e2e8f0 !important;
    font-weight: 900 !important;
    font-size: 10px !important;
    color: #000000 !important;
    border-top: 2px solid #000000 !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  @media print {
    @page {
      size: letter landscape;
      margin: 5mm 10mm !important;
    }
    .no-print {
      display: none !important;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      color: #000000 !important;
      font-size: 9.5px !important;
      background: transparent !important;
      box-sizing: border-box !important;
    }
    .pagina-reporte {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
      box-sizing: border-box !important;
      height: auto !important;
    }
    .header-institucional {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      margin-top: 0 !important;
      padding-bottom: 2px !important;
      margin-bottom: 3px !important;
      border-bottom: 2px solid #701128 !important;
      height: auto !important;
      min-height: 0 !important;
    }
    .header-brand {
      display: flex !important;
      align-items: center !important;
      flex-shrink: 0 !important;
    }
    .header-brand img {
      height: 44px !important;
      max-width: 270px !important;
      display: block !important;
    }
    .logo-texto-dept {
      font-size: 9px !important;
      line-height: 1.2 !important;
      padding-left: 7px !important;
      color: #701128 !important;
    }
    .header-meta-right {
      text-align: right !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-end !important;
    }
    .titulo-reporte-oficial {
      font-size: 13px !important;
      margin-bottom: 1px !important;
      color: #701128 !important;
      font-weight: 800 !important;
      line-height: 1.15 !important;
    }
    .subtitulo-institucion {
      font-size: 9px !important;
      margin-bottom: 2px !important;
      line-height: 1.15 !important;
    }
    .fecha-box-container {
      display: inline-flex !important;
      border: 1px solid #000000 !important;
      margin-top: 1px !important;
    }
    .fecha-cell {
      font-size: 7.5px !important;
      padding: 1px 6px !important;
      line-height: 1.1 !important;
    }
    .fecha-cell strong {
      font-size: 9.5px !important;
    }
    .meta-subbar {
      font-size: 9.5px !important;
      margin-top: 2px !important;
      margin-bottom: 3px !important;
      color: #000000 !important;
      font-weight: bold !important;
      display: flex !important;
      justify-content: space-between !important;
      clear: both !important;
    }
    
    th.th-rot-header, th.th-rot-col, th.th-rot-diario, .th-rot-enf, th:has([class*="rot-"]) {
      height: 80px !important;
      max-height: 80px !important;
      vertical-align: bottom !important;
      padding: 1px 0.5px 3px 0.5px !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
    .rot-th-mg, .rot-col-med, .rot-th-gen, .rot-col-enf, .rot-th-enf, .rot-col, .rot-col-hd, .rot-col-mensual, .rot-th {
      writing-mode: vertical-rl !important;
      transform: rotate(180deg) !important;
      white-space: nowrap !important;
      font-size: 7.2px !important;
      line-height: 1.0 !important;
      letter-spacing: -0.2px !important;
      max-height: 72px !important;
      margin: 0 auto !important;
      display: block !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      box-sizing: border-box !important;
    }

    .tabla-oficial {
      width: 100% !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      box-sizing: border-box !important;
    }
    .tabla-oficial th {
      font-size: 8.5px !important;
      padding: 1px 0.5px !important;
      line-height: 1.05 !important;
      color: #000000 !important;
      font-weight: bold !important;
    }
    .tabla-oficial td {
      font-size: 9px !important;
      height: 14.5px !important;
      padding: 0 0.5px !important;
      line-height: 1.05 !important;
      color: #000000 !important;
      font-weight: bold !important;
    }
    .tabla-oficial tr {
      height: 14.5px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .total-row, .row-total {
      height: 16px !important;
      font-size: 9.5px !important;
      font-weight: 900 !important;
      color: #000000 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .th-rot-col, .th-rot-diario {
      height: 75px !important;
      padding: 1px 0.5px !important;
    }
  }
`;
module.exports = estilosPrint;
