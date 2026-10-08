// Consultas SQL específicas para el módulo de Odontología
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

async function obtenerDatosDiarios(db, fecha) {
  const query = `
    SELECT ac.id as atencion_id, ac.tipo_atencion, ac.fecha_hora_ingreso,
           p.id as paciente_id, p.nombres, p.apellido_paterno, p.apellido_materno,
           p.fecha_nacimiento, p.sexo, p.numero_expediente,
           cb.motivo_consulta, cb.observaciones,
           co.id as consulta_odontologia_id, co.tipo_denticion, co.comorbilidades_bucales,
           co.estudios_gabinete, co.indice_cpod, co.indice_ceod,
           u.nombre as odontologo_nombre, u.apellidos as odontologo_apellidos
    FROM atenciones_clinicas ac
    JOIN pacientes p ON p.id = ac.paciente_id
    LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id AND (cb.area_medica = 'ODONTOLOGIA' OR ac.area_servicio ILIKE '%ODONTO%')
    LEFT JOIN consultas_odontologia co ON co.consulta_id = cb.id
    LEFT JOIN usuarios u ON u.id = cb.especialista_id
    WHERE ac.fecha_hora_ingreso >= $1::date AND ac.fecha_hora_ingreso < ($1::date + INTERVAL '1 day')
      AND (ac.area_servicio ILIKE '%ODONTO%' OR cb.area_medica = 'ODONTOLOGIA')
    ORDER BY ac.fecha_hora_ingreso ASC
  `;

  const result = await db.query(query, [fecha]);
  const hoy = new Date(fecha);

  let nombreOdontologo = '';

  const pacientes = result.rows.map((row, index) => {
    const nac = new Date(row.fecha_nacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
      edad--;
    }

    if (!nombreOdontologo && row.odontologo_nombre) {
      nombreOdontologo = `C.D. ${row.odontologo_nombre} ${row.odontologo_apellidos || ''}`.trim();
    }

    const textoClinico = `${row.motivo_consulta || ''} ${row.observaciones || ''} ${row.comorbilidades_bucales || ''} ${row.estudios_gabinete || ''}`.toLowerCase();
    const esPreventiva = textoClinico.includes('preventiv') || textoClinico.includes('limpieza') || textoClinico.includes('profilaxis') || textoClinico.includes('fluor');

    return {
      numero: index + 1,
      nombre: `${row.apellido_paterno} ${row.apellido_materno || ''}, ${row.nombres}`.trim(),
      diagnostico: row.observaciones || row.motivo_consulta || row.comorbilidades_bucales || 'Consulta Odontológica',
      edad,
      sexo_f: row.sexo === 'F' ? 'X' : '',
      sexo_m: row.sexo === 'M' ? 'X' : '',
      primera_vez: row.tipo_atencion === 'PRIMERA_VEZ' ? 'X' : '',
      subsecuente: row.tipo_atencion === 'SUBSECUENTE' ? 'X' : '',
      preventiva: esPreventiva ? 'X' : '',

      // Detecciones
      det_absceso: textoClinico.includes('absceso') ? 'X' : '',
      det_caries: (textoClinico.includes('caries') || (row.indice_cpod && row.indice_cpod > 0)) ? 'X' : '',
      det_gingivitis: textoClinico.includes('gingiv') ? 'X' : '',
      det_periodontitis: textoClinico.includes('periodont') ? 'X' : '',
      det_abrasion: (textoClinico.includes('abrasi') || textoClinico.includes('desgaste')) ? 'X' : '',
      det_bruxismo: textoClinico.includes('brux') ? 'X' : '',
      det_cepillado: (textoClinico.includes('cepillado') || textoClinico.includes('tecnica')) ? 'X' : '',
      det_hilo: (textoClinico.includes('hilo') || textoClinico.includes('seda')) ? 'X' : '',
      det_placa: (textoClinico.includes('placa') || textoClinico.includes('bacter')) ? 'X' : '',
      det_fluor: textoClinico.includes('fluor') ? 'X' : '',

      // Tratamiento
      trat_profilaxis: (textoClinico.includes('profilaxis') || textoClinico.includes('limpieza')) ? 'X' : '',
      trat_curetaje: (textoClinico.includes('curetaje') || textoClinico.includes('periapical')) ? 'X' : '',
      trat_farmaco: (textoClinico.includes('farmaco') || textoClinico.includes('receta') || textoClinico.includes('antibiot') || textoClinico.includes('analges')) ? 'X' : '',
      trat_desensibilizante: (textoClinico.includes('desensibiliz') || textoClinico.includes('sensib')) ? 'X' : '',
      trat_amalgama: textoClinico.includes('amalgama') ? 'X' : '',
      trat_resina: (textoClinico.includes('resina') || textoClinico.includes('obturaci')) ? 'X' : '',
      trat_extraccion: textoClinico.includes('extracci') ? 'X' : '',

      // Estudios de Gabinete
      gab_biometria: (textoClinico.includes('biometr') || textoClinico.includes('hematica') || textoClinico.includes('bh')) ? 'X' : '',
      gab_coagulacion: (textoClinico.includes('coagulaci') || textoClinico.includes('tp') || textoClinico.includes('ttpa')) ? 'X' : '',
      gab_pruebas_rapidas: (textoClinico.includes('prueba rapida') || textoClinico.includes('vih') || textoClinico.includes('vdrl')) ? 'X' : '',
      gab_panoramica: textoClinico.includes('panoramica') ? 'X' : '',
      gab_periapical: (textoClinico.includes('periapical') || textoClinico.includes('rx') || textoClinico.includes('radiograf')) ? 'X' : '',
    };
  });

  return {
    fecha,
    odontologo: nombreOdontologo || 'C.D. Especialista en Estomatología',
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
           ac.tipo_atencion,
           cb.motivo_consulta, cb.observaciones,
           co.comorbilidades_bucales, co.estudios_gabinete, co.indice_cpod, co.indice_ceod
    FROM atenciones_clinicas ac
    JOIN pacientes p ON p.id = ac.paciente_id
    LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id AND (cb.area_medica = 'ODONTOLOGIA' OR ac.area_servicio ILIKE '%ODONTO%')
    LEFT JOIN consultas_odontologia co ON co.consulta_id = cb.id
    WHERE EXTRACT(YEAR FROM ac.fecha_hora_ingreso) = $1
      AND EXTRACT(MONTH FROM ac.fecha_hora_ingreso) = $2
      AND (ac.area_servicio ILIKE '%ODONTO%' OR cb.area_medica = 'ODONTOLOGIA')
    ORDER BY ac.fecha_hora_ingreso ASC
  `;

  const result = await db.query(query, [anio, mes]);

  const dias = {};
  for (let d = 1; d <= totalDias; d++) {
    dias[d] = {
      dia: d,
      // Detecciones (10 columnas)
      absceso: 0, caries: 0, gingivitis: 0, periodontitis: 0, abrasion: 0, bruxismo: 0,
      tecnica_cepillado: 0, hilo_dental: 0, deteccion_placa: 0, aplicacion_fluor: 0,
      // Tratamiento (7 columnas)
      profilaxis: 0, curetaje: 0, farmacoterapia: 0, desensibilizante: 0, amalgama: 0, resina: 0, extraccion: 0,
      // Gabinete (5 columnas)
      biometria_hematica: 0, tiempo_coagulacion: 0, pruebas_rapidas: 0, radio_panoramica: 0, radio_periapical: 0,
      total_dia: 0
    };
  }

  for (const row of result.rows) {
    const d = row.dia;
    if (!dias[d]) continue;

    dias[d].total_dia++;
    const textoClinico = `${row.motivo_consulta || ''} ${row.observaciones || ''} ${row.comorbilidades_bucales || ''} ${row.estudios_gabinete || ''}`.toLowerCase();

    // Detecciones
    if (textoClinico.includes('absceso')) dias[d].absceso++;
    if (textoClinico.includes('caries') || (row.indice_cpod && row.indice_cpod > 0)) dias[d].caries++;
    if (textoClinico.includes('gingiv')) dias[d].gingivitis++;
    if (textoClinico.includes('periodont')) dias[d].periodontitis++;
    if (textoClinico.includes('abrasi') || textoClinico.includes('desgaste')) dias[d].abrasion++;
    if (textoClinico.includes('brux')) dias[d].bruxismo++;
    if (textoClinico.includes('cepillado') || textoClinico.includes('tecnica')) dias[d].tecnica_cepillado++;
    if (textoClinico.includes('hilo') || textoClinico.includes('seda')) dias[d].hilo_dental++;
    if (textoClinico.includes('placa') || textoClinico.includes('bacter')) dias[d].deteccion_placa++;
    if (textoClinico.includes('fluor')) dias[d].aplicacion_fluor++;

    // Tratamiento
    if (textoClinico.includes('profilaxis') || textoClinico.includes('limpieza')) dias[d].profilaxis++;
    if (textoClinico.includes('curetaje') || textoClinico.includes('periapical')) dias[d].curetaje++;
    if (textoClinico.includes('farmaco') || textoClinico.includes('receta') || textoClinico.includes('antibiot') || textoClinico.includes('analges')) dias[d].farmacoterapia++;
    if (textoClinico.includes('desensibiliz') || textoClinico.includes('sensib')) dias[d].desensibilizante++;
    if (textoClinico.includes('amalgama')) dias[d].amalgama++;
    if (textoClinico.includes('resina') || textoClinico.includes('obturaci')) dias[d].resina++;
    if (textoClinico.includes('extracci')) dias[d].extraccion++;

    // Gabinete
    if (textoClinico.includes('biometr') || textoClinico.includes('hematica') || textoClinico.includes('bh')) dias[d].biometria_hematica++;
    if (textoClinico.includes('coagulaci') || textoClinico.includes('tp') || textoClinico.includes('ttpa')) dias[d].tiempo_coagulacion++;
    if (textoClinico.includes('prueba rapida') || textoClinico.includes('vih') || textoClinico.includes('vdrl')) dias[d].pruebas_rapidas++;
    if (textoClinico.includes('panoramica')) dias[d].radio_panoramica++;
    if (textoClinico.includes('periapical') || textoClinico.includes('rx') || textoClinico.includes('radiograf')) dias[d].radio_periapical++;
  }

  const listaDias = Object.values(dias);
  const keys = [
    'absceso', 'caries', 'gingivitis', 'periodontitis', 'abrasion', 'bruxismo', 'tecnica_cepillado', 'hilo_dental', 'deteccion_placa', 'aplicacion_fluor',
    'profilaxis', 'curetaje', 'farmacoterapia', 'desensibilizante', 'amalgama', 'resina', 'extraccion',
    'biometria_hematica', 'tiempo_coagulacion', 'pruebas_rapidas', 'radio_panoramica', 'radio_periapical',
    'total_dia'
  ];

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
