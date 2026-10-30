const { randomUUID } = require('node:crypto');

const CAMPOS = {
  area_servicio: 'área / servicio', tipo_atencion: 'tipo de consulta',
  estado_civil: 'estado civil', escolaridad: 'escolaridad',
  derechohabiencia: 'derechohabiencia', grupo_sanguineo: 'grupo sanguíneo',
  fecha_nacimiento: 'fecha de nacimiento', curp: 'CURP', telefono: 'teléfono',
  telefono_contacto: 'teléfono del tutor', parentesco: 'parentesco del tutor',
  tipo_identificacion: 'identificación del tutor', ocupacion: 'ocupación',
  tipo_poblacion: 'tipo de población', nombres: 'nombres',
  apellido_paterno: 'apellido paterno', apellido_materno: 'apellido materno',
  calle_numero: 'dirección', colonia: 'colonia', sexo: 'sexo',
  numero_expediente: 'número de expediente', numero_afiliacion: 'número de afiliación',
};

// Nunca devuelve err.detail ni filas/valores de PostgreSQL al navegador o al log.
function responderErrorPaciente(res, err, operacion, campos = []) {
  const referencia = randomUUID();
  const campo = Object.keys(CAMPOS).sort((a, b) => b.length - a.length).find(c =>
    err.column === c || (err.constraint || '').includes(`_${c}_`));
  const dato = campo ? `El campo ${CAMPOS[campo]}` : 'Uno de los datos';
  let status = 500;
  let codigo = 'PACIENTE_GUARDADO_FALLIDO';
  let error = 'El servidor no pudo guardar el expediente. Comparte la referencia del error con soporte.';
  switch (err.code) {
    case '23505':
      status = 409; codigo = 'PACIENTE_DUPLICADO';
      error = err.constraint === 'pacientes_curp_key'
        ? 'La CURP ingresada ya existe en el sistema.'
        : err.constraint === 'pacientes_numero_expediente_key'
          ? 'El número de expediente ya está en uso.'
          : 'Un registro con estos datos ya existe en el sistema.';
      break;
    case '22001':
      status = 400; codigo = 'PACIENTE_LONGITUD';
      error = `${dato} excede el tamaño permitido en la base de datos. Verifica los campos y aplica la migración 06 del backend actualizado.`;
      break;
    case '23514':
      status = 400; codigo = 'PACIENTE_RESTRICCION';
      error = `${dato} no cumple una regla de la base de datos. Revisa su valor; si es correcto, soporte debe revisar la restricción indicada en el registro del servidor.`;
      break;
    case '23502':
      status = 400; codigo = 'PACIENTE_OBLIGATORIO';
      error = `${dato} es obligatorio en la base de datos. Completa el campo antes de guardar.`;
      break;
    case '23503':
      status = 409; codigo = 'PACIENTE_RELACION';
      error = 'Un registro relacionado ya no está disponible. Actualiza la lista y vuelve a abrir el expediente.';
      break;
    case '22P02': case '22007': case '22008': case '22003':
      status = 400; codigo = 'PACIENTE_FORMATO';
      error = `${dato} tiene un formato que la base de datos no admite. Revisa los datos o comparte la referencia con soporte.`;
      break;
    case '42P01': case '42703':
      status = 503; codigo = 'PACIENTE_ESQUEMA';
      error = 'La base de datos no tiene el esquema esperado por este backend. El administrador debe revisar y aplicar las migraciones.';
      break;
    default:
      if (String(err.code || '').startsWith('08') || ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '57P01', '57P03', '53300'].includes(err.code)) {
        status = 503; codigo = 'PACIENTE_BD_NO_DISPONIBLE';
        error = 'PostgreSQL no está disponible en este momento. Intenta guardar cuando se restablezca el servicio.';
      }
  }
  console.error(`[PACIENTE ${operacion}]`, JSON.stringify({
    referencia, sqlstate: err.code || null, tabla: err.table || null,
    columna: err.column || null, restriccion: err.constraint || null,
    campos: campos.filter(c => Object.prototype.hasOwnProperty.call(CAMPOS, c) || c === 'tutor'),
  }));
  return res.status(status).json({ error, codigo, referencia, ...(campo ? { campo } : {}) });
}

module.exports = { responderErrorPaciente };
