import subprocess, glob

# 1. Update src/index.js to create and seed oms_referencia_imc in PostgreSQL
with open("src/index.js", "r", encoding="utf-8") as f:
    idx_code = f.read()

old_mig = """// Migraciones automáticas seguras para soporte de Invitaciones y Activación
async function inicializarMigraciones() {
  try {
    await db.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_activacion VARCHAR(255);
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_expiracion TIMESTAMP;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS turno VARCHAR(30);
      ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;
    `);
    console.log('[DB] Migraciones de activación y tokens verificadas exitosamente.');
  } catch (err) {
    console.warn('[DB WARNING] No se ejecutaron migraciones automáticas:', err.message);
  }
}"""

new_mig = """// Migraciones automáticas seguras para soporte de Invitaciones, Activación y Tablas Normativas OMS
async function inicializarMigraciones() {
  try {
    await db.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_activacion VARCHAR(255);
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_expiracion TIMESTAMP;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS turno VARCHAR(30);
      ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;

      CREATE TABLE IF NOT EXISTS oms_referencia_imc (
        edad INT NOT NULL,
        sexo VARCHAR(1) NOT NULL,
        sd_menos_3 NUMERIC(5,2) NOT NULL,
        sd_menos_2 NUMERIC(5,2) NOT NULL,
        sd_menos_1 NUMERIC(5,2) NOT NULL,
        mediana NUMERIC(5,2) NOT NULL,
        sd_mas_1 NUMERIC(5,2) NOT NULL,
        sd_mas_2 NUMERIC(5,2) NOT NULL,
        sd_mas_3 NUMERIC(5,2) NOT NULL,
        PRIMARY KEY (edad, sexo)
      );

      INSERT INTO oms_referencia_imc (edad, sexo, sd_menos_3, sd_menos_2, sd_menos_1, mediana, sd_mas_1, sd_mas_2, sd_mas_3) VALUES
        (5, 'F', 11.8, 12.7, 13.9, 15.3, 16.9, 18.9, 21.5),
        (6, 'F', 11.9, 12.8, 14.0, 15.5, 17.3, 19.6, 22.6),
        (7, 'F', 12.0, 12.9, 14.2, 15.8, 17.8, 20.3, 23.7),
        (8, 'F', 12.1, 13.1, 14.4, 16.2, 18.3, 21.0, 24.8),
        (9, 'F', 12.3, 13.3, 14.8, 16.7, 19.0, 22.1, 26.5),
        (10, 'F', 12.5, 13.6, 15.2, 17.2, 19.8, 23.2, 28.2),
        (11, 'F', 12.8, 14.0, 15.7, 17.9, 20.7, 24.5, 30.0),
        (12, 'F', 13.2, 14.5, 16.3, 18.7, 21.7, 25.8, 31.8),
        (13, 'F', 13.6, 15.0, 16.9, 19.4, 22.6, 26.8, 33.0),
        (14, 'F', 14.0, 15.5, 17.5, 20.1, 23.4, 27.7, 34.0),
        (15, 'F', 14.4, 16.0, 18.1, 20.8, 24.2, 28.6, 35.0),
        (16, 'F', 14.5, 16.2, 18.3, 21.0, 24.5, 28.9, 35.4),
        (17, 'F', 14.6, 16.3, 18.5, 21.2, 24.7, 29.2, 35.8),
        (18, 'F', 14.7, 16.4, 18.6, 21.3, 24.9, 29.5, 36.1),
        (19, 'F', 14.8, 16.5, 18.7, 21.4, 25.0, 29.7, 36.3),
        (5, 'M', 12.1, 13.0, 14.1, 15.3, 16.6, 18.3, 20.5),
        (6, 'M', 12.2, 13.1, 14.2, 15.5, 17.0, 19.0, 21.6),
        (7, 'M', 12.3, 13.2, 14.3, 15.7, 17.4, 19.7, 22.8),
        (8, 'M', 12.4, 13.3, 14.5, 16.0, 17.9, 20.5, 24.0),
        (9, 'M', 12.6, 13.5, 14.8, 16.4, 18.4, 21.3, 25.4),
        (10, 'M', 12.8, 13.8, 15.1, 16.8, 19.0, 22.2, 26.8),
        (11, 'M', 13.1, 14.1, 15.5, 17.4, 19.9, 23.4, 28.5),
        (12, 'M', 13.4, 14.5, 16.0, 18.0, 20.8, 24.6, 30.2),
        (13, 'M', 13.7, 14.9, 16.6, 18.7, 21.6, 25.6, 31.7),
        (14, 'M', 14.0, 15.4, 17.2, 19.4, 22.4, 26.6, 33.2),
        (15, 'M', 14.4, 15.9, 17.8, 20.2, 23.3, 27.7, 34.8),
        (16, 'M', 14.8, 16.4, 18.3, 20.8, 23.9, 28.3, 35.2),
        (17, 'M', 15.2, 16.8, 18.8, 21.3, 24.5, 28.9, 35.6),
        (18, 'M', 15.7, 17.3, 19.3, 21.9, 25.1, 29.5, 36.0),
        (19, 'M', 15.9, 17.5, 19.5, 22.2, 25.4, 29.8, 36.3)
      ON CONFLICT (edad, sexo) DO NOTHING;
    `);
    console.log('[DB] Migraciones y tablas normativas OMS verificadas exitosamente.');
  } catch (err) {
    console.warn('[DB WARNING] No se ejecutaron migraciones automáticas:', err.message);
  }
}"""

assert old_mig in idx_code, "old_mig not found in src/index.js"
idx_code = idx_code.replace(old_mig, new_mig)
with open("src/index.js", "w", encoding="utf-8") as f:
    f.write(idx_code)
print("Updated src/index.js with oms_referencia_imc migration")

# 2. Update src/routes/nutricion.routes.js to query oms_referencia_imc from PostgreSQL
with open("src/routes/nutricion.routes.js", "r", encoding="utf-8") as f:
    nut_code = f.read()

old_oms_fn = """// Función auxiliar para determinar z-score y percentil estimado OMS según IMC y edad
function calcularMetricasOMS(edad, sexo, imc, peso, talla) {
  // Rango de edad OMS
  const rango_edad_oms = edad <= 5 ? '2_A_5_ANOS' : '5_A_19_ANOS';
  
  // Puntuación Z aproximada para IMC infantil según tablas de referencia de la OMS
  // Para niños de 7 años, la mediana OMS es aprox 15.5 kg/m2 con DE de 1.5
  const medianaIMC = edad === 7 ? 15.5 : (14.0 + (edad * 0.3));
  const desvEstandar = 1.6;
  const zscore_imc_edad = parseFloat(((imc - medianaIMC) / desvEstandar).toFixed(2));
  
  // Mediana de peso y talla
  const medianaPeso = edad === 7 ? 23.0 : (10.0 + (edad * 2.2));
  const zscore_peso_edad = parseFloat(((peso - medianaPeso) / 3.0).toFixed(2));
  
  const medianaTalla = edad === 7 ? 1.22 : (0.85 + (edad * 0.05));
  const zscore_talla_edad = parseFloat(((talla - medianaTalla) / 0.06).toFixed(2));

  // Estimación de percentil a partir del Z-score
  let percentil = 50;
  if (zscore_imc_edad <= -2) percentil = 3;
  else if (zscore_imc_edad <= -1) percentil = 15;
  else if (zscore_imc_edad < 1) percentil = 50;
  else if (zscore_imc_edad < 2) percentil = 85;
  else percentil = 97;

  return {
    rango_edad_oms,
    zscore_imc_edad,
    zscore_peso_edad,
    zscore_talla_edad,
    percentil_calculado: percentil
  };
}"""

new_oms_fn = """// Función asíncrona que consulta la tabla normativa oms_referencia_imc en PostgreSQL para calcular Z-score y percentil OMS
async function calcularMetricasOMS(queryRunner, edad, sexo, imc, peso, talla) {
  const rango_edad_oms = edad <= 5 ? '2_A_5_ANOS' : '5_A_19_ANOS';
  const sexoNorm = (sexo === 'F' || sexo === 'Fem.' || sexo === 'Femenino') ? 'F' : 'M';

  let medianaIMC = 14.0 + (edad * 0.3);
  let desvEstandar = 1.6;

  try {
    const refRes = await queryRunner.query(
      'SELECT * FROM oms_referencia_imc WHERE sexo = $1 ORDER BY ABS(edad - $2) ASC LIMIT 1',
      [sexoNorm, Math.max(5, Math.min(19, edad))]
    );
    if (refRes.rows.length > 0) {
      const r = refRes.rows[0];
      medianaIMC = parseFloat(r.mediana);
      desvEstandar = Math.max(0.5, imc >= medianaIMC
        ? parseFloat(r.sd_mas_1) - medianaIMC
        : medianaIMC - parseFloat(r.sd_menos_1));
    }
  } catch (_) {}

  const zscore_imc_edad = parseFloat(((imc - medianaIMC) / desvEstandar).toFixed(2));
  const medianaPeso = 10.0 + (edad * 2.2);
  const zscore_peso_edad = parseFloat(((peso - medianaPeso) / 3.0).toFixed(2));
  const medianaTalla = 0.85 + (edad * 0.05);
  const zscore_talla_edad = parseFloat(((talla - medianaTalla) / 0.06).toFixed(2));

  let percentil = 50;
  if (zscore_imc_edad <= -3) percentil = 1;
  else if (zscore_imc_edad <= -2) percentil = 3;
  else if (zscore_imc_edad <= -1) percentil = 15;
  else if (zscore_imc_edad < 1) percentil = 50;
  else if (zscore_imc_edad < 2) percentil = 85;
  else if (zscore_imc_edad < 3) percentil = 97;
  else percentil = 99;

  return {
    rango_edad_oms,
    zscore_imc_edad,
    zscore_peso_edad,
    zscore_talla_edad,
    percentil_calculado: percentil
  };
}

// GET /api/nutricion/oms-referencia (Consulta SQL de curvas normativas OMS 5-19 años desde PostgreSQL)
router.get('/oms-referencia', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT edad, sexo, sd_menos_3, sd_menos_2, sd_menos_1, mediana, sd_mas_1, sd_mas_2, sd_mas_3 FROM oms_referencia_imc ORDER BY sexo ASC, edad ASC'
    );
    const ninas = {};
    const ninos = {};
    for (const row of result.rows) {
      const item = {
        edad: Number(row.edad),
        sdMenos3: Number(row.sd_menos_3),
        sdMenos2: Number(row.sd_menos_2),
        sdMenos1: Number(row.sd_menos_1),
        mediana: Number(row.mediana),
        sdMas1: Number(row.sd_mas_1),
        sdMas2: Number(row.sd_mas_2),
        sdMas3: Number(row.sd_mas_3),
      };
      if (row.sexo === 'F') {
        ninas[row.edad] = item;
      } else {
        ninos[row.edad] = item;
      }
    }
    res.json({ ninas, ninos, total_registros: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar tablas de referencia OMS en base de datos: ' + err.message });
  }
});"""

assert old_oms_fn in nut_code, "old_oms_fn not found in src/routes/nutricion.routes.js"
nut_code = nut_code.replace(old_oms_fn, new_oms_fn)
nut_code = nut_code.replace(
    """      const metricas = calcularMetricasOMS(
        edad,
        pacienteInfo.sexo,
        parseFloat(pacienteInfo.imc),
        parseFloat(pacienteInfo.peso_kg),
        parseFloat(pacienteInfo.talla_metros)
      );""",
    """      const metricas = await calcularMetricasOMS(
        client,
        edad,
        pacienteInfo.sexo,
        parseFloat(pacienteInfo.imc),
        parseFloat(pacienteInfo.peso_kg),
        parseFloat(pacienteInfo.talla_metros)
      );"""
)

with open("src/routes/nutricion.routes.js", "w", encoding="utf-8") as f:
    f.write(nut_code)
print("Updated src/routes/nutricion.routes.js with SQL OMS reference queries")

# 3. Enhance /api/estadisticas/tablero-resumen in src/routes/estadisticas.routes.js
with open("src/routes/estadisticas.routes.js", "r", encoding="utf-8") as f:
    est_code = f.read()

old_tablero = """router.get('/tablero-resumen', async (req, res) => {
  try {
    const [
      atencionesHoyRes,
      personalActivoRes,
      clinicasActivasRes,
      pacientesTotalRes,
      desgloseAreasRes
    ] = await Promise.all([
      db.query("SELECT COUNT(*) FROM atenciones_clinicas WHERE fecha_hora_ingreso >= CURRENT_DATE AND fecha_hora_ingreso < CURRENT_DATE + INTERVAL '1 day'"),
      db.query("SELECT COUNT(*) FROM usuarios WHERE activo = true"),
      db.query("SELECT COUNT(*) FROM unidades_medicas WHERE activo = true"),
      db.query("SELECT COUNT(*) FROM pacientes"),
      db.query(`
        SELECT COALESCE(area_servicio, 'Medicina General') as area, COUNT(*) as total
        FROM atenciones_clinicas
        WHERE fecha_hora_ingreso >= CURRENT_DATE AND fecha_hora_ingreso < CURRENT_DATE + INTERVAL '1 day'
        GROUP BY area_servicio
      `)
    ]);

    res.json({
      atenciones_hoy: parseInt(atencionesHoyRes.rows[0].count, 10),
      personal_activo: parseInt(personalActivoRes.rows[0].count, 10),
      clinicas_activas: parseInt(clinicasActivasRes.rows[0].count, 10),
      total_pacientes: parseInt(pacientesTotalRes.rows[0].count, 10),
      desglose_hoy: desgloseAreasRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen de tablero: ' + err.message });
  }
});"""

new_tablero = """router.get('/tablero-resumen', async (req, res) => {
  try {
    const [
      atencionesHoyRes,
      tiposHoyRes,
      atencionesMesRes,
      personalActivoRes,
      clinicasActivasRes,
      pacientesTotalRes,
      desgloseAreasRes,
      desgloseMesRes,
      prodMedicosRes,
      topCieRes
    ] = await Promise.all([
      db.query("SELECT COUNT(*) FROM atenciones_clinicas WHERE fecha_hora_ingreso >= CURRENT_DATE AND fecha_hora_ingreso < CURRENT_DATE + INTERVAL '1 day'"),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE tipo_atencion = 'PRIMERA_VEZ') AS primera_vez_hoy,
          COUNT(*) FILTER (WHERE tipo_atencion <> 'PRIMERA_VEZ') AS subsecuentes_hoy
        FROM atenciones_clinicas
        WHERE fecha_hora_ingreso >= CURRENT_DATE AND fecha_hora_ingreso < CURRENT_DATE + INTERVAL '1 day'
      `),
      db.query(`
        SELECT
          COUNT(*) AS total_mes,
          COUNT(*) FILTER (WHERE tipo_atencion = 'PRIMERA_VEZ') AS primera_vez_mes,
          COUNT(*) FILTER (WHERE tipo_atencion <> 'PRIMERA_VEZ') AS subsecuentes_mes
        FROM atenciones_clinicas
        WHERE DATE_TRUNC('month', fecha_hora_ingreso) = DATE_TRUNC('month', CURRENT_DATE)
      `),
      db.query("SELECT COUNT(*) FROM usuarios WHERE activo = true"),
      db.query("SELECT COUNT(*) FROM unidades_medicas WHERE activo = true"),
      db.query("SELECT COUNT(*) FROM pacientes"),
      db.query(`
        SELECT COALESCE(area_servicio, 'Medicina General') as area, COUNT(*)::INT as total
        FROM atenciones_clinicas
        WHERE fecha_hora_ingreso >= CURRENT_DATE AND fecha_hora_ingreso < CURRENT_DATE + INTERVAL '1 day'
        GROUP BY area_servicio
      `),
      db.query(`
        SELECT COALESCE(area_servicio, 'Medicina General') as area, COUNT(*)::INT as total
        FROM atenciones_clinicas
        WHERE DATE_TRUNC('month', fecha_hora_ingreso) = DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY area_servicio
      `),
      db.query(`
        SELECT
          u.nombre || ' ' || u.apellidos AS medico,
          cb.area_medica AS area,
          COUNT(cb.id) FILTER (WHERE ac.tipo_atencion = 'PRIMERA_VEZ')::INT AS primera_vez,
          COUNT(cb.id) FILTER (WHERE ac.tipo_atencion <> 'PRIMERA_VEZ')::INT AS subsecuente,
          COUNT(cb.id)::INT AS total
        FROM consultas_base cb
        JOIN usuarios u ON cb.especialista_id = u.id
        JOIN atenciones_clinicas ac ON cb.atencion_id = ac.id
        WHERE DATE_TRUNC('month', cb.fecha_hora) = DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY u.id, u.nombre, u.apellidos, cb.area_medica
        ORDER BY total DESC
      `),
      db.query(`
        SELECT
          COALESCE(cm.diagnostico_cie10, 'Z00.0') AS cie10,
          COALESCE(cm.diagnostico_descripcion, cb.motivo_consulta) AS diagnostico,
          cb.area_medica AS area,
          COUNT(*)::INT AS total
        FROM consultas_base cb
        LEFT JOIN consultas_medicina_general cm ON cm.consulta_id = cb.id
        WHERE DATE_TRUNC('month', cb.fecha_hora) = DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY COALESCE(cm.diagnostico_cie10, 'Z00.0'), COALESCE(cm.diagnostico_descripcion, cb.motivo_consulta), cb.area_medica
        ORDER BY total DESC
        LIMIT 10
      `)
    ]);

    res.json({
      atenciones_hoy: parseInt(atencionesHoyRes.rows[0].count, 10),
      primera_vez_hoy: parseInt(tiposHoyRes.rows[0]?.primera_vez_hoy || '0', 10),
      subsecuentes_hoy: parseInt(tiposHoyRes.rows[0]?.subsecuentes_hoy || '0', 10),
      productividad_mes: parseInt(atencionesMesRes.rows[0]?.total_mes || '0', 10),
      primera_vez_mes: parseInt(atencionesMesRes.rows[0]?.primera_vez_mes || '0', 10),
      subsecuentes_mes: parseInt(atencionesMesRes.rows[0]?.subsecuentes_mes || '0', 10),
      personal_activo: parseInt(personalActivoRes.rows[0].count, 10),
      clinicas_activas: parseInt(clinicasActivasRes.rows[0].count, 10),
      total_pacientes: parseInt(pacientesTotalRes.rows[0].count, 10),
      desglose_hoy: desgloseAreasRes.rows,
      desglose_mes: desgloseMesRes.rows,
      productividad_medicos_mes: prodMedicosRes.rows,
      top_diagnosticos_mes: topCieRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen de tablero: ' + err.message });
  }
});"""

assert old_tablero in est_code, "old_tablero not found in src/routes/estadisticas.routes.js"
est_code = est_code.replace(old_tablero, new_tablero)
with open("src/routes/estadisticas.routes.js", "w", encoding="utf-8") as f:
    f.write(est_code)
print("Updated src/routes/estadisticas.routes.js with comprehensive SQL aggregations")

for f in sorted(glob.glob("src/**/*.js", recursive=True)):
    res = subprocess.run(["node", "--check", f], capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Syntax error in {f}: {res.stderr}")
print("All backend JS files verified with node --check!")
