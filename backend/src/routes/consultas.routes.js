const { obtenerColaConsulta, validarContextoConsulta, finalizarContextoConsulta, responderErrorConsulta, validarDerivacionSalida } = require('../utils/consultaContexto');
const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Catálogo base de diagnósticos CIE-10 frecuentes en atención ambulatoria municipal
const CIE10_FRECUENTES = [
  { codigo: 'J00', descripcion: 'Rinofaringitis aguda (resfriado común)', morbilidad: 'Infecciones Respiratorias Agudas' },
  { codigo: 'J02.9', descripcion: 'Faringitis aguda, no especificada', morbilidad: 'Infecciones Respiratorias Agudas' },
  { codigo: 'J20.9', descripcion: 'Bronquitis aguda, no especificada', morbilidad: 'Infecciones Respiratorias Agudas' },
  { codigo: 'K29.7', descripcion: 'Gastritis, no especificada', morbilidad: 'Enfermedades del Sistema Digestivo' },
  { codigo: 'A09', descripcion: 'Gastroenteritis y colitis de origen infeccioso', morbilidad: 'Enfermedades Infecciosas Intestinales' },
  { codigo: 'I10', descripcion: 'Hipertensión arterial esencial (primaria)', morbilidad: 'Enfermedades Cardiovasculares / Crónicas' },
  { codigo: 'E11.9', descripcion: 'Diabetes mellitus tipo 2 sin mención de complicación', morbilidad: 'Enfermedades Endocrinas / Metabólicas' },
  { codigo: 'N39.0', descripcion: 'Infección de vías urinarias, sitio no especificado', morbilidad: 'Enfermedades del Sistema Genitourinario' },
  { codigo: 'L03.9', descripcion: 'Celulitis / Infección de piel y tejido subcutáneo', morbilidad: 'Enfermedades de la Piel' },
  { codigo: 'M54.5', descripcion: 'Lumbago no especificado / Dolor lumbar', morbilidad: 'Trastornos Musculoesqueléticos' }
];

// 1. GET /api/consultas/catalogo-cie10 (Búsqueda o listado de diagnósticos CIE-10)
router.get('/catalogo-cie10', (req, res) => {
  const { q } = req.query;
  if (q && q.trim() !== '') {
    const term = q.toLowerCase().trim();
    const filtrados = CIE10_FRECUENTES.filter(c => 
      c.codigo.toLowerCase().includes(term) || c.descripcion.toLowerCase().includes(term)
    );
    return res.json(filtrados);
  }
  res.json(CIE10_FRECUENTES);
});

// 2. GET /api/consultas/pendientes (Cola de pacientes en estado EN_CONSULTA con sus signos vitales de triaje)
router.get('/pendientes', requireRoles('MEDICO_GENERAL', 'DIRECCION'), async (req, res) => {
  try {
    res.json(await obtenerColaConsulta(db, 'MEDICINA_GENERAL'));
  } catch (err) {
    console.error('[COLA MEDICINA_GENERAL]', err.code || 'ERROR');
    res.status(503).json({ error: 'No se pudo actualizar la lista de este servicio. Intenta nuevamente.' });
  }
});

// 2.1 GET /api/consultas/atendidos-hoy (Pacientes atendidos en medicina general hoy por turno)
router.get('/atendidos-hoy', requireRoles('MEDICO_GENERAL', 'DIRECCION'), async (req, res) => {
  try {
    const { turno } = req.query;
    let turnoCondition = '';
    if (turno) {
      const tLower = turno.toLowerCase();
      if (tLower.includes('mat')) {
        turnoCondition = ' AND EXTRACT(HOUR FROM cb.fecha_hora) >= 7 AND EXTRACT(HOUR FROM cb.fecha_hora) < 14';
      } else if (tLower.includes('vesp')) {
        turnoCondition = ' AND EXTRACT(HOUR FROM cb.fecha_hora) >= 14 AND EXTRACT(HOUR FROM cb.fecha_hora) < 22';
      }
    }

    const query = `
      SELECT a.id as atencion_id, a.fecha_hora_ingreso, a.tipo_atencion, a.estado, a.area_servicio,
             p.id as paciente_id, p.numero_expediente, p.curp, p.nombres, p.apellido_paterno, p.apellido_materno,
             p.fecha_nacimiento, p.sexo, p.derechohabiencia, p.enfermedades_previas,
             t.tension_arterial, t.frecuencia_cardiaca, t.frecuencia_respiratoria,
             t.temperatura, t.saturacion_oxigeno, t.glucosa_capilar, t.peso_kg, t.talla_metros, t.imc,
             cb.id as consulta_id, cb.fecha_hora as consulta_fecha_hora, cb.motivo_consulta, cb.observaciones,
             cm.diagnostico_cie10, cm.diagnostico_descripcion, cm.clasificacion_morbilidad,
             cm.nota_subjetivo, cm.nota_objetivo, cm.nota_analisis, cm.nota_plan,
             u.nombre || ' ' || u.apellidos as especialista_nombre
      FROM atenciones_clinicas a
      JOIN pacientes p ON a.paciente_id = p.id
      JOIN consultas_base cb ON a.id = cb.atencion_id
      LEFT JOIN triaje_signos_vitales t ON a.id = t.atencion_id
      LEFT JOIN consultas_medicina_general cm ON cb.id = cm.consulta_id
      LEFT JOIN usuarios u ON cb.especialista_id = u.id
      WHERE a.estado = 'FINALIZADA'
        AND cb.area_medica = 'MEDICINA_GENERAL'
        AND cb.fecha_hora >= CURRENT_DATE AND cb.fecha_hora < (CURRENT_DATE + INTERVAL '1 day')
        ${turnoCondition}
      ORDER BY cb.fecha_hora DESC
    `;
    const result = await db.query(query);

    const hoy = new Date();
    const lista = result.rows.map(row => {
      const nac = new Date(row.fecha_nacimiento);
      let edad = hoy.getFullYear() - nac.getFullYear();
      if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
        edad--;
      }
      return { ...row, edad, es_menor: edad < 18 };
    });

    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar atendidos de medicina general: ' + err.message });
  }
});

// 3. GET /api/consultas/historial/:paciente_id (Historial clínico acumulado de notas médicas anteriores)
router.get('/historial/:paciente_id', async (req, res) => {
  const { paciente_id } = req.params;

  try {
    const query = `
      SELECT cb.id as consulta_id, cb.area_medica, cb.fecha_hora, cb.motivo_consulta,
             cm.diagnostico_cie10, cm.diagnostico_descripcion, cm.clasificacion_morbilidad,
             cm.nota_subjetivo, cm.nota_objetivo, cm.nota_analisis, cm.nota_plan,
             cm.pruebas_rapidas, cm.canalizacion_externa, cm.emite_certificado,
             u.nombre || ' ' || u.apellidos as medico_nombre, u.cedula_profesional as medico_cedula
      FROM consultas_base cb
      JOIN atenciones_clinicas ac ON cb.atencion_id = ac.id
      JOIN usuarios u ON cb.especialista_id = u.id
      LEFT JOIN consultas_medicina_general cm ON cb.id = cm.consulta_id
      WHERE ac.paciente_id = $1
      ORDER BY cb.fecha_hora DESC
    `;
    const result = await db.query(query, [paciente_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar historial clínico: ' + err.message });
  }
});

// 4. POST /api/consultas/medicina-general (Registro de Nota SOAP + CIE-10 + Tratamiento Cruzado opcional)
// Roles permitidos: MEDICO_GENERAL o DIRECCION
router.post('/medicina-general', requireRoles('MEDICO_GENERAL', 'DIRECCION'), async (req, res) => {
  const {
    atencion_id,
    motivo_consulta,
    observaciones,
    nota_subjetivo,
    nota_objetivo,
    nota_analisis,
    nota_plan,
    diagnostico_cie10,
    diagnostico_descripcion,
    clasificacion_morbilidad,
    pruebas_rapidas,
    canalizacion_externa,
    emite_certificado,
    tratamiento_cruzado // Objeto opcional: { area_destino, prioridad, motivo_derivacion }
  } = req.body;

  // Validaciones obligatorias de la nota médica bajo la NOM-004-SSA3-2012
  if (!atencion_id || !motivo_consulta || !nota_subjetivo || !nota_objetivo || !nota_analisis || !nota_plan || !diagnostico_cie10 || !diagnostico_descripcion || !clasificacion_morbilidad) {
    return res.status(400).json({
      error: 'La nota clínica SOAP completa (Subjetivo, Objetivo, Análisis, Plan) y el diagnóstico CIE-10 son obligatorios conforme a la NOM-004-SSA3-2012.'
    });
  }

  const medicoId = req.user.id;
  const unidadMedicaId = req.user.unidad_medica_id || 1;

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    const contexto = await validarContextoConsulta(client, req.body, 'MEDICINA_GENERAL');
    validarDerivacionSalida(tratamiento_cruzado, 'MEDICINA_GENERAL');

    // A. Insertar cabecera en consultas_base
    const insertBaseQuery = `
      INSERT INTO consultas_base (atencion_id, especialista_id, area_medica, motivo_consulta, observaciones)
      VALUES ($1, $2, 'MEDICINA_GENERAL', $3, $4)
      RETURNING *
    `;
    const baseResult = await client.query(insertBaseQuery, [
      atencion_id, medicoId, motivo_consulta.trim(), observaciones || null
    ]);
    const consultaBase = baseResult.rows[0];

    // B. Insertar nota médica SOAP especializada
    const insertSoapQuery = `
      INSERT INTO consultas_medicina_general (
        consulta_id, nota_subjetivo, nota_objetivo, nota_analisis, nota_plan,
        diagnostico_cie10, diagnostico_descripcion, clasificacion_morbilidad,
        pruebas_rapidas, canalizacion_externa, emite_certificado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const soapResult = await client.query(insertSoapQuery, [
      consultaBase.id, nota_subjetivo.trim(), nota_objetivo.trim(), nota_analisis.trim(),
      nota_plan.trim(), diagnostico_cie10.trim(), diagnostico_descripcion.trim(),
      clasificacion_morbilidad.trim(), pruebas_rapidas || null, canalizacion_externa || null,
      emite_certificado === true
    ]);
    const consultaSoap = soapResult.rows[0];

    // C. Registrar Tratamiento Cruzado (Interconsulta Interna) si se solicita
    let derivacionCruzada = null;
    if (tratamiento_cruzado && tratamiento_cruzado.area_destino && tratamiento_cruzado.motivo_derivacion) {
      const insertCruzadoQuery = `
        INSERT INTO tratamientos_cruzados (atencion_origen_id, area_origen, area_destino, prioridad, motivo_derivacion, estado)
        VALUES ($1, 'MEDICINA_GENERAL', $2, $3, $4, 'PENDIENTE')
        RETURNING *
      `;
      const cruzadoRes = await client.query(insertCruzadoQuery, [
        atencion_id, tratamiento_cruzado.area_destino, tratamiento_cruzado.prioridad || 'NORMAL',
        tratamiento_cruzado.motivo_derivacion.trim()
      ]);
      derivacionCruzada = cruzadoRes.rows[0];
    }

    // D. Transición de estado: Finalizar la visita médica


    // E. Actualizar la bitácora de productividad diaria del médico
    const upsertBitacoraQuery = `
      INSERT INTO bitacora_productividad_diaria (usuario_id, unidad_medica_id, fecha, total_atenciones)
      VALUES ($1, $2, CURRENT_DATE, 1)
      ON CONFLICT (usuario_id, fecha)
      DO UPDATE SET total_atenciones = bitacora_productividad_diaria.total_atenciones + 1
    `;
    await client.query(upsertBitacoraQuery, [medicoId, unidadMedicaId]);

    await finalizarContextoConsulta(client, contexto);
    await client.query('COMMIT');

    res.status(201).json({
      message: 'Consulta médica registrada con éxito bajo estructura SOAP (NOM-004)',
      consulta: {
        ...consultaBase,
        detalle_medicina_general: consultaSoap
      },
      tratamiento_cruzado: derivacionCruzada,
      estado_atencion: 'FINALIZADA'
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return responderErrorConsulta(res, err, 'MEDICINA_GENERAL');
  } finally {
    if (client) client.release();
  }
});


// 5. GET /api/consultas/datos-certificado/:paciente_id (Auto-llenado inteligente para Certificados de Medicina General y Nutrición)
router.get('/datos-certificado/:paciente_id', async (req, res) => {
  const { paciente_id } = req.params;
  const userId = req.user.id;

  try {
    const [
      folioRes,
      userRes,
      pacRes,
      hcRes,
      triajeRes,
      mgRes,
      nutriRes
    ] = await Promise.all([
      db.query("SELECT COUNT(*)::INT as total FROM consultas_medicina_general WHERE emite_certificado = TRUE"),
      db.query("SELECT nombre, apellidos, cedula_profesional, rol FROM usuarios WHERE id = $1", [userId]),
      db.query(`
        SELECT id, numero_expediente, nombres, apellido_paterno, apellido_materno,
               curp, fecha_nacimiento, sexo, ocupacion, grupo_sanguineo, enfermedades_previas
        FROM pacientes WHERE id = $1
      `, [paciente_id]),
      db.query("SELECT * FROM historias_clinicas WHERE paciente_id = $1 LIMIT 1", [paciente_id]),
      db.query(`
        SELECT t.tension_arterial, t.frecuencia_cardiaca, t.frecuencia_respiratoria,
               t.temperatura, t.saturacion_oxigeno, t.glucosa_capilar,
               t.peso_kg, t.talla_metros, t.imc, t.clasificacion_imc,
               ac.id as atencion_id, ac.tipo_atencion
        FROM triaje_signos_vitales t
        JOIN atenciones_clinicas ac ON ac.id = t.atencion_id
        WHERE ac.paciente_id = $1
        ORDER BY t.fecha_hora DESC
        LIMIT 1
      `, [paciente_id]),
      db.query(`
        SELECT cm.nota_objetivo, cm.diagnostico_cie10, cm.diagnostico_descripcion, cb.motivo_consulta
        FROM consultas_medicina_general cm
        JOIN consultas_base cb ON cb.id = cm.consulta_id
        JOIN atenciones_clinicas ac ON ac.id = cb.atencion_id
        WHERE ac.paciente_id = $1
        ORDER BY cb.fecha_hora DESC
        LIMIT 1
      `, [paciente_id]),
      db.query(`
        SELECT cn.circunferencia_cintura, cn.circunferencia_cadera, cn.consumo_agua_litros,
               cn.frecuencia_ejercicio, cn.recordatorio_24h, cb.observaciones, cb.motivo_consulta
        FROM consultas_nutricion cn
        JOIN consultas_base cb ON cb.id = cn.consulta_id
        JOIN atenciones_clinicas ac ON ac.id = cb.atencion_id
        WHERE ac.paciente_id = $1
        ORDER BY cb.fecha_hora DESC
        LIMIT 1
      `, [paciente_id])
    ]);

    const anioActual = new Date().getFullYear();
    const numCert = (folioRes.rows[0]?.total || 0) + 1;
    const folio = `CM${String(numCert).padStart(3, '0')}--${anioActual}`;

    const prof = userRes.rows[0] || {};
    const pac = pacRes.rows[0] || {};
    const hc = hcRes.rows[0] || {};
    const tri = triajeRes.rows[0] || {};
    const mg = mgRes.rows[0] || {};
    const nut = nutriRes.rows[0] || {};

    // Calcular edad y formatear fecha de nacimiento
    let edad = 0;
    let fechaNacStr = '—';
    if (pac.fecha_nacimiento) {
      const fn = new Date(pac.fecha_nacimiento);
      const hoy = new Date();
      edad = hoy.getFullYear() - fn.getFullYear();
      if (hoy.getMonth() < fn.getMonth() || (hoy.getMonth() === fn.getMonth() && hoy.getDate() < fn.getDate())) {
        edad--;
      }
      fechaNacStr = fn.toISOString().split('T')[0];
    }

    // Construir AHF y APP legibles
    const ahfItems = [];
    if (hc.ahf_diabetes) ahfItems.push('Diabetes Mellitus');
    if (hc.ahf_hipertension) ahfItems.push('Hipertensión Arterial');
    if (hc.ahf_cardiopatias) ahfItems.push('Cardiopatías');
    if (hc.ahf_neoplasias) ahfItems.push('Neoplasias');
    if (hc.ahf_nefropatias) ahfItems.push('Nefropatías');
    if (hc.ahf_otros && hc.ahf_otros.trim()) ahfItems.push(hc.ahf_otros.trim());
    const ahfTexto = ahfItems.length > 0 ? ahfItems.join(', ') : 'Interrogados y negados';

    const appItems = [];
    if (pac.enfermedades_previas && pac.enfermedades_previas.trim() && pac.enfermedades_previas.toLowerCase() !== 'ninguna') {
      appItems.push(pac.enfermedades_previas.trim());
    }
    if (hc.app_cronico_degenerativas && hc.app_cronico_degenerativas.trim()) appItems.push(hc.app_cronico_degenerativas.trim());
    if (hc.app_alergias && hc.app_alergias.trim()) appItems.push(`Alergias: ${hc.app_alergias.trim()}`);
    if (hc.app_quirurgicos && hc.app_quirurgicos.trim()) appItems.push(`Quirúrgicos: ${hc.app_quirurgicos.trim()}`);
    if (hc.app_otros && hc.app_otros.trim()) appItems.push(hc.app_otros.trim());
    const appTexto = appItems.length > 0 ? appItems.join(' | ') : 'Interrogados y negados';

    res.json({
      folio,
      profesional: {
        nombre_completo: `${prof.nombre || ''} ${prof.apellidos || ''}`.trim(),
        cedula_profesional: prof.cedula_profesional || 'En trámite',
        rol: prof.rol || ''
      },
      paciente: {
        id: pac.id,
        numero_expediente: pac.numero_expediente || '—',
        nombre_completo: `${pac.nombres || ''} ${pac.apellido_paterno || ''} ${pac.apellido_materno || ''}`.trim(),
        sexo: pac.sexo || 'M',
        edad,
        fecha_nacimiento: fechaNacStr,
        ocupacion: pac.ocupacion || '—',
        grupo_sanguineo: pac.grupo_sanguineo || 'Desconocido'
      },
      antecedentes: {
        ahf: ahfTexto,
        app: appTexto
      },
      triaje: {
        atencion_id: tri.atencion_id || null,
        tipo_atencion: tri.tipo_atencion || 'PRIMERA_VEZ',
        tension_arterial: tri.tension_arterial || '120/80 mmHg',
        frecuencia_cardiaca: tri.frecuencia_cardiaca != null ? `${tri.frecuencia_cardiaca} lpm` : '74 lpm',
        frecuencia_respiratoria: tri.frecuencia_respiratoria != null ? `${tri.frecuencia_respiratoria} rpm` : '18 rpm',
        temperatura: tri.temperatura != null ? `${tri.temperatura} °C` : '36.5 °C',
        saturacion_oxigeno: tri.saturacion_oxigeno != null ? `${tri.saturacion_oxigeno}%` : '98%',
        peso_kg: tri.peso_kg != null ? String(tri.peso_kg) : '',
        talla_metros: tri.talla_metros != null ? String(tri.talla_metros) : '',
        imc: tri.imc != null ? String(tri.imc) : '',
        clasificacion_imc: tri.clasificacion_imc || ''
      },
      ultima_consulta_mg: {
        ef: mg.nota_objetivo || '',
        diagnostico_cie10: mg.diagnostico_cie10 || 'Z00.0',
        diagnostico_descripcion: mg.diagnostico_descripcion || 'CLÍNICAMENTE SANO'
      },
      ultima_consulta_nutri: {
        cintura: nut.circunferencia_cintura != null ? String(nut.circunferencia_cintura) : '',
        cadera: nut.circunferencia_cadera != null ? String(nut.circunferencia_cadera) : '',
        consumo_agua: nut.consumo_agua_litros != null ? `${nut.consumo_agua_litros} L` : '2.0 L',
        recordatorio_24h: nut.recordatorio_24h || null,
        observaciones: nut.observaciones || ''
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener datos para certificado: ' + err.message });
  }
});

// 6. POST /api/consultas/emitir-certificado (Registra la emisión oficial del Certificado Médico y suma a estadísticas)
router.post('/emitir-certificado', requireRoles('MEDICO_GENERAL', 'DIRECCION'), async (req, res) => {
  const {
    paciente_id,
    atencion_id,
    ef,
    diagnostico,
    ahf,
    app,
    grupo_sanguineo
  } = req.body;

  if (!paciente_id && !atencion_id) {
    return res.status(400).json({ error: 'Se requiere seleccionar un paciente para emitir el certificado médico.' });
  }

  const medicoId = req.user.id;
  const unidadMedicaId = req.user.unidad_medica_id || 1;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Si se envió grupo_sanguineo, actualizarlo en la ficha del paciente si estaba vacío
    if (paciente_id && grupo_sanguineo && grupo_sanguineo.trim() !== '') {
      await client.query(
        "UPDATE pacientes SET grupo_sanguineo = COALESCE(NULLIF(grupo_sanguineo, ''), $1) WHERE id = $2",
        [grupo_sanguineo.trim(), paciente_id]
      );
    }

    // Verificar si ya existe una consulta de medicina general el día de hoy para este paciente/atención
    let consultaMgId = null;
    if (atencion_id) {
      const existingRes = await client.query(`
        SELECT cm.id
        FROM consultas_medicina_general cm
        JOIN consultas_base cb ON cb.id = cm.consulta_id
        WHERE cb.atencion_id = $1
        LIMIT 1
      `, [atencion_id]);
      if (existingRes.rows.length > 0) {
        consultaMgId = existingRes.rows[0].id;
      }
    }

    if (!consultaMgId && paciente_id) {
      const existingTodayRes = await client.query(`
        SELECT cm.id
        FROM consultas_medicina_general cm
        JOIN consultas_base cb ON cb.id = cm.consulta_id
        JOIN atenciones_clinicas ac ON ac.id = cb.atencion_id
        WHERE ac.paciente_id = $1
          AND cb.fecha_hora >= CURRENT_DATE AND cb.fecha_hora < (CURRENT_DATE + INTERVAL '1 day')
        ORDER BY cb.fecha_hora DESC
        LIMIT 1
      `, [paciente_id]);
      if (existingTodayRes.rows.length > 0) {
        consultaMgId = existingTodayRes.rows[0].id;
      }
    }

    if (consultaMgId) {
      await client.query(
        "UPDATE consultas_medicina_general SET emite_certificado = TRUE WHERE id = $1",
        [consultaMgId]
      );
    } else {
      // Crear atención y consulta de certificado médico para que sume en Hoja Diaria y Concentrado Mensual
      let targetAtencionId = atencion_id;
      if (!targetAtencionId) {
        const openAtencionRes = await client.query(`
          SELECT id FROM atenciones_clinicas
          WHERE paciente_id = $1
            AND fecha_hora_ingreso >= CURRENT_DATE AND fecha_hora_ingreso < (CURRENT_DATE + INTERVAL '1 day')
          ORDER BY fecha_hora_ingreso DESC
          LIMIT 1
        `, [paciente_id]);
        if (openAtencionRes.rows.length > 0) {
          targetAtencionId = openAtencionRes.rows[0].id;
          await client.query("UPDATE atenciones_clinicas SET estado = 'FINALIZADA' WHERE id = $1", [targetAtencionId]);
        } else {
          const prevCountRes = await client.query("SELECT COUNT(*)::INT as c FROM atenciones_clinicas WHERE paciente_id = $1", [paciente_id]);
          const tipoAtencion = (prevCountRes.rows[0]?.c || 0) === 0 ? 'PRIMERA_VEZ' : 'SUBSECUENTE';
          const newAtRes = await client.query(`
            INSERT INTO atenciones_clinicas (paciente_id, unidad_medica_id, usuario_recepcion_id, tipo_atencion, estado, area_servicio)
            VALUES ($1, $2, $3, $4, 'FINALIZADA', 'Medicina General')
            RETURNING id
          `, [paciente_id, unidadMedicaId, medicoId, tipoAtencion]);
          targetAtencionId = newAtRes.rows[0].id;
        }
      } else {
        await client.query("UPDATE atenciones_clinicas SET estado = 'FINALIZADA' WHERE id = $1", [targetAtencionId]);
      }

      const baseRes = await client.query(`
        INSERT INTO consultas_base (atencion_id, especialista_id, area_medica, motivo_consulta, observaciones)
        VALUES ($1, $2, 'MEDICINA_GENERAL', 'Expedición de Certificado Médico Oficial', $3)
        RETURNING id
      `, [targetAtencionId, medicoId, `AHF: ${ahf || 'Negados'} | APP: ${app || 'Negados'}`]);

      const diagDesc = (diagnostico && diagnostico.trim()) ? diagnostico.trim() : 'EXAMEN MÉDICO Y EXPEDICIÓN DE CERTIFICADO (SANO)';
      await client.query(`
        INSERT INTO consultas_medicina_general (
          consulta_id, nota_subjetivo, nota_objetivo, nota_analisis, nota_plan,
          diagnostico_cie10, diagnostico_descripcion, clasificacion_morbilidad,
          emite_certificado
        ) VALUES ($1, $2, $3, $4, $5, 'Z02.7', $6, 'Certificado Médico / Sano', TRUE)
      `, [
        baseRes.rows[0].id,
        'Acude para valoración clínica y expedición de certificado médico oficial.',
        (ef && ef.trim()) ? ef.trim() : 'Paciente consciente, orientado, cardiopulmonar y abdomen sin alteraciones.',
        `Z02.7 - ${diagDesc}`,
        'Se expide certificado médico oficial con vigencia de 15 días.',
        diagDesc
      ]);

      await client.query(`
        INSERT INTO bitacora_productividad_diaria (usuario_id, unidad_medica_id, fecha, total_atenciones)
        VALUES ($1, $2, CURRENT_DATE, 1)
        ON CONFLICT (usuario_id, fecha)
        DO UPDATE SET total_atenciones = bitacora_productividad_diaria.total_atenciones + 1
      `, [medicoId, unidadMedicaId]);
    }

    const folioCountRes = await client.query("SELECT COUNT(*)::INT as total FROM consultas_medicina_general WHERE emite_certificado = TRUE");
    const anioActual = new Date().getFullYear();
    const folio = `CM${String(folioCountRes.rows[0]?.total || 1).padStart(3, '0')}--${anioActual}`;

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Certificado médico registrado exitosamente y contabilizado en estadísticas.',
      folio
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar emisión de certificado médico: ' + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
