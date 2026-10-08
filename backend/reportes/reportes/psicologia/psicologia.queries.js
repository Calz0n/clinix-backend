// Consultas SQL específicas para el módulo de Psicología
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

async function obtenerDatosDiarios(db, fecha) {
  const query = `
    SELECT ac.id as atencion_id, ac.tipo_atencion, ac.fecha_hora_ingreso,
           p.id as paciente_id, p.nombres, p.apellido_paterno, p.apellido_materno,
           p.fecha_nacimiento, p.sexo, p.numero_expediente, p.tipo_poblacion,
           t.tension_arterial, t.frecuencia_cardiaca, t.frecuencia_respiratoria,
           t.peso_kg, t.talla_metros, t.imc, t.saturacion_oxigeno, t.glucosa_capilar,
           cb.motivo_consulta, cb.observaciones,
           cps.evaluacion_clinica, cps.nota_evolucion, cps.plan_intervencion,
           u.nombre as psicologo_nombre, u.apellidos as psicologo_apellidos
    FROM atenciones_clinicas ac
    JOIN pacientes p ON p.id = ac.paciente_id
    LEFT JOIN triaje_signos_vitales t ON t.atencion_id = ac.id
    LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id AND (cb.area_medica = 'PSICOLOGIA' OR ac.area_servicio ILIKE '%PSICO%')
    LEFT JOIN consultas_psicologia cps ON cps.consulta_id = cb.id
    LEFT JOIN usuarios u ON u.id = cb.especialista_id
    WHERE DATE(ac.fecha_hora_ingreso) = $1
      AND (ac.area_servicio ILIKE '%PSICO%' OR cb.area_medica = 'PSICOLOGIA')
    ORDER BY ac.fecha_hora_ingreso ASC
  `;

  const result = await db.query(query, [fecha]);
  const hoy = new Date(fecha);

  let nombrePsicologo = '';

  const pacientes = result.rows.map((row, index) => {
    const nac = new Date(row.fecha_nacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
      edad--;
    }

    if (!nombrePsicologo && row.psicologo_nombre) {
      nombrePsicologo = `Lic. ${row.psicologo_nombre} ${row.psicologo_apellidos || ''}`.trim();
    }

    const diagnostico = row.motivo_consulta || row.observaciones || row.evaluacion_clinica || 'Atención Psicológica';

    return {
      numero: index + 1,
      nombre: `${row.apellido_paterno} ${row.apellido_materno || ''}, ${row.nombres}`.trim(),
      diagnostico,
      edad,
      sexo_f: row.sexo === 'F' ? 'X' : '',
      sexo_m: row.sexo === 'M' ? 'X' : '',
      primera_vez: row.tipo_atencion === 'PRIMERA_VEZ' ? 'X' : '',
      subsecuente: row.tipo_atencion === 'SUBSECUENTE' ? 'X' : '',
      ta: row.tension_arterial || '-',
      fc: row.frecuencia_cardiaca || '-',
      fr: row.frecuencia_respiratoria || '-',
      peso: row.peso_kg || '-',
      talla: row.talla_metros || '-',
      imc: row.imc || '-',
      spo2: row.saturacion_oxigeno ? `${row.saturacion_oxigeno}%` : '-',
      glucosa: row.glucosa_capilar || '-'
    };
  });

  return {
    fecha,
    psicologo: nombrePsicologo || 'Lic. Especialista en Psicología',
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
           cps.evaluacion_clinica
    FROM atenciones_clinicas ac
    JOIN pacientes p ON p.id = ac.paciente_id
    LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id AND (cb.area_medica = 'PSICOLOGIA' OR ac.area_servicio ILIKE '%PSICO%')
    LEFT JOIN consultas_psicologia cps ON cps.consulta_id = cb.id
    WHERE EXTRACT(YEAR FROM ac.fecha_hora_ingreso) = $1
      AND EXTRACT(MONTH FROM ac.fecha_hora_ingreso) = $2
      AND (ac.area_servicio ILIKE '%PSICO%' OR cb.area_medica = 'PSICOLOGIA')
    ORDER BY ac.fecha_hora_ingreso ASC
  `;

  const result = await db.query(query, [anio, mes]);

  const dias = {};
  for (let d = 1; d <= totalDias; d++) {
    dias[d] = {
      dia: d,
      // Población Abierta (12 columnas)
      pob_f: 0, pob_m: 0, pob_1ra: 0, pob_sub: 0, pob_sanas: 0, pob_enfermas: 0,
      pob_ninez: 0, pob_adol_temp: 0, pob_adol_tard: 0, pob_adul_temp: 0, pob_adul_media: 0, pob_adul_tard: 0,

      // Población Cautiva (12 columnas)
      cau_f: 0, cau_m: 0, cau_1ra: 0, cau_sub: 0, cau_sanas: 0, cau_enfermas: 0,
      cau_ninez: 0, cau_adol_temp: 0, cau_adol_tard: 0, cau_adul_temp: 0, cau_adul_media: 0, cau_adul_tard: 0,

      total_dia: 0
    };
  }

  const hoyAnio = anio;
  for (const row of result.rows) {
    const d = row.dia;
    if (!dias[d]) continue;

    dias[d].total_dia++;

    const nac = new Date(row.fecha_nacimiento);
    const edad = hoyAnio - nac.getFullYear();

    const esCautiva = (row.tipo_poblacion || '').toLowerCase().includes('trab') ||
                      (row.tipo_poblacion || '').toLowerCase().includes('munic') ||
                      (row.tipo_poblacion || '').toLowerCase().includes('cautiv');

    const textoClinico = `${row.motivo_consulta || ''} ${row.observaciones || ''} ${row.evaluacion_clinica || ''}`.toLowerCase();
    const esSano = textoClinico.includes('orientaci') || textoClinico.includes('preventiv') || textoClinico.includes('valoracion inicial normal');

    if (!esCautiva) {
      // Población Abierta
      if (row.sexo === 'F') dias[d].pob_f++;
      if (row.sexo === 'M') dias[d].pob_m++;
      if (row.tipo_atencion === 'PRIMERA_VEZ') dias[d].pob_1ra++;
      if (row.tipo_atencion === 'SUBSECUENTE') dias[d].pob_sub++;
      if (esSano) dias[d].pob_sanas++; else dias[d].pob_enfermas++;

      // Etapas de desarrollo
      if (edad < 12) dias[d].pob_ninez++;
      else if (edad >= 12 && edad <= 14) dias[d].pob_adol_temp++;
      else if (edad >= 15 && edad <= 17) dias[d].pob_adol_tard++;
      else if (edad >= 18 && edad <= 39) dias[d].pob_adul_temp++;
      else if (edad >= 40 && edad <= 59) dias[d].pob_adul_media++;
      else dias[d].pob_adul_tard++;
    } else {
      // Población Cautiva
      if (row.sexo === 'F') dias[d].cau_f++;
      if (row.sexo === 'M') dias[d].cau_m++;
      if (row.tipo_atencion === 'PRIMERA_VEZ') dias[d].cau_1ra++;
      if (row.tipo_atencion === 'SUBSECUENTE') dias[d].cau_sub++;
      if (esSano) dias[d].cau_sanas++; else dias[d].cau_enfermas++;

      // Etapas de desarrollo
      if (edad < 12) dias[d].cau_ninez++;
      else if (edad >= 12 && edad <= 14) dias[d].cau_adol_temp++;
      else if (edad >= 15 && edad <= 17) dias[d].cau_adol_tard++;
      else if (edad >= 18 && edad <= 39) dias[d].cau_adul_temp++;
      else if (edad >= 40 && edad <= 59) dias[d].cau_adul_media++;
      else dias[d].cau_adul_tard++;
    }
  }

  const listaDias = Object.values(dias);
  const keys = [
    'pob_f', 'pob_m', 'pob_1ra', 'pob_sub', 'pob_sanas', 'pob_enfermas',
    'pob_ninez', 'pob_adol_temp', 'pob_adol_tard', 'pob_adul_temp', 'pob_adul_media', 'pob_adul_tard',
    'cau_f', 'cau_m', 'cau_1ra', 'cau_sub', 'cau_sanas', 'cau_enfermas',
    'cau_ninez', 'cau_adol_temp', 'cau_adol_tard', 'cau_adul_temp', 'cau_adul_media', 'cau_adul_tard',
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
