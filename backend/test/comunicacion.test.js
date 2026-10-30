// Pruebas HTTP y SQL aisladas: no se conectan a tu base de datos real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'solo-pruebas-locales-clinix';

const pg = new PGlite();
let fallaDB = false;
async function query(sql, params) {
  if (fallaDB) throw Object.assign(new Error('Conexión de prueba interrumpida'), { code: 'ECONNREFUSED' });
  if (params === undefined && sql.split(';').filter(s => s.trim()).length > 1) {
    const results = await pg.exec(sql);
    return results.at(-1);
  }
  return pg.query(sql, params);
}
const dbMock = { query, pool: { connect: async () => {
  if (fallaDB) throw new Error('Conexión de prueba interrumpida');
  return { query, release() {} };
}, end: async () => {} } };
const dbPath = require.resolve('../src/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: dbMock };
const { app, inicializarMigraciones } = require('../src/index');

const adulto = {
  nombres: 'Paciente', apellido_paterno: 'Prueba', apellido_materno: 'Local',
  curp: 'PRUL900101HVZBBB01', fecha_nacimiento: '1990-01-01', sexo: 'M',
  calle_numero: 'Calle de prueba 10', colonia: 'Colonia de prueba', derechohabiencia: 'IMSS',
  telefono: '9211231234', numero_afiliacion: 'AF-123', grupo_sanguineo: 'Desconocido',
  religion: 'Sin especificar', ocupacion: 'Estudiante', tipo_poblacion: 'Población general',
  area_servicio: 'Nutrición', tipo_consulta: 'Primera vez', num_personas_vivienda: 2,
};
let server, base, token, pacienteId;
async function request(route, { method = 'GET', body, auth = token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: await response.json(), headers: response.headers };
}

test('Contrato de comunicación Clinix (HTTP + PostgreSQL embebido)', async t => {
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await pg.close();
  });
  // pgcrypto no se utiliza en estas rutas; el resto del esquema se ejecuta completo.
  const schema = fs.readFileSync(path.join(__dirname, '../init_db/01_schema.sql'), 'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
  await pg.exec(schema);
  await inicializarMigraciones();
  await inicializarMigraciones(); // Comprobar que puede repetirse sin borrar datos.
  await query("INSERT INTO unidades_medicas (nombre,clave_oficial,direccion,colonia) VALUES ('Clínica de prueba','TEST','Calle','Centro')");
  const passwordHash = await bcrypt.hash('ClaveSoloDePruebas2026', 4);
  await query("INSERT INTO usuarios (unidad_medica_id,nombre,apellidos,email,password_hash,rol) VALUES (1,'Recepción','Prueba','recepcion@test.local',$1,'RECEPCION')", [passwordHash]);
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  base = `http://127.0.0.1:${server.address().port}/api`;

  await t.test('Inicio de sesión: credenciales inválidas y token válido', async () => {
    assert.equal((await request('/auth/login', { method: 'POST', auth: null, body: {email: 'recepcion@test.local', password: 'incorrecta'} })).status, 401);
    const r = await request('/auth/login', {method:'POST', auth:null, body:{email:'recepcion@test.local',password:'ClaveSoloDePruebas2026'}});
    assert.equal(r.status,200); assert.equal(r.json.user.rol,'RECEPCION');
    token = r.json.token; assert.equal(typeof token,'string');
  });
  await t.test('Registro sin token, expirado o malformado: 401', async () => {
    assert.equal((await request('/pacientes',{method:'POST',auth:null,body:adulto})).status,401);
    assert.equal((await request('/pacientes',{method:'POST',auth:'invalido',body:adulto})).status,401);
    const expired=jwt.sign({id:1,rol:'RECEPCION'},process.env.JWT_SECRET,{expiresIn:-1});
    assert.equal((await request('/pacientes',{method:'POST',auth:expired,body:adulto})).status,401);
  });
  await t.test('Crear paciente: guarda todos los datos y canaliza al área elegida',async()=>{
    const r=await request('/pacientes',{method:'POST',body:adulto});
    assert.equal(r.status,201,JSON.stringify(r.json)); pacienteId=r.json.paciente.id;
    for(const key of ['numero_afiliacion','grupo_sanguineo','religion','ocupacion','tipo_poblacion','area_servicio']) assert.equal(r.json.paciente[key],adulto[key]);
    assert.equal(r.json.atencion_inicial.estado,'TRIAJE');
    assert.equal(r.json.atencion_inicial.area_servicio,'Nutrición');
    assert.equal(r.json.atencion_inicial.tipo_atencion,'PRIMERA_VEZ');
  });
  await t.test('Listar pacientes con búsqueda y paginación',async()=>{
    const r=await request('/pacientes?q=Prueba&pagina=1&limite=10');
    assert.equal(r.status,200,JSON.stringify(r.json));assert.equal(r.json.datos.length,1);assert.equal(r.json.paginacion.totalRegistros,1);
  });
  await t.test('Duplicado de CURP: 409 sin crear otra atención',async()=>{
    const r=await request('/pacientes',{method:'POST',body:adulto});assert.equal(r.status,409);
    assert.equal((await query('SELECT COUNT(*)::INT AS n FROM atenciones_clinicas')).rows[0].n,1);
  });
  await t.test('Datos inválidos y tutor obligatorio: 400',async()=>{
    for(const cambio of [{colonia:''},{calle_numero:' '},{fecha_nacimiento:'2020-02-31'},{sexo:'X'},{num_personas_vivienda:0}]) assert.equal((await request('/pacientes',{method:'POST',body:{...adulto,...cambio}})).status,400);
    assert.equal((await request('/pacientes',{method:'POST',body:{...adulto,curp:'MENR200101HVZBBB01',fecha_nacimiento:'2020-01-01'}})).status,400);
  });
  await t.test('Menor con tutor: guarda tutor y paciente',async()=>{
    const r=await request('/pacientes',{method:'POST',body:{...adulto,curp:'MENR200101HVZBBB01',fecha_nacimiento:'2020-01-01',tutor:{nombre_completo:'Tutor de prueba',parentesco:'Madre',telefono_contacto:'9211231234',tipo_identificacion:'INE'}}});
    assert.equal(r.status,201,JSON.stringify(r.json));assert.equal(r.json.tutor.parentesco,'Madre');assert.equal(r.json.paciente.es_menor,true);
  });
  await t.test('Editar parcialmente conserva los campos omitidos y permite vaciar opcionales',async()=>{
    const r=await request(`/pacientes/${pacienteId}`,{method:'PUT',body:{telefono:'9210000000'}});
    assert.equal(r.status,200,JSON.stringify(r.json));assert.equal(r.json.paciente.ocupacion,'Estudiante');assert.equal(r.json.paciente.numero_afiliacion,'AF-123');
    const r2=await request(`/pacientes/${pacienteId}`,{method:'PUT',body:{religion:'',area:'Odontología',tipo_consulta:'Subsecuente'}});
    assert.equal(r2.status,200);assert.equal(r2.json.paciente.religion,null);
    const atencion=(await query('SELECT * FROM atenciones_clinicas WHERE paciente_id=$1',[pacienteId])).rows[0];
    assert.equal(atencion.area_servicio,'Odontología');assert.equal(atencion.tipo_atencion,'SUBSECUENTE');
  });
  await t.test('Fallos durante edición se revierten en transacción',async()=>{
    const r=await request(`/pacientes/${pacienteId}`,{method:'PUT',body:{curp:'MENR200101HVZBBB01',ocupacion:'No debe guardarse'}});
    assert.equal(r.status,409);const p=(await query('SELECT ocupacion FROM pacientes WHERE id=$1',[pacienteId])).rows[0];assert.equal(p.ocupacion,'Estudiante');
  });
  await t.test('Migración 06 corrige columnas antiguas estrechas al editar el área',async()=>{
    await query('ALTER TABLE pacientes ALTER COLUMN ocupacion TYPE VARCHAR(12)');
    await query('ALTER TABLE pacientes ALTER COLUMN area_servicio TYPE VARCHAR(12)');
    await query('ALTER TABLE atenciones_clinicas ALTER COLUMN area_servicio TYPE VARCHAR(12)');
    const body={area:'Medicina General',ocupacion:'Población abierta',tipo_poblacion:'Población general',estado_civil:'Unión libre',escolaridad:'Preparatoria'};
    const antes=await request(`/pacientes/${pacienteId}`,{method:'PUT',body});
    assert.equal(antes.status,400);assert.match(antes.json.error,/migración 06/);
    await inicializarMigraciones();
    const despues=await request(`/pacientes/${pacienteId}`,{method:'PUT',body});
    assert.equal(despues.status,200,JSON.stringify(despues.json));
    assert.equal(despues.json.paciente.area_servicio,'Medicina General');
    assert.equal(despues.json.paciente.ocupacion,'Población abierta');
    assert.equal(despues.json.paciente.fecha_nacimiento.slice(0,10),'1990-01-01');
    const atencion=(await query('SELECT area_servicio FROM atenciones_clinicas WHERE paciente_id=$1',[pacienteId])).rows[0];
    assert.equal(atencion.area_servicio,'Medicina General');
  });
  await t.test('Cambiar a un área de etiqueta larga conserva la fecha de nacimiento',async()=>{
    const r=await request(`/pacientes/${pacienteId}`,{method:'PUT',body:{area:'Enfermería / Triaje'}});
    assert.equal(r.status,200,JSON.stringify(r.json));
    assert.equal(r.json.paciente.area_servicio,'Enfermería / Triaje');
    assert.equal(r.json.paciente.fecha_nacimiento.slice(0,10),'1990-01-01');
  });
  await t.test('Backend rechaza CURP con longitud incorrecta o símbolos',async()=>{
    for(const curp of ['123','1234567890123456789','@23456789012345678']){
      const r=await request(`/pacientes/${pacienteId}`,{method:'PUT',body:{curp}});
      assert.equal(r.status,400,JSON.stringify(r.json));
    }
  });
  await t.test('Backend acepta teléfono de diez números y rechaza otros formatos',async()=>{
    for(const telefono of ['123456789','12345678901','921-2808287','ABCDEFGHIJ']){
      const r=await request(`/pacientes/${pacienteId}`,{method:'PUT',body:{telefono}});
      assert.equal(r.status,400,JSON.stringify(r.json));
    }
    assert.equal((await request(`/pacientes/${pacienteId}`,{method:'PUT',body:{telefono:'9212808287'}})).status,200);
    assert.equal((await request(`/pacientes/${pacienteId}`,{method:'PUT',body:{telefono:''}})).status,200);
  });
  await t.test('Backend limita también el teléfono del tutor a diez números',async()=>{
    const r=await request(`/pacientes/${pacienteId}/tutor`,{method:'PUT',body:{nombre_completo:'Tutor',parentesco:'Padre',telefono_contacto:'12345678901',tipo_identificacion:'INE'}});
    assert.equal(r.status,400,JSON.stringify(r.json));
  });
  await t.test('Restricción CHECK al editar: mensaje específico, referencia y reversión completa', async () => {
    const antes = (await query('SELECT area_servicio, ocupacion FROM pacientes WHERE id=$1', [pacienteId])).rows[0];
    await query("ALTER TABLE pacientes ADD CONSTRAINT pacientes_area_servicio_prueba_check CHECK (area_servicio != 'Área bloqueada')");
    try {
      const r = await request(`/pacientes/${pacienteId}`, {method:'PUT', body:{area_servicio:'Área bloqueada', ocupacion:'No debe persistir'}});
      assert.equal(r.status, 400, JSON.stringify(r.json));
      assert.equal(r.json.codigo, 'PACIENTE_RESTRICCION');
      assert.equal(r.json.campo, 'area_servicio');
      assert.match(r.json.referencia, /^[a-f0-9-]{36}$/);
      assert.match(r.json.error, /área \/ servicio/);
      assert.doesNotMatch(JSON.stringify(r.json), /Área bloqueada|No debe persistir|failing row|23514/i);
      assert.deepEqual((await query('SELECT area_servicio, ocupacion FROM pacientes WHERE id=$1', [pacienteId])).rows[0], antes);
    } finally { await query('ALTER TABLE pacientes DROP CONSTRAINT pacientes_area_servicio_prueba_check'); }
  });
  await t.test('Modificar únicamente el área conserva un teléfono antiguo sin reenviarlo', async () => {
    await query("UPDATE pacientes SET telefono='921-123-1234' WHERE id=$1", [pacienteId]);
    const r = await request(`/pacientes/${pacienteId}`, {method:'PUT', body:{area_servicio:'Odontología'}});
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.paciente.telefono, '921-123-1234');
    assert.equal(r.json.paciente.area_servicio, 'Odontología');
    await query("UPDATE pacientes SET telefono='9211231234' WHERE id=$1", [pacienteId]);
  });
  await t.test('Tutor existente se conserva al editar solamente el área de un menor', async () => {
    const menor = (await query("SELECT id FROM pacientes WHERE curp='MENR200101HVZBBB01'")).rows[0];
    const antes = (await query('SELECT * FROM tutores WHERE paciente_id=$1', [menor.id])).rows[0];
    const r = await request(`/pacientes/${menor.id}`, {method:'PUT', body:{area_servicio:'Odontología'}});
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual((await query('SELECT * FROM tutores WHERE paciente_id=$1', [menor.id])).rows[0], antes);
  });
  await t.test('Tutor inválido y cuerpo no objeto se rechazan sin un error SQL', async () => {
    assert.equal((await request(`/pacientes/${pacienteId}/tutor`, {method:'PUT', body:{nombre_completo:123, parentesco:'Madre', telefono_contacto:'9211231234', tipo_identificacion:'INE'}})).status, 400);
    assert.equal((await request(`/pacientes/${pacienteId}`, {method:'PUT', body:[]})).status, 400);
  });
  await t.test('Permisos actualizados y cuenta desactivada se verifican en cada petición',async()=>{
    await query("UPDATE usuarios SET rol='ENFERMERIA' WHERE id=1");
    assert.equal((await request('/pacientes',{method:'POST',body:adulto})).status,403);
    await query("UPDATE usuarios SET rol='RECEPCION',activo=false WHERE id=1");
    assert.equal((await request('/pacientes')).status,403);
    await query('UPDATE usuarios SET activo=true WHERE id=1');
  });
  await t.test('Falla de BD no permite pasar la autenticación',async()=>{
    fallaDB=true;try{assert.equal((await request('/pacientes')).status,503);}finally{fallaDB=false;}
  });
  await t.test('Rutas de lectura de todos los módulos y expediente: HTTP 200',async()=>{
    await query("UPDATE usuarios SET rol='DIRECCION' WHERE id=1");
    const rutas = [
      '/health','/auth/me','/unidades','/usuarios','/atenciones/sala-espera?estado=TRIAJE',
      '/triaje/pendientes','/triaje/atendidos-hoy','/triaje/procedimientos-hoy',
      '/consultas/pendientes','/consultas/atendidos-hoy',
      '/odontologia/pendientes','/odontologia/atendidos-hoy',
      '/nutricion/pendientes','/nutricion/atendidos-hoy','/nutricion/oms-referencia',
      '/psicologia/pendientes','/psicologia/atendidos-hoy',
      `/pacientes/${pacienteId}/historia-clinica`, `/pacientes/${pacienteId}/expediente-completo`,
      `/consultas/datos-certificado/${pacienteId}`, '/estadisticas/tablero-resumen'
    ];
    const errores=[];
    for (const ruta of rutas) {
      const r=await request(ruta); if(r.status !== 200) errores.push(`${ruta}: ${JSON.stringify(r.json)}`);
    }
    assert.deepEqual(errores,[]);
  });
  await t.test('Flujo de alta, triaje y guardado en cada especialidad',async()=>{
    const casos = [
      {ruta:'/consultas/medicina-general', area:'Medicina General', body:{motivo_consulta:'Prueba de comunicación',nota_subjetivo:'Dato de prueba',nota_objetivo:'Dato de prueba',nota_analisis:'Dato de prueba',nota_plan:'Dato de prueba',diagnostico_cie10:'Z00.0',diagnostico_descripcion:'Prueba',clasificacion_morbilidad:'Medicina General',emite_certificado:false}},
      {ruta:'/odontologia',area:'Odontología',body:{tipo_denticion:'ADULTA',motivo_consulta:'Prueba de comunicación',piezas:[]}},
      {ruta:'/nutricion',area:'Nutrición',body:{motivo_consulta:'Prueba de comunicación',circunferencia_cintura:80,circunferencia_cadera:90,circunferencia_brazo:30,porcentaje_grasa:20,porcentaje_musculo:40,consumo_agua_litros:2,frecuencia_ejercicio:'Prueba',recordatorio_24h:{desayuno:'Dato de prueba'}}},
      {ruta:'/psicologia',area:'Psicología',body:{motivo_consulta:'Prueba de comunicación',evaluacion_clinica:'Dato de prueba',nota_evolucion:'Dato de prueba',plan_intervencion:'Dato de prueba'}}
    ];
    const errores=[];
    for(const [index,caso] of casos.entries()) {
      const alta=await request('/pacientes',{method:'POST',body:{...adulto,curp:`TEST${String(index).padStart(14,'0')}`,area_servicio:caso.area}});
      assert.equal(alta.status,201,JSON.stringify(alta.json));
      const atencion_id=alta.json.atencion_inicial.id;
      const triaje=await request('/triaje',{method:'POST',body:{atencion_id,tension_arterial:'120/80',frecuencia_cardiaca:75,frecuencia_respiratoria:18,temperatura:36.5,saturacion_oxigeno:98,peso_kg:70,talla_metros:1.7,procedimientos:[{tipo_procedimiento:'Curación',cantidad:1,observaciones:'Sólo prueba'}]}});
      assert.equal(triaje.status,201,JSON.stringify(triaje.json));
      const guardado=await request(caso.ruta,{method:'POST',body:{atencion_id,...caso.body}});
      if(guardado.status!==201) errores.push(`${caso.ruta}: ${JSON.stringify(guardado.json)}`);
    }
    assert.deepEqual(errores,[]);
  });
  const antecedentesA={diabetes:true,hipertension:false,dislipidemia:false,enfermedad_renal:false,cardiopatia:true,hipotiroidismo:false,embarazo_lactancia:false};
  const antecedentesB={...antecedentesA,diabetes:false,hipertension:true,cardiopatia:false};
  let pacienteA,pacienteB,atencionA,consultaA;
  await t.test('Antecedentes: guardar junto con la evaluación, separados por paciente',async()=>{
    const altaA=await request('/pacientes',{method:'POST',body:{...adulto,curp:'ANUT00000000000001',area_servicio:'Nutrición'}});
    const altaB=await request('/pacientes',{method:'POST',body:{...adulto,curp:'BNUT00000000000001',area_servicio:'Nutrición'}});
    assert.equal(altaA.status,201);assert.equal(altaB.status,201);
    pacienteA=altaA.json.paciente.id;pacienteB=altaB.json.paciente.id;atencionA=altaA.json.atencion_inicial.id;
    for(const [atencion,datos] of [[atencionA,antecedentesA],[altaB.json.atencion_inicial.id,antecedentesB]]){
      const r=await request('/nutricion',{method:'POST',body:{atencion_id:atencion,motivo_consulta:'Prueba de antecedentes',antecedentes_patologicos:datos}});
      assert.equal(r.status,201,JSON.stringify(r.json));assert.deepEqual(r.json.consulta.antropometria.antecedentes_patologicos,datos);
      if(atencion===atencionA)consultaA=r.json.consulta.id;
    }
    const a=await request(`/nutricion/historial/${pacienteA}`);
    const b=await request(`/nutricion/historial/${pacienteB}`);
    assert.equal(a.status,200);assert.equal(b.status,200);
    assert.deepEqual(a.json[0].antecedentes_patologicos,antecedentesA);
    assert.deepEqual(b.json[0].antecedentes_patologicos,antecedentesB);
  });
  await t.test('Expediente completo devuelve las casillas de la evaluación guardada',async()=>{
    const r=await request(`/pacientes/${pacienteA}/expediente-completo`);
    assert.equal(r.status,200,JSON.stringify(r.json));
    const consulta=r.json.timeline_visitas.flatMap(v=>v.consultas).find(c=>c.id===consultaA);
    assert.deepEqual(consulta.nutricion.antecedentes_patologicos,antecedentesA);
  });
  await t.test('Una nueva evaluación conserva el historial y guarda también los falsos',async()=>{
    const atencion=await request('/atenciones',{method:'POST',body:{paciente_id:pacienteA,area_servicio:'Nutrición',tipo_atencion:'SUBSECUENTE'}});
    assert.equal(atencion.status,201,JSON.stringify(atencion.json));
    const r=await request('/nutricion',{method:'POST',body:{atencion_id:atencion.json.atencion.id,motivo_consulta:'Segunda evaluación',antecedentes_patologicos:antecedentesB}});
    assert.equal(r.status,201,JSON.stringify(r.json));
    const historial=await request(`/nutricion/historial/${pacienteA}`);
    assert.equal(historial.json.length,2);
    assert.deepEqual(historial.json[0].antecedentes_patologicos,antecedentesB);
    assert.deepEqual(historial.json[1].antecedentes_patologicos,antecedentesA);
    assert.equal(historial.json[1].consulta_id,consultaA);
  });
  await t.test('Rechazar valores de casillas malformados sin escribir una consulta',async()=>{
    const atencion=await request('/atenciones',{method:'POST',body:{paciente_id:pacienteB,area_servicio:'Nutrición'}});
    assert.equal(atencion.status,201,JSON.stringify(atencion.json));
    const antes=(await query('SELECT COUNT(*)::int AS n FROM consultas_nutricion')).rows[0].n;
    for(const datos of [null,[],true,'diabetes',{diabetes:'true'},{diabetes:1},{campo_desconocido:true}]){
      const r=await request('/nutricion',{method:'POST',body:{atencion_id:atencion.json.atencion.id,motivo_consulta:'No debe guardarse',antecedentes_patologicos:datos}});
      assert.equal(r.status,400,JSON.stringify(r.json));
    }
    assert.equal((await query('SELECT COUNT(*)::int AS n FROM consultas_nutricion')).rows[0].n,antes);
  });
  await t.test('No duplicar una evaluación en una atención finalizada',async()=>{
    const r=await request('/nutricion',{method:'POST',body:{atencion_id:atencionA,motivo_consulta:'Duplicado',antecedentes_patologicos:antecedentesB}});
    assert.equal(r.status,409,JSON.stringify(r.json));
    assert.equal((await query('SELECT COUNT(*)::int AS n FROM consultas_base WHERE atencion_id=$1',[atencionA])).rows[0].n,1);
  });
  await t.test('La migración de antecedentes se puede repetir sin perder evaluaciones',async()=>{
    await inicializarMigraciones();
    const historial=await request(`/nutricion/historial/${pacienteA}`);
    assert.equal(historial.json.length,2);
    assert.deepEqual(historial.json[1].antecedentes_patologicos,antecedentesA);
    // Los clientes anteriores sin casillas siguen siendo compatibles.
    const antiguo=(await query("SELECT antecedentes_patologicos FROM consultas_nutricion WHERE consulta_id IN (SELECT id FROM consultas_base WHERE motivo_consulta='Prueba de comunicación') LIMIT 1")).rows[0];
    assert.equal(antiguo.antecedentes_patologicos.diabetes,false);
  });
  await t.test('Cambiar área del paciente no reescribe atenciones finalizadas',async()=>{
    const antes=(await query('SELECT id,area_servicio FROM atenciones_clinicas WHERE paciente_id=$1 ORDER BY id',[pacienteA])).rows;
    const r=await request(`/pacientes/${pacienteA}`,{method:'PUT',body:{area:'Psicología'}});
    assert.equal(r.status,200,JSON.stringify(r.json));
    assert.equal(r.json.paciente.area_servicio,'Psicología');
    const despues=(await query('SELECT id,area_servicio FROM atenciones_clinicas WHERE paciente_id=$1 ORDER BY id',[pacienteA])).rows;
    assert.deepEqual(despues,antes);
  });
  await t.test('Reportes y certificado responden como HTML descargable',async()=>{
    const hoy=new Date();
    const rutas=[
      `/estadisticas/diario/pdf?fecha=${hoy.toISOString().slice(0,10)}&area=MEDICINA_GENERAL`,
      `/estadisticas/mensual/pdf?mes=${hoy.getUTCMonth()+1}&anio=${hoy.getUTCFullYear()}&area=GENERAL`,
      '/estadisticas/certificado/medico/pdf?nombre=Paciente%20Prueba',
      '/estadisticas/certificado/nutricion/pdf?nombre=Paciente%20Prueba'
    ];
    for(const ruta of rutas) {
      const r=await fetch(`${base}${ruta}`,{headers:{Authorization:`Bearer ${token}`}});
      assert.equal(r.status,200,`${ruta}: ${await r.text()}`);
      assert.match(r.headers.get('content-type'),/text\/html/);
    }
  });
  await t.test('Preflight CORS admite Authorization y Content-Type',async()=>{
    const r=await fetch(`${base}/pacientes`,{method:'OPTIONS',headers:{Origin:'http://localhost:8080','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
    assert.equal(r.status,204);assert.match(r.headers.get('access-control-allow-headers'),/authorization/i);
  });
});
