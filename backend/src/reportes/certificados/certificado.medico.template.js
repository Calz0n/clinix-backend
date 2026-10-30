// Certificado Médico Oficial (Formato CM0__--2026) - Medicina General
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
const { esc, limpio, campo, campoLargo, partesFecha, normalizarSexo, envolverHtml, esAutoPrint } = require('./common');

const CSS = `
  .folio { position: absolute; z-index: 1; right: 0.95in; top: 1.55in; font-size: 10pt; font-weight: bold; }
  .contenido { top: 1.85in; font-size: 11pt; line-height: 1.4; text-align: justify; }
  .fl { display: flex; align-items: baseline; margin: 4px 0; text-align: left; }
  .fl b { white-space: nowrap; margin-right: 6px; }
  .fl .campo { flex: 1; }
  .fl .val { flex: 1; }
  .dest { font-weight: bold; line-height: 1.3; margin-bottom: 8px; }
  .titulo { text-align: center; font-weight: bold; font-size: 12pt; margin: 4px 0 8px; }
  .certifica { text-align: center; font-weight: bold; letter-spacing: 6px; margin: 8px 0 8px; }
  .fila { margin: 4px 0; text-align: left; }
  .fila b { font-weight: bold; }
  .centro { text-align: center; }
  .firma { text-align: center; margin-top: 10px; }
  .firma .linea { width: 3.2in; border-top: 1px solid #000; margin: 30px auto 3px; }
  .nota { position: absolute; z-index: 1; left: 0.95in; width: 5.6in; top: 9.2in; font-size: 7.5pt; line-height: 1.25; font-weight: bold; text-align: left; }
`;

function renderizarCertificadoMedicoHtml(datos = {}) {
  const f = partesFecha(datos.fecha);
  const sexo = normalizarSexo(datos.sexo);
  const edad = limpio(datos.edad);
  const preposicion = sexo === 'F' ? 'a la' : (sexo === 'M' ? 'al' : 'a (el) la');
  const articulo = sexo === 'F' ? 'la cual' : (sexo === 'M' ? 'el cual' : 'la (el) cual');
  const sexoTxt = sexo === 'F' ? 'FEMENINO' : (sexo === 'M' ? 'MASCULINO' : '');
  const cedula = limpio(datos.cedula);
  const cedulaOficial = cedula && !/dgpsep/i.test(cedula) ? `${cedula} DGPSEP` : cedula;
  const medico = limpio(datos.medico).toUpperCase();
  const folio = (limpio(datos.folio) || 'CM0__-2026').replace(/-{2,}/g, '-');
  const mes = f.mes.toUpperCase();

  const cuerpo = `
  <div class="folio">${esc(folio)}</div>
  <div class="contenido">
    <div class="dest">A QUIEN CORRESPONDA<br>PRESENTE</div>
    <div class="titulo">CERTIFICADO MÉDICO</div>

    <p>El suscrito ${campo(medico, 30, true)} Médico Cirujano con <b>cédula profesional</b>
    ${campo(cedula, 12, true)}, legalmente autorizado para el ejercicio de su profesión, en función como
    médico de esta dirección médica.</p>

    <div class="certifica">C E R T I F I C A</div>

    <p>Haber practicado examen médico ${preposicion} ${campo(datos.paciente, 34, true)} ${articulo} es paciente
    <b>${esc(sexoTxt) || campo('', 10)}</b> ${campo(edad, 7, true)} <b>Años</b> de edad, con los siguientes resultados:</p>

    <div class="fl"><b>AHF:</b> ${campo(datos.ahf, 20)}</div>
    <div class="fl"><b>APP:</b> ${campo(datos.app, 20)}</div>
    <div class="fl" style="width:60%"><b>Grupo sanguíneo:</b> ${campo(datos.grupo_sanguineo, 10, true)}</div>
    <div class="fila"><b>T/A:</b> ${campo(datos.ta, 12)} <b>FC:</b> ${campo(datos.fc, 7)}
      <b>FR:</b> ${campo(datos.fr, 7)} <b>SPO<sub>2</sub>:</b> ${campo(datos.spo2, 8)}
      <b>Temperatura:</b> ${campo(datos.temp, 9)}</div>
    <div class="fila"><b>Peso:</b> ${campo(datos.peso, 10)} <b>Talla:</b> ${campo(datos.talla, 12)}
      <b>IMC:</b> ${campo(datos.imc, 16)}</div>
    <div class="fila" style="margin-top:6px"><b>EF:</b></div>
    ${campoLargo(datos.ef, 3)}
    <div class="fl" style="margin-top:8px; width:75%"><b>Diagnóstico:</b> ${campo(datos.diagnostico, 20, true)}</div>

    <p style="margin:10px 0 4px">Se extiende la presente a petición del interesado y para fines que le convengan,
    el día ${campo(String(f.dia).padStart(2, '0'), 4, true)} del mes de ${campo(mes, 10, true)} de ${campo(f.anio, 8, true)},
    en la ciudad de Coatzacoalcos Veracruz.</p>

    <div class="firma">
      ATENTAMENTE
      <div class="linea"></div>
      ${medico ? `<div><b>${esc(medico)}</b></div>` : ''}
      <div><b>MEDICO GENERAL</b></div>
      <div><b>CED. PROF. ${esc(cedulaOficial)}</b></div>
    </div>
  </div>
  <div class="nota">NOTA: Este documento no es válido si presenta tachaduras, enmendaduras o datos que no se
  encuentren consignados en el mismo. Vigencia: quince días</div>`;

  return envolverHtml({
    titulo: `Certificado Médico ${limpio(datos.folio)}`.trim(),
    css: CSS,
    cuerpo,
    autoPrint: esAutoPrint(datos),
  });
}

module.exports = { renderizarCertificadoMedicoHtml };
