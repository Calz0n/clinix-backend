// Certificado de Nutrición Oficial - Nutrición
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029
const { esc, limpio, campo, partesFecha, normalizarSexo, envolverHtml, esAutoPrint } = require('./common');

const CSS = `
  .banner { position: absolute; z-index: 1; left: 2.3in; right: 1.7in; top: 1.0in; height: 0.32in; background: #6b6b6b;
            color: #fff; font-weight: bold; font-size: 12pt; display: flex; align-items: center; justify-content: center; }
  .contenido { top: 1.5in; left: 0.75in; right: 0.75in; font-size: 9.5pt; line-height: 1.45; text-align: justify; }
  .datos { border: 1.5px solid #000; padding: 5px 8px; margin-bottom: 8px; font-size: 9pt; line-height: 1.9; text-align: left; }
  .datos .campo { font-weight: normal; }
  p { margin: 5px 0; }
  h4 { margin: 8px 0 2px; font-size: 9.5pt; }
  ul { margin: 3px 0 3px 22px; padding: 0; }
  li { margin: 1px 0; }
  .recordatorio { white-space: pre-wrap; word-break: break-word; min-height: 20px; margin: 2px 0 4px; }
  .firma { text-align: center; margin-top: 26px; }
  .firma .linea { width: 3in; border-top: 1px solid #000; margin: 0 auto 4px; }
`;

function lineasComoLista(texto) {
  return limpio(texto)
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-–*]+/, '').trim())
    .filter(Boolean)
    .map((l) => `<li>${esc(l)}</li>`)
    .join('');
}

function renderizarCertificadoNutricionHtml(datos = {}) {
  const f = partesFecha(datos.fecha);
  const sexo = normalizarSexo(datos.sexo);
  const sexoTxt = sexo === 'F' ? 'femenino' : (sexo === 'M' ? 'masculino' : 'femenino/masculino');
  const sexoEnc = sexo === 'F' ? 'Femenino' : (sexo === 'M' ? 'Masculino' : '');

  let tipo = limpio(datos.tipo_consulta).toLowerCase() || 'primera vez';
  if (!tipo.startsWith('por ')) tipo = `por ${tipo}`;

  const recordatorio = limpio(datos.recordatorio_24h);
  const tamRecordatorio = recordatorio.length > 700 ? '8pt' : (recordatorio.length > 400 ? '8.8pt' : 'inherit');

  const cuerpo = `
  <div class="banner">CERTIFICADO DE NUTRICIÓN</div>
  <div class="contenido">
    <div class="datos">
      <b>Nombre:</b> ${campo(datos.paciente, 30)} <b>Edad:</b> ${campo(datos.edad, 6)}
      <b>Sexo:</b> ${campo(sexoEnc, 10)} <b>Ocupación:</b> ${campo(datos.ocupacion, 14)}<br>
      <b>Fecha de nacimiento:</b> ${campo(datos.fecha_nacimiento, 11)} <b>Fecha:</b> ${campo(f.corta, 10)}
      <b>No. Expediente:</b> ${campo(datos.expediente, 14)} <b>Servicio:</b> ${campo(datos.servicio || 'Nutrición', 9)}
    </div>

    <p>Paciente ${sexoTxt} de ${campo(datos.edad, 5)} años de edad, acude a consulta ${esc(tipo)} para
    ${campo(datos.motivo_consulta, 20)} con diagnóstico nutricio ${campo(datos.diagnostico_nutricio, 20)}
    relacionado con ${campo(datos.relacionado_con, 18)} evidenciado con ${campo(datos.evidenciado_con, 18)}</p>

    <p>Se realizó un recordatorio de 24 horas, en el cual se registró lo siguiente:</p>
    <div class="recordatorio" style="font-size:${tamRecordatorio}">${esc(recordatorio)}</div>

    <h4>Datos antropométricos</h4>
    <p><b>Peso:</b> ${campo(datos.peso, 6)} kg <b>Estatura:</b> ${campo(datos.estatura, 6)} m
    <b>Peso ideal:</b> ${campo(datos.peso_ideal, 6)} kg <b>Circunferencia de cintura:</b> ${campo(datos.cintura, 6)} cm
    <b>Circunferencia de cadera:</b> ${campo(datos.cadera, 6)} cm <b>IMC:</b> ${campo(datos.imc, 6)} kg/m²</p>

    <h4>Diagnóstico nutricio:</h4>
    <p>${esc(limpio(datos.diagnostico_nutricio))}${limpio(datos.relacionado_con) ? ` relacionado con ${esc(limpio(datos.relacionado_con))}` : ''}${limpio(datos.evidenciado_con) ? ` evidenciado con ${esc(limpio(datos.evidenciado_con))}` : ''}</p>

    <h4>Tratamiento nutricional:</h4>
    <p>Se le proporciona orientación nutricional y plan de alimentación para ${campo(datos.objetivo_plan, 18)},
    de igual forma se mencionaron las siguientes recomendaciones:</p>
    <ul>
      <li>Establecer horarios de comida para mantener un peso adecuado.</li>
      ${lineasComoLista(datos.recomendaciones_extra)}
    </ul>

    <p>Cada 15 días se estará citando para su consulta de seguimiento y así evaluar su estado nutricional.<br>
    El tratamiento tendrá una duración estimada de 6 meses.</p>

    <p><b>TX:</b> Dieta para ${campo(datos.calorias, 8)} calorías.</p>
    <ul>
      <li>Distribución: Hidratos de carbono ${campo(datos.hc_pct, 4)} % Proteína ${campo(datos.proteina_pct, 4)} % Lípidos ${campo(datos.lipidos_pct, 4)} %</li>
      <li>Horario: ${esc(limpio(datos.horario))}</li>
      <li>Consumo de agua natural al día ${esc(limpio(datos.consumo_agua))}</li>
    </ul>

    <div class="firma">
      <div class="linea"></div>
      ATENTAMENTE
      ${limpio(datos.nutriologo) ? `<div><b>${esc(limpio(datos.nutriologo))}</b></div>` : ''}
      <div>CED.PROF. ${esc(limpio(datos.cedula))}</div>
    </div>
  </div>`;

  return envolverHtml({
    titulo: 'Certificado de Nutrición',
    css: CSS,
    cuerpo,
    autoPrint: esAutoPrint(datos),
  });
}

module.exports = { renderizarCertificadoNutricionHtml };
