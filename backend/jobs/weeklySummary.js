'use strict';
const sheets = require('../services/sheets');
const tg = require('../services/telegram');

module.exports = async function weeklySummary() {
    const [incidencias, consumibles] = await Promise.all([
        sheets.readSheetAsObjects('IncidenciasMantenimiento'),
        sheets.readSheetAsObjects('Consumibles'),
    ]);
    await tg.resumenSemanal({ incidencias, consumibles });
};
