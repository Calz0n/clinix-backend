const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Lista oficial de parentescos permitidos según el esquema municipal
const PARENTESCOS_VALIDOS = ['Madre', 'Padre', 'Tutor Legal', 'Abuelo/a', 'Otro'];

// Función auxiliar para calcular edad exacta en años
function calcularEdad(fechaNacimiento) {
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mes = hoy.getMonth() - fechaNac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  return edad;
}

// 1. GET /api/pacientes (Búsqueda indexada por CURP, Folio o Nombre - RF-01)
router.get('/', async (req, res) => {
  const { q } = req.query;

  try {
    let query = `
      SELECT p.id, p.numero_expediente, p.curp, p.nombres, p.apellido_paterno, p.apellido_materno,
             p.fecha_nacimiento, p.sexo, p.telefono, p.derechohabiencia, p.colonia, p.fecha_registro,
             t.id as tutor_id, t.nombre_completo as tutor_nombre, t.parentesco as tutor_parentesco,
             t.telefono_contacto as tutor_telefono, t.tipo_identificacion as tutor_tipo_id
      FROM pacientes p
      LEFT JOIN tutores t ON p.id = t.paciente_id
    `;
    const params = [];

    if (q && q.trim() !== '') {
      query += `
        WHERE p.curp ILIKE $1 
           OR p.numero_expediente ILIKE $1 
           OR (p.nombres || ' ' || p.apellido_paterno || ' ' || COALESCE(p.apellido_materno, '')) ILIKE $1
        ORDER BY p.fecha_registro DESC
        LIMIT 20
      `;
      params.push(`%${q.trim()}%`);
    } else {
      query += ` ORDER BY p.fecha_registro DESC LIMIT 20`;
    }

    const result = await db.query(query, params);

    const pacientes = result.rows.map(pac => {
      const edad = calcularEdad(pac.fecha_nacimiento);
      return {
        ...pac,
        edad,
        es_menor: edad < 18
      };
    });

    res.json(pacientes);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar pacientes: ' + err.message });
  }
});

// 2. GET /api/pacientes/:id (Detalle completo del paciente, tutor e historial)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pacienteRes = await db.query(`
      SELECT p.*, t.id as tutor_id, t.nombre_completo as tutor_nombre, t.parentesco as tutor_parentesco,
             t.telefono_contacto as tutor_telefono, t.tipo_identificacion as tutor_tipo_id, t.numero_identificacion as tutor_num_id
      FROM pacientes p
      LEFT JOIN tutores t ON p.id = t.paciente_id
      WHERE p.id = $1
    `, [id]);

    if (pacienteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }

    const pac = pacienteRes.rows[0];
    const edad = calcularEdad(pac.fecha_nacimiento);

    const atencionesRes = await db.query(`
      SELECT a.id, a.fecha_hora_ingreso, a.tipo_atencion, a.estado,
             u.nombre || ' ' || u.apellidos as recepcionista_nombre
      FROM atenciones_clinicas a
      JOIN usuarios u ON a.usuario_recepcion_id = u.id
      WHERE a.paciente_id = $1
      ORDER BY a.fecha_hora_ingreso DESC
    `, [id]);

    res.json({
      ...pac,
      edad,
      es_menor: edad < 18,
      tutor: pac.tutor_id ? {
        id: pac.tutor_id,
        nombre_completo: pac.tutor_nombre,
        parentesco: pac.tutor_parentesco,
        telefono_contacto: pac.tutor_telefono,
        tipo_identificacion: pac.tutor_tipo_id,
        numero_identificacion: pac.tutor_num_id
      } : null,
      historial_atenciones: atencionesRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener expediente: ' + err.message });
  }
});

// 3. POST /api/pacientes (Alta con candado estricto para menores de 18 años)
router.post('/', requireRoles('RECEPCION', 'DIRECCION'), async (req, res) => {
  const {
    numero_expediente,
    nombres,
    apellido_paterno,
    apellido_materno,
    curp,
    fecha_nacimiento,
    sexo,
    estado_civil,
    escolaridad,
    calle_numero,
    colonia,
    codigo_postal,
    telefono,
    derechohabiencia,
    enfermedades_previas,
    beneficiario_programa,
    nombre_programa,
    num_personas_vivienda,
    tutor // { nombre_completo, parentesco, telefono_contacto, tipo_identificacion, numero_identificacion }
  } = req.body;

  // Validación de campos obligatorios básicos
  if (!nombres || !apellido_paterno || !curp || !fecha_nacimiento || !sexo || !calle_numero || !colonia || !derechohabiencia) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el registro del paciente.' });
  }

  const curpLimpia = curp.toUpperCase().trim();
  if (curpLimpia.length !== 18) {
    return res.status(400).json({ error: 'La CURP debe tener exactamente 18 caracteres.' });
  }

  const edad = calcularEdad(fecha_nacimiento);

  // REGLA CLÍNICA Y LEGAL CRÍTICA: RF-01.1
  if (edad < 18) {
    if (!tutor || !tutor.nombre_completo || !tutor.parentesco || !tutor.telefono_contacto || !tutor.tipo_identificacion) {
      return res.status(400).json({
        error: `Regla de Negocio RF-01.1 (Protección de Menores): El paciente tiene ${edad} años. Es obligatorio registrar los datos completos del tutor legal (nombre_completo, parentesco, telefono_contacto y tipo_identificacion).`,
        es_menor: true,
        edad_calculada: edad
      });
    }

    if (!PARENTESCOS_VALIDOS.includes(tutor.parentesco)) {
      return res.status(400).json({
        error: `Parentesco del tutor no permitido: "${tutor.parentesco}". Valores autorizados: ${PARENTESCOS_VALIDOS.join(', ')}`
      });
    }
  }

  const expFinal = numero_expediente || `EXP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
  const unidadMedicaId = req.user.unidad_medica_id || 1;
  const usuarioRecepcionId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // A. Registrar Paciente
    const insertPacQuery = `
      INSERT INTO pacientes (
        unidad_medica_id, numero_expediente, nombres, apellido_paterno, apellido_materno,
        curp, fecha_nacimiento, sexo, estado_civil, escolaridad, calle_numero, colonia,
        codigo_postal, telefono, derechohabiencia, enfermedades_previas, beneficiario_programa,
        nombre_programa, num_personas_vivienda
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;
    const pacValues = [
      unidadMedicaId, expFinal, nombres.trim(), apellido_paterno.trim(), apellido_materno ? apellido_materno.trim() : null,
      curpLimpia, fecha_nacimiento, sexo, estado_civil || null, escolaridad || null, calle_numero.trim(), colonia.trim(),
      codigo_postal || null, telefono || null, derechohabiencia, enfermedades_previas || null,
      beneficiario_programa === true, nombre_programa || null, num_personas_vivienda || 1
    ];
    const pacResult = await client.query(insertPacQuery, pacValues);
    const nuevoPaciente = pacResult.rows[0];

    // B. Registrar Tutor si aplica (obligatorio en menores o voluntario en adultos)
    let tutorCreado = null;
    if (tutor && tutor.nombre_completo && tutor.parentesco) {
      const insertTutorQuery = `
        INSERT INTO tutores (paciente_id, nombre_completo, parentesco, telefono_contacto, tipo_identificacion, numero_identificacion)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const tutorValues = [
        nuevoPaciente.id, tutor.nombre_completo.trim(), tutor.parentesco,
        tutor.telefono_contacto.trim(), tutor.tipo_identificacion, tutor.numero_identificacion || null
      ];
      const tutorResult = await client.query(insertTutorQuery, tutorValues);
      tutorCreado = tutorResult.rows[0];
    }

    // C. Apertura de episodio en Triaje
    const insertAtencionQuery = `
      INSERT INTO atenciones_clinicas (paciente_id, unidad_medica_id, usuario_recepcion_id, tipo_atencion, estado)
      VALUES ($1, $2, $3, 'PRIMERA_VEZ', 'TRIAJE')
      RETURNING *
    `;
    const atencionResult = await client.query(insertAtencionQuery, [nuevoPaciente.id, unidadMedicaId, usuarioRecepcionId]);

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Expediente único aperturado exitosamente.',
      paciente: {
        ...nuevoPaciente,
        edad,
        es_menor: edad < 18
      },
      tutor: tutorCreado,
      atencion_inicial: atencionResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      if (err.constraint === 'pacientes_curp_key') {
        return res.status(409).json({ error: 'La CURP ingresada ya existe en el sistema.' });
      }
      if (err.constraint === 'pacientes_numero_expediente_key') {
        return res.status(409).json({ error: 'El número de expediente ya está en uso.' });
      }
    }
    res.status(500).json({ error: 'Error al registrar paciente: ' + err.message });
  } finally {
    client.release();
  }
});

// 4. PUT /api/pacientes/:id/tutor (Actualizar o asignar tutor a un paciente existente)
router.put('/:id/tutor', requireRoles('RECEPCION', 'DIRECCION'), async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, parentesco, telefono_contacto, tipo_identificacion, numero_identificacion } = req.body;

  if (!nombre_completo || !parentesco || !telefono_contacto || !tipo_identificacion) {
    return res.status(400).json({ error: 'Todos los campos del tutor son obligatorios.' });
  }

  if (!PARENTESCOS_VALIDOS.includes(parentesco)) {
    return res.status(400).json({ error: `Parentesco no permitido. Valores autorizados: ${PARENTESCOS_VALIDOS.join(', ')}` });
  }

  try {
    const upsertQuery = `
      INSERT INTO tutores (paciente_id, nombre_completo, parentesco, telefono_contacto, tipo_identificacion, numero_identificacion)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (paciente_id)
      DO UPDATE SET
        nombre_completo = EXCLUDED.nombre_completo,
        parentesco = EXCLUDED.parentesco,
        telefono_contacto = EXCLUDED.telefono_contacto,
        tipo_identificacion = EXCLUDED.tipo_identificacion,
        numero_identificacion = EXCLUDED.numero_identificacion
      RETURNING *
    `;
    const result = await db.query(upsertQuery, [
      id, nombre_completo.trim(), parentesco, telefono_contacto.trim(), tipo_identificacion.trim(), numero_identificacion || null
    ]);

    res.json({
      mensaje: 'Datos del tutor legal actualizados exitosamente.',
      tutor: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar tutor: ' + err.message });
  }
});

module.exports = router;
