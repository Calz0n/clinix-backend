const express = require('express');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

const DIENTES_ADULTO = [
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41,
  31, 32, 33, 34, 35, 36, 37, 38
];

const DIENTES_INFANTIL = [
  55, 54, 53, 52, 51,
  61, 62, 63, 64, 65,
  85, 84, 83, 82, 81,
  71, 72, 73, 74, 75
];

function generarPlantillaOdontograma(tipo = 'ADULTA') {
  const tipoNormalizado = (tipo || 'ADULTA').toUpperCase();
  const listaPiezas = tipoNormalizado === 'INFANTIL' ? DIENTES_INFANTIL : DIENTES_ADULTO;

  return {
    tipo_denticion: tipoNormalizado,
    total_piezas: listaPiezas.length,
    odontograma: listaPiezas.map((num) => ({
      numero_fdi: num,
      cara_vestibular: 'SANO',
      cara_lingual: 'SANO',
      cara_mesial: 'SANO',
      cara_distal: 'SANO',
      cara_oclusal: 'SANO',
      estado_general: 'NORMAL',
      en_puente_fijo: false,
      tiene_protesis_corona: false
    }))
  };
}

function calcularIndices(tipoDenticion, piezas = []) {
  let cariados = 0;
  let perdidos = 0;
  let obturados = 0;

  for (const pieza of piezas) {
    const estado = (pieza.estado_general || 'NORMAL').toUpperCase();
    const caras = [
      pieza.cara_vestibular,
      pieza.cara_lingual,
      pieza.cara_mesial,
      pieza.cara_distal,
      pieza.cara_oclusal
    ].map((c) => (c || 'SANO').toUpperCase());

    const tieneCaries = caras.includes('CARIES');
    const estaPerdido = estado === 'AUSENTE' || estado === 'EXTRACCION';
    const tieneObturacion = caras.includes('RESINA') || caras.includes('AMALGAMA') || Boolean(pieza.tiene_protesis_corona);

    if (estaPerdido) {
      perdidos++;
    } else if (tieneCaries) {
      cariados++;
    } else if (tieneObturacion) {
      obturados++;
    }
  }

  const sumaTotal = cariados + perdidos + obturados;
  const esInfantil = (tipoDenticion || '').toUpperCase() === 'INFANTIL';

  return {
    indice_cpod: esInfantil ? 0 : sumaTotal,
    indice_ceod: esInfantil ? sumaTotal : 0,
    desglose: {
      cariados,
      perdidos,
      obturados,
      total: sumaTotal
    }
  };
}

router.get(['/plantilla', '/plantilla/:tipo'], (req, res) => {
  const tipo = req.params.tipo || req.query.tipo || 'ADULTA';
  res.json(generarPlantillaOdontograma(tipo));
});

router.post('/calcular-indice', (req, res) => {
  const { tipo_denticion, piezas, odontograma } = req.body;
  const lista = piezas || odontograma || [];
  const resultado = calcularIndices(tipo_denticion, lista);
  res.json(resultado);
});

router.post('/', authenticateToken, requireRoles('ODONTOLOGO', 'DIRECCION'), async (req, res) => {
  const {
    atencion_id,
    motivo_consulta,
    observaciones,
    tipo_denticion = 'ADULTA',
    comorbilidades_bucales,
    estudios_gabinete,
    piezas = []
  } = req.body;

  if (!atencion_id || !motivo_consulta) {
    return res.status(400).json({ error: 'atencion_id y motivo_consulta son obligatorios.' });
  }

  const { indice_cpod, indice_ceod } = calcularIndices(tipo_denticion, piezas);
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const baseRes = await client.query(`
      INSERT INTO consultas_base (atencion_id, especialista_id, area_medica, motivo_consulta, observaciones)
      VALUES ($1, $2, 'ODONTOLOGIA', $3, $4)
      RETURNING id, fecha_hora
    `, [atencion_id, req.user.id, motivo_consulta, observaciones || null]);
    const consultaId = baseRes.rows[0].id;

    const odontoRes = await client.query(`
      INSERT INTO consultas_odontologia (consulta_id, tipo_denticion, comorbilidades_bucales, estudios_gabinete, indice_cpod, indice_ceod)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [consultaId, tipo_denticion.toUpperCase(), comorbilidades_bucales || null, estudios_gabinete || null, indice_cpod, indice_ceod]);
    const consultaOdontoId = odontoRes.rows[0].id;

    for (const p of piezas) {
      await client.query(`
        INSERT INTO piezas_dentales (
          consulta_odontologia_id, numero_fdi, cara_vestibular, cara_lingual,
          cara_mesial, cara_distal, cara_oclusal, estado_general,
          en_puente_fijo, tiene_protesis_corona
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        consultaOdontoId,
        p.numero_fdi,
        p.cara_vestibular || 'SANO',
        p.cara_lingual || 'SANO',
        p.cara_mesial || 'SANO',
        p.cara_distal || 'SANO',
        p.cara_oclusal || 'SANO',
        p.estado_general || 'NORMAL',
        Boolean(p.en_puente_fijo),
        Boolean(p.tiene_protesis_corona)
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Consulta odontológica guardada exitosamente.',
      consulta_id: consultaId,
      consulta_odontologia_id: consultaOdontoId,
      indice_cpod,
      indice_ceod,
      piezas_registradas: piezas.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar consulta: ' + error.message });
  } finally {
    client.release();
  }
});

router.get('/consulta/:id', authenticateToken, async (req, res) => {
  try {
    const consultaRes = await db.query(`
      SELECT cb.id as consulta_id, cb.fecha_hora, cb.motivo_consulta, cb.observaciones,
             co.id as consulta_odontologia_id, co.tipo_denticion, co.comorbilidades_bucales,
             co.estudios_gabinete, co.indice_cpod, co.indice_ceod,
             u.nombre as doctor_nombre, u.apellidos as doctor_apellidos
      FROM consultas_base cb
      JOIN consultas_odontologia co ON co.consulta_id = cb.id
      JOIN usuarios u ON u.id = cb.especialista_id
      WHERE cb.id = $1
    `, [req.params.id]);

    if (consultaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Consulta no encontrada.' });
    }

    const consulta = consultaRes.rows[0];
    const piezasRes = await db.query(`
      SELECT numero_fdi, cara_vestibular, cara_lingual, cara_mesial, cara_distal,
             cara_oclusal, estado_general, en_puente_fijo, tiene_protesis_corona
      FROM piezas_dentales
      WHERE consulta_odontologia_id = $1
      ORDER BY numero_fdi ASC
    `, [consulta.consulta_odontologia_id]);

    consulta.piezas = piezasRes.rows;
    res.json(consulta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
