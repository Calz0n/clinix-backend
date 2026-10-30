const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
const nutricionReport = require('../reportes/nutricion');
const odontologiaReport = require('../reportes/odontologia');
const psicologiaReport = require('../reportes/psicologia');
const medicinaGeneralReport = require('../reportes/medicina_general');
const enfermeriaReport = require('../reportes/enfermeria');
const concentradoGeneralReport = require('../reportes/concentrado_general');
const certificadosReport = require('../reportes/certificados');
const { resolverNombreProfesional, resolverUnidadMedica } = require('../reportes/common/profesionalHelper');

const { obtenerLogoHtml } = require('../reportes/common/logo');

function obtenerLogoOficialHtml() {
  return obtenerLogoHtml({ height: 48, maxWidth: 300 });
}

// 1. GET /api/estadisticas/diario (Datos JSON)
// 0. GET /api/estadisticas/tablero-resumen (Totales ejecutivos para el Tablero Municipal)
router.get('/tablero-resumen', async (req, res) => {
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
});

router.get('/diario', async (req, res) => {
  const { fecha = new Date().toISOString().split('T')[0], area = 'MEDICINA_GENERAL' } = req.query;

  try {
    const query = `
      SELECT ac.id as atencion_id, ac.tipo_atencion, ac.estado, ac.fecha_hora_ingreso,
             p.id as paciente_id, p.nombres, p.apellido_paterno, p.apellido_materno,
             p.fecha_nacimiento, p.sexo, p.numero_expediente,
             t.tension_arterial, t.frecuencia_cardiaca, t.frecuencia_respiratoria,
             t.temperatura, t.saturacion_oxigeno, t.glucosa_capilar, t.peso_kg, t.talla_metros, t.imc,
             cb.id as consulta_id, cb.motivo_consulta,
             cm.diagnostico_cie10, cm.diagnostico_descripcion, cm.clasificacion_morbilidad, cm.pruebas_rapidas, cm.canalizacion_externa,
             cn.circunferencia_cintura, cn.circunferencia_cadera,
             co.indice_cpod, co.tipo_denticion
      FROM atenciones_clinicas ac
      JOIN pacientes p ON p.id = ac.paciente_id
      LEFT JOIN triaje_signos_vitales t ON t.atencion_id = ac.id
      LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id AND cb.area_medica = $2
      LEFT JOIN consultas_medicina_general cm ON cm.consulta_id = cb.id
      LEFT JOIN consultas_nutricion cn ON cn.consulta_id = cb.id
      LEFT JOIN consultas_odontologia co ON co.consulta_id = cb.id
      WHERE DATE(ac.fecha_hora_ingreso) = $1
        AND (
          $2 = 'GENERAL' OR
          ($2 = 'MEDICINA_GENERAL' AND (ac.area_servicio ILIKE '%MEDICINA%' OR cb.area_medica = 'MEDICINA_GENERAL' OR (ac.area_servicio IS NULL AND cb.id IS NULL))) OR
          ($2 = 'ENFERMERIA' AND (ac.area_servicio ILIKE '%ENFERM%' OR t.id IS NOT NULL)) OR
          ($2 = 'ODONTOLOGIA' AND (ac.area_servicio ILIKE '%ODONTO%' OR cb.area_medica = 'ODONTOLOGIA')) OR
          ($2 = 'NUTRICION' AND (ac.area_servicio ILIKE '%NUTRI%' OR cb.area_medica = 'NUTRICION')) OR
          ($2 = 'PSICOLOGIA' AND (ac.area_servicio ILIKE '%PSICO%' OR cb.area_medica = 'PSICOLOGIA'))
        )
      ORDER BY ac.fecha_hora_ingreso ASC
    `;
    const result = await db.query(query, [fecha, area.toUpperCase()]);

    const hoy = new Date(fecha);
    const pacientes = result.rows.map((row, index) => {
      const nac = new Date(row.fecha_nacimiento);
      let edad = hoy.getFullYear() - nac.getFullYear();
      return {
        numero: index + 1,
        nombre: `${row.nombres} ${row.apellido_paterno} ${row.apellido_materno || ''}`.trim(),
        edad,
        sexo: row.sexo,
        tipo_atencion: row.tipo_atencion,
        diagnostico: row.diagnostico_descripcion || row.motivo_consulta || 'En espera / Valoración',
        morbilidad: row.clasificacion_morbilidad || 'General',
        talla: row.talla_metros || '-',
        peso: row.peso_kg || '-',
        imc: row.imc || '-',
        ta: row.tension_arterial || '-',
        glucosa: row.glucosa_capilar || '-'
      };
    });

    res.json({
      fecha,
      area: area.toUpperCase(),
      total_pacientes: pacientes.length,
      pacientes
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar reporte diario: ' + err.message });
  }
});

// 2. GET /api/estadisticas/diario/excel (Descarga de Hoja Diaria con formato idéntico para Excel)
router.get(['/diario/excel', '/diario/csv'], async (req, res) => {
  const { fecha = new Date().toISOString().split('T')[0], area = 'MEDICINA_GENERAL' } = req.query;

  if (area.toUpperCase() === 'ENFERMERIA') {
    try {
      const datos = await enfermeriaReport.obtenerDatosDiarios(db, fecha, req.query.unidad_id);
      datos.enfermero = await resolverNombreProfesional(db, req, 'ENFERMERIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const excel = enfermeriaReport.renderizarDiarioExcel(datos);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="hoja_diaria_enfermeria_${fecha}.xls"`);
      return res.send('\uFEFF' + excel);
    } catch (err) {
      return res.status(500).json({ error: 'Error al exportar Hoja Diaria Enfermería: ' + err.message });
    }
  }

  if (area.toUpperCase() === 'MEDICINA_GENERAL' || area.toUpperCase() === 'MEDICINA') {
    try {
      const datos = await medicinaGeneralReport.obtenerDatosDiarios(db, fecha, req.query.unidad_id);
      datos.medico = await resolverNombreProfesional(db, req, 'MEDICINA_GENERAL');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const excel = medicinaGeneralReport.renderizarDiarioExcel(datos);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="hoja_diaria_medicina_general_${fecha}.xls"`);
      return res.send('\uFEFF' + excel);
    } catch (err) {
      return res.status(500).json({ error: 'Error al exportar Hoja Diaria Medicina General: ' + err.message });
    }
  }

  if (area.toUpperCase() === 'PSICOLOGIA') {
    try {
      const datos = await psicologiaReport.obtenerDatosDiarios(db, fecha, req.query.unidad_id);
      datos.psicologo = await resolverNombreProfesional(db, req, 'PSICOLOGIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const excel = psicologiaReport.renderizarDiarioExcel(datos);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="hoja_diaria_psicologia_${fecha}.xls"`);
      return res.send('\uFEFF' + excel);
    } catch (err) {
      return res.status(500).json({ error: 'Error al exportar Hoja Diaria Psicología: ' + err.message });
    }
  }

  if (area.toUpperCase() === 'ODONTOLOGIA') {
    try {
      const datos = await odontologiaReport.obtenerDatosDiarios(db, fecha, req.query.unidad_id);
      datos.odontologo = await resolverNombreProfesional(db, req, 'ODONTOLOGIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const excel = odontologiaReport.renderizarDiarioExcel(datos);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="hoja_diaria_odontologia_${fecha}.xls"`);
      return res.send('﻿' + excel);
    } catch (err) {
      return res.status(500).json({ error: 'Error al exportar Hoja Diaria Odontología: ' + err.message });
    }
  }



  if (area.toUpperCase() === 'NUTRICION') {
    try {
      const datos = await nutricionReport.obtenerDatosDiarios(db, fecha, req.query.unidad_id);
      datos.nutriologo = await resolverNombreProfesional(db, req, 'NUTRICION');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const excel = nutricionReport.renderizarDiarioExcel(datos);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="hoja_diaria_nutricion_${fecha}.xls"`);
      return res.send('\uFEFF' + excel);
    } catch (err) {
      return res.status(500).json({ error: 'Error al exportar Hoja Diaria Nutrición: ' + err.message });
    }
  }

  try {
    const dataRes = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/estadisticas/diario?fecha=${fecha}&area=${area}`);
    const data = await dataRes.json();
    const pacientes = data.pacientes || [];
    const [anio, mes, dia] = fecha.split('-');

    const filasCompletas = [...pacientes];
    while (filasCompletas.length < 15) {
      filasCompletas.push({ numero: filasCompletas.length + 1, nombre: '', edad: '', sexo: '', tipo_atencion: '', diagnostico: '', morbilidad: '', talla: '', peso: '', imc: '', ta: '', glucosa: '' });
    }

    const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Hoja Diaria</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 9pt; }
        th, td { border: 1px solid #000000; padding: 4px; text-align: center; vertical-align: middle; }
        .hdr-main { background-color: #701128; color: #ffffff; font-size: 13pt; font-weight: bold; text-align: center; }
        .hdr-sub { background-color: #f7f7f7; color: #701128; font-size: 10pt; font-weight: bold; text-align: center; }
        .hdr-meta { background-color: #eaeaea; font-size: 9pt; font-weight: bold; }
        .th-col { background-color: #d9d9d9; font-weight: bold; font-size: 8.5pt; color: #000000; }
        .text-left { text-align: left; }
        .row-total { background-color: #e6e6e6; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <th colspan="12" class="hdr-main">GOBIERNO DE LA CIUDAD DE COATZACOALCOS 2026 - 2029</th>
        </tr>
        <tr>
          <th colspan="12" class="hdr-sub">DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL &bull; HOJA DIARIA DE ATENCIÓN (${area.replace('_', ' ')})</th>
        </tr>
        <tr>
          <td colspan="6" class="hdr-meta text-left"><strong>Unidad Médica:</strong> Sede Central Malpica &nbsp;|&nbsp; <strong>Especialidad:</strong> ${area.replace('_', ' ')}</td>
          <td colspan="6" class="hdr-meta"><strong>FECHA:</strong> ${dia}/${mes}/${anio} &nbsp;|&nbsp; <strong>TOTAL PACIENTES:</strong> ${pacientes.length}</td>
        </tr>
        <tr>
          <th class="th-col" style="width: 35px;">No.</th>
          <th class="th-col" style="width: 220px;">NOMBRE DEL PACIENTE</th>
          <th class="th-col" style="width: 45px;">EDAD</th>
          <th class="th-col" style="width: 40px;">SEXO</th>
          <th class="th-col" style="width: 100px;">TIPO ATENCIÓN</th>
          <th class="th-col" style="width: 55px;">TALLA</th>
          <th class="th-col" style="width: 55px;">PESO</th>
          <th class="th-col" style="width: 55px;">IMC</th>
          <th class="th-col" style="width: 65px;">T/A</th>
          <th class="th-col" style="width: 65px;">GLUCOSA</th>
          <th class="th-col" style="width: 240px;">DIAGNÓSTICO / MOTIVO CLÍNICO</th>
          <th class="th-col" style="width: 180px;">CLASIFICACIÓN DE MORBILIDAD</th>
        </tr>
        ${filasCompletas.map(f => `
          <tr>
            <td>${f.numero}</td>
            <td class="text-left"><strong>${f.nombre}</strong></td>
            <td>${f.edad}</td>
            <td>${f.sexo}</td>
            <td>${f.tipo_atencion}</td>
            <td>${f.talla}</td>
            <td>${f.peso}</td>
            <td>${f.imc}</td>
            <td>${f.ta}</td>
            <td>${f.glucosa}</td>
            <td class="text-left">${f.diagnostico}</td>
            <td class="text-left">${f.morbilidad}</td>
          </tr>
        `).join('')}
        <tr class="row-total">
          <td colspan="2">TOTAL REGISTRADO</td>
          <td colspan="2">F: ${pacientes.filter(p => p.sexo === 'F').length} | M: ${pacientes.filter(p => p.sexo === 'M').length}</td>
          <td colspan="7">1RA VEZ: ${pacientes.filter(p => p.tipo_atencion === 'PRIMERA_VEZ').length} | SUBSECUENTE: ${pacientes.filter(p => p.tipo_atencion === 'SUBSECUENTE').length}</td>
          <td>TOTAL: ${pacientes.length}</td>
        </tr>
      </table>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="hoja_diaria_${area.toLowerCase()}_${fecha}.xls"`);
    res.send('\uFEFF' + excelHtml);
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar Excel: ' + err.message });
  }
});

// 3. GET /api/estadisticas/diario/pdf (Vista oficial con botón a Excel formateado)
router.get('/diario/pdf', async (req, res) => {
  const { fecha = new Date().toISOString().split('T')[0], area = 'MEDICINA_GENERAL' } = req.query;

  if (area.toUpperCase() === 'ENFERMERIA') {
    try {
      const datos = await enfermeriaReport.obtenerDatosDiarios(db, fecha, req.query.unidad_id);
      datos.enfermero = await resolverNombreProfesional(db, req, 'ENFERMERIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const html = enfermeriaReport.renderizarDiarioHtml(datos);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return res.status(500).json({ error: 'Error al generar Hoja Diaria Enfermería: ' + err.message });
    }
  }

  if (area.toUpperCase() === 'MEDICINA_GENERAL' || area.toUpperCase() === 'MEDICINA' || area.toUpperCase() === 'GENERAL') {
    try {
      const datos = await medicinaGeneralReport.obtenerDatosDiarios(db, fecha, req.query.unidad_id);
      datos.medico = await resolverNombreProfesional(db, req, 'MEDICINA_GENERAL');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const html = medicinaGeneralReport.renderizarDiarioHtml(datos);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return res.status(500).json({ error: 'Error al generar Hoja Diaria Medicina General: ' + err.message });
    }
  }

  if (area.toUpperCase() === 'PSICOLOGIA') {
    try {
      const datos = await psicologiaReport.obtenerDatosDiarios(db, fecha, req.query.unidad_id);
      datos.psicologo = await resolverNombreProfesional(db, req, 'PSICOLOGIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const html = psicologiaReport.renderizarDiarioHtml(datos);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return res.status(500).json({ error: 'Error al generar Hoja Diaria Psicología: ' + err.message });
    }
  }

  if (area.toUpperCase() === 'ODONTOLOGIA') {
    try {
      const datos = await odontologiaReport.obtenerDatosDiarios(db, fecha, req.query.unidad_id);
      datos.odontologo = await resolverNombreProfesional(db, req, 'ODONTOLOGIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const html = odontologiaReport.renderizarDiarioHtml(datos);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return res.status(500).json({ error: 'Error al generar Hoja Diaria Odontología: ' + err.message });
    }
  }

  if (area.toUpperCase() === 'NUTRICION') {
    try {
      const datos = await nutricionReport.obtenerDatosDiarios(db, fecha, req.query.unidad_id);
      datos.nutriologo = await resolverNombreProfesional(db, req, 'NUTRICION');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const html = nutricionReport.renderizarDiarioHtml(datos);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return res.status(500).json({ error: 'Error al generar Hoja Diaria Nutrición: ' + err.message });
    }
  }

  try {
    const dataRes = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/estadisticas/diario?fecha=${fecha}&area=${area}`);
    const data = await dataRes.json();
    const pacientes = data.pacientes || [];
    const [anio, mes, dia] = fecha.split('-');

    const logoHtml = obtenerLogoOficialHtml();

    const filasCompletas = [...pacientes];
    while (filasCompletas.length < 15) {
      filasCompletas.push({ numero: filasCompletas.length + 1, nombre: '', edad: '', sexo: '', tipo_atencion: '', diagnostico: '', morbilidad: '', talla: '', peso: '', imc: '', ta: '', glucosa: '' });
    }

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Hoja Diaria Oficial - ${area}</title>
      <style>
        @page { size: landscape; margin: 5mm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 8px; margin: 0; color: #111; }
        .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #701128; padding-bottom: 4px; margin-bottom: 5px; }
        .brand-section { display: flex; align-items: center; gap: 14px; }
        .dept-title { font-size: 9px; font-weight: bold; color: #701128; line-height: 1.2; text-transform: uppercase; border-left: 2px solid #b38e5d; padding-left: 10px; }
        .right-box { text-align: right; }
        .sheet-title { font-size: 11px; font-weight: bold; color: #701128; margin: 0 0 3px 0; text-transform: uppercase; }
        .date-grid { display: inline-flex; border: 1px solid #333; }
        .date-cell { border-left: 1px solid #333; padding: 2px 7px; text-align: center; font-size: 7.5px; }
        .date-cell:first-child { border-left: none; }
        .date-cell strong { display: block; font-size: 9.5px; }
        .sub-header { display: flex; justify-content: space-between; font-size: 8.5px; margin-bottom: 4px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #333; padding: 3px 2px; text-align: center; height: 16px; }
        th { background: #f4f4f4; font-size: 7px; font-weight: bold; color: #111; }
        .text-left { text-align: left; padding-left: 4px; }
        .total-row { background: #eaeaea; font-weight: bold; font-size: 8px; }
        .no-print { margin: 8px 0; display: flex; gap: 10px; align-items: center; }
        .btn-print { background: #701128; color: white; border: none; padding: 6px 14px; font-size: 11px; cursor: pointer; border-radius: 3px; font-weight: bold; }
        .btn-excel { background: #107c41; color: white; text-decoration: none; padding: 6px 14px; font-size: 11px; border-radius: 3px; font-weight: bold; display: inline-block; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print">
        <button class="btn-print" onclick="window.print()">📥 Imprimir / Guardar como PDF</button>
        <a href="/api/estadisticas/diario/excel?fecha=${fecha}&area=${area}" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
      </div>

      <div class="header-container">
        <div class="brand-section">
          ${logoHtml}
          <div class="dept-title">
            Dirección de<br>Salud Pública<br>Municipal
          </div>
        </div>

        <div class="right-box">
          <div class="sheet-title">HOJA DIARIA DE ATENCIÓN (${area.replace('_', ' ')})</div>
          <div class="date-grid">
            <div class="date-cell">DÍA<strong>${dia}</strong></div>
            <div class="date-cell">MES<strong>${mes}</strong></div>
            <div class="date-cell">AÑO<strong>${anio}</strong></div>
          </div>
        </div>
      </div>

      <div class="sub-header">
        <div><strong>Unidad Médica:</strong> Sede Central Malpica &nbsp;|&nbsp; <strong>Especialidad:</strong> ${area.replace('_', ' ')}</div>
        <div><strong>Total Pacientes del Turno:</strong> ${pacientes.length}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 25px;">No.</th>
            <th style="width: 175px;">NOMBRE DEL PACIENTE</th>
            <th style="width: 32px;">EDAD</th>
            <th style="width: 24px;">SEXO</th>
            <th style="width: 65px;">TIPO</th>
            <th style="width: 35px;">TALLA</th>
            <th style="width: 35px;">PESO</th>
            <th style="width: 35px;">IMC</th>
            <th style="width: 45px;">T/A</th>
            <th style="width: 38px;">GLUCOSA</th>
            <th>DIAGNÓSTICO / MOTIVO CLÍNICO</th>
            <th style="width: 135px;">CLASIFICACIÓN DE MORBILIDAD</th>
          </tr>
        </thead>
        <tbody>
          ${filasCompletas.map(f => `
            <tr>
              <td>${f.numero}</td>
              <td class="text-left"><strong>${f.nombre}</strong></td>
              <td>${f.edad}</td>
              <td>${f.sexo}</td>
              <td>${f.tipo_atencion}</td>
              <td>${f.talla}</td>
              <td>${f.peso}</td>
              <td>${f.imc}</td>
              <td>${f.ta}</td>
              <td>${f.glucosa}</td>
              <td class="text-left">${f.diagnostico}</td>
              <td class="text-left">${f.morbilidad}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2">TOTAL REGISTRADO</td>
            <td colspan="2">F: ${pacientes.filter(p => p.sexo === 'F').length} | M: ${pacientes.filter(p => p.sexo === 'M').length}</td>
            <td colspan="7">1RA VEZ: ${pacientes.filter(p => p.tipo_atencion === 'PRIMERA_VEZ').length} | SUBSECUENTE: ${pacientes.filter(p => p.tipo_atencion === 'SUBSECUENTE').length}</td>
            <td>TOTAL: ${pacientes.length}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: 'Error al generar vista oficial: ' + err.message });
  }
});

// CONFIGURACIÓN DINÁMICA DE REPORTES MENSUALES POR ESPECIALIDAD CLÍNICA
const CONFIG_AREAS = {
  GENERAL: {
    codigo: 'GENERAL',
    nombre: 'Concentrado General (Todas las áreas)',
    subtitulo: 'CONCENTRADO GENERAL MENSUAL — TODAS LAS ÁREAS MUNICIPALES',
    thGrupos: [
      { titulo: 'SEXO', colSpan: 2 },
      { titulo: 'TIPO ATENCIÓN', colSpan: 2 },
      { titulo: 'ATENCIONES POR ÁREA DE SERVICIO', colSpan: 5 },
    ],
    columnas: [
      { key: 'femenino', label: 'F', width: '40px' },
      { key: 'masculino', label: 'M', width: '40px' },
      { key: 'primera_vez', label: '1RA VEZ', width: '65px' },
      { key: 'subsecuente', label: 'SUBSEC', width: '65px' },
      { key: 'medicina_general', label: 'MED. GENERAL', width: '90px' },
      { key: 'enfermeria', label: 'ENFERMERÍA', width: '90px' },
      { key: 'odontologia', label: 'ODONTOLOGÍA', width: '90px' },
      { key: 'nutricion', label: 'NUTRICIÓN', width: '85px' },
      { key: 'psicologia', label: 'PSICOLOGÍA', width: '85px' },
    ]
  },
  MEDICINA_GENERAL: {
    codigo: 'MEDICINA_GENERAL',
    nombre: 'Medicina General',
    subtitulo: 'CONCENTRADO MENSUAL DE ATENCIONES — MEDICINA GENERAL',
    thGrupos: [
      { titulo: 'SEXO', colSpan: 2 },
      { titulo: 'TIPO CONSULTA', colSpan: 2 },
      { titulo: 'CANALIZACIONES', colSpan: 2 },
      { titulo: 'MORBILIDAD / DIAGNÓSTICOS CIE-10', colSpan: 4 },
    ],
    columnas: [
      { key: 'femenino', label: 'F', width: '40px' },
      { key: 'masculino', label: 'M', width: '40px' },
      { key: 'primera_vez', label: '1RA VEZ', width: '65px' },
      { key: 'subsecuente', label: 'SUBSEC', width: '65px' },
      { key: 'canalizados_displasia', label: 'DISPLASIA', width: '80px' },
      { key: 'canalizados_capasits', label: 'CAPASITS', width: '80px' },
      { key: 'respiratorias', label: 'RESPIRATORIAS', width: '100px' },
      { key: 'digestivas', label: 'DIGESTIVAS', width: '100px' },
      { key: 'cardio_hta', label: 'CARDIO / HTA', width: '100px' },
      { key: 'otras_morbilidades', label: 'OTRAS', width: '90px' },
    ]
  },
  ENFERMERIA: {
    codigo: 'ENFERMERIA',
    nombre: 'Triaje y Enfermería',
    subtitulo: 'CONCENTRADO MENSUAL DE ATENCIONES — TRIAJE Y ENFERMERÍA',
    thGrupos: [
      { titulo: 'SEXO', colSpan: 2 },
      { titulo: 'TIPO ATENCIÓN', colSpan: 2 },
      { titulo: 'DETECCIONES OPORTUNAS DE RIESGO', colSpan: 3 },
      { titulo: 'PROCEDIMIENTOS DE ENFERMERÍA', colSpan: 3 },
    ],
    columnas: [
      { key: 'femenino', label: 'F', width: '40px' },
      { key: 'masculino', label: 'M', width: '40px' },
      { key: 'primera_vez', label: '1RA VEZ', width: '65px' },
      { key: 'subsecuente', label: 'SUBSEC', width: '65px' },
      { key: 'det_hta', label: 'HTA (T/A ALTA)', width: '85px' },
      { key: 'det_diabetes', label: 'GLUCOSA ALTA', width: '85px' },
      { key: 'det_obesidad', label: 'SOBREPESO/OBES.', width: '95px' },
      { key: 'proc_curaciones', label: 'CURACIONES', width: '85px' },
      { key: 'proc_inyecciones', label: 'INYECCIONES', width: '85px' },
      { key: 'proc_otros', label: 'OTROS PROC.', width: '85px' },
    ]
  },
  ODONTOLOGIA: {
    codigo: 'ODONTOLOGIA',
    nombre: 'Odontología',
    subtitulo: 'CONCENTRADO MENSUAL DE ATENCIONES — ODONTOLOGÍA',
    thGrupos: [
      { titulo: 'SEXO', colSpan: 2 },
      { titulo: 'TIPO CONSULTA', colSpan: 2 },
      { titulo: 'POBLACIÓN / DENTICIÓN', colSpan: 2 },
      { titulo: 'PROCEDIMIENTOS ESTOMATOLÓGICOS', colSpan: 4 },
    ],
    columnas: [
      { key: 'femenino', label: 'F', width: '40px' },
      { key: 'masculino', label: 'M', width: '40px' },
      { key: 'primera_vez', label: '1RA VEZ', width: '65px' },
      { key: 'subsecuente', label: 'SUBSEC', width: '65px' },
      { key: 'dent_infantil', label: 'INFANTIL', width: '75px' },
      { key: 'dent_adulta', label: 'ADULTA', width: '75px' },
      { key: 'proc_profilaxis', label: 'PROFILAXIS/FLÚOR', width: '100px' },
      { key: 'proc_obturacion', label: 'OBTURACIONES', width: '95px' },
      { key: 'proc_extraccion', label: 'EXTRACCIONES', width: '90px' },
      { key: 'proc_urgencias', label: 'URGENCIAS/OTRAS', width: '95px' },
    ]
  },
  NUTRICION: {
    codigo: 'NUTRICION',
    nombre: 'Nutrición',
    subtitulo: 'CONCENTRADO MENSUAL DE ATENCIONES — NUTRICIÓN',
    thGrupos: [
      { titulo: 'SEXO', colSpan: 2 },
      { titulo: 'TIPO CONSULTA', colSpan: 2 },
      { titulo: 'ESTADO NUTRICIONAL (EVALUACIÓN IMC)', colSpan: 4 },
      { titulo: 'CONDICIONES ASOCIADAS', colSpan: 1 },
    ],
    columnas: [
      { key: 'femenino', label: 'F', width: '40px' },
      { key: 'masculino', label: 'M', width: '40px' },
      { key: 'primera_vez', label: '1RA VEZ', width: '65px' },
      { key: 'subsecuente', label: 'SUBSEC', width: '65px' },
      { key: 'nutri_bajo_peso', label: 'BAJO PESO', width: '80px' },
      { key: 'nutri_normopeso', label: 'NORMOPESO', width: '85px' },
      { key: 'nutri_sobrepeso', label: 'SOBREPESO', width: '85px' },
      { key: 'nutri_obesidad', label: 'OBESIDAD', width: '80px' },
      { key: 'cronicos_asoc', label: 'DIABETES / HTA', width: '100px' },
    ]
  },
  PSICOLOGIA: {
    codigo: 'PSICOLOGIA',
    nombre: 'Psicología',
    subtitulo: 'CONCENTRADO MENSUAL DE ATENCIONES — PSICOLOGÍA',
    thGrupos: [
      { titulo: 'SEXO', colSpan: 2 },
      { titulo: 'TIPO CONSULTA', colSpan: 2 },
      { titulo: 'MOTIVOS DE ATENCIÓN Y DIAGNÓSTICO', colSpan: 4 },
    ],
    columnas: [
      { key: 'femenino', label: 'F', width: '40px' },
      { key: 'masculino', label: 'M', width: '40px' },
      { key: 'primera_vez', label: '1RA VEZ', width: '65px' },
      { key: 'subsecuente', label: 'SUBSEC', width: '65px' },
      { key: 'psico_ansiedad', label: 'ANSIEDAD / ESTRÉS', width: '110px' },
      { key: 'psico_depresion', label: 'DEPRESIÓN / DUELO', width: '110px' },
      { key: 'psico_familiar', label: 'FAMILIA / PAREJA', width: '110px' },
      { key: 'psico_otros', label: 'OTROS MOTIVOS', width: '100px' },
    ]
  }
};

// 4. GET /api/estadisticas/mensual (Datos JSON desagregados por área)
router.get('/mensual', async (req, res) => {
  const anio = parseInt(req.query.anio || new Date().getFullYear(), 10);
  const mes = parseInt(req.query.mes || (new Date().getMonth() + 1), 10);
  const area = (req.query.area || 'GENERAL').toUpperCase();
  const configArea = CONFIG_AREAS[area] || CONFIG_AREAS.GENERAL;

  try {
    const totalDias = new Date(anio, mes, 0).getDate();

    let filtroAreaSql = '';
    if (area === 'MEDICINA_GENERAL') {
      filtroAreaSql = "AND (ac.area_servicio ILIKE '%MEDICINA%' OR cb.area_medica = 'MEDICINA_GENERAL' OR (ac.area_servicio IS NULL AND cb.id IS NULL))";
    } else if (area === 'ENFERMERIA') {
      filtroAreaSql = "AND (ac.area_servicio ILIKE '%ENFERM%' OR t.id IS NOT NULL)";
    } else if (area === 'ODONTOLOGIA') {
      filtroAreaSql = "AND (ac.area_servicio ILIKE '%ODONTO%' OR cb.area_medica = 'ODONTOLOGIA')";
    } else if (area === 'NUTRICION') {
      filtroAreaSql = "AND (ac.area_servicio ILIKE '%NUTRI%' OR cb.area_medica = 'NUTRICION')";
    } else if (area === 'PSICOLOGIA') {
      filtroAreaSql = "AND (ac.area_servicio ILIKE '%PSICO%' OR cb.area_medica = 'PSICOLOGIA')";
    }

    const dailyQuery = `
      WITH proc_agg AS (
        SELECT t.atencion_id,
               COUNT(*) FILTER (WHERE pe.tipo_procedimiento ILIKE '%curaci%') as curaciones,
               COUNT(*) FILTER (WHERE pe.tipo_procedimiento ILIKE '%inyecc%' OR pe.tipo_procedimiento ILIKE '%medicaci%') as inyecciones,
               COUNT(*) FILTER (WHERE pe.tipo_procedimiento NOT ILIKE '%curaci%' AND pe.tipo_procedimiento NOT ILIKE '%inyecc%' AND pe.tipo_procedimiento NOT ILIKE '%medicaci%') as otros_proc
        FROM triaje_signos_vitales t
        JOIN procedimientos_enfermeria pe ON pe.triaje_id = t.id
        GROUP BY t.atencion_id
      )
      SELECT EXTRACT(DAY FROM ac.fecha_hora_ingreso)::INT as dia,
             COUNT(DISTINCT ac.id) as total_consultas,
             COUNT(DISTINCT ac.id) FILTER (WHERE p.sexo = 'F') as femenino,
             COUNT(DISTINCT ac.id) FILTER (WHERE p.sexo = 'M') as masculino,
             COUNT(DISTINCT ac.id) FILTER (WHERE ac.tipo_atencion = 'PRIMERA_VEZ') as primera_vez,
             COUNT(DISTINCT ac.id) FILTER (WHERE ac.tipo_atencion = 'SUBSECUENTE') as subsecuente,
             
             -- Indicadores para Concentrado General:
             COUNT(DISTINCT ac.id) FILTER (WHERE ac.area_servicio ILIKE '%MEDICINA%' OR cb.area_medica = 'MEDICINA_GENERAL' OR (ac.area_servicio IS NULL AND cb.id IS NULL)) as medicina_general,
             COUNT(DISTINCT ac.id) FILTER (WHERE ac.area_servicio ILIKE '%ENFERM%') as enfermeria,
             COUNT(DISTINCT ac.id) FILTER (WHERE ac.area_servicio ILIKE '%ODONTO%' OR cb.area_medica = 'ODONTOLOGIA') as odontologia,
             COUNT(DISTINCT ac.id) FILTER (WHERE ac.area_servicio ILIKE '%NUTRI%' OR cb.area_medica = 'NUTRICION') as nutricion,
             COUNT(DISTINCT ac.id) FILTER (WHERE ac.area_servicio ILIKE '%PSICO%' OR cb.area_medica = 'PSICOLOGIA') as psicologia,

             -- Indicadores para Medicina General:
             COUNT(DISTINCT ac.id) FILTER (WHERE cm.canalizacion_externa ILIKE '%DISPLASIA%') as canalizados_displasia,
             COUNT(DISTINCT ac.id) FILTER (WHERE cm.canalizacion_externa ILIKE '%CAPASITS%') as canalizados_capasits,
             COUNT(DISTINCT ac.id) FILTER (WHERE cm.clasificacion_morbilidad ILIKE '%RESPIRATORIA%' OR cm.diagnostico_descripcion ILIKE '%respirator%' OR cm.diagnostico_descripcion ILIKE '%faring%' OR cm.diagnostico_descripcion ILIKE '%bronq%') as respiratorias,
             COUNT(DISTINCT ac.id) FILTER (WHERE cm.clasificacion_morbilidad ILIKE '%DIGESTIV%' OR cm.diagnostico_descripcion ILIKE '%gastr%' OR cm.diagnostico_descripcion ILIKE '%diarrea%' OR cm.diagnostico_descripcion ILIKE '%colitis%') as digestivas,
             COUNT(DISTINCT ac.id) FILTER (WHERE cm.clasificacion_morbilidad ILIKE '%CARDIO%' OR cm.clasificacion_morbilidad ILIKE '%HIPERTEN%' OR cm.clasificacion_morbilidad ILIKE '%HTA%' OR cm.diagnostico_descripcion ILIKE '%hiperten%') as cardio_hta,
             COUNT(DISTINCT ac.id) FILTER (WHERE cm.consulta_id IS NOT NULL AND NOT (
               cm.clasificacion_morbilidad ILIKE '%RESPIRATORIA%' OR cm.diagnostico_descripcion ILIKE '%respirator%' OR cm.diagnostico_descripcion ILIKE '%faring%' OR cm.diagnostico_descripcion ILIKE '%bronq%' OR
               cm.clasificacion_morbilidad ILIKE '%DIGESTIV%' OR cm.diagnostico_descripcion ILIKE '%gastr%' OR cm.diagnostico_descripcion ILIKE '%diarrea%' OR cm.diagnostico_descripcion ILIKE '%colitis%' OR
               cm.clasificacion_morbilidad ILIKE '%CARDIO%' OR cm.clasificacion_morbilidad ILIKE '%HIPERTEN%' OR cm.clasificacion_morbilidad ILIKE '%HTA%' OR cm.diagnostico_descripcion ILIKE '%hiperten%'
             )) as otras_morbilidades,

             -- Indicadores para Triaje y Enfermería:
             COUNT(DISTINCT ac.id) FILTER (WHERE t.tension_arterial ~ '^(1[4-9]\\d|[2-9]\\d{2})/' OR t.detecciones_riesgo ILIKE '%hiperten%') as det_hta,
             COUNT(DISTINCT ac.id) FILTER (WHERE t.glucosa_capilar >= 126 OR t.detecciones_riesgo ILIKE '%diabet%' OR t.detecciones_riesgo ILIKE '%glucosa%') as det_diabetes,
             COUNT(DISTINCT ac.id) FILTER (WHERE t.imc >= 25.0 OR t.clasificacion_imc ILIKE '%sobrepeso%' OR t.clasificacion_imc ILIKE '%obesidad%') as det_obesidad,
             COALESCE(SUM(pa.curaciones), 0) as proc_curaciones,
             COALESCE(SUM(pa.inyecciones), 0) as proc_inyecciones,
             COALESCE(SUM(pa.otros_proc), 0) as proc_otros,

             -- Indicadores para Odontología:
             COUNT(DISTINCT ac.id) FILTER (WHERE co.tipo_denticion = 'INFANTIL') as dent_infantil,
             COUNT(DISTINCT ac.id) FILTER (WHERE co.tipo_denticion = 'ADULTA' OR co.tipo_denticion IS NULL) as dent_adulta,
             COUNT(DISTINCT ac.id) FILTER (WHERE cb.motivo_consulta ILIKE '%limpieza%' OR cb.motivo_consulta ILIKE '%profilaxis%' OR cb.motivo_consulta ILIKE '%fluor%') as proc_profilaxis,
             COUNT(DISTINCT ac.id) FILTER (WHERE cb.motivo_consulta ILIKE '%obturaci%' OR cb.motivo_consulta ILIKE '%resina%' OR cb.motivo_consulta ILIKE '%amalgama%' OR cb.observaciones ILIKE '%obturaci%') as proc_obturacion,
             COUNT(DISTINCT ac.id) FILTER (WHERE cb.motivo_consulta ILIKE '%extracci%' OR cb.observaciones ILIKE '%extracci%') as proc_extraccion,
             COUNT(DISTINCT ac.id) FILTER (WHERE co.consulta_id IS NOT NULL AND NOT (
               cb.motivo_consulta ILIKE '%limpieza%' OR cb.motivo_consulta ILIKE '%profilaxis%' OR cb.motivo_consulta ILIKE '%fluor%' OR
               cb.motivo_consulta ILIKE '%obturaci%' OR cb.motivo_consulta ILIKE '%resina%' OR cb.motivo_consulta ILIKE '%amalgama%' OR cb.observaciones ILIKE '%obturaci%' OR
               cb.motivo_consulta ILIKE '%extracci%' OR cb.observaciones ILIKE '%extracci%'
             )) as proc_urgencias,

             -- Indicadores para Nutrición:
             COUNT(DISTINCT ac.id) FILTER (WHERE t.imc > 0 AND t.imc < 18.5) as nutri_bajo_peso,
             COUNT(DISTINCT ac.id) FILTER (WHERE t.imc >= 18.5 AND t.imc < 25.0) as nutri_normopeso,
             COUNT(DISTINCT ac.id) FILTER (WHERE t.imc >= 25.0 AND t.imc < 30.0) as nutri_sobrepeso,
             COUNT(DISTINCT ac.id) FILTER (WHERE t.imc >= 30.0) as nutri_obesidad,
             COUNT(DISTINCT ac.id) FILTER (WHERE p.enfermedades_previas ILIKE '%diabet%' OR p.enfermedades_previas ILIKE '%hiperten%') as cronicos_asoc,

             -- Indicadores para Psicología:
             COUNT(DISTINCT ac.id) FILTER (WHERE cb.motivo_consulta ILIKE '%ansiedad%' OR cps.evaluacion_clinica ILIKE '%ansiedad%') as psico_ansiedad,
             COUNT(DISTINCT ac.id) FILTER (WHERE cb.motivo_consulta ILIKE '%depresi%' OR cb.motivo_consulta ILIKE '%duelo%' OR cps.evaluacion_clinica ILIKE '%depresi%' OR cps.evaluacion_clinica ILIKE '%duelo%') as psico_depresion,
             COUNT(DISTINCT ac.id) FILTER (WHERE cb.motivo_consulta ILIKE '%familia%' OR cb.motivo_consulta ILIKE '%pareja%' OR cb.motivo_consulta ILIKE '%violencia%' OR cps.evaluacion_clinica ILIKE '%familia%') as psico_familiar,
             COUNT(DISTINCT ac.id) FILTER (WHERE cps.consulta_id IS NOT NULL AND NOT (
               cb.motivo_consulta ILIKE '%ansiedad%' OR cps.evaluacion_clinica ILIKE '%ansiedad%' OR
               cb.motivo_consulta ILIKE '%depresi%' OR cps.evaluacion_clinica ILIKE '%depresi%' OR cps.evaluacion_clinica ILIKE '%duelo%' OR
               cb.motivo_consulta ILIKE '%familia%' OR cb.motivo_consulta ILIKE '%pareja%' OR cb.motivo_consulta ILIKE '%violencia%' OR cps.evaluacion_clinica ILIKE '%familia%'
             )) as psico_otros

      FROM atenciones_clinicas ac
      JOIN pacientes p ON p.id = ac.paciente_id
      LEFT JOIN triaje_signos_vitales t ON t.atencion_id = ac.id
      LEFT JOIN proc_agg pa ON pa.atencion_id = ac.id
      LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id
      LEFT JOIN consultas_medicina_general cm ON cm.consulta_id = cb.id
      LEFT JOIN consultas_odontologia co ON co.consulta_id = cb.id
      LEFT JOIN consultas_nutricion cn ON cn.consulta_id = cb.id
      LEFT JOIN consultas_psicologia cps ON cps.consulta_id = cb.id
      WHERE EXTRACT(YEAR FROM ac.fecha_hora_ingreso) = $1 AND EXTRACT(MONTH FROM ac.fecha_hora_ingreso) = $2
        ${filtroAreaSql}
      GROUP BY EXTRACT(DAY FROM ac.fecha_hora_ingreso)
      ORDER BY dia ASC
    `;

    const dailyRes = await db.query(dailyQuery, [anio, mes]);
    const mapaDias = {};
    dailyRes.rows.forEach(r => { mapaDias[r.dia] = r; });

    const matrizMensual = [];
    const tot = {
      total_consultas: 0
    };
    configArea.columnas.forEach(col => {
      tot[col.key] = 0;
    });

    for (let d = 1; d <= totalDias; d++) {
      const reg = mapaDias[d] || {};
      const fila = {
        dia: d,
        fecha: `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        total_consultas: parseInt(reg.total_consultas || 0, 10)
      };
      tot.total_consultas += fila.total_consultas;

      configArea.columnas.forEach(col => {
        const val = parseInt(reg[col.key] || 0, 10);
        fila[col.key] = val;
        tot[col.key] += val;
      });

      matrizMensual.push(fila);
    }

    res.json({
      periodo: { anio, mes, dias_en_mes: totalDias },
      area,
      area_nombre: configArea.nombre,
      area_subtitulo: configArea.subtitulo,
      th_grupos: configArea.thGrupos,
      config_columnas: configArea.columnas,
      totales_mensuales: tot,
      dias: matrizMensual
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar reporte mensual: ' + err.message });
  }
});

// 5. GET /api/estadisticas/mensual/excel (Concentrado Mensual formateado para Excel)
router.get(['/mensual/excel', '/mensual/csv'], async (req, res) => {
  const anio = req.query.anio || new Date().getFullYear();
  const mes = req.query.mes || (new Date().getMonth() + 1);
  const area = (req.query.area || 'GENERAL').toUpperCase();

  if (area === 'GENERAL' || area === 'CONCENTRADO_GENERAL') {
    try {
      const datos = await concentradoGeneralReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.director = await resolverNombreProfesional(db, req, 'GENERAL');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const excel = concentradoGeneralReport.renderizarMensualExcel(datos);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="concentrado_general_${anio}_${String(mes).padStart(2, '0')}.xls"`);
      return res.send('\uFEFF' + excel);
    } catch (err) {
      return res.status(500).json({ error: 'Error al exportar Concentrado General: ' + err.message });
    }
  }

  if (area === 'ENFERMERIA') {
    try {
      const datos = await enfermeriaReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.enfermero = await resolverNombreProfesional(db, req, 'ENFERMERIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const excel = enfermeriaReport.renderizarMensualExcel(datos);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="concentrado_mensual_enfermeria_${anio}_${String(mes).padStart(2, '0')}.xls"`);
      return res.send('\uFEFF' + excel);
    } catch (err) {
      return res.status(500).json({ error: 'Error al exportar Concentrado Mensual Enfermería: ' + err.message });
    }
  }

  if (area === 'MEDICINA_GENERAL' || area === 'MEDICINA') {
    try {
      const datos = await medicinaGeneralReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.medico = await resolverNombreProfesional(db, req, 'MEDICINA_GENERAL');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const excel = medicinaGeneralReport.renderizarMensualExcel(datos);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="concentrado_mensual_medicina_general_${anio}_${String(mes).padStart(2, '0')}.xls"`);
      return res.send('\uFEFF' + excel);
    } catch (err) {
      return res.status(500).json({ error: 'Error al exportar Concentrado Mensual Medicina General: ' + err.message });
    }
  }

  if (area === 'PSICOLOGIA') {
    try {
      const datos = await psicologiaReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.psicologo = await resolverNombreProfesional(db, req, 'PSICOLOGIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const excel = psicologiaReport.renderizarMensualExcel(datos);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="concentrado_mensual_psicologia_${anio}_${String(mes).padStart(2, '0')}.xls"`);
      return res.send('\uFEFF' + excel);
    } catch (err) {
      return res.status(500).json({ error: 'Error al exportar Concentrado Mensual Psicología: ' + err.message });
    }
  }

  if (area === 'ODONTOLOGIA') {
    try {
      const datos = await odontologiaReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.odontologo = await resolverNombreProfesional(db, req, 'ODONTOLOGIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const excel = odontologiaReport.renderizarMensualExcel(datos);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="concentrado_mensual_odontologia_${anio}_${String(mes).padStart(2, "0")}.xls"`);
      return res.send('﻿' + excel);
    } catch (err) {
      return res.status(500).json({ error: 'Error al exportar Concentrado Mensual Odontología: ' + err.message });
    }
  }



  if (area === 'NUTRICION') {
    try {
      const datos = await nutricionReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.nutriologo = await resolverNombreProfesional(db, req, 'NUTRICION');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const excel = nutricionReport.renderizarMensualExcel(datos);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="concentrado_mensual_nutricion_${anio}_${String(mes).padStart(2, '0')}.xls"`);
      return res.send('\uFEFF' + excel);
    } catch (err) {
      return res.status(500).json({ error: 'Error al exportar Concentrado Mensual Nutrición: ' + err.message });
    }
  }

  try {
    const dataRes = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/estadisticas/mensual?anio=${anio}&mes=${mes}&area=${area}`);
    const data = await dataRes.json();
    const dias = data.dias || [];
    const tot = data.totales_mensuales || {};
    const thGrupos = data.th_grupos || [];
    const configColumnas = data.config_columnas || [];
    const numCols = configColumnas.length + 2; // DÍA + Columnas + TOTAL DÍA

    const mesesNombres = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const nombreMes = mesesNombres[parseInt(mes, 10)] || `MES ${mes}`;

    const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${data.area_nombre || 'Concentrado'}</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 8.5pt; }
        th, td { border: 1px solid #000000; padding: 4px; text-align: center; vertical-align: middle; }
        .hdr-main { background-color: #701128; color: #ffffff; font-size: 13pt; font-weight: bold; }
        .hdr-sub { background-color: #f7f7f7; color: #701128; font-size: 10pt; font-weight: bold; }
        .hdr-meta { background-color: #eaeaea; font-size: 9pt; font-weight: bold; }
        .th-col { background-color: #d9d9d9; font-weight: bold; font-size: 8pt; color: #000000; }
        .row-total { background-color: #e6e6e6; font-weight: bold; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <th colspan="${numCols}" class="hdr-main">H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
        </tr>
        <tr>
          <th colspan="${numCols}" class="hdr-sub">${data.area_subtitulo || 'CONCENTRADO MENSUAL'} &bull; PERIODO: ${nombreMes} ${anio}</th>
        </tr>
        <tr>
          <td colspan="${Math.floor(numCols / 2)}" class="hdr-meta text-left"><strong>Área / Especialidad:</strong> ${data.area_nombre || area} &nbsp;|&nbsp; <strong>Unidad Médica:</strong> Sede Central Malpica</td>
          <td colspan="${numCols - Math.floor(numCols / 2)}" class="hdr-meta text-right"><strong>TOTAL DEL MES:</strong> ${tot.total_consultas || 0} atenciones</td>
        </tr>
        <tr>
          <th rowspan="2" class="th-col" style="width: 40px;">DÍA</th>
          ${thGrupos.map(g => `<th colspan="${g.colSpan}" class="th-col">${g.titulo}</th>`).join('')}
          <th rowspan="2" class="th-col" style="width: 70px;">TOTAL DÍA</th>
        </tr>
        <tr>
          ${configColumnas.map(c => `<th class="th-col" style="width: ${c.width};">${c.label}</th>`).join('')}
        </tr>
        ${dias.map(d => `
          <tr>
            <td><strong>${d.dia}</strong></td>
            ${configColumnas.map(c => `<td>${d[c.key] || 0}</td>`).join('')}
            <td><strong>${d.total_consultas || 0}</strong></td>
          </tr>
        `).join('')}
        <tr class="row-total">
          <td>TOTAL</td>
          ${configColumnas.map(c => `<td>${tot[c.key] || 0}</td>`).join('')}
          <td>${tot.total_consultas || 0}</td>
        </tr>
      </table>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="concentrado_mensual_${area.toLowerCase()}_${anio}_${String(mes).padStart(2, '0')}.xls"`);
    res.send('﻿' + excelHtml);
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar Concentrado Excel: ' + err.message });
  }
});

// 6. GET /api/estadisticas/mensual/pdf
router.get('/mensual/pdf', async (req, res) => {
  const anio = req.query.anio || new Date().getFullYear();
  const mes = req.query.mes || (new Date().getMonth() + 1);
  const area = (req.query.area || 'GENERAL').toUpperCase();

  if (area === 'ENFERMERIA') {
    try {
      const datos = await enfermeriaReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.enfermero = await resolverNombreProfesional(db, req, 'ENFERMERIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const html = enfermeriaReport.renderizarMensualHtml(datos);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return res.status(500).json({ error: 'Error al generar Concentrado Mensual Enfermería: ' + err.message });
    }
  }

  if (area === 'MEDICINA_GENERAL' || area === 'MEDICINA') {
    try {
      const datos = await medicinaGeneralReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.medico = await resolverNombreProfesional(db, req, 'MEDICINA_GENERAL');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const html = medicinaGeneralReport.renderizarMensualHtml(datos);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return res.status(500).json({ error: 'Error al generar Concentrado Mensual Medicina General: ' + err.message });
    }
  }

  if (area === 'GENERAL' || area === 'CONCENTRADO_GENERAL') {
    try {
      const datos = await concentradoGeneralReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.director = await resolverNombreProfesional(db, req, 'GENERAL');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const html = concentradoGeneralReport.renderizarMensualHtml(datos);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return res.status(500).json({ error: 'Error al generar Concentrado General: ' + err.message });
    }
  }

  if (area === 'PSICOLOGIA') {
    try {
      const datos = await psicologiaReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.psicologo = await resolverNombreProfesional(db, req, 'PSICOLOGIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const html = psicologiaReport.renderizarMensualHtml(datos);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return res.status(500).json({ error: 'Error al generar Concentrado Mensual Psicología: ' + err.message });
    }
  }

  if (area === 'ODONTOLOGIA') {
    try {
      const datos = await odontologiaReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.odontologo = await resolverNombreProfesional(db, req, 'ODONTOLOGIA');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const html = odontologiaReport.renderizarMensualHtml(datos);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return res.status(500).json({ error: 'Error al generar Concentrado Mensual Odontología: ' + err.message });
    }
  }

  if (area === 'NUTRICION') {
    try {
      const datos = await nutricionReport.obtenerDatosMensuales(db, parseInt(anio, 10), parseInt(mes, 10));
      datos.nutriologo = await resolverNombreProfesional(db, req, 'NUTRICION');
      datos.unidad_medica = await resolverUnidadMedica(db, req);
      const html = nutricionReport.renderizarMensualHtml(datos);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      return res.status(500).json({ error: 'Error al generar Concentrado Mensual Nutrición: ' + err.message });
    }
  }

  try {
    const dataRes = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/estadisticas/mensual?anio=${anio}&mes=${mes}&area=${area}`);
    const data = await dataRes.json();
    const dias = data.dias || [];
    const tot = data.totales_mensuales || {};
    const thGrupos = data.th_grupos || [];
    const configColumnas = data.config_columnas || [];
    const logoHtml = obtenerLogoOficialHtml();

    const mesesNombres = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const nombreMes = mesesNombres[parseInt(mes, 10)] || `MES ${mes}`;

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Concentrado Mensual - ${data.area_nombre || area} - Coatzacoalcos</title>
      <style>
        @page { size: landscape; margin: 5mm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 8px; margin: 0; color: #111; }
        .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #701128; padding-bottom: 4px; margin-bottom: 5px; }
        .brand-section { display: flex; align-items: center; gap: 14px; }
        .dept-title { font-size: 9px; font-weight: bold; color: #701128; line-height: 1.2; text-transform: uppercase; border-left: 2px solid #b38e5d; padding-left: 10px; }
        .right-box { text-align: right; }
        .sheet-title { font-size: 11px; font-weight: bold; color: #701128; text-transform: uppercase; margin-bottom: 3px; }
        .meta-line { font-size: 8.5px; color: #231F20; }
        .area-tag { background: #701128; color: #ffffff; padding: 1px 6px; border-radius: 3px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        th, td { border: 1px solid #333; padding: 2.5px 1px; text-align: center; }
        th { background: #f4f4f4; font-size: 7px; font-weight: bold; }
        .total-row { background: #eaeaea; font-weight: bold; font-size: 8px; }
        .no-print { margin: 8px 0; display: flex; gap: 10px; align-items: center; }
        .btn-print { background: #701128; color: white; border: none; padding: 6px 14px; font-size: 11px; cursor: pointer; border-radius: 3px; font-weight: bold; }
        .btn-excel { background: #107c41; color: white; text-decoration: none; padding: 6px 14px; font-size: 11px; border-radius: 3px; font-weight: bold; display: inline-block; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print">
        <button class="btn-print" onclick="window.print()">📥 Imprimir / Guardar como PDF</button>
        <a href="/api/estadisticas/mensual/excel?anio=${anio}&mes=${mes}&area=${area}" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
      </div>

      <div class="header-container">
        <div class="brand-section">
          ${logoHtml}
          <div class="dept-title">
            Dirección de<br>Salud Pública<br>Municipal
          </div>
        </div>

        <div class="right-box">
          <div class="sheet-title">${data.area_subtitulo || 'CONCENTRADO MENSUAL'}</div>
          <div class="meta-line">
            <strong>PERIODO:</strong> ${nombreMes} ${anio} &nbsp;|&nbsp; 
            <strong>ÁREA:</strong> <span class="area-tag">${data.area_nombre || area}</span> &nbsp;|&nbsp; 
            <strong>TOTAL MES:</strong> ${tot.total_consultas || 0} atenciones
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th rowspan="2" style="width: 25px;">DÍA</th>
            ${thGrupos.map(g => `<th colspan="${g.colSpan}">${g.titulo}</th>`).join('')}
            <th rowspan="2" style="width: 45px;">TOTAL DÍA</th>
          </tr>
          <tr>
            ${configColumnas.map(c => `<th style="width: ${c.width};">${c.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${dias.map(d => `
            <tr>
              <td><strong>${d.dia}</strong></td>
              ${configColumnas.map(c => `<td>${d[c.key] || 0}</td>`).join('')}
              <td><strong>${d.total_consultas || 0}</strong></td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td>TOTAL</td>
            ${configColumnas.map(c => `<td>${tot[c.key] || 0}</td>`).join('')}
            <td>${tot.total_consultas || 0}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: 'Error al generar concentrado mensual: ' + err.message });
  }
});


// 7. POST /api/estadisticas/consolidar-mes
router.post('/consolidar-mes', requireRoles('DIRECCION'), async (req, res) => {
  const anio = parseInt(req.body.anio || new Date().getFullYear(), 10);
  const mes = parseInt(req.body.mes || (new Date().getMonth() + 1), 10);
  const unidadMedicaId = 1;

  if (mes < 1 || mes > 12) {
    return res.status(400).json({ error: 'El mes debe ser un valor numérico entre 1 y 12.' });
  }

  try {
    const atencionesRes = await db.query(`
      SELECT COUNT(*) as total_consultas,
             COUNT(*) FILTER (WHERE a.tipo_atencion = 'PRIMERA_VEZ') as total_primeras_veces,
             COUNT(*) FILTER (WHERE a.tipo_atencion = 'SUBSECUENTE') as total_subsecuentes,
             COUNT(*) FILTER (WHERE p.sexo = 'F') as femenino,
             COUNT(*) FILTER (WHERE p.sexo = 'M') as masculino
      FROM atenciones_clinicas a
      JOIN pacientes p ON p.id = a.paciente_id
      WHERE EXTRACT(YEAR FROM a.fecha_hora_ingreso) = $1 
        AND EXTRACT(MONTH FROM a.fecha_hora_ingreso) = $2
    `, [anio, mes]);

    const row = atencionesRes.rows[0];
    const totalConsultas = parseInt(row.total_consultas, 10);
    const totalPrimeras = parseInt(row.total_primeras_veces, 10);
    const totalSubsecuentes = parseInt(row.total_subsecuentes, 10);
    const fem = parseInt(row.femenino, 10);
    const masc = parseInt(row.masculino, 10);

    const desgloseSexo = { femenino: fem, masculino: masc };

    const edadRes = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE edad_anos < 1) as menores_1_ano,
        COUNT(*) FILTER (WHERE edad_anos BETWEEN 1 AND 4) as de_1_a_4,
        COUNT(*) FILTER (WHERE edad_anos BETWEEN 5 AND 14) as de_5_a_14,
        COUNT(*) FILTER (WHERE edad_anos BETWEEN 15 AND 29) as de_15_a_29,
        COUNT(*) FILTER (WHERE edad_anos BETWEEN 30 AND 59) as de_30_a_59,
        COUNT(*) FILTER (WHERE edad_anos >= 60) as mayores_60
      FROM (
        SELECT EXTRACT(YEAR FROM AGE(a.fecha_hora_ingreso, p.fecha_nacimiento)) as edad_anos
        FROM atenciones_clinicas a
        JOIN pacientes p ON p.id = a.paciente_id
        WHERE EXTRACT(YEAR FROM a.fecha_hora_ingreso) = $1 
          AND EXTRACT(MONTH FROM a.fecha_hora_ingreso) = $2
      ) sub
    `, [anio, mes]);

    const desgloseGruposEdad = {
      menores_1_ano: parseInt(edadRes.rows[0].menores_1_ano, 10),
      de_1_a_4: parseInt(edadRes.rows[0].de_1_a_4, 10),
      de_5_a_14: parseInt(edadRes.rows[0].de_5_a_14, 10),
      de_15_a_29: parseInt(edadRes.rows[0].de_15_a_29, 10),
      de_30_a_59: parseInt(edadRes.rows[0].de_30_a_59, 10),
      mayores_60: parseInt(edadRes.rows[0].mayores_60, 10)
    };

    const morbilidadRes = await db.query(`
      SELECT COALESCE(cm.clasificacion_morbilidad, 'Consulta General / Valoración') as categoria,
             COUNT(*) as conteo
      FROM atenciones_clinicas a
      LEFT JOIN consultas_base cb ON cb.atencion_id = a.id
      LEFT JOIN consultas_medicina_general cm ON cm.consulta_id = cb.id
      WHERE EXTRACT(YEAR FROM a.fecha_hora_ingreso) = $1 
        AND EXTRACT(MONTH FROM a.fecha_hora_ingreso) = $2
      GROUP BY cm.clasificacion_morbilidad
    `, [anio, mes]);

    const desgloseMorbilidad = {};
    morbilidadRes.rows.forEach(m => {
      desgloseMorbilidad[m.categoria] = parseInt(m.conteo, 10);
    });

    const cuadreValido = (totalConsultas === (totalPrimeras + totalSubsecuentes)) &&
                         (totalConsultas === (fem + masc));

    const upsertReporte = `
      INSERT INTO reportes_estadisticos_mensuales (
        unidad_medica_id, mes, anio, total_consultas, total_primeras_veces, total_subsecuentes,
        desglose_sexo, desglose_grupos_edad, desglose_morbilidad, cuadre_valido
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (unidad_medica_id, mes, anio)
      DO UPDATE SET
        total_consultas = EXCLUDED.total_consultas,
        total_primeras_veces = EXCLUDED.total_primeras_veces,
        total_subsecuentes = EXCLUDED.total_subsecuentes,
        desglose_sexo = EXCLUDED.desglose_sexo,
        desglose_grupos_edad = EXCLUDED.desglose_grupos_edad,
        desglose_morbilidad = EXCLUDED.desglose_morbilidad,
        cuadre_valido = EXCLUDED.cuadre_valido,
        fecha_generacion = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const reporteResult = await db.query(upsertReporte, [
      unidadMedicaId,
      mes,
      anio,
      totalConsultas,
      totalPrimeras,
      totalSubsecuentes,
      JSON.stringify(desgloseSexo),
      JSON.stringify(desgloseGruposEdad),
      JSON.stringify(desgloseMorbilidad),
      cuadreValido
    ]);

    res.status(201).json({
      mensaje: `Reporte estadístico de ${mes}/${anio} consolidado y cerrado exitosamente en PostgreSQL.`,
      reporte: reporteResult.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consolidar reporte mensual: ' + err.message });
  }
});

// 8. GET /api/estadisticas/consolidado-mensual
router.get('/consolidado-mensual', async (req, res) => {
  const anio = parseInt(req.query.anio || new Date().getFullYear(), 10);
  const mes = parseInt(req.query.mes || (new Date().getMonth() + 1), 10);

  try {
    const reporteRes = await db.query(`
      SELECT r.*, u.nombre as unidad_nombre
      FROM reportes_estadisticos_mensuales r
      JOIN unidades_medicas u ON u.id = r.unidad_medica_id
      WHERE r.mes = $1 AND r.anio = $2
    `, [mes, anio]);

    if (reporteRes.rows.length === 0) {
      return res.status(404).json({ error: `No existe reporte consolidado para el periodo ${mes}/${anio}.` });
    }

    res.json(reporteRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 9. GET /api/estadisticas/certificado/medico/pdf (Formato Oficial 1:1 CM0__--2026 en tamaño Carta)
router.get('/certificado/medico/pdf', async (req, res) => {
  try {
    const datos = { ...req.query };
    datos.unidad_medica = await resolverUnidadMedica(db, req);
    if (!datos.medico || !datos.medico.trim()) {
      datos.medico = await resolverNombreProfesional(db, req, 'MEDICINA_GENERAL');
    }
    const html = certificadosReport.renderizarCertificadoMedicoHtml(datos);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    return res.status(500).json({ error: 'Error al generar Certificado Médico Oficial: ' + err.message });
  }
});

// 10. GET /api/estadisticas/certificado/nutricion/pdf (Formato Oficial 1:1 CERTIFICADO DE NUTRICIÓN en tamaño Carta)
router.get('/certificado/nutricion/pdf', async (req, res) => {
  try {
    const datos = { ...req.query };
    datos.unidad_medica = await resolverUnidadMedica(db, req);
    if (!datos.nutriologo || !datos.nutriologo.trim()) {
      datos.nutriologo = await resolverNombreProfesional(db, req, 'NUTRICION');
    }
    const html = certificadosReport.renderizarCertificadoNutricionHtml(datos);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    return res.status(500).json({ error: 'Error al generar Certificado de Nutrición Oficial: ' + err.message });
  }
});

module.exports = router;