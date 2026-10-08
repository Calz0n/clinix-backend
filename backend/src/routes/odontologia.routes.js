const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Piezas FDI para dentición adulta (32 piezas) e infantil (20 piezas)
const DIENTES_ADULTO = [
  18, 17, 16, 15, 14, 13, 12, 11,  21, 22, 23, 24, 25, 26, 27, 28, // Arcada Superior
  48, 47, 46, 45, 44, 43, 42, 41,  31, 32, 33, 34, 35, 36, 37, 38  // Arcada Inferior
];

const DIENTES_INFANTIL = [
  55, 54, 53, 52, 51,  61, 62, 63, 64, 65, // Arcada Superior Decidua
  85, 84, 83, 82, 81,  71, 72, 73, 74, 75  // Arcada Inferior Decidua
];

// Función de cálculo automático de índices epidemiológicos CPO-D y ceo-d
function calcularIndicesBucales(tipo_denticion, piezas) {
  let cpod = { c: 0, p: 0, o: 0, total: 0 };
  let ceod = { c: 0, e: 0, o: 0, total: 0 };

  if (!piezas || !Array.isArray(piezas)) {
    return { cpod: 0, ceod: 0, desglose: null };
  }

  piezas.forEach(diente => {
    const caras = [
      diente.cara_vestibular,
      diente.cara_lingual,
      diente.cara_mesial,
      diente.cara_distal,
      diente.cara_oclusal
    ];

    const tieneCaries = caras.includes('CARIES');
    const tieneObturacion = caras.includes('RESINA') || caras.includes('AMALGAMA');
    const estado = diente.estado_general || 'NORMAL';

    if (tipo_denticion === 'ADULTA') {
      if (estado === 'AUSENTE' || estado === 'EXTRACCION') {
        cpod.p++; // Diente Perdido / Indicado para extracción
      } else if (tieneCaries) {
        cpod.c++; // Diente Cariado
      } else if (tieneObturacion) {
        cpod.o++; // Diente Obturado (sin caries)
      }
    } else {
      // Infantil / Decidua
      if (estado === 'EXTRACCION' || estado === 'AUSENTE') {
        ceod.e++; // Diente extraído o indicado
      } else if (tieneCaries) {
        ceod.c++; // Diente cariado
      } else if (tieneObturacion) {
        ceod.o++; // Diente obturado
      }
    }
  });

  cpod.total = cpod.c + cpod.p + cpod.o;
  ceod.total = ceod.c + ceod.e + ceod.o;

  return {
    indice_cpod: cpod.total,
    indice_ceod: ceod.total,
    desglose_cpod: cpod,
    desglose_ceod: ceod
  };
}

// 1. GET /api/odontologia/plantilla-base (Genera plantilla limpia de 32 o 20 dientes lista para Flutter)
router.get('/plantilla-base', (req, res) => {
  const tipo = (req.query.tipo || 'ADULTA').toUpperCase();
  const numeros = tipo === 'INFANTIL' ? DIENTES_INFANTIL : DIENTES_ADULTO;

  const plantilla = numeros.map(num => ({
    numero_fdi: num,
    cara_vestibular: 'SANO',
    cara_lingual: 'SANO',
    cara_mesial: 'SANO',
    cara_distal: 'SANO',
    cara_oclusal: 'SANO',
    estado_general: 'NORMAL',
    en_puente_fijo: false,
    tiene_protesis_corona: false
  }));

  res.json({
    tipo_denticion: tipo,
    total_piezas: plantilla.length,
    odontograma: plantilla
  });
});

// 2. GET /api/odontologia/interconsultas (Derivaciones pendientes a Odontología)
router.get('/interconsultas', requireRoles('ODONTOLOGO', 'DIRECCION'), async (req, res) => {
  try {
    const query = `
      SELECT tc.id as tratamiento_cruzado_id, tc.area_origen, tc.area_destino, tc.prioridad,
             tc.motivo_derivacion, tc.fecha_hora_derivacion, tc.estado,
             ac.id as atencion_id, ac.paciente_id, ac.numero_expediente, ac.nombres, ac.apellido_paterno,
             ac.apellido_materno, ac.fecha_nacimiento, ac.sexo, ac.enfermedades_previas,
             ac.tutor_nombre, ac.tutor_telefono
      FROM tratamientos_cruzados tc
      JOIN (
        SELECT a.id, a.paciente_id, p.numero_expediente, p.nombres, p.apellido_paterno, p.apellido_materno,
               p.fecha_nacimiento, p.sexo, p.enfermedades_previas,
               tu.nombre_completo as tutor_nombre, tu.telefono_contacto as tutor_telefono
        FROM atenciones_clinicas a
        JOIN pacientes p ON a.paciente_id = p.id
        LEFT JOIN tutores tu ON p.id = tu.paciente_id
      ) ac ON tc.atencion_origen_id = ac.id
      WHERE tc.area_destino = 'ODONTOLOGIA' AND tc.estado = 'PENDIENTE'
      ORDER BY tc.prioridad DESC, tc.fecha_hora_derivacion ASC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar interconsultas dentales: ' + err.message });
  }
});

// 3. GET /api/odontologia/:consulta_id (Obtener Odontograma completo registrado)
router.get('/:consulta_id', async (req, res) => {
  const { consulta_id } = req.params;

  try {
    const consultaRes = await db.query(`
      SELECT cb.id as consulta_id, cb.atencion_id, cb.fecha_hora, cb.motivo_consulta, cb.observaciones,
             co.id as consulta_odontologia_id, co.tipo_denticion, co.comorbilidades_bucales,
             co.estudios_gabinete, co.indice_cpod, co.indice_ceod,
             u.nombre || ' ' || u.apellidos as odontologo_nombre, u.cedula_profesional as odontologo_cedula
      FROM consultas_base cb
      JOIN consultas_odontologia co ON cb.id = co.consulta_id
      JOIN usuarios u ON cb.especialista_id = u.id
      WHERE cb.id = $1
    `, [consulta_id]);

    if (consultaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Consulta odontológica no encontrada.' });
    }

    const info = consultaRes.rows[0];

    // Obtener piezas dentales
    const piezasRes = await db.query(`
      SELECT * FROM piezas_dentales 
      WHERE consulta_odontologia_id = $1
      ORDER BY numero_fdi ASC
    `, [info.consulta_odontologia_id]);

    res.json({
      ...info,
      total_piezas_registradas: piezasRes.rows.length,
      odontograma: piezasRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener odontograma: ' + err.message });
  }
});

// 4. POST /api/odontologia (Registro de Consulta Dental + Odontograma FDI + Cálculo CPO-D/ceo-d)
// Roles permitidos: ODONTOLOGO o DIRECCION
router.post('/', requireRoles('ODONTOLOGO', 'DIRECCION'), async (req, res) => {
  const {
    atencion_id,
    tratamiento_cruzado_id,
    tipo_denticion, // 'ADULTA' o 'INFANTIL'
    motivo_consulta,
    observaciones,
    comorbilidades_bucales,
    estudios_gabinete,
    piezas // Array de objetos pieza dental
  } = req.body;

  if (!atencion_id || !tipo_denticion || !motivo_consulta) {
    return res.status(400).json({ error: 'La atención, tipo de dentición y motivo de consulta son obligatorios.' });
  }

  const tipoDentLimpia = tipo_denticion.toUpperCase().trim();
  if (!['ADULTA', 'INFANTIL'].includes(tipoDentLimpia)) {
    return res.status(400).json({ error: 'El tipo de dentición debe ser ADULTA o INFANTIL.' });
  }

  // CÁLCULO AUTOMÁTICO DE ÍNDICES CPO-D Y CEO-D (RF-04.1)
  const indices = calcularIndicesBucales(tipoDentLimpia, piezas);

  const odontologoId = req.user.id;
  const unidadMedicaId = req.user.unidad_medica_id || 1;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Validar atención clínica
    const atencionRes = await client.query('SELECT id, paciente_id, estado FROM atenciones_clinicas WHERE id = $1', [atencion_id]);
    if (atencionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'La atención clínica no existe.' });
    }

    // A. Insertar cabecera en consultas_base
    const insertBaseQuery = `
      INSERT INTO consultas_base (atencion_id, especialista_id, area_medica, motivo_consulta, observaciones)
      VALUES ($1, $2, 'ODONTOLOGIA', $3, $4)
      RETURNING *
    `;
    const baseResult = await client.query(insertBaseQuery, [
      atencion_id, odontologoId, motivo_consulta.trim(), observaciones || null
    ]);
    const consultaBase = baseResult.rows[0];

    // B. Insertar resumen en consultas_odontologia con los índices calculados
    const insertOdontoQuery = `
      INSERT INTO consultas_odontologia (
        consulta_id, tipo_denticion, comorbilidades_bucales, estudios_gabinete, indice_cpod, indice_ceod
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const odontoResult = await client.query(insertOdontoQuery, [
      consultaBase.id, tipoDentLimpia, comorbilidades_bucales || null,
      estudios_gabinete || null, indices.indice_cpod, indices.indice_ceod
    ]);
    const consultaOdonto = odontoResult.rows[0];

    // C. Insertar piezas dentales del odontograma
    let piezasInsertadas = 0;
    if (piezas && Array.isArray(piezas) && piezas.length > 0) {
      for (const p of piezas) {
        const insertPiezaQuery = `
          INSERT INTO piezas_dentales (
            consulta_odontologia_id, numero_fdi, cara_vestibular, cara_lingual,
            cara_mesial, cara_distal, cara_oclusal, estado_general, en_puente_fijo, tiene_protesis_corona
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;
        await client.query(insertPiezaQuery, [
          consultaOdonto.id,
          p.numero_fdi,
          p.cara_vestibular || 'SANO',
          p.cara_lingual || 'SANO',
          p.cara_mesial || 'SANO',
          p.cara_distal || 'SANO',
          p.cara_oclusal || 'SANO',
          p.estado_general || 'NORMAL',
          p.en_puente_fijo === true,
          p.tiene_protesis_corona === true
        ]);
        piezasInsertadas++;
      }
    }

    // D. Si venía de tratamiento cruzado, marcarlo como ATENDIDO
    if (tratamiento_cruzado_id) {
      await client.query(`
        UPDATE tratamientos_cruzados 
        SET estado = 'ATENDIDO' 
        WHERE id = $1 AND area_destino = 'ODONTOLOGIA'
      `, [tratamiento_cruzado_id]);
    }

    // E. Finalizar atención médica
    await client.query("UPDATE atenciones_clinicas SET estado = 'FINALIZADA' WHERE id = $1", [atencion_id]);

    // F. Incrementar bitácora de productividad diaria del odontólogo (+1)
    const upsertBitacoraQuery = `
      INSERT INTO bitacora_productividad_diaria (usuario_id, unidad_medica_id, fecha, total_atenciones)
      VALUES ($1, $2, CURRENT_DATE, 1)
      ON CONFLICT (usuario_id, fecha)
      DO UPDATE SET total_atenciones = bitacora_productividad_diaria.total_atenciones + 1
    `;
    await client.query(upsertBitacoraQuery, [odontologoId, unidadMedicaId]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Consulta odontológica y odontograma registrados exitosamente',
      consulta: {
        ...consultaBase,
        detalle_odontologia: consultaOdonto
      },
      indices_calculados: indices,
      piezas_registradas: piezasInsertadas,
      interconsulta_atendida: !!tratamiento_cruzado_id
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar consulta odontológica: ' + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
