const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

// Plantillas legales estandarizadas por grupo de edad (NOM-004-SSA3-2012 y LGPDPPSO)
const PLANTILLAS_CONSENTIMIENTO = {
  INFANTIL: {
    grupo_edad: 'INFANTIL',
    requiere_tutor: true,
    titulo: 'Consentimiento Informado para Atención Psicológica Infantil',
    texto_legal: 'Por medio del presente documento, en mi calidad de madre, padre o tutor legal del paciente menor de edad, otorgo mi consentimiento libre, informado y expreso para la valoración, evaluación diagnóstica e intervención psicológica del menor en la Dirección de Salud Pública Municipal de Coatzacoalcos, Veracruz, garantizando la confidencialidad de la información salvo riesgo inminente a su integridad física o emocional.'
  },
  ADOLESCENTE: {
    grupo_edad: 'ADOLESCENTE',
    requiere_tutor: true,
    titulo: 'Consentimiento y Asentimiento Informado para Atención de Adolescentes',
    texto_legal: 'En calidad de tutor legal autorizo la intervención psicoterapéutica y, conjuntamente, el paciente adolescente asiente de manera voluntaria participar en el proceso, reconociendo el espacio de escucha ética, respeto y confidencialidad para su bienestar integral.'
  },
  ADULTO: {
    grupo_edad: 'ADULTO',
    requiere_tutor: false,
    titulo: 'Consentimiento Informado para Atención Psicológica de Adultos',
    texto_legal: 'Otorgo voluntariamente mi consentimiento para recibir atención y acompañamiento psicológico en la Dirección de Salud Pública Municipal de Coatzacoalcos, conociendo el encuadre de las sesiones, objetivos terapéuticos y el derecho a la confidencialidad estricta y protección de mis datos personales sensibles.'
  }
};

// 1. GET /api/psicologia/plantilla-consentimiento/:grupo_edad
router.get('/plantilla-consentimiento/:grupo_edad', (req, res) => {
  const grupo = (req.params.grupo_edad || '').toUpperCase();
  const plantilla = PLANTILLAS_CONSENTIMIENTO[grupo];

  if (!plantilla) {
    return res.status(400).json({
      error: 'Grupo de edad inválido. Valores permitidos: INFANTIL, ADOLESCENTE, ADULTO.'
    });
  }

  res.json(plantilla);
});

// 2. POST /api/psicologia (Registrar consulta y consentimiento informado)
router.post('/', authenticateToken, requireRoles('PSICOLOGO', 'DIRECCION'), async (req, res) => {
  const {
    atencion_id,
    motivo_consulta,
    observaciones,
    evaluacion_clinica,
    nota_evolucion,
    plan_intervencion,
    consentimiento // { grupo_edad, texto_legal, firmado, tutor_id }
  } = req.body;

  if (!atencion_id || !motivo_consulta || !evaluacion_clinica || !nota_evolucion || !plan_intervencion) {
    return res.status(400).json({
      error: 'Campos obligatorios incompletos: atencion_id, motivo_consulta, evaluacion_clinica, nota_evolucion y plan_intervencion son requeridos.'
    });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 2.1 Obtener paciente_id a partir de la atención clínica
    const atencionRes = await client.query('SELECT paciente_id FROM atenciones_clinicas WHERE id = $1', [atencion_id]);
    if (atencionRes.rows.length === 0) {
      throw new Error(`La atención clínica con ID ${atencion_id} no existe.`);
    }
    const pacienteId = atencionRes.rows[0].paciente_id;

    // 2.2 Registrar en consultas_base
    const baseRes = await client.query(`
      INSERT INTO consultas_base (atencion_id, especialista_id, area_medica, motivo_consulta, observaciones)
      VALUES ($1, $2, 'PSICOLOGIA', $3, $4)
      RETURNING id, fecha_hora
    `, [atencion_id, req.user.id, motivo_consulta, observaciones || null]);
    const consultaId = baseRes.rows[0].id;

    // 2.3 Registrar datos especializados en consultas_psicologia
    const psicoRes = await client.query(`
      INSERT INTO consultas_psicologia (consulta_id, evaluacion_clinica, nota_evolucion, plan_intervencion)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [consultaId, evaluacion_clinica, nota_evolucion, plan_intervencion]);
    const consultaPsicoId = psicoRes.rows[0].id;

    // 2.4 Registrar consentimiento informado si se incluye en la consulta
    let consentimientoId = null;
    if (consentimiento && consentimiento.grupo_edad) {
      const grupoNormalizado = consentimiento.grupo_edad.toUpperCase();
      const textoDefecto = PLANTILLAS_CONSENTIMIENTO[grupoNormalizado]?.texto_legal || 'Consentimiento general de atención psicológica';

      const consentRes = await client.query(`
        INSERT INTO consentimientos_informados (
          consulta_id, paciente_id, tutor_id, grupo_edad, texto_legal, firmado
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, firmado, fecha_firma
      `, [
        consultaId,
        pacienteId,
        consentimiento.tutor_id || null,
        grupoNormalizado,
        consentimiento.texto_legal || textoDefecto,
        Boolean(consentimiento.firmado)
      ]);
      consentimientoId = consentRes.rows[0].id;
    }

    // 2.5 Actualizar estado de la atención a FINALIZADA
    await client.query(`
      UPDATE atenciones_clinicas
      SET estado = 'FINALIZADA'
      WHERE id = $1
    `, [atencion_id]);

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Consulta psicológica y consentimiento informado registrados exitosamente.',
      consulta_id: consultaId,
      consulta_psicologia_id: consultaPsicoId,
      consentimiento_id: consentimientoId,
      estado_atencion: 'FINALIZADA'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar consulta psicológica: ' + error.message });
  } finally {
    client.release();
  }
});

// 3. GET /api/psicologia/consulta/:id (Lectura integral del expediente)
router.get('/consulta/:id', authenticateToken, async (req, res) => {
  try {
    const consultaRes = await db.query(`
      SELECT cb.id as consulta_id, cb.fecha_hora, cb.motivo_consulta, cb.observaciones,
             cp.evaluacion_clinica, cp.nota_evolucion, cp.plan_intervencion,
             u.nombre as psicologo_nombre, u.apellidos as psicologo_apellidos,
             ci.id as consentimiento_id, ci.grupo_edad, ci.firmado as consentimiento_firmado,
             ci.fecha_firma, ci.texto_legal,
             p.nombres as paciente_nombres, p.apellido_paterno as paciente_apellido_paterno, p.numero_expediente
      FROM consultas_base cb
      JOIN consultas_psicologia cp ON cp.consulta_id = cb.id
      JOIN usuarios u ON u.id = cb.especialista_id
      JOIN atenciones_clinicas ac ON ac.id = cb.atencion_id
      JOIN pacientes p ON p.id = ac.paciente_id
      LEFT JOIN consentimientos_informados ci ON ci.consulta_id = cb.id
      WHERE cb.id = $1
    `, [req.params.id]);

    if (consultaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Consulta psicológica no encontrada.' });
    }

    res.json(consultaRes.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
