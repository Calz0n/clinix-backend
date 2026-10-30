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

async function pasarTriaje(atencion_id) {
  const r = await request('/triaje', {method:'POST', body:{atencion_id,tension_arterial:'120/80',frecuencia_cardiaca:75,frecuencia_respiratoria:18,temperatura:36.5,saturacion_oxigeno:98,peso_kg:70,talla_metros:1.7}});
  assert.equal(r.status, 201, JSON.stringify(r.json));
}
let numeroCaso = 0;
async function crearAtencion(area, lista = true) {
  const r = await request('/pacientes', {method:'POST', body:{...adulto,curp:`SERV${String(++numeroCaso).padStart(14,'0')}`,area_servicio:area}});
  assert.equal(r.status, 201, JSON.stringify(r.json));
  if (lista) await pasarTriaje(r.json.atencion_inicial.id);
  return {atencion_id:r.json.atencion_inicial.id, paciente_id:r.json.paciente.id};
}
const servicios = [
  {area:'Medicina General', codigo:'MEDICINA_GENERAL', ruta:'/consultas/medicina-general', cola:'/consultas/pendientes', datos:{motivo_consulta:'Prueba',nota_subjetivo:'Prueba',nota_objetivo:'Prueba',nota_analisis:'Prueba',nota_plan:'Prueba',diagnostico_cie10:'Z00.0',diagnostico_descripcion:'Prueba',clasificacion_morbilidad:'Medicina General'}},
  {area:'Odontología', codigo:'ODONTOLOGIA', ruta:'/odontologia', cola:'/odontologia/pendientes', datos:{motivo_consulta:'Prueba',tipo_denticion:'ADULTA',piezas:[]}},
  {area:'Nutrición', codigo:'NUTRICION', ruta:'/nutricion', cola:'/nutricion/pendientes', datos:{motivo_consulta:'Prueba'}},
  {area:'Psicología', codigo:'PSICOLOGIA', ruta:'/psicologia', cola:'/psicologia/pendientes', datos:{motivo_consulta:'Prueba',evaluacion_clinica:'Prueba',nota_evolucion:'Prueba',plan_intervencion:'Prueba'}},
];

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
      const guardado=await request(caso.ruta,{method:'POST',body:{atencion_id,paciente_id:alta.json.paciente.id,...caso.body}});
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
      await pasarTriaje(atencion);
      const r=await request('/nutricion',{method:'POST',body:{atencion_id:atencion,paciente_id:atencion===atencionA?pacienteA:pacienteB,motivo_consulta:'Prueba de antecedentes',antecedentes_patologicos:datos}});
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
    await pasarTriaje(atencion.json.atencion.id);
    const r=await request('/nutricion',{method:'POST',body:{atencion_id:atencion.json.atencion.id,paciente_id:pacienteA,motivo_consulta:'Segunda evaluación',antecedentes_patologicos:antecedentesB}});
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
    await pasarTriaje(atencion.json.atencion.id);
    const antes=(await query('SELECT COUNT(*)::int AS n FROM consultas_nutricion')).rows[0].n;
    for(const datos of [null,[],true,'diabetes',{diabetes:'true'},{diabetes:1},{campo_desconocido:true}]){
      const r=await request('/nutricion',{method:'POST',body:{atencion_id:atencion.json.atencion.id,paciente_id:pacienteB,motivo_consulta:'No debe guardarse',antecedentes_patologicos:datos}});
      assert.equal(r.status,400,JSON.stringify(r.json));
    }
    assert.equal((await query('SELECT COUNT(*)::int AS n FROM consultas_nutricion')).rows[0].n,antes);
  });
  await t.test('No duplicar una evaluación en una atención finalizada',async()=>{
    const r=await request('/nutricion',{method:'POST',body:{atencion_id:atencionA,paciente_id:pacienteA,motivo_consulta:'Duplicado',antecedentes_patologicos:antecedentesB}});
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
  await t.test('Las cuatro colas muestran sólo el servicio correspondiente', async () => {
    const casos = [];
    for (const servicio of servicios) casos.push({...await crearAtencion(servicio.area, false),servicio});
    // La base embebida usa una conexión; las transacciones se prueban secuencialmente.
    for (const caso of casos) await pasarTriaje(caso.atencion_id);
    for (const servicio of servicios) {
      const r = await request(servicio.cola);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      for (const caso of casos) assert.equal(r.json.some(p => p.atencion_id === caso.atencion_id), caso.servicio.codigo === servicio.codigo);
    }
  });
  await t.test('Un área nula o desconocida no aparece en ninguna cola', async () => {
    const nulo = await crearAtencion('Nutrición');
    const desconocido = await crearAtencion('Nutrición');
    await query('UPDATE atenciones_clinicas SET area_servicio=NULL WHERE id=$1', [nulo.atencion_id]);
    await query("UPDATE atenciones_clinicas SET area_servicio='Área desconocida' WHERE id=$1", [desconocido.atencion_id]);
    for (const servicio of servicios) {
      const r = await request(servicio.cola);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.some(p => [nulo.atencion_id,desconocido.atencion_id].includes(p.atencion_id)), false);
    }
  });
  await t.test('Ningún servicio guarda una atención que todavía está en Triaje', async () => {
    for (const servicio of servicios) {
      const caso = await crearAtencion(servicio.area, false);
      const antes = (await query('SELECT COUNT(*)::int AS n FROM consultas_base')).rows[0].n;
      const r = await request(servicio.ruta, {method:'POST',body:{...caso,...servicio.datos}});
      assert.equal(r.status, 409, JSON.stringify(r.json));
      assert.equal((await query('SELECT COUNT(*)::int AS n FROM consultas_base')).rows[0].n, antes);
    }
  });
  await t.test('Guardar desde otra especialidad se rechaza sin cambiar el área', async () => {
    for (const servicio of servicios) {
      const caso = await crearAtencion(servicio.codigo === 'NUTRICION' ? 'Psicología' : 'Nutrición');
      const antes = (await query('SELECT area_servicio,estado FROM atenciones_clinicas WHERE id=$1',[caso.atencion_id])).rows[0];
      const r = await request(servicio.ruta, {method:'POST',body:{...caso,...servicio.datos}});
      assert.equal(r.status, 409, JSON.stringify(r.json));
      assert.deepEqual((await query('SELECT area_servicio,estado FROM atenciones_clinicas WHERE id=$1',[caso.atencion_id])).rows[0], antes);
      assert.equal((await query('SELECT COUNT(*)::int AS n FROM consultas_base WHERE atencion_id=$1',[caso.atencion_id])).rows[0].n,0);
    }
  });
  await t.test('Los cuatro servicios requieren el identificador del paciente, incluso con una atención válida', async () => {
    for (const servicio of servicios) {
      const caso = await crearAtencion(servicio.area);
      const r = await request(servicio.ruta,{method:'POST',body:{atencion_id:caso.atencion_id,...servicio.datos}});
      assert.equal(r.status,400,JSON.stringify(r.json));
      assert.equal((await query('SELECT COUNT(*)::int AS n FROM consultas_base WHERE atencion_id=$1',[caso.atencion_id])).rows[0].n,0);
    }
  });
  await t.test('Paciente y atención deben coincidir en los cuatro servicios', async () => {
    for (const servicio of servicios) {
      const a = await crearAtencion(servicio.area), b = await crearAtencion(servicio.area);
      const r = await request(servicio.ruta, {method:'POST',body:{...a,paciente_id:b.paciente_id,...servicio.datos}});
      assert.equal(r.status,409,JSON.stringify(r.json));
      assert.equal((await query('SELECT COUNT(*)::int AS n FROM consultas_base WHERE atencion_id=$1',[a.atencion_id])).rows[0].n,0);
    }
  });
  await t.test('La derivación válida aparece en su destino y se atiende una sola vez', async () => {
    const origen = servicios[0], destino = servicios[3];
    const caso = await crearAtencion(origen.area);
    const salida = await request(origen.ruta, {method:'POST',body:{...caso,...origen.datos,tratamiento_cruzado:{area_destino:destino.codigo,motivo_derivacion:'Interconsulta de prueba'}}});
    assert.equal(salida.status,201,JSON.stringify(salida.json));
    const tratamiento_cruzado_id = salida.json.tratamiento_cruzado.id;
    assert.equal((await query('SELECT estado FROM atenciones_clinicas WHERE id=$1',[caso.atencion_id])).rows[0].estado,'FINALIZADA');
    for (const servicio of servicios) {
      const r = await request(servicio.cola);
      const item = r.json.find(p => p.atencion_id === caso.atencion_id);
      assert.equal(!!item,servicio.codigo === destino.codigo);
      if (item) assert.equal(item.tratamiento_cruzado_id,tratamiento_cruzado_id);
    }
    const body = {...caso,...destino.datos,tratamiento_cruzado_id};
    const llegada = await request(destino.ruta,{method:'POST',body});
    assert.equal(llegada.status,201,JSON.stringify(llegada.json));
    assert.equal((await query('SELECT estado FROM tratamientos_cruzados WHERE id=$1',[tratamiento_cruzado_id])).rows[0].estado,'ATENDIDO');
    assert.equal((await request(destino.ruta,{method:'POST',body})).status,409);
    assert.equal((await query("SELECT COUNT(*)::int AS n FROM consultas_base WHERE atencion_id=$1 AND area_medica='PSICOLOGIA'",[caso.atencion_id])).rows[0].n,1);
    assert.equal((await query('SELECT area_servicio FROM atenciones_clinicas WHERE id=$1',[caso.atencion_id])).rows[0].area_servicio,'Medicina General');
  });
  await t.test('Las cuatro especialidades aceptan su derivación y excluyen a las demás', async () => {
    for (const destino of servicios) {
      const origen = destino.codigo === 'MEDICINA_GENERAL' ? servicios[3] : servicios[0];
      const caso = await crearAtencion(origen.area);
      const datos = {area_destino:destino.area,motivo_derivacion:'Derivación de prueba'};
      const body = {...caso,...origen.datos,...(origen.codigo === 'MEDICINA_GENERAL' ? {tratamiento_cruzado:datos} : {derivar_a:datos})};
      const r = await request(origen.ruta,{method:'POST',body});
      assert.equal(r.status,201,JSON.stringify(r.json));
      const ref = r.json.tratamiento_cruzado?.id || r.json.derivacion_generada.id;
      const cola = await request(destino.cola);
      assert.equal(cola.json.find(p => p.atencion_id === caso.atencion_id)?.tratamiento_cruzado_id,ref);
      const llegada = await request(destino.ruta,{method:'POST',body:{...caso,...destino.datos,tratamiento_cruzado_id:ref}});
      assert.equal(llegada.status,201,JSON.stringify(llegada.json));
      assert.equal((await query('SELECT estado FROM tratamientos_cruzados WHERE id=$1',[ref])).rows[0].estado,'ATENDIDO');
    }
  });
  await t.test('Una derivación interna inválida se rechaza sin guardar una nota parcial', async () => {
    const caso = await crearAtencion('Medicina General');
    const r = await request(servicios[0].ruta,{method:'POST',body:{...caso,...servicios[0].datos,tratamiento_cruzado:{area_destino:'Servicio inexistente',motivo_derivacion:'Prueba'}}});
    assert.equal(r.status,400,JSON.stringify(r.json));
    assert.equal((await query('SELECT COUNT(*)::int AS n FROM consultas_base WHERE atencion_id=$1',[caso.atencion_id])).rows[0].n,0);
  });
  await t.test('Una derivación ajena o cancelada no permite guardar', async () => {
    const a = await crearAtencion('Nutrición'), b = await crearAtencion('Nutrición');
    const ref = (await query("INSERT INTO tratamientos_cruzados(atencion_origen_id,area_origen,area_destino,motivo_derivacion,estado) VALUES($1,'NUTRICION','PSICOLOGIA','Prueba','PENDIENTE') RETURNING id",[b.atencion_id])).rows[0].id;
    assert.equal((await request('/psicologia',{method:'POST',body:{...a,...servicios[3].datos,tratamiento_cruzado_id:ref}})).status,409);
    await query("UPDATE tratamientos_cruzados SET estado='CANCELADO' WHERE id=$1",[ref]);
    assert.equal((await request('/psicologia',{method:'POST',body:{...b,...servicios[3].datos,tratamiento_cruzado_id:ref}})).status,409);
  });
  await t.test('Cambiar el área invalida la captura anterior y actualiza ambas colas', async () => {
    const caso = await crearAtencion('Nutrición');
    assert.equal((await request(`/pacientes/${caso.paciente_id}`,{method:'PUT',body:{area:'Psicología'}})).status,200);
    const nutri=await request('/nutricion/pendientes'), psico=await request('/psicologia/pendientes');
    assert.equal(nutri.json.some(p => p.atencion_id === caso.atencion_id),false);
    assert.equal(psico.json.some(p => p.atencion_id === caso.atencion_id),true);
    assert.equal((await request('/nutricion',{method:'POST',body:{...caso,...servicios[2].datos}})).status,409);
    assert.equal((await request('/psicologia',{method:'POST',body:{...caso,...servicios[3].datos}})).status,201);
  });
  const dxPsico=[{cie10:'F41.1',descripcion:'Trastorno de ansiedad generalizada',principal:false},{cie10:'F32.1',descripcion:'Episodio depresivo moderado',principal:true}];
  const datosPsico={motivo_consulta:'Seguimiento psicológico',nota_evolucion:'Nota de prueba',plan_intervencion:'Plan de prueba',diagnosticos:dxPsico,estado_diagnostico:'REGISTRADO'};
  let casoMulti,consultaMulti;
  await t.test('Diagnósticos múltiples: guardar y recuperar principal y secundarios en historial y expediente',async()=>{
    casoMulti=await crearAtencion('Psicología');
    const r=await request('/psicologia',{method:'POST',body:{...casoMulti,...datosPsico}});
    assert.equal(r.status,201,JSON.stringify(r.json));
    const nota=r.json.consulta.detalle_psicologia;consultaMulti=nota.consulta_id;
    assert.deepEqual(nota.diagnosticos,dxPsico);assert.equal(nota.estado_diagnostico,'REGISTRADO');
    assert.ok(nota.evaluacion_clinica.startsWith('Principal: F32.1'));assert.ok(nota.evaluacion_clinica.includes('Secundario: F41.1'));
    assert.deepEqual((await request(`/psicologia/historial/${casoMulti.paciente_id}`)).json[0].diagnosticos,dxPsico);
    const exp=(await request(`/pacientes/${casoMulti.paciente_id}/expediente-completo`)).json;
    const notaExp=exp.timeline_visitas.flatMap(v=>v.consultas).find(c=>c.psicologia);
    assert.deepEqual(notaExp.psicologia.diagnosticos,dxPsico);assert.equal(notaExp.psicologia.estado_diagnostico,'REGISTRADO');
    const otro=await crearAtencion('Psicología');assert.deepEqual((await request(`/psicologia/historial/${otro.paciente_id}`)).json,[]);
  });
  await t.test('Una sesión en evaluación se guarda sin inventar código CIE-10',async()=>{
    const caso=await crearAtencion('Psicología');
    const r=await request('/psicologia',{method:'POST',body:{...caso,...datosPsico,diagnosticos:[],estado_diagnostico:'EN_EVALUACION'}});
    assert.equal(r.status,201,JSON.stringify(r.json));const nota=r.json.consulta.detalle_psicologia;
    assert.deepEqual(nota.diagnosticos,[]);assert.equal(nota.estado_diagnostico,'EN_EVALUACION');
    assert.equal(nota.evaluacion_clinica,'En evaluación / sin diagnóstico establecido.');
  });
  await t.test('Rechazar diagnósticos inválidos, repetidos o sin principal sin guardar una nota parcial',async()=>{
    const caso=await crearAtencion('Psicología'),d={cie10:'F41.1',descripcion:'Prueba',principal:true};
    const invalidos=[{diagnosticos:null},{diagnosticos:{}},{diagnosticos:[]},{diagnosticos:[null]},
      {diagnosticos:[{...d,principal:'true'}]},{diagnosticos:[{...d,principal:false}]},
      {diagnosticos:[d,{...d,cie10:'F32.1'}]},{diagnosticos:[d,{...d,cie10:' f41.1 ',principal:false}]},
      {diagnosticos:[{...d,cie10:'INVALIDO'}]},{diagnosticos:[{...d,descripcion:''}]},{diagnosticos:[{...d,descripcion:'x'.repeat(201)}]},
      {diagnosticos:Array.from({length:21},(_,i)=>({...d,cie10:`F${String(i).padStart(2,'0')}`,principal:i===0}))},
      {estado_diagnostico:'LEGADO'},{estado_diagnostico:'EN_EVALUACION'}];
    for(const invalido of invalidos){
      const r=await request('/psicologia',{method:'POST',body:{...caso,...datosPsico,...invalido}});
      assert.equal(r.status,400,JSON.stringify(r.json));
      assert.equal((await query('SELECT COUNT(*)::int AS n FROM consultas_base WHERE atencion_id=$1',[caso.atencion_id])).rows[0].n,0);
      assert.equal((await query('SELECT estado FROM atenciones_clinicas WHERE id=$1',[caso.atencion_id])).rows[0].estado,'EN_CONSULTA');
    }
    const incompleto={...caso,...datosPsico};delete incompleto.estado_diagnostico;
    assert.equal((await request('/psicologia',{method:'POST',body:incompleto})).status,400);
  });
  await t.test('Normalizar la captura y conservar diagnósticos separados entre sesiones del mismo paciente',async()=>{
    const atencion=await request('/atenciones',{method:'POST',body:{paciente_id:casoMulti.paciente_id,area_servicio:'Psicología'}});
    const atencion_id=atencion.json.atencion.id;await pasarTriaje(atencion_id);
    const r=await request('/psicologia',{method:'POST',body:{atencion_id,paciente_id:casoMulti.paciente_id,...datosPsico,diagnosticos:[{cie10:' f90.0 ',descripcion:' Segunda sesión ',principal:true}]}});
    assert.equal(r.status,201,JSON.stringify(r.json));assert.deepEqual(r.json.consulta.detalle_psicologia.diagnosticos,[{cie10:'F90.0',descripcion:'Segunda sesión',principal:true}]);
    const historial=(await request(`/psicologia/historial/${casoMulti.paciente_id}`)).json;
    assert.equal(historial.length,2);assert.deepEqual(historial.find(n=>n.consulta_id===consultaMulti).diagnosticos,dxPsico);
  });
  await t.test('La base protege principal único, códigos repetidos y coherencia del estado',async()=>{
    for(const lista of [dxPsico.map(d=>({...d,principal:true})),dxPsico.map(d=>({...d,principal:false})),[dxPsico[1],{...dxPsico[1],principal:false}]]){
      await assert.rejects(query('UPDATE consultas_psicologia SET diagnosticos=$1::jsonb WHERE consulta_id=$2',[JSON.stringify(lista),consultaMulti]),{code:'23514'});
    }
    await assert.rejects(query("UPDATE consultas_psicologia SET estado_diagnostico='EN_EVALUACION' WHERE consulta_id=$1",[consultaMulti]),{code:'23514'});
    assert.deepEqual((await query('SELECT diagnosticos FROM consultas_psicologia WHERE consulta_id=$1',[consultaMulti])).rows[0].diagnosticos,dxPsico);
  });
  await t.test('Migración 07 repetible conserva texto antiguo y diagnósticos nuevos',async()=>{
    const caso=await crearAtencion('Psicología'),anterior='F90.0 - Texto íntegro anterior, sin reinterpretación.';
    const r=await request('/psicologia',{method:'POST',body:{...caso,motivo_consulta:'Legado',evaluacion_clinica:anterior,nota_evolucion:'Nota anterior',plan_intervencion:'Plan anterior'}});
    assert.equal(r.status,201,JSON.stringify(r.json));await inicializarMigraciones();await inicializarMigraciones();
    const nota=(await request(`/psicologia/historial/${caso.paciente_id}`)).json[0];
    assert.equal(nota.evaluacion_clinica,anterior);assert.equal(nota.estado_diagnostico,'LEGADO');assert.deepEqual(nota.diagnosticos,[]);
    assert.deepEqual((await query('SELECT diagnosticos FROM consultas_psicologia WHERE consulta_id=$1',[consultaMulti])).rows[0].diagnosticos,dxPsico);
  });
  await t.test('Reportes muestran todos los diagnósticos y cuentan una consulta incluso con interconsulta',async()=>{
    const reportes=require('../src/reportes/psicologia');
    const fecha=(await query('SELECT CURRENT_DATE::text AS fecha')).rows[0].fecha;
    const [anio,mes]=fecha.split('-').map(Number),antes=await reportes.obtenerDatosMensuales(dbMock,anio,mes);
    const caso=await crearAtencion('Psicología');await query("UPDATE pacientes SET nombres='MULTIDIAGNOSTICO' WHERE id=$1",[caso.paciente_id]);
    const r=await request('/psicologia',{method:'POST',body:{...caso,...datosPsico,diagnosticos:[{cie10:'F41.1',descripcion:'Ansiedad <prueba>',principal:true},{cie10:'F32.1',descripcion:'Diagnóstico secundario',principal:false}],derivar_a:{area_destino:'MEDICINA_GENERAL',motivo_derivacion:'Prueba'}}});
    assert.equal(r.status,201,JSON.stringify(r.json));
    assert.equal((await request(servicios[0].ruta,{method:'POST',body:{...caso,...servicios[0].datos,tratamiento_cruzado_id:r.json.derivacion_generada.id}})).status,201);
    const diario=await reportes.obtenerDatosDiarios(dbMock,fecha),filas=diario.pacientes.filter(p=>p.nombre.includes('MULTIDIAGNOSTICO'));
    assert.equal(filas.length,1);assert.ok(filas[0].diagnostico.includes('Principal: F41.1'));assert.ok(filas[0].diagnostico.includes('Secundario: F32.1'));
    assert.equal((await reportes.obtenerDatosMensuales(dbMock,anio,mes)).total_general_mes,antes.total_general_mes+1);
    for(const html of [reportes.renderizarDiarioHtml(diario),reportes.renderizarDiarioExcel(diario)]){
      assert.ok(html.includes('Ansiedad &lt;prueba&gt;'));assert.ok(!html.includes('Ansiedad <prueba>'));assert.ok(html.includes('Secundario: F32.1'));
    }
    const tablero=await request('/estadisticas/tablero-resumen');assert.equal(tablero.status,200);
    const top=tablero.json.top_diagnosticos_mes.filter(d=>d.area==='PSICOLOGIA');
    assert.ok(top.some(d=>d.cie10==='F32.1'));assert.ok(!top.some(d=>d.cie10==='Z00.0'));
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
