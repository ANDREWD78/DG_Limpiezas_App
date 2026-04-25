'use strict';
const nodemailer = require('nodemailer');

function getTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

/**
 * Envía un email genérico
 */
async function sendEmail({ subject, html, text }) {
    if (!process.env.SMTP_USER || process.env.SMTP_USER.includes('TU_CUENTA')) {
        console.warn('[Email] SMTP no configurado, email omitido.');
        return;
    }
    const transporter = getTransporter();
    return transporter.sendMail({
        from: process.env.EMAIL_FROM || 'DG Limpiezas <noreply@destinoguara.com>',
        to: process.env.EMAIL_TO || 'info@destinoguara.com',
        subject,
        text,
        html,
    });
}

/**
 * Email de incidencia
 */
async function emailIncidencia({ piso, descripcion, limpiador, fotoUrl }) {
    const fecha = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
    return sendEmail({
        subject: `🔴 Incidencia en ${piso} — ${fecha}`,
        html: `
      <h2 style="color:#dc2626;">Incidencia reportada</h2>
      <table style="font-family:sans-serif;font-size:14px;">
        <tr><td><b>Alojamiento:</b></td><td>${piso}</td></tr>
        <tr><td><b>Reportada por:</b></td><td>${limpiador}</td></tr>
        <tr><td><b>Descripción:</b></td><td>${descripcion}</td></tr>
        <tr><td><b>Fecha:</b></td><td>${fecha}</td></tr>
        ${fotoUrl ? `<tr><td><b>Foto:</b></td><td><a href="${fotoUrl}">Ver foto</a></td></tr>` : ''}
      </table>
    `,
        text: `Incidencia en ${piso} — ${descripcion} — Reportada por ${limpiador} el ${fecha}`,
    });
}

/**
 * Email resumen limpieza (solo si hay incidencia o comentario)
 */
async function emailResumenLimpieza({ piso, tipo, limpiador, tiempoMinutos, tiempoObjetivo, notas }) {
    const fecha = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
    const sobreTiempo = tiempoMinutos > tiempoObjetivo;
    if (!sobreTiempo && !notas) return; // solo enviar si hay algo destacable

    return sendEmail({
        subject: `${sobreTiempo ? '⚠️' : '✅'} Limpieza ${piso} — ${fecha}`,
        html: `
      <h2>Resumen de limpieza</h2>
      <table style="font-family:sans-serif;font-size:14px;">
        <tr><td><b>Alojamiento:</b></td><td>${piso}</td></tr>
        <tr><td><b>Tipo:</b></td><td>${tipo}</td></tr>
        <tr><td><b>Limpiador/a:</b></td><td>${limpiador}</td></tr>
        <tr><td><b>Tiempo:</b></td><td>${tiempoMinutos} min (objetivo: ${tiempoObjetivo} min)</td></tr>
        ${notas ? `<tr><td><b>Notas:</b></td><td>${notas}</td></tr>` : ''}
      </table>
    `,
        text: `Limpieza ${piso} (${tipo}) por ${limpiador}: ${tiempoMinutos}/${tiempoObjetivo} min${notas ? '. Notas: ' + notas : ''}`,
    });
}

module.exports = { sendEmail, emailIncidencia, emailResumenLimpieza };
