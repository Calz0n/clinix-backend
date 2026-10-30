// Utilidades compartidas por los certificados oficiales (Medicina General y Nutrición)
const { MEMBRETE_BASE64 } = require('./assets');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function esc(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Valor limpio: los placeholders vacíos del frontend ('—', '-', 'null') se tratan como vacío
function limpio(v) {
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (['—', '-', '–', 'null', 'undefined'].includes(s)) return '';
  return s;
}

// Campo en línea. Con dato: texto suelto, sin subrayado (como sale impreso en el formato real).
// Sin dato: línea en blanco para llenar a mano.
function campo(valor, ancho = 12, negrita = false) {
  const v = limpio(valor);
  if (v) return `<span class="val${negrita ? ' neg' : ''}">${esc(v)}</span>`;
  return `<span class="campo" style="min-width:${ancho}ch">&nbsp;</span>`;
}

// Campo de varias líneas: con dato, párrafo normal; sin dato, líneas en blanco
function campoLargo(valor, lineas = 2) {
  const v = limpio(valor);
  if (v) return `<div class="largo-val">${esc(v)}</div>`;
  return `<div class="largo" style="min-height:${lineas * 22}px"></div>`;
}

// Fecha actual en zona horaria de Ciudad de México (o la recibida en AAAA-MM-DD)
function partesFecha(fecha) {
  let y, m, d;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(limpio(fecha));
  if (match) {
    y = parseInt(match[1], 10); m = parseInt(match[2], 10); d = parseInt(match[3], 10);
  } else {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const p = fmt.split('-');
    y = parseInt(p[0], 10); m = parseInt(p[1], 10); d = parseInt(p[2], 10);
  }
  return { dia: String(d), mes: MESES[m - 1] || '', anio: String(y),
    corta: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` };
}

function normalizarSexo(sexo) {
  const s = limpio(sexo).toUpperCase();
  if (s.startsWith('F') || s.startsWith('MUJER')) return 'F';
  if (s.startsWith('M') || s.startsWith('H')) return 'M';
  return '';
}

const CSS_BASE = `
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #e5e7eb; }
  body { font-family: Arial, 'Liberation Sans', Helvetica, sans-serif; color: #000; }
  .hoja { position: relative; width: 8.5in; height: 11in; margin: 0 auto; background: #fff;
          overflow: hidden; page-break-after: avoid; page-break-inside: avoid; }
  .membrete { position: absolute; left: 0; top: 0; width: 8.5in; height: 11in; z-index: 0; }
  .contenido { position: absolute; z-index: 1; left: 0.95in; right: 0.95in; top: 1.75in; font-size: 11pt; line-height: 1.55; }
  .val { white-space: pre-wrap; }
  .neg { font-weight: bold; }
  .largo-val { white-space: pre-wrap; word-break: break-word; text-align: left; }
  .campo { display: inline-block; border-bottom: 1px solid #000; text-align: center; padding: 0 4px;
           line-height: 1.2; vertical-align: baseline; font-weight: normal; }
  .largo { border-bottom: 1px solid #000; line-height: 22px; white-space: pre-wrap; word-break: break-word;
           background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 21px, #000 21px, #000 22px);
           border-bottom: none; }
  @media screen { body { padding: 16px 0; } .hoja { box-shadow: 0 2px 12px rgba(0,0,0,.25); } }
  @media print { html, body { background: #fff; } body { padding: 0; } .hoja { margin: 0; box-shadow: none; } }
`;

function envolverHtml({ titulo, css, cuerpo, autoPrint }) {
  const script = autoPrint
    ? `<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>`
    : '';
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<style>${CSS_BASE}${css || ''}</style></head>
<body>
<div class="hoja">
  <img class="membrete" alt="Gobierno de Coatzacoalcos 2026-2029 - Dirección de Salud Pública Municipal" src="data:image/jpeg;base64,${MEMBRETE_BASE64}">
  ${cuerpo}
</div>
${script}
</body></html>`;
}

function esAutoPrint(datos) {
  return ['1', 'true', 'si'].includes(String((datos && datos.auto_print) || '').toLowerCase());
}

module.exports = { esc, limpio, campo, campoLargo, partesFecha, normalizarSexo, envolverHtml, esAutoPrint };
