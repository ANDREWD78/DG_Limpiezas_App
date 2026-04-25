'use strict';
const sheets = require('../services/sheets');
const tg = require('../services/telegram');

module.exports = async function dailyReminder() {
    const incidencias = await sheets.readSheetAsObjects('IncidenciasMantenimiento');
    const abiertas = incidencias.filter(i => ['Abierta', 'En curso'].includes(i.estado));
    if (!abiertas.length) {
        await tg.sendMessage('✅ *Recordatorio diario* — Sin incidencias abiertas 🎉');
        return;
    }
    await tg.recordatorioDiario(abiertas);
};
