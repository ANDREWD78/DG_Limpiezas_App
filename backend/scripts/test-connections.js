'use strict';
/**
 * Script de verificación de conexiones — DG Limpiezas
 * Ejecutar: node scripts/test-connections.js (desde /backend)
 */
require('dotenv').config();
const sheets = require('../services/sheets');

const telegram = require('../services/telegram');
const email = require('../services/email');

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELL = '\x1b[33m';
const RESET = '\x1b[0m';

async function check(name, fn) {
    process.stdout.write(`  Probando ${name}... `);
    try {
        const result = await fn();
        console.log(`${GREEN}✓ OK${RESET}${result ? ' — ' + result : ''}`);
        return true;
    } catch (err) {
        console.log(`${RED}✗ FALLO${RESET}`);
        console.log(`    ${RED}→ ${err.message}${RESET}`);
        return false;
    }
}

async function main() {
    console.log(`\n${BOLD}🧹 DG Limpiezas — Test de conexiones${RESET}\n`);

    // 1. Google Sheets — Leer pestaña Config
    const sheetsOk = await check('Google Sheets (lectura Config)', async () => {
        const rows = await sheets.readSheetAsObjects('Config');
        if (!rows.length) throw new Error('La pestaña Config está vacía o no existe');
        return `${rows.length} filas leídas`;
    });

    // 2. Google Sheets — Pestaña Usuarios
    const usersOk = await check('Google Sheets (pestaña Usuarios)', async () => {
        const rows = await sheets.readSheetAsObjects('Usuarios');
        if (!rows.length) throw new Error('La pestaña Usuarios está vacía o no existe');
        return `${rows.length} usuario(s) encontrados`;
    });

    // 3. Google Sheets — Escribir fila de prueba en PartesLimpieza
    const writeOk = await check('Google Sheets (escritura PartesLimpieza)', async () => {
        const testId = 'TEST-' + Date.now();
        await sheets.appendRow('PartesLimpieza', [
            testId, '', new Date().toISOString().slice(0, 10),
            'TEST', 'test', '', new Date().toISOString(), '', '',
            'test-bot', 'Test Bot', '', '', '', 'Prueba automática test-connections',
            'Ninguno', '', '', '', 'Sí', '', '', '', '', 'test-connections',
        ]);
        return `Fila ${testId} escrita correctamente`;
    });

    // 4. Telegram
    const telegramOk = await check('Telegram (mensaje de prueba)', async () => {
        if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN.includes('TU_BOT')) {
            throw new Error('TELEGRAM_BOT_TOKEN no configurado en .env');
        }
        const ok = await telegram.sendMessage('🔧 *Test de conexión* DG Limpiezas App — Todo OK');
        if (!ok) throw new Error('Respuesta no OK de Telegram');
        return 'Mensaje enviado al grupo';
    });

    // 5. Email (solo si SMTP está configurado)
    const emailOk = await check('Email SMTP (Gmail)', async () => {
        if (!process.env.SMTP_USER || process.env.SMTP_USER.includes('TU_CUENTA')) {
            throw new Error('SMTP_USER no configurado en .env');
        }
        await email.sendEmail({
            subject: '🔧 Test conexión — DG Limpiezas',
            text: 'Prueba de conexión SMTP desde DG Limpiezas App. Si recibes este email, el envío funciona correctamente.',
            html: '<h2>✅ DG Limpiezas — Email OK</h2><p>La conexión SMTP funciona correctamente.</p>',
        });
        return `Email enviado a ${process.env.EMAIL_TO}`;
    });

    // Resumen
    console.log('\n' + '─'.repeat(50));
    const results = [
        ['Google Sheets (lectura)', sheetsOk],
        ['Google Sheets (usuarios)', usersOk],
        ['Google Sheets (escritura)', writeOk],
        ['Telegram', telegramOk],
        ['Email SMTP', emailOk],
    ];

    const passed = results.filter(([, ok]) => ok).length;
    results.forEach(([name, ok]) => {
        const icon = ok ? `${GREEN}✅` : `${RED}❌`;
        console.log(`  ${icon} ${name}${RESET}`);
    });

    console.log('\n' + (passed === results.length
        ? `${GREEN}${BOLD}✅ Todas las conexiones OK (${passed}/${results.length})${RESET}`
        : `${YELL}${BOLD}⚠️  ${passed}/${results.length} conexiones OK — Revisa los fallos arriba${RESET}`
    ) + '\n');

    if (writeOk) {
        console.log(`${YELL}  ℹ️  Recuerda borrar la fila TEST-* de la pestaña PartesLimpieza en Sheets${RESET}\n`);
    }

    process.exit(passed === results.length ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
