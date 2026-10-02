const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');

const router = express.Router();

function obtenerLogoOficialHtml() {
  const rutasPosibles = [
    path.join(__dirname, '../assets/logo.png'),
    path.resolve(process.cwd(), 'src/assets/logo.png'),
    '/app/src/assets/logo.png'
  ];
  let ruta = rutasPosibles.find(r => fs.existsSync(r));
  if (ruta && fs.existsSync(ruta)) {
    const base64 = fs.readFileSync(ruta).toString('base64');
    return `<img src="data:image/png;base64,${base64}" style="height: 56px; max-width: 290px; object-fit: contain;" alt="Gobierno de Coatzacoalcos">`;
  }
  return '<div style="font-size: 11px; font-weight: bold; color: #701128;">GOBIERNO DE LA CIUDAD DE COATZACOALCOS 2026-2029</div>';
}

// 1. GET /api/estadisticas/diario (Datos JSON)
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

// 4. GET /api/estadisticas/mensual (Datos JSON)
router.get('/mensual', async (req, res) => {
  const anio = parseInt(req.query.anio || new Date().getFullYear(), 10);
  const mes = parseInt(req.query.mes || (new Date().getMonth() + 1), 10);

  try {
    const totalDias = new Date(anio, mes, 0).getDate();

    const dailyQuery = `
      SELECT EXTRACT(DAY FROM ac.fecha_hora_ingreso)::INT as dia,
             COUNT(*) as total_consultas,
             COUNT(*) FILTER (WHERE p.sexo = 'F') as femenino,
             COUNT(*) FILTER (WHERE p.sexo = 'M') as masculino,
             COUNT(*) FILTER (WHERE ac.tipo_atencion = 'PRIMERA_VEZ') as primera_vez,
             COUNT(*) FILTER (WHERE ac.tipo_atencion = 'SUBSECUENTE') as subsecuente,
             COUNT(*) FILTER (WHERE cm.canalizacion_externa ILIKE '%DISPLASIA%') as canalizados_displasia,
             COUNT(*) FILTER (WHERE cm.canalizacion_externa ILIKE '%CAPASITS%') as canalizados_capasits
      FROM atenciones_clinicas ac
      JOIN pacientes p ON p.id = ac.paciente_id
      LEFT JOIN consultas_base cb ON cb.atencion_id = ac.id
      LEFT JOIN consultas_medicina_general cm ON cm.consulta_id = cb.id
      WHERE EXTRACT(YEAR FROM ac.fecha_hora_ingreso) = $1 AND EXTRACT(MONTH FROM ac.fecha_hora_ingreso) = $2
      GROUP BY EXTRACT(DAY FROM ac.fecha_hora_ingreso)
      ORDER BY dia ASC
    `;
    const dailyRes = await db.query(dailyQuery, [anio, mes]);
    const mapaDias = {};
    dailyRes.rows.forEach(r => { mapaDias[r.dia] = r; });

    const diagQuery = `
      SELECT EXTRACT(DAY FROM cb.fecha_hora)::INT as dia,
             COALESCE(cm.clasificacion_morbilidad, 'OTRAS') as categoria,
             COUNT(*) as conteo
      FROM consultas_base cb
      JOIN consultas_medicina_general cm ON cm.consulta_id = cb.id
      WHERE EXTRACT(YEAR FROM cb.fecha_hora) = $1 AND EXTRACT(MONTH FROM cb.fecha_hora) = $2
      GROUP BY EXTRACT(DAY FROM cb.fecha_hora), cm.clasificacion_morbilidad
    `;
    const diagRes = await db.query(diagQuery, [anio, mes]);
    const mapaDiags = {};
    diagRes.rows.forEach(d => {
      if (!mapaDiags[d.dia]) mapaDiags[d.dia] = {};
      mapaDiags[d.dia][d.categoria] = parseInt(d.conteo, 10);
    });

    const matrizMensual = [];
    let totGeneral = 0, totFem = 0, totMasc = 0, tot1ra = 0, totSub = 0;

    for (let d = 1; d <= totalDias; d++) {
      const reg = mapaDias[d] || {
        total_consultas: 0, femenino: 0, masculino: 0, primera_vez: 0, subsecuente: 0,
        canalizados_displasia: 0, canalizados_capasits: 0
      };
      totGeneral += parseInt(reg.total_consultas, 10);
      totFem += parseInt(reg.femenino, 10);
      totMasc += parseInt(reg.masculino, 10);
      tot1ra += parseInt(reg.primera_vez, 10);
      totSub += parseInt(reg.subsecuente, 10);

      matrizMensual.push({
        dia: d,
        fecha: `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        ...reg,
        diagnosticos: mapaDiags[d] || {}
      });
    }

    res.json({
      periodo: { anio, mes, dias_en_mes: totalDias },
      totales_mensuales: {
        total_consultas: totGeneral,
        femenino: totFem,
        masculino: totMasc,
        primera_vez: tot1ra,
        subsecuente: totSub
      },
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

  try {
    const dataRes = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/estadisticas/mensual?anio=${anio}&mes=${mes}`);
    const data = await dataRes.json();
    const dias = data.dias || [];
    const tot = data.totales_mensuales;

    const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Concentrado Mensual</x:Name>
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
        .th-col { background-color: #d9d9d9; font-weight: bold; font-size: 8pt; color: #000000; }
        .row-total { background-color: #e6e6e6; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <th colspan="12" class="hdr-main">H. AYUNTAMIENTO DE COATZACOALCOS &bull; DIRECCIÓN DE SALUD PÚBLICA MUNICIPAL</th>
        </tr>
        <tr>
          <th colspan="12" class="hdr-sub">RESUMEN TOTAL MENSUAL Y CONCENTRADO POR DÍA &bull; PERIODO: ${mes}/${anio}</th>
        </tr>
        <tr>
          <th rowspan="2" class="th-col" style="width: 40px;">DÍA</th>
          <th colspan="2" class="th-col">SEXO</th>
          <th colspan="2" class="th-col">TIPO CONSULTA</th>
          <th colspan="2" class="th-col">CANALIZACIONES</th>
          <th colspan="4" class="th-col">DIAGNÓSTICOS PRINCIPALES</th>
          <th rowspan="2" class="th-col" style="width: 70px;">TOTAL DÍA</th>
        </tr>
        <tr>
          <th class="th-col" style="width: 45px;">F</th>
          <th class="th-col" style="width: 45px;">M</th>
          <th class="th-col" style="width: 65px;">1RA VEZ</th>
          <th class="th-col" style="width: 65px;">SUBSEC</th>
          <th class="th-col" style="width: 80px;">DISPLASIA</th>
          <th class="th-col" style="width: 80px;">CAPASITS</th>
          <th class="th-col" style="width: 100px;">RESPIRATORIAS</th>
          <th class="th-col" style="width: 100px;">DIGESTIVAS</th>
          <th class="th-col" style="width: 100px;">CARDIO / HTA</th>
          <th class="th-col" style="width: 100px;">OTRAS</th>
        </tr>
        ${dias.map(d => `
          <tr>
            <td><strong>${d.dia}</strong></td>
            <td>${d.femenino || 0}</td>
            <td>${d.masculino || 0}</td>
            <td>${d.primera_vez || 0}</td>
            <td>${d.subsecuente || 0}</td>
            <td>${d.canalizados_displasia || 0}</td>
            <td>${d.canalizados_capasits || 0}</td>
            <td>${d.diagnosticos['Infecciones respiratorias agudas'] || 0}</td>
            <td>${d.diagnosticos['Enfermedades del sistema digestivo'] || 0}</td>
            <td>${d.diagnosticos['Enfermedades cardiovasculares'] || 0}</td>
            <td>${Object.keys(d.diagnosticos).reduce((acc, k) => !['Infecciones respiratorias agudas','Enfermedades del sistema digestivo','Enfermedades cardiovasculares'].includes(k) ? acc + d.diagnosticos[k] : acc, 0)}</td>
            <td><strong>${d.total_consultas || 0}</strong></td>
          </tr>
        `).join('')}
        <tr class="row-total">
          <td>TOTAL</td>
          <td>${tot.femenino}</td>
          <td>${tot.masculino}</td>
          <td>${tot.primera_vez}</td>
          <td>${tot.subsecuente}</td>
          <td colspan="2">-</td>
          <td colspan="4">-</td>
          <td>${tot.total_consultas}</td>
        </tr>
      </table>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="concentrado_mensual_${anio}_${String(mes).padStart(2, '0')}.xls"`);
    res.send('\uFEFF' + excelHtml);
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar Concentrado Excel: ' + err.message });
  }
});

// 6. GET /api/estadisticas/mensual/pdf
router.get('/mensual/pdf', async (req, res) => {
  const anio = req.query.anio || new Date().getFullYear();
  const mes = req.query.mes || (new Date().getMonth() + 1);

  try {
    const dataRes = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/estadisticas/mensual?anio=${anio}&mes=${mes}`);
    const data = await dataRes.json();
    const dias = data.dias || [];
    const tot = data.totales_mensuales;
    const logoHtml = obtenerLogoOficialHtml();

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Concentrado Mensual - Coatzacoalcos</title>
      <style>
        @page { size: landscape; margin: 5mm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 8px; margin: 0; color: #111; }
        .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #701128; padding-bottom: 4px; margin-bottom: 5px; }
        .brand-section { display: flex; align-items: center; gap: 14px; }
        .dept-title { font-size: 9px; font-weight: bold; color: #701128; line-height: 1.2; text-transform: uppercase; border-left: 2px solid #b38e5d; padding-left: 10px; }
        .right-box { text-align: right; }
        .sheet-title { font-size: 11px; font-weight: bold; color: #701128; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        th, td { border: 1px solid #333; padding: 2px 1px; text-align: center; }
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
        <a href="/api/estadisticas/mensual/excel?anio=${anio}&mes=${mes}" class="btn-excel">📊 Descargar en Excel Formateado (.xls)</a>
      </div>

      <div class="header-container">
        <div class="brand-section">
          ${logoHtml}
          <div class="dept-title">
            Dirección de<br>Salud Pública<br>Municipal
          </div>
        </div>

        <div class="right-box">
          <div class="sheet-title">RESUMEN TOTAL MENSUAL Y CONCENTRADO POR DÍA</div>
          <div><strong>PERIODO:</strong> MES ${mes} / AÑO ${anio} &nbsp;|&nbsp; <strong>CONSULTAS TOTALES:</strong> ${tot.total_consultas}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th rowspan="2" style="width: 25px;">DÍA</th>
            <th colspan="2">SEXO</th>
            <th colspan="2">TIPO CONSULTA</th>
            <th colspan="2">CANALIZACIONES</th>
            <th colspan="4">DIAGNÓSTICOS PRINCIPALES (MORBILIDAD)</th>
            <th rowspan="2" style="width: 45px;">TOTAL DÍA</th>
          </tr>
          <tr>
            <th>F</th><th>M</th>
            <th>1RA VEZ</th><th>SUBSEC</th>
            <th>DISPLASIA</th><th>CAPASITS</th>
            <th>RESPIRATORIAS</th><th>DIGESTIVAS</th><th>CARDIO / HTA</th><th>OTRAS</th>
          </tr>
        </thead>
        <tbody>
          ${dias.map(d => `
            <tr>
              <td><strong>${d.dia}</strong></td>
              <td>${d.femenino || 0}</td>
              <td>${d.masculino || 0}</td>
              <td>${d.primera_vez || 0}</td>
              <td>${d.subsecuente || 0}</td>
              <td>${d.canalizados_displasia || 0}</td>
              <td>${d.canalizados_capasits || 0}</td>
              <td>${d.diagnosticos['Infecciones respiratorias agudas'] || 0}</td>
              <td>${d.diagnosticos['Enfermedades del sistema digestivo'] || 0}</td>
              <td>${d.diagnosticos['Enfermedades cardiovasculares'] || 0}</td>
              <td>${Object.keys(d.diagnosticos).reduce((acc, k) => !['Infecciones respiratorias agudas','Enfermedades del sistema digestivo','Enfermedades cardiovasculares'].includes(k) ? acc + d.diagnosticos[k] : acc, 0)}</td>
              <td><strong>${d.total_consultas || 0}</strong></td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td>TOTAL</td>
            <td>${tot.femenino}</td>
            <td>${tot.masculino}</td>
            <td>${tot.primera_vez}</td>
            <td>${tot.subsecuente}</td>
            <td colspan="2">-</td>
            <td colspan="4">-</td>
            <td>${tot.total_consultas}</td>
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
router.post('/consolidar-mes', async (req, res) => {
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

module.exports = router;
