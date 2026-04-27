'use strict';

// ─── Scheduler de cron jobs ───────────────────────────────────────────────────
// NOTA: todos los require() son lazy (dentro de start()) para evitar que
// node-cron bloquee el arranque del servidor al ser cargado a nivel de módulo.

function start() {
    if (process.env.NODE_ENV !== 'production') {
        console.log('[Scheduler] Cron jobs DESACTIVADOS en desarrollo (NODE_ENV != production)');
        return;
    }
    try {
        const cron = require('node-cron');
        const dailyReminder = require('./dailyReminder');
        const weeklySummary = require('./weeklySummary');
        const monthlySummary = require('./monthlySummary');

        // Recordatorio diario a las 08:00 (Madrid = UTC+1/+2)
        cron.schedule('0 7 * * *', () => {
            console.log('[Cron] Recordatorio diario...');
            dailyReminder().catch(console.error);
        }, { timezone: 'Europe/Madrid' });

        // Resumen semanal: jueves a las 21:00
        cron.schedule('0 21 * * 4', () => {
            console.log('[Cron] Resumen semanal (jueves)...');
            weeklySummary().catch(console.error);
        }, { timezone: 'Europe/Madrid' });

        // Resumen mensual: último día del mes a las 21:00
        cron.schedule('0 21 * * *', () => {
            const hoy = new Date();
            const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
            if (hoy.getDate() === ultimo) {
                console.log('[Cron] Resumen mensual (último día mes)...');
                monthlySummary().catch(console.error);
            }
        }, { timezone: 'Europe/Madrid' });

        // Archivado histórico mensual: Día 1 de cada mes a las 03:00 MADRID
        const archivarHistorico = require('./archivarHistorico');
        cron.schedule('0 3 1 * *', () => {
            console.log('[Cron] Iniciando Archivado Histórico Mensual...');
            archivarHistorico().catch(console.error);
        }, { timezone: 'Europe/Madrid' });

        console.log('   ⏰ Cron jobs activos: diario, semanal (jue), mensual, archivado (día 1)');
    } catch (err) {
        console.error('[Scheduler] Error al iniciar cron jobs (no bloquea el servidor):', err.message);
    }
}

module.exports = { start };
