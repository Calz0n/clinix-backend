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
router.get('/pendientes', requireRoles('MEDICO_GENERAL', 'ODONTOLOGO', 'NUTRIOLOGO', 'PSICOLOGO', 'DIRECCION'), async (req, res) => {
  try {
    const query = `
      SELECT a.id as atencion_id, a.fecha_hora_ingreso, a.tipo_atencion, a.estado,
             p.id as paciente_id, p.numero_expediente, p.curp, p.nombres, p.apellido_paterno, p.apellido_materno,
             p.fecha_nacimiento, p.sexo, p.derechohabiencia, p.enfermedades_previas,
             t.id as triaje_id, t.tension_arterial, t.frecuencia_cardiaca, t.frecuencia_respiratoria,
             t.temperatura, t.saturacion_oxigeno, t.glucosa_capilar, t.peso_kg, t.talla_metros, t.imc,
             t.clasificacion_imc, t.detecciones_riesgo
      FROM atenciones_clinicas a
      JOIN pacientes p ON a.paciente_id = p.id
      LEFT JOIN triaje_signos_vitales t ON a.id = t.atencion_id
      WHERE a.estado = 'EN_CONSULTA' AND DATE(a.fecha_hora_ingreso) = CURRENT_DATE
      ORDER BY a.fecha_hora_ingreso ASC
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
    res.status(500).json({ error: 'Error al consultar lista de espera de consulta: ' + err.message });
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

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Validar estado de la atención clínica
    const atencionRes = await client.query(
      'SELECT id, paciente_id, estado FROM atenciones_clinicas WHERE id = $1',
      [atencion_id]
    );

    if (atencionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'La atención clínica especificada no existe.' });
    }

    if (atencionRes.rows[0].estado !== 'EN_CONSULTA') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `La atención no se encuentra lista para consulta (Estado actual: ${atencionRes.rows[0].estado}).`
      });
    }

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
    await client.query(
      "UPDATE atenciones_clinicas SET estado = 'FINALIZADA' WHERE id = $1",
      [atencion_id]
    );

    // E. Actualizar la bitácora de productividad diaria del médico
    const upsertBitacoraQuery = `
      INSERT INTO bitacora_productividad_diaria (usuario_id, unidad_medica_id, fecha, total_atenciones)
      VALUES ($1, $2, CURRENT_DATE, 1)
      ON CONFLICT (usuario_id, fecha)
      DO UPDATE SET total_atenciones = bitacora_productividad_diaria.total_atenciones + 1
    `;
    await client.query(upsertBitacoraQuery, [medicoId, unidadMedicaId]);

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
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar consulta médica: ' + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
