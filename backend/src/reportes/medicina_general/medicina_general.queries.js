// Consultas SQL específicas para el módulo de Medicina General
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

async function obtenerDatosDiarios(db, fecha) {
  const query = `
    SELECT ac.id as atencion_id, ac.tipo_atencion, ac.fecha_hora_ingreso, ac.area_servicio,
           p.id as paciente_id, p.nombres, p.apellido_paterno, p.apellido_materno,
           p.fecha_nacimiento, p.sexo, p.numero_expediente, p.tipo_poblacion,
           t.tension_arterial, t.glucosa_capilar, t.peso_kg, t.talla_metros, t.imc, t.clasificacion_imc,
           t.detecciones_riesgo,
           cb.motivo_consulta, cb.observaciones,
           cm.diagnostico_cie10, cm.diagnostico_descripcion, cm.clasificacion_morbilidad,
           cm.pruebas_rapidas, cm.canalizacion_externa, cm.emite_certificado,
           u.nombre as medico_nombre, u.apellidos as medico_apellidos
    FROM atenciones_clinicas ac
    JOIN pacientes p ON p.id = ac.paciente_id
    LEFT JOIN triaje_signos_vitales t ON t.atencion_id = ac.id
    LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id
    LEFT JOIN consultas_medicina_general cm ON cm.consulta_id = cb.id
    LEFT JOIN usuarios u ON u.id = cb.especialista_id
    WHERE ac.fecha_hora_ingreso >= $1::date AND ac.fecha_hora_ingreso < ($1::date + INTERVAL '1 day')
      AND (ac.area_servicio ILIKE '%MEDICINA%' OR cb.area_medica = 'MEDICINA_GENERAL' OR ac.area_servicio IS NULL)
    ORDER BY ac.fecha_hora_ingreso ASC
  `;

  const result = await db.query(query, [fecha]);
  const hoy = new Date(fecha);

  let nombreMedico = '';

  const pacientes = result.rows.map((row, index) => {
    const nac = new Date(row.fecha_nacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
      edad--;
    }

    if (!nombreMedico && row.medico_nombre) {
      nombreMedico = `Dr. ${row.medico_nombre} ${row.medico_apellidos || ''}`.trim();
    }

    const esUsuaria = (row.tipo_poblacion || '').toLowerCase().includes('trab') ||
                      (row.tipo_poblacion || '').toLowerCase().includes('cautiv') ||
                      (row.tipo_poblacion || '').toLowerCase().includes('munic') ||
                      row.emite_certificado;

    const morbilidad = (row.clasificacion_morbilidad || '').toUpperCase();
    const diagDesc = `${row.diagnostico_descripcion || ''} ${row.motivo_consulta || ''} ${row.observaciones || ''}`.toUpperCase();
    const pruebas = (row.pruebas_rapidas || '').toUpperCase();
    const canaliza = (row.canalizacion_externa || '').toUpperCase();

    // Clasificación de enfermedades (columnas de la hoja física)
    const ets = morbilidad.includes('ETS') || morbilidad.includes('SEXUAL') || diagDesc.includes('SIFILIS') || diagDesc.includes('VIH') || diagDesc.includes('GONORR') || diagDesc.includes('VPH') || diagDesc.includes('TRICOMON');
    const gine = morbilidad.includes('GINE') || diagDesc.includes('VAGINIT') || diagDesc.includes('CERVIC') || diagDesc.includes('ANEXIT') || diagDesc.includes('OVAR');
    const obst = morbilidad.includes('OBSTET') || diagDesc.includes('EMBARAZ') || diagDesc.includes('PARTO') || diagDesc.includes('PUERP');
    const snc = morbilidad.includes('SNC') || morbilidad.includes('NERV') || diagDesc.includes('CEFALEA') || diagDesc.includes('MIGRA') || diagDesc.includes('EPILEP');
    const resp = morbilidad.includes('RESPIRAT') || diagDesc.includes('FARING') || diagDesc.includes('GRIPA') || diagDesc.includes('BRONQ') || diagDesc.includes('NEUMON') || diagDesc.includes('COVID') || diagDesc.includes('ASMA') || diagDesc.includes('RINOFARINGITIS');
    const dige = morbilidad.includes('DIGEST') || diagDesc.includes('GASTR') || diagDesc.includes('COLIT') || diagDesc.includes('DIARR') || diagDesc.includes('PARASIT') || diagDesc.includes('AMIB');
    const ofta = morbilidad.includes('OFTALM') || diagDesc.includes('CONJUNTIV') || diagDesc.includes('OJO');
    const derm = morbilidad.includes('DERMAT') || diagDesc.includes('PIEL') || diagDesc.includes('MICOSIS') || diagDesc.includes('ESCABIOSIS') || diagDesc.includes('ALERGIA');
    const card = morbilidad.includes('CARDIO') || diagDesc.includes('HIPERTENS') || diagDesc.includes('HTA') || diagDesc.includes('ARRITM');
    const urin = morbilidad.includes('URINAR') || morbilidad.includes('RENAL') || diagDesc.includes('CISTITIS') || diagDesc.includes('ITU') || diagDesc.includes('VIAS URINARIAS');
    const musc = morbilidad.includes('MUSCUL') || morbilidad.includes('ESQUELET') || diagDesc.includes('LUMBAL') || diagDesc.includes('ARTRIT') || diagDesc.includes('TENDIN');
    const otrosEnf = (!ets && !gine && !obst && !snc && !resp && !dige && !ofta && !derm && !card && !urin && !musc);

    // Análisis clínicos
    const vdrl = pruebas.includes('VDRL');
    const vih = pruebas.includes('VIH');
    const exudado = pruebas.includes('EXUDADO');
    const papanicolaou = pruebas.includes('PAP') || pruebas.includes('PAPANICOLAOU') || pruebas.includes('DOC');
    const otrosAnalisis = (!vdrl && !vih && !exudado && !papanicolaou && (pruebas.length > 0 || (row.detecciones_riesgo || '').length > 0));

    return {
      numero: index + 1,
      nombre: `${row.apellido_paterno} ${row.apellido_materno || ''}, ${row.nombres}`.trim(),
      edad,
      sexo_f: row.sexo === 'F' ? 'X' : '',
      sexo_m: row.sexo === 'M' ? 'X' : '',
      primera_vez: row.tipo_atencion === 'PRIMERA_VEZ' ? 'X' : '',
      subsecuente: row.tipo_atencion === 'SUBSECUENTE' ? 'X' : '',
      usuaria: esUsuaria ? 'X' : '',
      serv_comunidad: !esUsuaria ? 'X' : '',
      diagnostico: row.diagnostico_descripcion || row.motivo_consulta || 'Consulta Médica General',
      referido: canaliza || '',
      // Clasificación de enfermedades
      enf_ets: ets ? 'X' : '',
      enf_gine: gine ? 'X' : '',
      enf_obst: obst ? 'X' : '',
      enf_snc: snc ? 'X' : '',
      enf_resp: resp ? 'X' : '',
      enf_dige: dige ? 'X' : '',
      enf_ofta: ofta ? 'X' : '',
      enf_derm: derm ? 'X' : '',
      enf_card: card ? 'X' : '',
      enf_urin: urin ? 'X' : '',
      enf_musc: musc ? 'X' : '',
      enf_otros: otrosEnf ? 'X' : '',
      // Análisis Clínicos
      ac_vdrl: vdrl ? 'X' : '',
      ac_vih: vih ? 'X' : '',
      ac_exudado: exudado ? 'X' : '',
      ac_pap: papanicolaou ? 'X' : '',
      ac_otros: otrosAnalisis ? 'X' : ''
    };
  });

  return {
    fecha,
    medico: nombreMedico || 'Dr. Médico General',
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
           ac.tipo_atencion,
           cb.motivo_consulta, cb.observaciones,
           cm.diagnostico_cie10, cm.diagnostico_descripcion, cm.clasificacion_morbilidad,
           cm.pruebas_rapidas, cm.canalizacion_externa, cm.emite_certificado
    FROM atenciones_clinicas ac
    JOIN pacientes p ON p.id = ac.paciente_id
    LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id
    LEFT JOIN consultas_medicina_general cm ON cm.consulta_id = cb.id
    WHERE EXTRACT(YEAR FROM ac.fecha_hora_ingreso) = $1
      AND EXTRACT(MONTH FROM ac.fecha_hora_ingreso) = $2
      AND (ac.area_servicio ILIKE '%MEDICINA%' OR cb.area_medica = 'MEDICINA_GENERAL' OR ac.area_servicio IS NULL)
    ORDER BY ac.fecha_hora_ingreso ASC
  `;

  const result = await db.query(query, [anio, mes]);

  const dias = {};
  for (let d = 1; d <= totalDias; d++) {
    dias[d] = {
      dia: d,
      // Hoja 1: Resumen Total
      pob_f: 0, pob_m: 0, pob_1ra: 0, pob_sub: 0,
      pob_usuarias: 0, pob_comunidad: 0, pob_sanas: 0, pob_enfermas: 0,
      pob_displasia: 0, pob_capasits: 0,
      cau_f: 0, cau_m: 0, cau_sanas: 0, cau_enfermas: 0,
      cau_ets: 0, cau_otras_enf: 0, cau_certificado: 0,
      total_dia: 0,

      // Hoja 2: Padecimientos de Primera Vez
      // ETS (12)
      ets_gardnerella: 0, ets_candidiasis: 0, ets_tricomoniasis: 0, ets_blenorragia: 0,
      ets_cervicovaginitis: 0, ets_condiloma_peri: 0, ets_condiloma_balano: 0,
      ets_sifilis: 0, ets_vih: 0, ets_vph: 0, ets_displasia: 0, ets_otros: 0,
      // Gine (3)
      gine_anexitis: 0, gine_tumor_ovario: 0, gine_otras: 0,
      // Otras Enfermedades (18)
      enf_snc: 0, enf_oftalmologicas: 0, enf_respiratorias: 0, enf_hta: 0, enf_diabetes: 0,
      enf_cardiovasculares: 0, enf_digestivo: 0, enf_musculoesqueletico: 0, enf_dermatologico: 0,
      enf_urinarias: 0, enf_vascular_periferico: 0, enf_nefrologicas: 0, enf_salmonelosis: 0,
      enf_brucelosis: 0, enf_amibiasis: 0, enf_giardiasis: 0, enf_ascaris: 0, enf_otras: 0,

      // Hoja 3: Medidas Preventivas
      // Detecciones (6)
      det_cacu: 0, det_mama: 0, det_vih: 0, det_obesidad: 0, det_hta: 0, det_diabetes: 0,
      // Planificación Familiar (6)
      pf_diu: 0, pf_preservativos: 0, pf_hormonal_oral: 0, pf_hormonal_inyec: 0, pf_otb: 0, pf_subdermico: 0,
      // Preservativos (4)
      pres_consulta: 0, pres_platicas: 0, pres_ferias: 0, pres_operativos: 0,
      // Estudios de Gabinete / Lab (6)
      lab_vih: 0, lab_vdrl: 0, lab_rapidas_unidad: 0, lab_exudados: 0, lab_doc: 0, lab_hepatitis_c: 0
    };
  }

  for (const row of result.rows) {
    const d = row.dia;
    if (!dias[d]) continue;

    dias[d].total_dia++;

    const esCautiva = (row.tipo_poblacion || '').toLowerCase().includes('trab') ||
                      (row.tipo_poblacion || '').toLowerCase().includes('cautiv') ||
                      (row.tipo_poblacion || '').toLowerCase().includes('munic') ||
                      row.emite_certificado;

    const morbilidad = (row.clasificacion_morbilidad || '').toUpperCase();
    const diagDesc = `${row.diagnostico_descripcion || ''} ${row.motivo_consulta || ''} ${row.observaciones || ''}`.toUpperCase();
    const pruebas = (row.pruebas_rapidas || '').toUpperCase();
    const canaliza = (row.canalizacion_externa || '').toUpperCase();
    const es1raVez = (row.tipo_atencion === 'PRIMERA_VEZ');

    const esSano = diagDesc.includes('SANO') || diagDesc.includes('CONTROL') || diagDesc.includes('PREVENTIV') || diagDesc.includes('CERTIFICADO') || morbilidad.includes('SANO');

    // === HOJA 1: RESUMEN TOTAL ===
    if (!esCautiva) {
      if (row.sexo === 'F') dias[d].pob_f++;
      if (row.sexo === 'M') dias[d].pob_m++;
      if (es1raVez) dias[d].pob_1ra++; else dias[d].pob_sub++;
      dias[d].pob_comunidad++;
      if (esSano) dias[d].pob_sanas++; else dias[d].pob_enfermas++;
      if (canaliza.includes('DISPLASIA')) dias[d].pob_displasia++;
      if (canaliza.includes('CAPASITS')) dias[d].pob_capasits++;
    } else {
      if (row.sexo === 'F') dias[d].cau_f++;
      if (row.sexo === 'M') dias[d].cau_m++;
      dias[d].pob_usuarias++;
      if (esSano) dias[d].cau_sanas++; else dias[d].cau_enfermas++;
      if (morbilidad.includes('ETS') || morbilidad.includes('SEXUAL') || diagDesc.includes('ETS')) dias[d].cau_ets++;
      else if (!esSano) dias[d].cau_otras_enf++;
      if (row.emite_certificado) dias[d].cau_certificado++;
    }

    // === HOJA 2: PADECIMIENTOS DE PRIMERA VEZ ===
    if (es1raVez) {
      // ETS
      if (diagDesc.includes('GARDNERELLA')) dias[d].ets_gardnerella++;
      else if (diagDesc.includes('CANDIDIASIS') || diagDesc.includes('CANDIDA')) dias[d].ets_candidiasis++;
      else if (diagDesc.includes('TRICOMON')) dias[d].ets_tricomoniasis++;
      else if (diagDesc.includes('BLENORR') || diagDesc.includes('GONORR')) dias[d].ets_blenorragia++;
      else if (diagDesc.includes('CERVICOVAGINITIS')) dias[d].ets_cervicovaginitis++;
      else if (diagDesc.includes('CONDILOMA') && diagDesc.includes('PERIVULV')) dias[d].ets_condiloma_peri++;
      else if (diagDesc.includes('CONDILOMA') && (diagDesc.includes('BALANO') || diagDesc.includes('PENE'))) dias[d].ets_condiloma_balano++;
      else if (diagDesc.includes('SIFILIS') || diagDesc.includes('TREPONEMA')) dias[d].ets_sifilis++;
      else if (diagDesc.includes('VIH')) dias[d].ets_vih++;
      else if (diagDesc.includes('VPH') || diagDesc.includes('PAPILOMA')) dias[d].ets_vph++;
      else if (diagDesc.includes('DISPLASIA') || diagDesc.includes('EVERSION')) dias[d].ets_displasia++;
      else if (morbilidad.includes('ETS') || morbilidad.includes('SEXUAL')) dias[d].ets_otros++;

      // Gine
      if (diagDesc.includes('ANEXITIS')) dias[d].gine_anexitis++;
      else if (diagDesc.includes('OVAR') || diagDesc.includes('TUMOR')) dias[d].gine_tumor_ovario++;
      else if (morbilidad.includes('GINE')) dias[d].gine_otras++;

      // Otras Enfermedades
      if (morbilidad.includes('SNC') || diagDesc.includes('CEFALEA') || diagDesc.includes('EPILEP') || diagDesc.includes('NEURO')) dias[d].enf_snc++;
      else if (morbilidad.includes('OFTALM') || diagDesc.includes('CONJUNTIV')) dias[d].enf_oftalmologicas++;
      else if (morbilidad.includes('RESPIRAT') || diagDesc.includes('FARING') || diagDesc.includes('GRIPA') || diagDesc.includes('BRONQ') || diagDesc.includes('COVID') || diagDesc.includes('ASMA')) dias[d].enf_respiratorias++;
      else if (diagDesc.includes('HIPERTENS') || diagDesc.includes('HTA')) dias[d].enf_hta++;
      else if (diagDesc.includes('DIABET') || diagDesc.includes('GLUCOSA')) dias[d].enf_diabetes++;
      else if (morbilidad.includes('CARDIO') || diagDesc.includes('ARRITM')) dias[d].enf_cardiovasculares++;
      else if (morbilidad.includes('DIGEST') || diagDesc.includes('GASTR') || diagDesc.includes('COLIT')) dias[d].enf_digestivo++;
      else if (morbilidad.includes('MUSCUL') || morbilidad.includes('ESQUELET') || diagDesc.includes('LUMBAL') || diagDesc.includes('DOLOR MUSC')) dias[d].enf_musculoesqueletico++;
      else if (morbilidad.includes('DERMAT') || diagDesc.includes('PIEL') || diagDesc.includes('ALERGIA')) dias[d].enf_dermatologico++;
      else if (morbilidad.includes('URINAR') || diagDesc.includes('CISTITIS') || diagDesc.includes('ITU')) dias[d].enf_urinarias++;
      else if (morbilidad.includes('VASCULAR') || diagDesc.includes('VARICES')) dias[d].enf_vascular_periferico++;
      else if (morbilidad.includes('NEFRO') || diagDesc.includes('RENAL')) dias[d].enf_nefrologicas++;
      else if (diagDesc.includes('SALMONEL')) dias[d].enf_salmonelosis++;
      else if (diagDesc.includes('BRUCEL')) dias[d].enf_brucelosis++;
      else if (diagDesc.includes('AMIB')) dias[d].enf_amibiasis++;
      else if (diagDesc.includes('GIARD')) dias[d].enf_giardiasis++;
      else if (diagDesc.includes('ASCAR')) dias[d].enf_ascaris++;
      else if (!esSano) dias[d].enf_otras++;
    }

    // === HOJA 3: MEDIDAS PREVENTIVAS ===
    if (diagDesc.includes('CACU') || pruebas.includes('CACU') || pruebas.includes('PAP')) dias[d].det_cacu++;
    if (diagDesc.includes('MAMA') || pruebas.includes('MAMA')) dias[d].det_mama++;
    if (pruebas.includes('VIH')) dias[d].det_vih++;
    if (diagDesc.includes('SOBREPESO') || diagDesc.includes('OBESIDAD')) dias[d].det_obesidad++;
    if (diagDesc.includes('HTA') || diagDesc.includes('HIPERTENS')) dias[d].det_hta++;
    if (diagDesc.includes('DIABET')) dias[d].det_diabetes++;

    // Planificación familiar
    if (diagDesc.includes('DIU') || pruebas.includes('DIU')) dias[d].pf_diu++;
    if (diagDesc.includes('PRESERVATIVO') || pruebas.includes('PRESERVATIVO') || diagDesc.includes('CONDON')) {
      dias[d].pf_preservativos++;
      dias[d].pres_consulta++;
    }
    if (diagDesc.includes('ORAL') || diagDesc.includes('ANTICONCEPTIVO ORAL')) dias[d].pf_hormonal_oral++;
    if (diagDesc.includes('INYECTABLE') || diagDesc.includes('INYECCION')) dias[d].pf_hormonal_inyec++;
    if (diagDesc.includes('OTB') || diagDesc.includes('SALPINGO')) dias[d].pf_otb++;
    if (diagDesc.includes('INTRADERMICO') || diagDesc.includes('SUBDERMICO') || diagDesc.includes('IMPLANTE')) dias[d].pf_subdermico++;

    // Preservativos
    if (diagDesc.includes('PLATICA')) dias[d].pres_platicas++;
    if (diagDesc.includes('FERIA')) dias[d].pres_ferias++;
    if (diagDesc.includes('OPERATIVO')) dias[d].pres_operativos++;

    // Estudios de Gabinete / Lab
    if (pruebas.includes('VIH')) dias[d].lab_vih++;
    if (pruebas.includes('VDRL')) dias[d].lab_vdrl++;
    if (pruebas.length > 0) dias[d].lab_rapidas_unidad++;
    if (pruebas.includes('EXUDADO')) dias[d].lab_exudados++;
    if (pruebas.includes('DOC') || pruebas.includes('PAP')) dias[d].lab_doc++;
    if (pruebas.includes('HEPATITIS') || pruebas.includes('VHC')) dias[d].lab_hepatitis_c++;
  }

  const listaDias = Object.values(dias);
  const keys = Object.keys(listaDias[0]).filter(k => k !== 'dia');

  const totales = {};
  keys.forEach(k => {
    totales[k] = listaDias.reduce((acc, row) => acc + (row[k] || 0), 0);
  });

  return {
    periodo: { anio, mes, total_dias: totalDias },
    dias: listaDias,
    totales,
    total_general_mes: totales.total_dia
  };
}

module.exports = {
  obtenerDatosDiarios,
  obtenerDatosMensuales
};
