// Consultas SQL específicas para el módulo de Nutrición
// Dirección de Salud Pública Municipal de Coatzacoalcos

async function obtenerDatosDiarios(db, fecha) {
  const query = `
    SELECT ac.id as atencion_id, ac.tipo_atencion, ac.fecha_hora_ingreso,
           p.id as paciente_id, p.nombres, p.apellido_paterno, p.apellido_materno,
           p.fecha_nacimiento, p.sexo, p.numero_expediente, p.tipo_poblacion,
           t.tension_arterial, t.glucosa_capilar, t.peso_kg, t.talla_metros, t.imc, t.clasificacion_imc,
           t.detecciones_riesgo,
           cb.motivo_consulta, cb.observaciones,
           cn.circunferencia_cintura, cn.circunferencia_cadera, cn.circunferencia_brazo,
           cn.recordatorio_24h,
           u.nombre as nutriologo_nombre, u.apellidos as nutriologo_apellidos
    FROM atenciones_clinicas ac
    JOIN pacientes p ON p.id = ac.paciente_id
    LEFT JOIN triaje_signos_vitales t ON t.atencion_id = ac.id
    LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id AND (cb.area_medica = 'NUTRICION' OR ac.area_servicio ILIKE '%NUTRI%')
    LEFT JOIN consultas_nutricion cn ON cn.consulta_id = cb.id
    LEFT JOIN usuarios u ON u.id = cb.especialista_id
    WHERE DATE(ac.fecha_hora_ingreso) = $1
      AND (ac.area_servicio ILIKE '%NUTRI%' OR cb.area_medica = 'NUTRICION')
    ORDER BY ac.fecha_hora_ingreso ASC
  `;

  const result = await db.query(query, [fecha]);
  const hoy = new Date(fecha);

  let nombreNutriologo = '';

  const pacientes = result.rows.map((row, index) => {
    const nac = new Date(row.fecha_nacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
      edad--;
    }

    if (!nombreNutriologo && row.nutriologo_nombre) {
      nombreNutriologo = `L.N. ${row.nutriologo_nombre} ${row.nutriologo_apellidos || ''}`.trim();
    }

    const esCautiva = (row.tipo_poblacion || '').toLowerCase().includes('trab') ||
                      (row.tipo_poblacion || '').toLowerCase().includes('munic') ||
                      (row.tipo_poblacion || '').toLowerCase().includes('cautiv');

    const rec24 = row.recordatorio_24h || {};
    const puntuacionZ = rec24.puntuacion_z || (edad < 18 ? row.clasificacion_imc || '-' : '-');
    const laboratoriales = rec24.laboratoriales || (row.detecciones_riesgo ? row.detecciones_riesgo : '-');

    return {
      numero: index + 1,
      nombre: `${row.apellido_paterno} ${row.apellido_materno || ''}, ${row.nombres}`.trim(),
      edad,
      sexo_f: row.sexo === 'F' ? 'X' : '',
      sexo_m: row.sexo === 'M' ? 'X' : '',
      primera_vez: row.tipo_atencion === 'PRIMERA_VEZ' ? 'X' : '',
      subsecuente: row.tipo_atencion === 'SUBSECUENTE' ? 'X' : '',
      trab_mpio: esCautiva ? 'X' : '',
      pob_abierta: !esCautiva ? 'X' : '',
      talla: row.talla_metros || '-',
      peso: row.peso_kg || '-',
      imc: row.imc || '-',
      c_cintura: row.circunferencia_cintura || '-',
      c_cadera: row.circunferencia_cadera || '-',
      ta: row.tension_arterial || '-',
      glucosa: row.glucosa_capilar || '-',
      puntuacion_z: puntuacionZ,
      laboratoriales: laboratoriales,
      diagnostico: row.observaciones || row.motivo_consulta || row.clasificacion_imc || 'Consulta Nutricional'
    };
  });

  return {
    fecha,
    nutriologo: nombreNutriologo || 'L.N. Especialista en Nutrición',
    total_pacientes: pacientes.length,
    pacientes
  };
}

async function obtenerDatosMensuales(db, anio, mes) {
  const totalDias = new Date(anio, mes, 0).getDate();

  const query = `
    SELECT EXTRACT(DAY FROM ac.fecha_hora_ingreso)::INT as dia,
           p.sexo,
           p.fecha_nacimiento,
           p.tipo_poblacion,
           p.enfermedades_previas,
           ac.tipo_atencion,
           t.peso_kg, t.talla_metros, t.imc, t.clasificacion_imc, t.tension_arterial, t.glucosa_capilar,
           cb.motivo_consulta, cb.observaciones,
           cn.recordatorio_24h
    FROM atenciones_clinicas ac
    JOIN pacientes p ON p.id = ac.paciente_id
    LEFT JOIN triaje_signos_vitales t ON t.atencion_id = ac.id
    LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id AND (cb.area_medica = 'NUTRICION' OR ac.area_servicio ILIKE '%NUTRI%')
    LEFT JOIN consultas_nutricion cn ON cn.consulta_id = cb.id
    WHERE EXTRACT(YEAR FROM ac.fecha_hora_ingreso) = $1
      AND EXTRACT(MONTH FROM ac.fecha_hora_ingreso) = $2
      AND (ac.area_servicio ILIKE '%NUTRI%' OR cb.area_medica = 'NUTRICION')
    ORDER BY ac.fecha_hora_ingreso ASC
  `;

  const result = await db.query(query, [anio, mes]);

  // Agrupadores por día
  const diasHoja1 = {};
  const diasHoja2 = {};
  const diasHoja3 = {};

  for (let d = 1; d <= totalDias; d++) {
    diasHoja1[d] = {
      dia: d,
      pob_f: 0, pob_m: 0, pob_1ra: 0, pob_sub: 0, pob_sana: 0, pob_enferma: 0, pob_med: 0, pob_esp: 0,
      cau_f: 0, cau_m: 0, cau_1ra: 0, cau_sub: 0, cau_sana: 0, cau_enferma: 0, cau_med: 0, cau_esp: 0,
      total_dia: 0
    };
    diasHoja2[d] = {
      dia: d,
      estrenimiento: 0, diverticulosis: 0, colitis: 0, gastritis: 0, calculos: 0, celiaca: 0, reflujo: 0, etas: 0,
      hipertension: 0, diabetes: 0, obesidad: 0, sobrepeso: 0, higado_graso: 0, dano_renal: 0, e_renal: 0,
      hipotiroidismo: 0, hiper: 0, i_alimentaria: 0, anemia: 0, osteoporosis: 0, trastornos_alim: 0, desnutricion: 0,
      oncologicas: 0, vih: 0, dislipidemias: 0, ecv: 0,
      total_dia: 0
    };
    diasHoja3[d] = {
      dia: d,
      ped_desnutricion: 0, ped_riesgo_desnut: 0, ped_normopeso: 0, ped_riesgo_obesidad: 0, ped_obesidad: 0,
      lab_bh: 0, lab_qs: 0, lab_lipidos: 0, lab_hba1c: 0,
      total_pediatria: 0, total_labs: 0
    };
  }

  const hoyAnio = anio;
  for (const row of result.rows) {
    const d = row.dia;
    if (!diasHoja1[d]) continue;

    const nac = new Date(row.fecha_nacimiento);
    const edad = hoyAnio - nac.getFullYear();
    const esCautiva = (row.tipo_poblacion || '').toLowerCase().includes('trab') ||
                      (row.tipo_poblacion || '').toLowerCase().includes('munic') ||
                      (row.tipo_poblacion || '').toLowerCase().includes('cautiv');

    const textoClinico = `${row.motivo_consulta || ''} ${row.observaciones || ''} ${row.enfermedades_previas || ''}`.toLowerCase();
    const imcNum = parseFloat(row.imc) || 0;
    const esSano = imcNum >= 18.5 && imcNum < 25.0 && !textoClinico.includes('diabet') && !textoClinico.includes('hiperten');

    // HOJA 1: Población Abierta vs Cautiva
    diasHoja1[d].total_dia++;
    if (!esCautiva) {
      if (row.sexo === 'F') diasHoja1[d].pob_f++;
      if (row.sexo === 'M') diasHoja1[d].pob_m++;
      if (row.tipo_atencion === 'PRIMERA_VEZ') diasHoja1[d].pob_1ra++;
      if (row.tipo_atencion === 'SUBSECUENTE') diasHoja1[d].pob_sub++;
      if (esSano) diasHoja1[d].pob_sana++; else diasHoja1[d].pob_enferma++;
      if (textoClinico.includes('medicina')) diasHoja1[d].pob_med++;
      if (textoClinico.includes('especialista')) diasHoja1[d].pob_esp++;
    } else {
      if (row.sexo === 'F') diasHoja1[d].cau_f++;
      if (row.sexo === 'M') diasHoja1[d].cau_m++;
      if (row.tipo_atencion === 'PRIMERA_VEZ') diasHoja1[d].cau_1ra++;
      if (row.tipo_atencion === 'SUBSECUENTE') diasHoja1[d].cau_sub++;
      if (esSano) diasHoja1[d].cau_sana++; else diasHoja1[d].cau_enferma++;
      if (textoClinico.includes('medicina')) diasHoja1[d].cau_med++;
      if (textoClinico.includes('especialista')) diasHoja1[d].cau_esp++;
    }

    // HOJA 2: Padecimientos
    let padecimientoEncontrado = false;
    if (textoClinico.includes('estreñ')) { diasHoja2[d].estrenimiento++; padecimientoEncontrado = true; }
    if (textoClinico.includes('divertic')) { diasHoja2[d].diverticulosis++; padecimientoEncontrado = true; }
    if (textoClinico.includes('colitis')) { diasHoja2[d].colitis++; padecimientoEncontrado = true; }
    if (textoClinico.includes('gastritis')) { diasHoja2[d].gastritis++; padecimientoEncontrado = true; }
    if (textoClinico.includes('calculo') || textoClinico.includes('litiasis')) { diasHoja2[d].calculos++; padecimientoEncontrado = true; }
    if (textoClinico.includes('celiac') || textoClinico.includes('gluten')) { diasHoja2[d].celiaca++; padecimientoEncontrado = true; }
    if (textoClinico.includes('reflujo') || textoClinico.includes('erge')) { diasHoja2[d].reflujo++; padecimientoEncontrado = true; }
    if (textoClinico.includes('eta') || textoClinico.includes('diarrea')) { diasHoja2[d].etas++; padecimientoEncontrado = true; }

    if (textoClinico.includes('hiperten') || (row.tension_arterial && row.tension_arterial.match(/^(1[4-9]|2)/))) { diasHoja2[d].hipertension++; padecimientoEncontrado = true; }
    if (textoClinico.includes('diabet') || (row.glucosa_capilar && row.glucosa_capilar >= 126)) { diasHoja2[d].diabetes++; padecimientoEncontrado = true; }
    if (imcNum >= 30.0 || (row.clasificacion_imc || '').toLowerCase().includes('obesidad')) { diasHoja2[d].obesidad++; padecimientoEncontrado = true; }
    else if (imcNum >= 25.0 || (row.clasificacion_imc || '').toLowerCase().includes('sobrepeso')) { diasHoja2[d].sobrepeso++; padecimientoEncontrado = true; }
    if (textoClinico.includes('higado') || textoClinico.includes('esteatos')) { diasHoja2[d].higado_graso++; padecimientoEncontrado = true; }
    if (textoClinico.includes('daño renal')) { diasHoja2[d].dano_renal++; padecimientoEncontrado = true; }
    if (textoClinico.includes('renal') || textoClinico.includes('nefro')) { diasHoja2[d].e_renal++; padecimientoEncontrado = true; }

    if (textoClinico.includes('hipotiroid')) { diasHoja2[d].hipotiroidismo++; padecimientoEncontrado = true; }
    if (textoClinico.includes('hiperuric') || textoClinico.includes('acido urico') || textoClinico.includes('gota')) { diasHoja2[d].hiper++; padecimientoEncontrado = true; }
    if (textoClinico.includes('intoleran') || textoClinico.includes('alergia')) { diasHoja2[d].i_alimentaria++; padecimientoEncontrado = true; }
    if (textoClinico.includes('anemia')) { diasHoja2[d].anemia++; padecimientoEncontrado = true; }
    if (textoClinico.includes('osteo')) { diasHoja2[d].osteoporosis++; padecimientoEncontrado = true; }
    if (textoClinico.includes('tca') || textoClinico.includes('bulimia') || textoClinico.includes('anorexia')) { diasHoja2[d].trastornos_alim++; padecimientoEncontrado = true; }
    if (imcNum < 18.5 && imcNum > 0) { diasHoja2[d].desnutricion++; padecimientoEncontrado = true; }
    if (textoClinico.includes('cancer') || textoClinico.includes('oncol') || textoClinico.includes('tumor')) { diasHoja2[d].oncologicas++; padecimientoEncontrado = true; }
    if (textoClinico.includes('vih') || textoClinico.includes('sida')) { diasHoja2[d].vih++; padecimientoEncontrado = true; }
    if (textoClinico.includes('dislipid') || textoClinico.includes('colesterol') || textoClinico.includes('triglic')) { diasHoja2[d].dislipidemias++; padecimientoEncontrado = true; }
    if (textoClinico.includes('cardio') || textoClinico.includes('infarto') || textoClinico.includes('ecv')) { diasHoja2[d].ecv++; padecimientoEncontrado = true; }

    if (padecimientoEncontrado) diasHoja2[d].total_dia++;

    // HOJA 3: Pediatría y Laboratorios
    if (edad < 18) {
      diasHoja3[d].total_pediatria++;
      if (imcNum < 14.0 || textoClinico.includes('desnutri')) diasHoja3[d].ped_desnutricion++;
      else if (textoClinico.includes('riesgo') || (row.clasificacion_imc || '').toLowerCase().includes('bajo')) diasHoja3[d].ped_riesgo_desnut++;
      else if (imcNum >= 25.0) diasHoja3[d].ped_obesidad++;
      else if (imcNum >= 21.0) diasHoja3[d].ped_riesgo_obesidad++;
      else diasHoja3[d].ped_normopeso++;
    }

    if (textoClinico.includes('bh') || textoClinico.includes('biometr')) { diasHoja3[d].lab_bh++; diasHoja3[d].total_labs++; }
    if (textoClinico.includes('qs') || textoClinico.includes('quimica')) { diasHoja3[d].lab_qs++; diasHoja3[d].total_labs++; }
    if (textoClinico.includes('lipid') || textoClinico.includes('perfil')) { diasHoja3[d].lab_lipidos++; diasHoja3[d].total_labs++; }
    if (textoClinico.includes('hba1c') || textoClinico.includes('glucosilada') || textoClinico.includes('glicos')) { diasHoja3[d].lab_hba1c++; diasHoja3[d].total_labs++; }
  }

  // Totales de cada hoja
  const listaHoja1 = Object.values(diasHoja1);
  const listaHoja2 = Object.values(diasHoja2);
  const listaHoja3 = Object.values(diasHoja3);

  const totalizador = (lista, keys) => {
    const t = {};
    keys.forEach(k => { t[k] = lista.reduce((acc, row) => acc + (row[k] || 0), 0); });
    return t;
  };

  const tot1 = totalizador(listaHoja1, ['pob_f', 'pob_m', 'pob_1ra', 'pob_sub', 'pob_sana', 'pob_enferma', 'pob_med', 'pob_esp', 'cau_f', 'cau_m', 'cau_1ra', 'cau_sub', 'cau_sana', 'cau_enferma', 'cau_med', 'cau_esp', 'total_dia']);
  const tot2 = totalizador(listaHoja2, ['estrenimiento', 'diverticulosis', 'colitis', 'gastritis', 'calculos', 'celiaca', 'reflujo', 'etas', 'hipertension', 'diabetes', 'obesidad', 'sobrepeso', 'higado_graso', 'dano_renal', 'e_renal', 'hipotiroidismo', 'hiper', 'i_alimentaria', 'anemia', 'osteoporosis', 'trastornos_alim', 'desnutricion', 'oncologicas', 'vih', 'dislipidemias', 'ecv', 'total_dia']);
  const tot3 = totalizador(listaHoja3, ['ped_desnutricion', 'ped_riesgo_desnut', 'ped_normopeso', 'ped_riesgo_obesidad', 'ped_obesidad', 'lab_bh', 'lab_qs', 'lab_lipidos', 'lab_hba1c', 'total_pediatria', 'total_labs']);

  return {
    periodo: { anio, mes, total_dias: totalDias },
    hoja1: { dias: listaHoja1, totales: tot1 },
    hoja2: { dias: listaHoja2, totales: tot2 },
    hoja3: { dias: listaHoja3, totales: tot3 },
    total_general_mes: tot1.total_dia
  };
}

module.exports = {
  obtenerDatosDiarios,
  obtenerDatosMensuales
};
