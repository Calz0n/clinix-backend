// Consultas SQL específicas para el módulo de Enfermería
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

async function obtenerDatosDiarios(db, fecha) {
  const query = `
    SELECT ac.id as atencion_id, ac.tipo_atencion, ac.fecha_hora_ingreso, ac.area_servicio,
           p.id as paciente_id, p.nombres, p.apellido_paterno, p.apellido_materno,
           p.fecha_nacimiento, p.sexo, p.numero_expediente, p.tipo_poblacion,
           t.id as triaje_id, t.tension_arterial, t.frecuencia_cardiaca, t.frecuencia_respiratoria,
           t.temperatura, t.saturacion_oxigeno, t.glucosa_capilar, t.peso_kg, t.talla_metros,
           t.imc, t.clasificacion_imc, t.detecciones_riesgo,
           cn.circunferencia_cintura, cn.circunferencia_cadera,
           u.nombre as enfermero_nombre, u.apellidos as enfermero_apellidos,
           ARRAY_AGG(pe.tipo_procedimiento) FILTER (WHERE pe.id IS NOT NULL) as procedimientos_lista
    FROM atenciones_clinicas ac
    JOIN pacientes p ON p.id = ac.paciente_id
    LEFT JOIN triaje_signos_vitales t ON t.atencion_id = ac.id
    LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id
    LEFT JOIN consultas_nutricion cn ON cn.consulta_id = cb.id
    LEFT JOIN usuarios u ON u.id = t.enfermero_id
    LEFT JOIN procedimientos_enfermeria pe ON pe.triaje_id = t.id
    WHERE DATE(ac.fecha_hora_ingreso) = $1
      AND (t.id IS NOT NULL OR ac.area_servicio ILIKE '%ENFERM%')
    GROUP BY ac.id, p.id, t.id, cn.id, u.id
    ORDER BY ac.fecha_hora_ingreso ASC
  `;

  const result = await db.query(query, [fecha]);
  const hoy = new Date(fecha);

  let nombreEnfermero = '';

  const pacientes = result.rows.map((row, index) => {
    const nac = new Date(row.fecha_nacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
      edad--;
    }

    if (!nombreEnfermero && row.enfermero_nombre) {
      nombreEnfermero = `Enf. ${row.enfermero_nombre} ${row.enfermero_apellidos || ''}`.trim();
    }

    const detTexto = (row.detecciones_riesgo || '').toUpperCase();
    const procs = (row.procedimientos_lista || []).map(p => (p || '').toUpperCase());
    const procsStr = procs.join(' ');

    // Validar HAS (Hipertensión)
    let esHas = detTexto.includes('HAS') || detTexto.includes('HTA') || detTexto.includes('HIPERTENS');
    if (!esHas && row.tension_arterial) {
      const partes = row.tension_arterial.split('/');
      if (partes.length === 2) {
        const sis = parseInt(partes[0], 10);
        const dia = parseInt(partes[1], 10);
        if (sis >= 140 || dia >= 90) esHas = true;
      }
    }

    // Validar DM (Diabetes)
    let esDm = detTexto.includes('DM') || detTexto.includes('DIABETES');
    if (!esDm && row.glucosa_capilar && row.glucosa_capilar >= 126) {
      esDm = true;
    }

    // Exploración de mama
    const esMama = detTexto.includes('MAMA') || procsStr.includes('MAMA');

    // Procedimientos específicos
    const retPuntos = procsStr.includes('PUNTOS') || procsStr.includes('SUTURA');
    const inyecciones = procsStr.includes('INYEC') || procsStr.includes('MEDICAMENTO');
    const curacion = procsStr.includes('CURAC') || procsStr.includes('HERIDA');
    const pruebaRapida = procsStr.includes('PRUEBA') || procsStr.includes('RAPIDA') || procsStr.includes('VIH') || procsStr.includes('VDRL');
    const jornada = (row.area_servicio || '').toUpperCase().includes('JORNADA') || (row.tipo_poblacion || '').toUpperCase().includes('JORNADA');

    return {
      numero: index + 1,
      nombre: `${row.apellido_paterno} ${row.apellido_materno || ''}, ${row.nombres}`.trim(),
      edad,
      edad_f: row.sexo === 'F' ? edad : '',
      edad_m: row.sexo === 'M' ? edad : '',
      sexo: row.sexo,
      ta: row.tension_arterial || '-',
      fc: row.frecuencia_cardiaca || '-',
      fr: row.frecuencia_respiratoria || '-',
      temp: row.temperatura ? `${row.temperatura}°C` : '-',
      spo2: row.saturacion_oxigeno ? `${row.saturacion_oxigeno}%` : '-',
      peso: row.peso_kg || '-',
      talla: row.talla_metros || '-',
      imc: row.imc || '-',
      glucosa: row.glucosa_capilar || '-',
      cintura: row.circunferencia_cintura || '-',
      cadera: row.circunferencia_cadera || '-',
      det_has: esHas ? 'X' : '',
      det_dm: esDm ? 'X' : '',
      det_mama: esMama ? 'X' : '',
      proc_puntos: retPuntos ? 'X' : '',
      proc_inyeccion: inyecciones ? 'X' : '',
      proc_curacion: curacion ? 'X' : '',
      proc_prueba: pruebaRapida ? 'X' : '',
      proc_jornada: jornada ? 'X' : ''
    };
  });

  return {
    fecha,
    enfermero: nombreEnfermero || 'Enf. Personal de Enfermería',
    total_pacientes: pacientes.length,
    pacientes
  };
}

async function obtenerDatosMensuales(db, anio, mes) {
  const totalDias = new Date(anio, mes, 0).getDate();

  const query = `
    SELECT EXTRACT(DAY FROM ac.fecha_hora_ingreso)::INT as dia,
           p.sexo,
           p.tipo_poblacion,
           ac.area_servicio,
           t.id as triaje_id, t.tension_arterial, t.frecuencia_cardiaca, t.frecuencia_respiratoria,
           t.temperatura, t.saturacion_oxigeno, t.glucosa_capilar, t.peso_kg, t.talla_metros,
           t.detecciones_riesgo,
           ARRAY_AGG(pe.tipo_procedimiento) FILTER (WHERE pe.id IS NOT NULL) as procedimientos_lista
    FROM atenciones_clinicas ac
    JOIN pacientes p ON p.id = ac.paciente_id
    LEFT JOIN triaje_signos_vitales t ON t.atencion_id = ac.id
    LEFT JOIN procedimientos_enfermeria pe ON pe.triaje_id = t.id
    WHERE EXTRACT(YEAR FROM ac.fecha_hora_ingreso) = $1
      AND EXTRACT(MONTH FROM ac.fecha_hora_ingreso) = $2
      AND (t.id IS NOT NULL OR ac.area_servicio ILIKE '%ENFERM%')
    GROUP BY ac.id, p.id, t.id
    ORDER BY ac.fecha_hora_ingreso ASC
  `;

  const result = await db.query(query, [anio, mes]);

  const dias = {};
  for (let d = 1; d <= totalDias; d++) {
    dias[d] = {
      dia: d,
      sexo_f: 0,
      sexo_m: 0,
      toma_ta: 0,
      toma_glucosa: 0,
      toma_fc: 0,
      toma_fr: 0,
      toma_temp: 0,
      toma_spo2: 0,
      // Somatometría
      toma_peso: 0,
      toma_talla: 0,
      // Detecciones
      det_has: 0,
      det_dm: 0,
      // Otros Servicios
      proc_puntos: 0,
      proc_inyeccion: 0,
      proc_curacion: 0,
      proc_nebulizacion: 0,
      proc_pruebas_rapidas: 0,
      proc_exp_mama: 0,
      proc_jornada: 0,
      proc_otros: 0,
      total_dia: 0
    };
  }

  for (const row of result.rows) {
    const d = row.dia;
    if (!dias[d]) continue;

    dias[d].total_dia++;

    if (row.sexo === 'F') dias[d].sexo_f++;
    if (row.sexo === 'M') dias[d].sexo_m++;

    if (row.tension_arterial) dias[d].toma_ta++;
    if (row.glucosa_capilar) dias[d].toma_glucosa++;
    if (row.frecuencia_cardiaca) dias[d].toma_fc++;
    if (row.frecuencia_respiratoria) dias[d].toma_fr++;
    if (row.temperatura) dias[d].toma_temp++;
    if (row.saturacion_oxigeno) dias[d].toma_spo2++;
    if (row.peso_kg) dias[d].toma_peso++;
    if (row.talla_metros) dias[d].toma_talla++;

    const detTexto = (row.detecciones_riesgo || '').toUpperCase();
    const procs = (row.procedimientos_lista || []).map(p => (p || '').toUpperCase());
    const procsStr = procs.join(' ');

    let esHas = detTexto.includes('HAS') || detTexto.includes('HTA');
    if (!esHas && row.tension_arterial) {
      const partes = row.tension_arterial.split('/');
      if (partes.length === 2 && (parseInt(partes[0], 10) >= 140 || parseInt(partes[1], 10) >= 90)) {
        esHas = true;
      }
    }
    if (esHas) dias[d].det_has++;

    let esDm = detTexto.includes('DM') || detTexto.includes('DIABETES') || (row.glucosa_capilar && row.glucosa_capilar >= 126);
    if (esDm) dias[d].det_dm++;

    if (detTexto.includes('MAMA') || procsStr.includes('MAMA')) dias[d].proc_exp_mama++;

    if (procsStr.includes('PUNTOS') || procsStr.includes('SUTURA')) dias[d].proc_puntos++;
    if (procsStr.includes('INYEC') || procsStr.includes('MEDICAMENTO')) dias[d].proc_inyeccion++;
    if (procsStr.includes('CURAC') || procsStr.includes('HERIDA')) dias[d].proc_curacion++;
    if (procsStr.includes('NEBULIZ')) dias[d].proc_nebulizacion++;
    if (procsStr.includes('PRUEBA') || procsStr.includes('RAPIDA') || procsStr.includes('VIH') || procsStr.includes('VDRL')) dias[d].proc_pruebas_rapidas++;
    if ((row.area_servicio || '').toUpperCase().includes('JORNADA') || (row.tipo_poblacion || '').toUpperCase().includes('JORNADA')) dias[d].proc_jornada++;
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
