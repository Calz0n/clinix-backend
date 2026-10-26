// src/services/emailService.js
// Servicio oficial de envío de correos mediante Nodemailer
// Compatible con Gmail SMTP (Google App Password de 16 caracteres) y cualquier servidor SMTP corporativo/municipal
// Dirección de Salud Pública Municipal de Coatzacoalcos 2026-2029

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('[EMAIL WARNING] Módulo "nodemailer" no encontrado en el entorno local. Se instalará automáticamente al compilar el contenedor o ejecutar "npm install".');
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Obtiene o crea el transportador de correo según las variables de entorno
 */
let cachedTransporter = null;
let cachedCreds = '';

function getTransporter() {
  if (!nodemailer) {
    return null;
  }

  const user = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.MAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.MAIL_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? '465' : '587'), 10);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : (port === 465);

  if (!user || !pass) {
    return null;
  }

  const credsKey = `${host}:${port}:${user}:${pass}`;
  if (cachedTransporter && cachedCreds === credsKey) {
    return cachedTransporter;
  }

  cachedCreds = credsKey;
  cachedTransporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.SMTP_IGNORE_TLS === 'true' ? false : true
    }
  });
  return cachedTransporter;
}

/**
 * Plantilla HTML Oficial para Invitación y Activación de Cuenta Médica
 * Colores: Vino (#701128 / #6B1D36), Dorado (#B38E5D / #B07D3E), Fondo (#FBF8F5)
 */
function generarPlantillaActivacion({ nombre, email, especialidad, clinica, enlaceActivacion }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Activación de Cuenta - Clinix Coatzacoalcos</title>
    <style>
      body { margin: 0; padding: 0; background-color: #FBF8F5; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; }
      .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
      .header { background: #701128; padding: 28px 24px; text-align: center; border-bottom: 3px solid #b38e5d; }
      .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px; }
      .header p { color: #f1f5f9; margin: 6px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
      .content { padding: 32px 28px; }
      .saludo { font-size: 16px; font-weight: bold; color: #701128; margin-bottom: 12px; }
      .parrafo { font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px; }
      .card-info { background: #f8fafc; border-left: 4px solid #b38e5d; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
      .card-info table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .card-info td { padding: 4px 0; color: #475569; }
      .card-info td strong { color: #0f172a; }
      .btn-container { text-align: center; margin: 30px 0; }
      .btn-activar { background-color: #701128; color: #ffffff !important; text-decoration: none; padding: 14px 32px; font-size: 14px; font-weight: bold; border-radius: 6px; display: inline-block; box-shadow: 0 2px 6px rgba(112, 17, 40, 0.3); }
      .alerta-vigencia { background: #fffbeb; border: 1px solid #fef3c7; color: #92400e; padding: 12px; border-radius: 6px; font-size: 12.5px; text-align: center; margin-bottom: 20px; }
      .enlace-alternativo { font-size: 12px; color: #64748b; word-break: break-all; line-height: 1.4; }
      .footer { background: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>CLINIX • SALUD PÚBLICA MUNICIPAL</h1>
        <p>H. Ayuntamiento de Coatzacoalcos 2026–2029</p>
      </div>
      <div class="content">
        <div class="saludo">Estimado(a) ${nombre}:</div>
        <p class="parrafo">
          Ha sido registrado(a) como profesional de la salud en la plataforma oficial del <strong>Expediente Clínico Digital Municipal (Clinix)</strong>.
        </p>
        <div class="card-info">
          <table>
            <tr><td width="35%"><strong>Especialidad/Rol:</strong></td><td>${especialidad}</td></tr>
            <tr><td><strong>Sede Asignada:</strong></td><td>${clinica}</td></tr>
            <tr><td><strong>Usuario/Correo:</strong></td><td>${email}</td></tr>
          </table>
        </div>
        <p class="parrafo">
          Por disposición de la <strong>NOM-004-SSA3-2012</strong> (Expediente Clínico) y en estricto apego a la <strong>LGPDPPSO</strong>, la Dirección de Salud Pública no asigna contraseñas a los profesionales. Para activar su cuenta y crear su contraseña personal e intransferible, ingrese al siguiente botón:
        </p>
        <div class="btn-container">
          <a href="${enlaceActivacion}" target="_blank" class="btn-activar">Establecer Contraseña y Activar Cuenta</a>
        </div>
        <div class="alerta-vigencia">
          ⏳ <strong>Aviso de Seguridad:</strong> Este enlace tiene una vigencia única de <strong>48 horas</strong> a partir de su emisión.
        </div>
        <p class="enlace-alternativo">
          Si el botón no abre automáticamente, copie y pegue el siguiente enlace en su navegador:<br>
          <a href="${enlaceActivacion}" style="color: #701128;">${enlaceActivacion}</a>
        </p>
      </div>
      <div class="footer">
        Dirección de Salud Pública Municipal &bull; Coatzacoalcos, Veracruz.<br>
        Este correo es confidencial y personal. Si usted no esperaba este mensaje, favor de reportarlo a la administración.
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Plantilla HTML Oficial para Recuperación y Restablecimiento de Contraseña
 */
function generarPlantillaRecuperacion({ nombre, email, enlaceRecuperacion }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperación de Contraseña - Clinix Coatzacoalcos</title>
    <style>
      body { margin: 0; padding: 0; background-color: #FBF8F5; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; }
      .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
      .header { background: #701128; padding: 28px 24px; text-align: center; border-bottom: 3px solid #b38e5d; }
      .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px; }
      .header p { color: #f1f5f9; margin: 6px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
      .content { padding: 32px 28px; }
      .saludo { font-size: 16px; font-weight: bold; color: #701128; margin-bottom: 12px; }
      .parrafo { font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px; }
      .btn-container { text-align: center; margin: 30px 0; }
      .btn-activar { background-color: #701128; color: #ffffff !important; text-decoration: none; padding: 14px 32px; font-size: 14px; font-weight: bold; border-radius: 6px; display: inline-block; box-shadow: 0 2px 6px rgba(112, 17, 40, 0.3); }
      .alerta-vigencia { background: #fffbeb; border: 1px solid #fef3c7; color: #92400e; padding: 12px; border-radius: 6px; font-size: 12.5px; text-align: center; margin-bottom: 20px; }
      .enlace-alternativo { font-size: 12px; color: #64748b; word-break: break-all; line-height: 1.4; }
      .footer { background: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>CLINIX • SALUD PÚBLICA MUNICIPAL</h1>
        <p>H. Ayuntamiento de Coatzacoalcos 2026–2029</p>
      </div>
      <div class="content">
        <div class="saludo">Estimado(a) ${nombre}:</div>
        <p class="parrafo">
          Hemos recibido una solicitud para restablecer la contraseña de acceso a su cuenta en el <strong>Expediente Clínico Digital Municipal (Clinix)</strong> para el usuario <strong>${email}</strong>.
        </p>
        <p class="parrafo">
          Por su seguridad (conforme a la <strong>NOM-004-SSA3-2012</strong> y la <strong>LGPDPPSO</strong>), para generar una nueva contraseña haga clic en el siguiente botón:
        </p>
        <div class="btn-container">
          <a href="${enlaceRecuperacion}" target="_blank" class="btn-activar">Restablecer mi Contraseña</a>
        </div>
        <div class="alerta-vigencia">
          ⏳ <strong>Aviso de Seguridad:</strong> Este enlace tiene una vigencia única de <strong>2 horas</strong>. Si usted no solicitó este cambio, puede ignorar este mensaje; su cuenta continuará protegida con su contraseña actual.
        </div>
        <p class="enlace-alternativo">
          Si el botón no abre automáticamente, copie y pegue el siguiente enlace en su navegador:<br>
          <a href="${enlaceRecuperacion}" style="color: #701128;">${enlaceRecuperacion}</a>
        </p>
      </div>
      <div class="footer">
        Dirección de Salud Pública Municipal &bull; Coatzacoalcos, Veracruz.<br>
        Este correo es confidencial y personal.
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Despacha el correo de invitación mediante Nodemailer
 */
async function enviarCorreoInvitacion({ nombre, email, especialidad, clinica, token, baseUrl }) {
  const urlBase = (baseUrl && !baseUrl.includes('coatzacoalcos.gob.mx'))
    ? baseUrl.replace(/\/+$/, '')
    : (FRONTEND_URL && !FRONTEND_URL.includes('coatzacoalcos.gob.mx') ? FRONTEND_URL.replace(/\/+$/, '') : (baseUrl || FRONTEND_URL).replace(/\/+$/, ''));
  const enlaceActivacion = `${urlBase}/#/activar-cuenta?token=${token}`;
  const transporter = getTransporter();

  const user = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.MAIL_USER;
  const mailFrom = process.env.MAIL_FROM || (user ? `"Clinix Coatzacoalcos" <${user}>` : 'Clinix Coatzacoalcos <no-reply@coatzacoalcos.gob.mx>');

  if (!transporter) {
    console.warn('\n[NODEMAILER] ⚠️ Modo Simulación activo para Invitación (SMTP_USER / SMTP_PASS no detectados en .env).');
    console.log('--------------------------------------------------------------------------');
    console.log(`[SIMULACIÓN CORREO INVITACIÓN]`);
    console.log(` -> Destinatario: ${email} (${nombre})`);
    console.log(` -> Rol/Sede:     ${especialidad} | ${clinica}`);
    console.log(` -> URL Activación: ${enlaceActivacion}`);
    console.log('--------------------------------------------------------------------------\n');
    return {
      id: 'simulado_sin_credenciales_smtp',
      url: enlaceActivacion,
      simulado: true
    };
  }

  const html = generarPlantillaActivacion({
    nombre,
    email,
    especialidad,
    clinica,
    enlaceActivacion
  });

  const textoPlano = `
Estimado(a) ${nombre}:
Ha sido registrado(a) como profesional de la salud en la plataforma oficial del Expediente Clínico Digital Municipal (Clinix).

Especialidad/Rol: ${especialidad}
Sede Asignada: ${clinica}
Usuario/Correo: ${email}

Por disposición de la NOM-004-SSA3-2012 y la LGPDPPSO, por favor active su cuenta y establezca su contraseña ingresando al siguiente enlace (vigencia de 48 horas):
${enlaceActivacion}

Dirección de Salud Pública Municipal • H. Ayuntamiento de Coatzacoalcos 2026-2029
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: mailFrom,
      to: email,
      subject: 'Invitación y Activación de Cuenta • Clinix Coatzacoalcos',
      text: textoPlano,
      html: html
    });

    console.log(`[NODEMAILER] Correo de activación despachado con éxito a ${email}. ID: ${info.messageId}`);
    return {
      id: info.messageId,
      url: enlaceActivacion,
      simulado: false
    };
  } catch (error) {
    console.error('[NODEMAILER ERROR] Fallo al enviar correo de invitación:', error.message);
    throw new Error('Fallo al despachar correo vía Nodemailer (SMTP): ' + error.message);
  }
}

/**
 * Despacha el correo de recuperación/restablecimiento de contraseña mediante Nodemailer
 */
async function enviarCorreoRecuperacion({ nombre, email, token, baseUrl }) {
  const urlBase = (baseUrl && !baseUrl.includes('coatzacoalcos.gob.mx'))
    ? baseUrl.replace(/\/+$/, '')
    : (FRONTEND_URL && !FRONTEND_URL.includes('coatzacoalcos.gob.mx') ? FRONTEND_URL.replace(/\/+$/, '') : (baseUrl || FRONTEND_URL).replace(/\/+$/, ''));
  const enlaceRecuperacion = `${urlBase}/#/activar-cuenta?token=${token}`;
  const transporter = getTransporter();

  const user = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.MAIL_USER;
  const mailFrom = process.env.MAIL_FROM || (user ? `"Clinix Coatzacoalcos" <${user}>` : 'Clinix Coatzacoalcos <no-reply@coatzacoalcos.gob.mx>');

  if (!transporter) {
    console.warn('\n[NODEMAILER] ⚠️ Modo Simulación activo para Recuperación de Contraseña.');
    console.log('--------------------------------------------------------------------------');
    console.log(`[SIMULACIÓN CORREO RECUPERACIÓN]`);
    console.log(` -> Destinatario: ${email} (${nombre})`);
    console.log(` -> URL Recuperación: ${enlaceRecuperacion}`);
    console.log('--------------------------------------------------------------------------\n');
    return {
      id: 'simulado_sin_credenciales_smtp',
      url: enlaceRecuperacion,
      simulado: true
    };
  }

  const html = generarPlantillaRecuperacion({
    nombre,
    email,
    enlaceRecuperacion
  });

  const textoPlano = `
Estimado(a) ${nombre}:
Hemos recibido una solicitud para restablecer la contraseña de su cuenta en Clinix (${email}).

Para definir su nueva contraseña, ingrese al siguiente enlace (vigencia de 2 horas):
${enlaceRecuperacion}

Si usted no solicitó este cambio, puede ignorar este mensaje.
Dirección de Salud Pública Municipal • H. Ayuntamiento de Coatzacoalcos 2026-2029
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: mailFrom,
      to: email,
      subject: 'Recuperación de Contraseña • Clinix Coatzacoalcos',
      text: textoPlano,
      html: html
    });

    console.log(`[NODEMAILER] Correo de recuperación despachado con éxito a ${email}. ID: ${info.messageId}`);
    return {
      id: info.messageId,
      url: enlaceRecuperacion,
      simulado: false
    };
  } catch (error) {
    console.error('[NODEMAILER ERROR] Fallo al enviar correo de recuperación:', error.message);
    throw new Error('Fallo al despachar correo de recuperación vía Nodemailer (SMTP): ' + error.message);
  }
}

module.exports = {
  enviarCorreoInvitacion,
  enviarCorreoRecuperacion,
  generarPlantillaActivacion,
  generarPlantillaRecuperacion
};
