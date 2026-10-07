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
             p.fecha_nacimiento, p.sexo, p.calle_numero, p.colonia, p.codigo_postal, p.telefono,
             p.derechohabiencia, p.estado_civil, p.escolaridad, p.enfermedades_previas, p.fecha_registro,
             p.numero_afiliacion, p.grupo_sanguineo, p.religion, p.ocupacion, p.tipo_poblacion,
             COALESCE(p.area_servicio, 'Medicina General') as area,
             COALESCE(a.tipo_atencion, 'PRIMERA_VEZ') as tipo_atencion,
             t.id as tutor_id, t.nombre_completo as tutor_nombre, t.parentesco as tutor_parentesco,
             t.telefono_contacto as tutor_telefono, t.tipo_identificacion as tutor_tipo_id
      FROM pacientes p
      LEFT JOIN tutores t ON p.id = t.paciente_id
      LEFT JOIN LATERAL (
        SELECT tipo_atencion, area_servicio
        FROM atenciones_clinicas
        WHERE paciente_id = p.id
        ORDER BY fecha_hora_ingreso DESC
        LIMIT 1
      ) a ON TRUE
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

// 4.1 PUT /api/pacientes/:id (Actualizar datos generales del paciente)
router.put('/:id', requireRoles('RECEPCION', 'DIRECCION'), async (req, res) => {
  const { id } = req.params;
  const {
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
    numero_afiliacion,
    grupo_sanguineo,
    religion,
    ocupacion,
    tipo_poblacion,
    area,
    area_servicio,
    tipo_consulta,
    tipo_atencion,
    enfermedades_previas,
    beneficiario_programa,
    nombre_programa,
    num_personas_vivienda,
    tutor
  } = req.body;

  try {
    let pacExist;
    if (!isNaN(id) && Number.isInteger(Number(id))) {
      pacExist = await db.query('SELECT id, curp, fecha_nacimiento FROM pacientes WHERE id = $1 OR numero_expediente = $2', [parseInt(id, 10), id]);
    } else {
      pacExist = await db.query('SELECT id, curp, fecha_nacimiento FROM pacientes WHERE numero_expediente = $1', [id]);
    }

    if (pacExist.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }
    const pacActual = pacExist.rows[0];
    const pacienteIdNum = pacActual.id;

    let curpFinal = pacActual.curp;
    if (curp) {
      const curpLimpia = curp.toUpperCase().trim();
      if (curpLimpia.length !== 18) {
        return res.status(400).json({ error: 'La CURP debe tener exactamente 18 caracteres.' });
      }
      if (curpLimpia !== pacActual.curp) {
        const curpDup = await db.query('SELECT id FROM pacientes WHERE curp = $1 AND id != $2', [curpLimpia, pacienteIdNum]);
        if (curpDup.rows.length > 0) {
          return res.status(409).json({ error: 'La CURP ingresada ya pertenece a otro paciente registrado.' });
        }
        curpFinal = curpLimpia;
      }
    }

    const fNacFinal = fecha_nacimiento || pacActual.fecha_nacimiento;
    const edad = calcularEdad(fNacFinal);
    if (edad < 18 && tutor) {
      if (tutor.nombre_completo && tutor.parentesco && tutor.telefono_contacto && tutor.tipo_identificacion) {
        const tutorSql = `
          INSERT INTO tutores (paciente_id, nombre_completo, parentesco, telefono_contacto, tipo_identificacion, numero_identificacion)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (paciente_id)
          DO UPDATE SET
            nombre_completo = EXCLUDED.nombre_completo,
            parentesco = EXCLUDED.parentesco,
            telefono_contacto = EXCLUDED.telefono_contacto,
            tipo_identificacion = EXCLUDED.tipo_identificacion,
            numero_identificacion = EXCLUDED.numero_identificacion
        `;
        await db.query(tutorSql, [
          pacienteIdNum, tutor.nombre_completo.trim(), tutor.parentesco,
          tutor.telefono_contacto.trim(), tutor.tipo_identificacion, tutor.numero_identificacion || null
        ]);
      }
    }

    const updateSql = `
      UPDATE pacientes SET
        nombres = COALESCE($1, nombres),
        apellido_paterno = COALESCE($2, apellido_paterno),
        apellido_materno = $3,
        curp = $4,
        fecha_nacimiento = COALESCE($5, fecha_nacimiento),
        sexo = COALESCE($6, sexo),
        estado_civil = COALESCE($7, estado_civil),
        escolaridad = COALESCE($8, escolaridad),
        calle_numero = COALESCE($9, calle_numero),
        colonia = COALESCE($10, colonia),
        codigo_postal = $11,
        telefono = $12,
        derechohabiencia = COALESCE($13, derechohabiencia),
        enfermedades_previas = COALESCE($14, enfermedades_previas),
        beneficiario_programa = COALESCE($15, beneficiario_programa),
        nombre_programa = $16,
        num_personas_vivienda = COALESCE($17, num_personas_vivienda),
        numero_afiliacion = $18,
        grupo_sanguineo = $19,
        religion = $20,
        ocupacion = $21,
        tipo_poblacion = $22,
        area_servicio = COALESCE($23, area_servicio)
      WHERE id = $24
      RETURNING *
    `;

    const areaVal = area || area_servicio || null;
    const values = [
      nombres ? nombres.trim() : null,
      apellido_paterno ? apellido_paterno.trim() : null,
      apellido_materno ? apellido_materno.trim() : null,
      curpFinal,
      fecha_nacimiento || null,
      sexo || null,
      estado_civil || null,
      escolaridad || null,
      calle_numero ? calle_numero.trim() : null,
      colonia ? colonia.trim() : null,
      codigo_postal || null,
      telefono || null,
      derechohabiencia || null,
      enfermedades_previas || null,
      beneficiario_programa !== undefined ? beneficiario_programa : null,
      nombre_programa || null,
      num_personas_vivienda || null,
      numero_afiliacion || null,
      grupo_sanguineo || null,
      religion || null,
      ocupacion || null,
      tipo_poblacion || null,
      areaVal ? areaVal.trim() : null,
      pacienteIdNum
    ];

    const result = await db.query(updateSql, values);

    // Actualizar también la última atención activa/reciente del paciente si se especificó área o tipo
    if (areaVal || tipo_consulta || tipo_atencion) {
      const tipoVal = (tipo_consulta === 'Primera vez' || tipo_atencion === 'PRIMERA_VEZ')
        ? 'PRIMERA_VEZ'
        : (tipo_consulta === 'Subsecuente' || tipo_atencion === 'SUBSECUENTE' ? 'SUBSECUENTE' : null);

      await db.query(`
        UPDATE atenciones_clinicas
        SET area_servicio = COALESCE($1, area_servicio),
            tipo_atencion = COALESCE($2, tipo_atencion)
        WHERE id = (
          SELECT id FROM atenciones_clinicas
          WHERE paciente_id = $3
          ORDER BY fecha_hora_ingreso DESC
          LIMIT 1
        )
      `, [areaVal ? areaVal.trim() : null, tipoVal, pacienteIdNum]);
    }

    res.json({
      mensaje: 'Datos del expediente actualizados exitosamente.',
      paciente: {
        ...result.rows[0],
        edad,
        es_menor: edad < 18
      }
    });
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'pacientes_curp_key') {
      return res.status(409).json({ error: 'La CURP ingresada ya pertenece a otro paciente registrado.' });
    }
    res.status(500).json({ error: 'Error al actualizar expediente: ' + err.message });
  }
});


// Función auxiliar para semáforo de triaje en expediente completo
function evaluarSemaforoTriaje(ta, fc, fr, temp, satO2) {
  const alertas = [];
  let prioridad = 'VERDE';

  const partesTA = (ta || '').split('/');
  if (partesTA.length === 2) {
    const sistolica = parseInt(partesTA[0], 10);
    const diastolica = parseInt(partesTA[1], 10);

    if (sistolica >= 180 || diastolica >= 110) {
      alertas.push('Crisis hipertensiva');
      prioridad = 'ROJO';
    } else if (sistolica >= 140 || diastolica >= 90) {
      alertas.push('Hipertensión arterial');
      if (prioridad !== 'ROJO') prioridad = 'AMARILLO';
    }
  }

  if (satO2 < 90) {
    alertas.push('Desaturación severa (Hipoxia)');
    prioridad = 'ROJO';
  } else if (satO2 <= 93) {
    alertas.push('Saturación limítrofe');
    if (prioridad !== 'ROJO') prioridad = 'AMARILLO';
  }

  if (temp >= 39.0) {
    alertas.push('Fiebre alta');
    prioridad = 'ROJO';
  } else if (temp >= 38.0) {
    alertas.push('Fiebre');
    if (prioridad !== 'ROJO') prioridad = 'AMARILLO';
  }

  if (fc >= 120 || fc <= 45) {
    alertas.push('Frecuencia cardíaca crítica');
    prioridad = 'ROJO';
  } else if (fc >= 100 || fc < 60) {
    alertas.push('Frecuencia cardíaca fuera de rango');
    if (prioridad !== 'ROJO') prioridad = 'AMARILLO';
  }

  return { prioridad, alertas };
}

// 5. GET /api/pacientes/:id/historia-clinica (Consulta de antecedentes NOM-004-SSA3-2012)
router.get('/:id/historia-clinica', async (req, res) => {
  const { id } = req.params;

  try {
    const pacienteRes = await db.query('SELECT id, sexo, fecha_nacimiento FROM pacientes WHERE id = ', [id]);
    if (pacienteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }
    const pac = pacienteRes.rows[0];

    const hcRes = await db.query(`
      SELECT hc.*,
             u.nombre || ' ' || u.apellidos as usuario_nombre,
             u.rol as usuario_rol,
             u.cedula_profesional as usuario_cedula
      FROM historias_clinicas hc
      LEFT JOIN usuarios u ON hc.usuario_registro_id = u.id
      WHERE hc.paciente_id = 
    `, [id]);

    if (hcRes.rows.length === 0) {
      return res.json({
        registrado: false,
        paciente_id: Number(id),
        mensaje: 'El paciente aún no cuenta con antecedentes clínicos registrados.',
        historia_clinica: null
      });
    }

    const hc = hcRes.rows[0];
    res.json({
      registrado: true,
      paciente_id: Number(id),
      historia_clinica: {
        id: hc.id,
        fecha_registro: hc.fecha_registro,
        fecha_actualizacion: hc.fecha_actualizacion,
        profesional_responsable: hc.usuario_nombre ? {
          id: hc.usuario_registro_id,
          nombre: hc.usuario_nombre,
          rol: hc.usuario_rol,
          cedula_profesional: hc.usuario_cedula
        } : null,
        heredofamiliares: {
          diabetes: hc.ahf_diabetes,
          hipertension: hc.ahf_hipertension,
          cardiopatias: hc.ahf_cardiopatias,
          neoplasias: hc.ahf_neoplasias,
          nefropatias: hc.ahf_nefropatias,
          enfermedades_mentales: hc.ahf_enfermedades_mentales,
          otros: hc.ahf_otros
        },
        personales_patologicos: {
          alergias: hc.app_alergias,
          quirurgicos: hc.app_quirurgicos,
          transfusionales: hc.app_transfusionales,
          traumaticos: hc.app_traumaticos,
          hospitalizaciones: hc.app_hospitalizaciones,
          cronico_degenerativas: hc.app_cronico_degenerativas,
          otros: hc.app_otros
        },
        personales_no_patologicos: {
          tabaquismo: hc.apnp_tabaquismo,
          tabaquismo_descripcion: hc.apnp_tabaquismo_descripcion,
          alcoholismo: hc.apnp_alcoholismo,
          alcoholismo_descripcion: hc.apnp_alcoholismo_descripcion,
          toxicomania: hc.apnp_toxicomania,
          vacunacion_completa: hc.apnp_vacunacion_completa,
          vivienda_servicios: hc.apnp_vivienda_servicios,
          zoonosis: hc.apnp_zoonosis,
          actividad_fisica: hc.apnp_actividad_fisica
        },
        ginecoobstetricos: pac.sexo === 'F' ? {
          menarca: hc.ago_menarca,
          ritmo_menstrual: hc.ago_ritmo_menstrual,
          fum: hc.ago_fum,
          gestas: hc.ago_gestas,
          partos: hc.ago_partos,
          cesareas: hc.ago_cesareas,
          abortos: hc.ago_abortos,
          metodo_anticonceptivo: hc.ago_metodo_anticonceptivo,
          papanicolaou_fecha: hc.ago_papanicolaou_fecha,
          mastografia_fecha: hc.ago_mastografia_fecha,
          observaciones: hc.ago_observaciones
        } : null
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar historia clínica: ' + err.message });
  }
});

// 6. PUT /api/pacientes/:id/historia-clinica (Registro/Actualización de antecedentes NOM-004-SSA3-2012)
router.put(
  '/:id/historia-clinica',
  requireRoles('MEDICO_GENERAL', 'ODONTOLOGO', 'NUTRIOLOGO', 'PSICOLOGO', 'ENFERMERIA', 'DIRECCION'),
  async (req, res) => {
    const { id } = req.params;

    try {
      const pacRes = await db.query('SELECT id, sexo FROM pacientes WHERE id = ', [id]);
      if (pacRes.rows.length === 0) {
        return res.status(404).json({ error: 'Paciente no encontrado.' });
      }
      const pac = pacRes.rows[0];

      // Permitir payload plano o anidado
      const b = req.body || {};
      const ahf = b.heredofamiliares || {};
      const app = b.personales_patologicos || {};
      const apnp = b.personales_no_patologicos || {};
      const ago = b.ginecoobstetricos || {};

      // Heredofamiliares
      const ahf_diabetes = b.ahf_diabetes !== undefined ? Boolean(b.ahf_diabetes) : Boolean(ahf.diabetes);
      const ahf_hipertension = b.ahf_hipertension !== undefined ? Boolean(b.ahf_hipertension) : Boolean(ahf.hipertension);
      const ahf_cardiopatias = b.ahf_cardiopatias !== undefined ? Boolean(b.ahf_cardiopatias) : Boolean(ahf.cardiopatias);
      const ahf_neoplasias = b.ahf_neoplasias !== undefined ? Boolean(b.ahf_neoplasias) : Boolean(ahf.neoplasias);
      const ahf_nefropatias = b.ahf_nefropatias !== undefined ? Boolean(b.ahf_nefropatias) : Boolean(ahf.nefropatias);
      const ahf_enfermedades_mentales = b.ahf_enfermedades_mentales !== undefined ? Boolean(b.ahf_enfermedades_mentales) : Boolean(ahf.enfermedades_mentales);
      const ahf_otros = b.ahf_otros !== undefined ? b.ahf_otros : (ahf.otros || null);

      // Personales Patológicos
      const app_alergias = b.app_alergias !== undefined ? b.app_alergias : (app.alergias || null);
      const app_quirurgicos = b.app_quirurgicos !== undefined ? b.app_quirurgicos : (app.quirurgicos || null);
      const app_transfusionales = b.app_transfusionales !== undefined ? b.app_transfusionales : (app.transfusionales || null);
      const app_traumaticos = b.app_traumaticos !== undefined ? b.app_traumaticos : (app.traumaticos || null);
      const app_hospitalizaciones = b.app_hospitalizaciones !== undefined ? b.app_hospitalizaciones : (app.hospitalizaciones || null);
      const app_cronico_degenerativas = b.app_cronico_degenerativas !== undefined ? b.app_cronico_degenerativas : (app.cronico_degenerativas || null);
      const app_otros = b.app_otros !== undefined ? b.app_otros : (app.otros || null);

      // Personales No Patológicos
      const apnp_tabaquismo = b.apnp_tabaquismo !== undefined ? Boolean(b.apnp_tabaquismo) : Boolean(apnp.tabaquismo);
      const apnp_tabaquismo_descripcion = b.apnp_tabaquismo_descripcion !== undefined ? b.apnp_tabaquismo_descripcion : (apnp.tabaquismo_descripcion || null);
      const apnp_alcoholismo = b.apnp_alcoholismo !== undefined ? Boolean(b.apnp_alcoholismo) : Boolean(apnp.alcoholismo);
      const apnp_alcoholismo_descripcion = b.apnp_alcoholismo_descripcion !== undefined ? b.apnp_alcoholismo_descripcion : (apnp.alcoholismo_descripcion || null);
      const apnp_toxicomania = b.apnp_toxicomania !== undefined ? b.apnp_toxicomania : (apnp.toxicomania || null);
      const apnp_vacunacion_completa = b.apnp_vacunacion_completa !== undefined ? Boolean(b.apnp_vacunacion_completa) : (apnp.vacunacion_completa !== undefined ? Boolean(apnp.vacunacion_completa) : true);
      const apnp_vivienda_servicios = b.apnp_vivienda_servicios !== undefined ? b.apnp_vivienda_servicios : (apnp.vivienda_servicios || null);
      const apnp_zoonosis = b.apnp_zoonosis !== undefined ? b.apnp_zoonosis : (apnp.zoonosis || null);
      const apnp_actividad_fisica = b.apnp_actividad_fisica !== undefined ? b.apnp_actividad_fisica : (apnp.actividad_fisica || null);

      // Gineco-Obstétricos (Solo si sexo Femenino)
      let ago_menarca = null;
      let ago_ritmo_menstrual = null;
      let ago_fum = null;
      let ago_gestas = 0;
      let ago_partos = 0;
      let ago_cesareas = 0;
      let ago_abortos = 0;
      let ago_metodo_anticonceptivo = null;
      let ago_papanicolaou_fecha = null;
      let ago_mastografia_fecha = null;
      let ago_observaciones = null;

      if (pac.sexo === 'F') {
        ago_menarca = b.ago_menarca !== undefined ? b.ago_menarca : (ago.menarca || null);
        ago_ritmo_menstrual = b.ago_ritmo_menstrual !== undefined ? b.ago_ritmo_menstrual : (ago.ritmo_menstrual || null);
        ago_fum = b.ago_fum !== undefined ? b.ago_fum : (ago.fum || null);
        ago_gestas = b.ago_gestas !== undefined ? parseInt(b.ago_gestas, 10) : (ago.gestas !== undefined ? parseInt(ago.gestas, 10) : 0);
        ago_partos = b.ago_partos !== undefined ? parseInt(b.ago_partos, 10) : (ago.partos !== undefined ? parseInt(ago.partos, 10) : 0);
        ago_cesareas = b.ago_cesareas !== undefined ? parseInt(b.ago_cesareas, 10) : (ago.cesareas !== undefined ? parseInt(ago.cesareas, 10) : 0);
        ago_abortos = b.ago_abortos !== undefined ? parseInt(b.ago_abortos, 10) : (ago.abortos !== undefined ? parseInt(ago.abortos, 10) : 0);
        ago_metodo_anticonceptivo = b.ago_metodo_anticonceptivo !== undefined ? b.ago_metodo_anticonceptivo : (ago.metodo_anticonceptivo || null);
        ago_papanicolaou_fecha = b.ago_papanicolaou_fecha !== undefined ? b.ago_papanicolaou_fecha : (ago.papanicolaou_fecha || null);
        ago_mastografia_fecha = b.ago_mastografia_fecha !== undefined ? b.ago_mastografia_fecha : (ago.mastografia_fecha || null);
        ago_observaciones = b.ago_observaciones !== undefined ? b.ago_observaciones : (ago.observaciones || null);
      }

      const upsertQuery = `
        INSERT INTO historias_clinicas (
          paciente_id, usuario_registro_id, fecha_actualizacion,
          ahf_diabetes, ahf_hipertension, ahf_cardiopatias, ahf_neoplasias, ahf_nefropatias, ahf_enfermedades_mentales, ahf_otros,
          app_alergias, app_quirurgicos, app_transfusionales, app_traumaticos, app_hospitalizaciones, app_cronico_degenerativas, app_otros,
          apnp_tabaquismo, apnp_tabaquismo_descripcion, apnp_alcoholismo, apnp_alcoholismo_descripcion, apnp_toxicomania,
          apnp_vacunacion_completa, apnp_vivienda_servicios, apnp_zoonosis, apnp_actividad_fisica,
          ago_menarca, ago_ritmo_menstrual, ago_fum, ago_gestas, ago_partos, ago_cesareas, ago_abortos,
          ago_metodo_anticonceptivo, ago_papanicolaou_fecha, ago_mastografia_fecha, ago_observaciones
        ) VALUES (
          , , CURRENT_TIMESTAMP,
          , , , , , , ,
          0, 1, 2, 3, 4, 5, 6,
          7, 8, 9, 0, 1,
          2, 3, 4, 5,
          6, 7, 8, 9, 0, 1, 2,
          3, 4, 5, 6
        )
        ON CONFLICT (paciente_id)
        DO UPDATE SET
          usuario_registro_id = EXCLUDED.usuario_registro_id,
          fecha_actualizacion = CURRENT_TIMESTAMP,
          ahf_diabetes = EXCLUDED.ahf_diabetes,
          ahf_hipertension = EXCLUDED.ahf_hipertension,
          ahf_cardiopatias = EXCLUDED.ahf_cardiopatias,
          ahf_neoplasias = EXCLUDED.ahf_neoplasias,
          ahf_nefropatias = EXCLUDED.ahf_nefropatias,
          ahf_enfermedades_mentales = EXCLUDED.ahf_enfermedades_mentales,
          ahf_otros = EXCLUDED.ahf_otros,
          app_alergias = EXCLUDED.app_alergias,
          app_quirurgicos = EXCLUDED.app_quirurgicos,
          app_transfusionales = EXCLUDED.app_transfusionales,
          app_traumaticos = EXCLUDED.app_traumaticos,
          app_hospitalizaciones = EXCLUDED.app_hospitalizaciones,
          app_cronico_degenerativas = EXCLUDED.app_cronico_degenerativas,
          app_otros = EXCLUDED.app_otros,
          apnp_tabaquismo = EXCLUDED.apnp_tabaquismo,
          apnp_tabaquismo_descripcion = EXCLUDED.apnp_tabaquismo_descripcion,
          apnp_alcoholismo = EXCLUDED.apnp_alcoholismo,
          apnp_alcoholismo_descripcion = EXCLUDED.apnp_alcoholismo_descripcion,
          apnp_toxicomania = EXCLUDED.apnp_toxicomania,
          apnp_vacunacion_completa = EXCLUDED.apnp_vacunacion_completa,
          apnp_vivienda_servicios = EXCLUDED.apnp_vivienda_servicios,
          apnp_zoonosis = EXCLUDED.apnp_zoonosis,
          apnp_actividad_fisica = EXCLUDED.apnp_actividad_fisica,
          ago_menarca = EXCLUDED.ago_menarca,
          ago_ritmo_menstrual = EXCLUDED.ago_ritmo_menstrual,
          ago_fum = EXCLUDED.ago_fum,
          ago_gestas = EXCLUDED.ago_gestas,
          ago_partos = EXCLUDED.ago_partos,
          ago_cesareas = EXCLUDED.ago_cesareas,
          ago_abortos = EXCLUDED.ago_abortos,
          ago_metodo_anticonceptivo = EXCLUDED.ago_metodo_anticonceptivo,
          ago_papanicolaou_fecha = EXCLUDED.ago_papanicolaou_fecha,
          ago_mastografia_fecha = EXCLUDED.ago_mastografia_fecha,
          ago_observaciones = EXCLUDED.ago_observaciones
        RETURNING *
      `;

      const params = [
        id, req.user.id,
        ahf_diabetes, ahf_hipertension, ahf_cardiopatias, ahf_neoplasias, ahf_nefropatias, ahf_enfermedades_mentales, ahf_otros,
        app_alergias, app_quirurgicos, app_transfusionales, app_traumaticos, app_hospitalizaciones, app_cronico_degenerativas, app_otros,
        apnp_tabaquismo, apnp_tabaquismo_descripcion, apnp_alcoholismo, apnp_alcoholismo_descripcion, apnp_toxicomania,
        apnp_vacunacion_completa, apnp_vivienda_servicios, apnp_zoonosis, apnp_actividad_fisica,
        ago_menarca, ago_ritmo_menstrual, ago_fum, ago_gestas, ago_partos, ago_cesareas, ago_abortos,
        ago_metodo_anticonceptivo, ago_papanicolaou_fecha, ago_mastografia_fecha, ago_observaciones
      ];

      const result = await db.query(upsertQuery, params);
      const nuevoHC = result.rows[0];

      // Sincronizar resumen en pacientes para búsquedas ágiles
      if (app_cronico_degenerativas || app_alergias) {
        const resumenPrevio = [
          app_cronico_degenerativas ? `Crónicas: ${app_cronico_degenerativas}` : null,
          app_alergias ? `Alergias: ${app_alergias}` : null
        ].filter(Boolean).join(' | ');
        await db.query('UPDATE pacientes SET enfermedades_previas =  WHERE id = ', [resumenPrevio, id]);
      }

      res.json({
        mensaje: 'Historia clínica actualizada exitosamente conforme a NOM-004-SSA3-2012.',
        paciente_id: Number(id),
        historia_clinica: nuevoHC
      });
    } catch (err) {
      res.status(500).json({ error: 'Error al guardar historia clínica: ' + err.message });
    }
  }
);

// 7. GET /api/pacientes/:id/expediente-completo (Timeline Integral del Expediente Clínico NOM-004-SSA3-2012)
router.get('/:id/expediente-completo', async (req, res) => {
  const { id } = req.params;

  try {
    // A. Datos del Paciente
    const pacRes = await db.query(`
      SELECT p.*,
             um.nombre as unidad_medica_nombre,
             t.id as tutor_id, t.nombre_completo as tutor_nombre, t.parentesco as tutor_parentesco,
             t.telefono_contacto as tutor_telefono, t.tipo_identificacion as tutor_tipo_id, t.numero_identificacion as tutor_num_id
      FROM pacientes p
      JOIN unidades_medicas um ON p.unidad_medica_id = um.id
      LEFT JOIN tutores t ON p.id = t.paciente_id
      WHERE p.id = 
    `, [id]);

    if (pacRes.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }

    const pac = pacRes.rows[0];
    const edad = calcularEdad(pac.fecha_nacimiento);

    // B. Historia Clínica (Antecedentes)
    const hcRes = await db.query(`
      SELECT hc.*,
             u.nombre || ' ' || u.apellidos as profesional_nombre,
             u.rol as profesional_rol,
             u.cedula_profesional as profesional_cedula
      FROM historias_clinicas hc
      LEFT JOIN usuarios u ON hc.usuario_registro_id = u.id
      WHERE hc.paciente_id = 
    `, [id]);

    const hc = hcRes.rows.length > 0 ? hcRes.rows[0] : null;

    // C. Atenciones clínicas (episodios / visitas)
    const atencionesRes = await db.query(`
      SELECT a.id, a.fecha_hora_ingreso, a.tipo_atencion, a.estado,
             u.nombre || ' ' || u.apellidos as recepcionista_nombre
      FROM atenciones_clinicas a
      JOIN usuarios u ON a.usuario_recepcion_id = u.id
      WHERE a.paciente_id = 
      ORDER BY a.fecha_hora_ingreso DESC
    `, [id]);

    const atencionesIds = atencionesRes.rows.map(a => a.id);

    let triajesMap = {};
    let procedimientosMap = {};
    let consultasMap = {};
    let derivacionesMap = {};

    if (atencionesIds.length > 0) {
      // 1. Triajes
      const triajesRes = await db.query(`
        SELECT t.*,
               u.nombre || ' ' || u.apellidos as enfermero_nombre,
               u.cedula_profesional as enfermero_cedula
        FROM triaje_signos_vitales t
        JOIN usuarios u ON t.enfermero_id = u.id
        WHERE t.atencion_id = ANY(::int[])
      `, [atencionesIds]);

      for (const t of triajesRes.rows) {
        const semaforo = evaluarSemaforoTriaje(
          t.tension_arterial,
          t.frecuencia_cardiaca,
          t.frecuencia_respiratoria,
          Number(t.temperatura),
          t.saturacion_oxigeno
        );
        triajesMap[t.atencion_id] = {
          ...t,
          semaforo
        };
      }

      // 2. Procedimientos de enfermería
      const triajeIds = triajesRes.rows.map(t => t.id);
      if (triajeIds.length > 0) {
        const procRes = await db.query(`
          SELECT p.* FROM procedimientos_enfermeria p
          WHERE p.triaje_id = ANY(::int[])
        `, [triajeIds]);

        for (const p of procRes.rows) {
          if (!procedimientosMap[p.triaje_id]) procedimientosMap[p.triaje_id] = [];
          procedimientosMap[p.triaje_id].push(p);
        }
      }

      // 3. Consultas Base
      const consultasRes = await db.query(`
        SELECT c.*,
               u.nombre || ' ' || u.apellidos as especialista_nombre,
               u.rol as especialista_rol,
               u.cedula_profesional as especialista_cedula
        FROM consultas_base c
        JOIN usuarios u ON c.especialista_id = u.id
        WHERE c.atencion_id = ANY(::int[])
        ORDER BY c.fecha_hora ASC
      `, [atencionesIds]);

      const consultaIds = consultasRes.rows.map(c => c.id);

      // 3.1 Medicina General
      let medGenMap = {};
      if (consultaIds.length > 0) {
        const medRes = await db.query(`
          SELECT * FROM consultas_medicina_general WHERE consulta_id = ANY(::int[])
        `, [consultaIds]);
        for (const m of medRes.rows) medGenMap[m.consulta_id] = m;
      }

      // 3.2 Odontología
      let odontoMap = {};
      let odontologiaIds = [];
      if (consultaIds.length > 0) {
        const odoRes = await db.query(`
          SELECT * FROM consultas_odontologia WHERE consulta_id = ANY(::int[])
        `, [consultaIds]);
        for (const o of odoRes.rows) {
          odontoMap[o.consulta_id] = o;
          odontologiaIds.push(o.id);
        }
      }

      // Piezas dentales
      let piezasMap = {};
      if (odontologiaIds.length > 0) {
        const piezasRes = await db.query(`
          SELECT * FROM piezas_dentales WHERE consulta_odontologia_id = ANY(::int[]) ORDER BY numero_fdi ASC
        `, [odontologiaIds]);
        for (const pz of piezasRes.rows) {
          if (!piezasMap[pz.consulta_odontologia_id]) piezasMap[pz.consulta_odontologia_id] = [];
          piezasMap[pz.consulta_odontologia_id].push(pz);
        }
      }

      // 3.3 Nutrición
      let nutriMap = {};
      if (consultaIds.length > 0) {
        const nutRes = await db.query(`
          SELECT * FROM consultas_nutricion WHERE consulta_id = ANY(::int[])
        `, [consultaIds]);
        for (const n of nutRes.rows) nutriMap[n.consulta_id] = n;
      }

      // 3.4 Psicología
      let psicoMap = {};
      if (consultaIds.length > 0) {
        const psiRes = await db.query(`
          SELECT * FROM consultas_psicologia WHERE consulta_id = ANY(::int[])
        `, [consultaIds]);
        for (const ps of psiRes.rows) psicoMap[ps.consulta_id] = ps;
      }

      // Consentimientos Informados
      let consentimientosMap = {};
      if (consultaIds.length > 0) {
        const consRes = await db.query(`
          SELECT * FROM consentimientos_informados WHERE consulta_id = ANY(::int[])
        `, [consultaIds]);
        for (const ci of consRes.rows) consentimientosMap[ci.consulta_id] = ci;
      }

      // Armar mapa de consultas por atención
      for (const cb of consultasRes.rows) {
        if (!consultasMap[cb.atencion_id]) consultasMap[cb.atencion_id] = [];

        const detalleConsulta = {
          id: cb.id,
          area_medica: cb.area_medica,
          fecha_hora: cb.fecha_hora,
          motivo_consulta: cb.motivo_consulta,
          observaciones: cb.observaciones,
          especialista: {
            id: cb.especialista_id,
            nombre: cb.especialista_nombre,
            rol: cb.especialista_rol,
            cedula_profesional: cb.especialista_cedula
          }
        };

        if (cb.area_medica === 'MEDICINA_GENERAL' && medGenMap[cb.id]) {
          const mg = medGenMap[cb.id];
          detalleConsulta.medicina_general = {
            soap: {
              subjetivo: mg.nota_subjetivo,
              objetivo: mg.nota_objetivo,
              analisis: mg.nota_analisis,
              plan: mg.nota_plan
            },
            diagnostico: {
              cie10: mg.diagnostico_cie10,
              descripcion: mg.diagnostico_descripcion,
              morbilidad: mg.clasificacion_morbilidad
            },
            pruebas_rapidas: mg.pruebas_rapidas,
            canalizacion_externa: mg.canalizacion_externa,
            emite_certificado: mg.emite_certificado
          };
        } else if (cb.area_medica === 'ODONTOLOGIA' && odontoMap[cb.id]) {
          const od = odontoMap[cb.id];
          detalleConsulta.odontologia = {
            tipo_denticion: od.tipo_denticion,
            comorbilidades_bucales: od.comorbilidades_bucales,
            estudios_gabinete: od.estudios_gabinete,
            indices: {
              cpod: od.indice_cpod,
              ceod: od.indice_ceod
            },
            piezas_dentales: piezasMap[od.id] || []
          };
        } else if (cb.area_medica === 'NUTRICION' && nutriMap[cb.id]) {
          const nt = nutriMap[cb.id];
          detalleConsulta.nutricion = {
            antropometria: {
              cintura_cm: nt.circunferencia_cintura,
              cadera_cm: nt.circunferencia_cadera,
              rcc: nt.circunferencia_cintura && nt.circunferencia_cadera
                ? Number((nt.circunferencia_cintura / nt.circunferencia_cadera).toFixed(2))
                : null,
              brazo_cm: nt.circunferencia_brazo,
              porcentaje_grasa: nt.porcentaje_grasa,
              porcentaje_musculo: nt.porcentaje_musculo,
              consumo_agua_litros: nt.consumo_agua_litros,
              frecuencia_ejercicio: nt.frecuencia_ejercicio
            },
            recordatorio_24h: nt.recordatorio_24h
          };
        } else if (cb.area_medica === 'PSICOLOGIA' && psicoMap[cb.id]) {
          const ps = psicoMap[cb.id];
          detalleConsulta.psicologia = {
            evaluacion_clinica: ps.evaluacion_clinica,
            nota_evolucion: ps.nota_evolucion,
            plan_intervencion: ps.plan_intervencion,
            consentimiento_informado: consentimientosMap[cb.id] || null
          };
        }

        consultasMap[cb.atencion_id].push(detalleConsulta);
      }

      // 4. Derivaciones / Tratamientos Cruzados
      const derRes = await db.query(`
        SELECT * FROM tratamientos_cruzados
        WHERE atencion_origen_id = ANY(::int[])
        ORDER BY fecha_hora_derivacion DESC
      `, [atencionesIds]);

      for (const d of derRes.rows) {
        if (!derivacionesMap[d.atencion_origen_id]) derivacionesMap[d.atencion_origen_id] = [];
        derivacionesMap[d.atencion_origen_id].push(d);
      }
    }

    // Estructurar array de visitas en orden cronológico inverso
    const timelineVisitas = atencionesRes.rows.map(at => {
      const triajeInfo = triajesMap[at.id] || null;
      let procedimientos = [];
      if (triajeInfo && procedimientosMap[triajeInfo.id]) {
        procedimientos = procedimientosMap[triajeInfo.id];
      }

      return {
        atencion_id: at.id,
        fecha_hora_ingreso: at.fecha_hora_ingreso,
        tipo_atencion: at.tipo_atencion,
        estado: at.estado,
        recepcionista: at.recepcionista_nombre,
        triaje: triajeInfo ? {
          id: triajeInfo.id,
          enfermero: {
            nombre: triajeInfo.enfermero_nombre,
            cedula_profesional: triajeInfo.enfermero_cedula
          },
          signos_vitales: {
            tension_arterial: triajeInfo.tension_arterial,
            frecuencia_cardiaca: triajeInfo.frecuencia_cardiaca,
            frecuencia_respiratoria: triajeInfo.frecuencia_respiratoria,
            temperatura: triajeInfo.temperatura,
            saturacion_oxigeno: triajeInfo.saturacion_oxigeno,
            glucosa_capilar: triajeInfo.glucosa_capilar,
            peso_kg: triajeInfo.peso_kg,
            talla_metros: triajeInfo.talla_metros,
            imc: triajeInfo.imc,
            clasificacion_imc: triajeInfo.clasificacion_imc
          },
          semaforo: triajeInfo.semaforo,
          detecciones_riesgo: triajeInfo.detecciones_riesgo,
          procedimientos_enfermeria: procedimientos
        } : null,
        consultas: consultasMap[at.id] || [],
        interconsultas_derivadas: derivacionesMap[at.id] || []
      };
    });

    // Último triaje para el resumen rápido
    const ultimaAtencionConTriaje = timelineVisitas.find(v => v.triaje !== null);

    res.json({
      paciente: {
        id: pac.id,
        numero_expediente: pac.numero_expediente,
        curp: pac.curp,
        nombres: pac.nombres,
        apellido_paterno: pac.apellido_paterno,
        apellido_materno: pac.apellido_materno,
        nombre_completo: `${pac.nombres} ${pac.apellido_paterno} ${pac.apellido_materno || ''}`.trim(),
        fecha_nacimiento: pac.fecha_nacimiento,
        edad,
        es_menor: edad < 18,
        sexo: pac.sexo,
        estado_civil: pac.estado_civil,
        escolaridad: pac.escolaridad,
        domicilio: {
          calle_numero: pac.calle_numero,
          colonia: pac.colonia,
          codigo_postal: pac.codigo_postal
        },
        telefono: pac.telefono,
        derechohabiencia: pac.derechohabiencia,
        beneficiario_programa: pac.beneficiario_programa,
        nombre_programa: pac.nombre_programa,
        num_personas_vivienda: pac.num_personas_vivienda,
        fecha_registro: pac.fecha_registro,
        unidad_medica: pac.unidad_medica_nombre
      },
      tutor: pac.tutor_id ? {
        id: pac.tutor_id,
        nombre_completo: pac.tutor_nombre,
        parentesco: pac.tutor_parentesco,
        telefono_contacto: pac.tutor_telefono,
        tipo_identificacion: pac.tutor_tipo_id,
        numero_identificacion: pac.tutor_num_id
      } : null,
      alerta_clinica_inmediata: {
        alergias: hc ? (hc.app_alergias || 'Sin alergias registradas') : 'No evaluado',
        padecimientos_cronicos: hc ? (hc.app_cronico_degenerativas || 'Ninguno') : (pac.enfermedades_previas || 'Ninguno'),
        ultimo_semaforo_triaje: ultimaAtencionConTriaje ? ultimaAtencionConTriaje.triaje.semaforo : null,
        ultimo_imc: ultimaAtencionConTriaje ? `${ultimaAtencionConTriaje.triaje.signos_vitales.imc} (${ultimaAtencionConTriaje.triaje.signos_vitales.clasificacion_imc})` : null
      },
      historia_clinica: hc ? {
        id: hc.id,
        fecha_actualizacion: hc.fecha_actualizacion,
        profesional_responsable: hc.profesional_nombre ? {
          nombre: hc.profesional_nombre,
          rol: hc.profesional_rol,
          cedula: hc.profesional_cedula
        } : null,
        heredofamiliares: {
          diabetes: hc.ahf_diabetes,
          hipertension: hc.ahf_hipertension,
          cardiopatias: hc.ahf_cardiopatias,
          neoplasias: hc.ahf_neoplasias,
          nefropatias: hc.ahf_nefropatias,
          enfermedades_mentales: hc.ahf_enfermedades_mentales,
          otros: hc.ahf_otros
        },
        personales_patologicos: {
          alergias: hc.app_alergias,
          quirurgicos: hc.app_quirurgicos,
          transfusionales: hc.app_transfusionales,
          traumaticos: hc.app_traumaticos,
          hospitalizaciones: hc.app_hospitalizaciones,
          cronico_degenerativas: hc.app_cronico_degenerativas,
          otros: hc.app_otros
        },
        personales_no_patologicos: {
          tabaquismo: hc.apnp_tabaquismo,
          tabaquismo_descripcion: hc.apnp_tabaquismo_descripcion,
          alcoholismo: hc.apnp_alcoholismo,
          alcoholismo_descripcion: hc.apnp_alcoholismo_descripcion,
          toxicomania: hc.apnp_toxicomania,
          vacunacion_completa: hc.apnp_vacunacion_completa,
          vivienda_servicios: hc.apnp_vivienda_servicios,
          zoonosis: hc.apnp_zoonosis,
          actividad_fisica: hc.apnp_actividad_fisica
        },
        ginecoobstetricos: pac.sexo === 'F' ? {
          menarca: hc.ago_menarca,
          ritmo_menstrual: hc.ago_ritmo_menstrual,
          fum: hc.ago_fum,
          gestas: hc.ago_gestas,
          partos: hc.ago_partos,
          cesareas: hc.ago_cesareas,
          abortos: hc.ago_abortos,
          metodo_anticonceptivo: hc.ago_metodo_anticonceptivo,
          papanicolaou_fecha: hc.ago_papanicolaou_fecha,
          mastografia_fecha: hc.ago_mastografia_fecha,
          observaciones: hc.ago_observaciones
        } : null
      } : null,
      total_visitas: timelineVisitas.length,
      timeline_visitas: timelineVisitas
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener expediente completo del paciente: ' + err.message });
  }
});

module.exports = router;

