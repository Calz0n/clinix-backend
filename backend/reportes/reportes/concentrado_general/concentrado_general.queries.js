// Consultas SQL específicas para el Concentrado General Mensual
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

async function obtenerDatosMensuales(db, anio, mes) {
  const totalDias = new Date(anio, mes, 0).getDate();

  const query = `
    SELECT 
      EXTRACT(DAY FROM ac.fecha_hora_ingreso)::INT as dia,
      p.sexo,
      p.tipo_poblacion,
      p.beneficiario_programa,
      ac.tipo_atencion,
      ac.area_servicio,
      cb.area_medica,
      cm.emite_certificado,
      cm.canalizacion_externa,
      t.id as triaje_id,
      t.tension_arterial,
      t.glucosa_capilar,
      t.imc,
      t.detecciones_riesgo,
      (SELECT COUNT(*)::INT FROM procedimientos_enfermeria pe WHERE pe.triaje_id = t.id) as num_procedimientos
    FROM atenciones_clinicas ac
    JOIN pacientes p ON p.id = ac.paciente_id
    LEFT JOIN triaje_signos_vitales t ON t.atencion_id = ac.id
    LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id
    LEFT JOIN consultas_medicina_general cm ON cm.consulta_id = cb.id
    WHERE EXTRACT(YEAR FROM ac.fecha_hora_ingreso) = $1
      AND EXTRACT(MONTH FROM ac.fecha_hora_ingreso) = $2
    ORDER BY ac.fecha_hora_ingreso ASC
  `;

  const result = await db.query(query, [anio, mes]);

  const dias = {};
  for (let d = 1; d <= totalDias; d++) {
    dias[d] = {
      dia: d,
      // Demográficos
      sexo_f: 0,
      sexo_m: 0,
      tipo_1ra: 0,
      tipo_sub: 0,
      // Población
      pob_abierta: 0,
      pob_cautiva: 0,
      // Especialidades
      medicina_general: 0,
      enfermeria: 0,
      odontologia: 0,
      nutricion: 0,
      psicologia: 0,
      // Salud Pública e Indicadores
      det_riesgo: 0,
      procedimientos: 0,
      canalizaciones: 0,
      certificados: 0,
      // Total del día
      total_dia: 0
    };
  }

  for (const row of result.rows) {
    const d = row.dia;
    if (!dias[d]) continue;

    dias[d].total_dia++;

    // Sexo
    if (row.sexo === 'F') dias[d].sexo_f++;
    if (row.sexo === 'M') dias[d].sexo_m++;

    // Tipo de consulta
    if (row.tipo_atencion === 'PRIMERA_VEZ') dias[d].tipo_1ra++;
    else dias[d].tipo_sub++;

    // Tipo de población
    const tipoPob = (row.tipo_poblacion || '').toLowerCase();
    const esCautiva = tipoPob.includes('trab') ||
                      tipoPob.includes('cautiv') ||
                      tipoPob.includes('munic') ||
                      tipoPob.includes('sindicato') ||
                      row.beneficiario_programa ||
                      row.emite_certificado;

    if (esCautiva) dias[d].pob_cautiva++;
    else dias[d].pob_abierta++;

    // Clasificación por especialidad
    const areaServ = (row.area_servicio || '').toUpperCase();
    const areaMed = (row.area_medica || '').toUpperCase();

    if (areaServ.includes('ODONTO') || areaMed === 'ODONTOLOGIA') {
      dias[d].odontologia++;
    } else if (areaServ.includes('NUTRI') || areaMed === 'NUTRICION') {
      dias[d].nutricion++;
    } else if (areaServ.includes('PSICO') || areaMed === 'PSICOLOGIA') {
      dias[d].psicologia++;
    } else if (areaServ.includes('ENFERM') || (row.triaje_id && !areaMed && !areaServ.includes('MEDICINA'))) {
      dias[d].enfermeria++;
    } else {
      // Medicina General por defecto
      dias[d].medicina_general++;
    }

    // Indicadores preventivos de Salud Pública
    let tieneRiesgo = false;
    if (row.detecciones_riesgo && row.detecciones_riesgo.trim().length > 0) tieneRiesgo = true;
    if (row.tension_arterial) {
      const p = row.tension_arterial.split('/');
      if (p.length === 2 && (parseInt(p[0], 10) >= 140 || parseInt(p[1], 10) >= 90)) tieneRiesgo = true;
    }
    if (row.glucosa_capilar && row.glucosa_capilar >= 126) tieneRiesgo = true;
    if (row.imc && parseFloat(row.imc) >= 30) tieneRiesgo = true;

    if (tieneRiesgo) dias[d].det_riesgo++;

    // Procedimientos
    if (row.num_procedimientos && row.num_procedimientos > 0) {
      dias[d].procedimientos += row.num_procedimientos;
    }

    // Canalizaciones
    if (row.canalizacion_externa && row.canalizacion_externa.trim().length > 0) {
      dias[d].canalizaciones++;
    }

    // Certificados
    if (row.emite_certificado) {
      dias[d].certificados++;
    }
  }

  const listaDias = Object.values(dias);
  const keys = Object.keys(listaDias[0]).filter(k => k !== 'dia');

  const totales = {};
  keys.forEach(k => {
    totales[k] = listaDias.reduce((acc, row) => acc + (row[k] || 0), 0);
  });

  const totalGeneral = totales.total_dia || 0;

  // Estadísticas ejecutivas para tarjetas de resumen
  const desgloseEspecialidades = [
    { nombre: 'Medicina General', total: totales.medicina_general, pct: totalGeneral > 0 ? ((totales.medicina_general / totalGeneral) * 100).toFixed(1) : '0.0' },
    { nombre: 'Triaje y Enfermería', total: totales.enfermeria, pct: totalGeneral > 0 ? ((totales.enfermeria / totalGeneral) * 100).toFixed(1) : '0.0' },
    { nombre: 'Odontología', total: totales.odontologia, pct: totalGeneral > 0 ? ((totales.odontologia / totalGeneral) * 100).toFixed(1) : '0.0' },
    { nombre: 'Nutrición', total: totales.nutricion, pct: totalGeneral > 0 ? ((totales.nutricion / totalGeneral) * 100).toFixed(1) : '0.0' },
    { nombre: 'Psicología', total: totales.psicologia, pct: totalGeneral > 0 ? ((totales.psicologia / totalGeneral) * 100).toFixed(1) : '0.0' }
  ].sort((a, b) => b.total - a.total);

  const topEspecialidad = desgloseEspecialidades[0];

  const pctFemenino = totalGeneral > 0 ? ((totales.sexo_f / totalGeneral) * 100).toFixed(1) : '0.0';
  const pctMasculino = totalGeneral > 0 ? ((totales.sexo_m / totalGeneral) * 100).toFixed(1) : '0.0';
  const pctAbierta = totalGeneral > 0 ? ((totales.pob_abierta / totalGeneral) * 100).toFixed(1) : '0.0';
  const pctCautiva = totalGeneral > 0 ? ((totales.pob_cautiva / totalGeneral) * 100).toFixed(1) : '0.0';

  return {
    periodo: { anio, mes, total_dias: totalDias },
    dias: listaDias,
    totales,
    resumen_ejecutivo: {
      total_atenciones: totalGeneral,
      top_especialidad: topEspecialidad,
      pct_femenino: pctFemenino,
      pct_masculino: pctMasculino,
      pct_abierta: pctAbierta,
      pct_cautiva: pctCautiva,
      desglose_especialidades: desgloseEspecialidades
    }
  };
}

module.exports = {
  obtenerDatosMensuales
};
