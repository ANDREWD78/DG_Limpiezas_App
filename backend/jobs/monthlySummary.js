'use strict';
const sheets = require('../services/sheets');
const tg = require('../services/telegram');

module.exports = async function monthlySummary() {
    const mes = new Date().toISOString().slice(0, 7); // YYYY-MM
    const partes = await sheets.readSheetAsObjects('PartesLimpieza');
    const mesParts = partes.filter(p => p.fecha?.startsWith(mes));

    const resumen = {};
    mesParts.forEach(p => {
        const k = p.user_id || p.usuario_nombre;
        if (!resumen[k]) resumen[k] = { nombre: p.usuario_nombre, minutos: 0, coste: 0 };
        resumen[k].minutos += parseInt(p.duracion_min || 0);
        resumen[k].coste += parseFloat(p.coste_estimado_eur || 0);
    });

    const empleadas = Object.values(resumen).map(r => ({
        ...r,
        horas: (r.minutos / 60).toFixed(1),
        coste: r.coste.toFixed(2),
    }));

    await tg.resumenMensual({ mes, empleadas });
};
