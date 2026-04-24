const sheets = require('../services/sheets');
const { now } = require('../services/time');

function segEntre(ts1, ts2) {
    if (!ts1 || !ts2) return 0;
    const diff = new Date(ts2) - new Date(ts1);
    return Math.max(0, Math.round(diff / 1000));
}

function getTiempoAcumuladoSeg(fila) {
    const raw = parseFloat(fila.tiempo_acumulado_seg);
    return isNaN(raw) ? 0 : raw;
}

function getTiempoLegacySeg(fila) {
    if (!fila.inicio_ts) return 0;
    const fin = fila.fin_ts || now();
    let totalSeg = segEntre(fila.inicio_ts, fin);
    let pausas = [];
    try { pausas = JSON.parse(fila.pausas_json || '[]'); } catch { }
    for (const p of pausas) {
        const pFin = p.fin || fin;
        totalSeg -= segEntre(p.inicio, pFin);
    }
    return Math.max(0, totalSeg);
}

function getTiempoActualSeg(fila) {
    const status = fila.status || 'ABIERTO';
    const acumulado = getTiempoAcumuladoSeg(fila);
    const tieneNueFields = fila.tiempo_acumulado_seg !== '' && fila.tiempo_acumulado_seg != null;

    if (!tieneNueFields) return getTiempoLegacySeg(fila);

    if (status === 'ABIERTO' && fila.ultimo_reanudar_ts) {
        return acumulado + segEntre(fila.ultimo_reanudar_ts, now());
    }
    return acumulado;
}

async function debugTiempos() {
    console.log('--- DEBUG DE TIEMPOS ---');
    console.log('now() evaluado:', now());
    const all = await sheets.readSheetAsObjects('PartesLimpieza');
    const abiertos = all.filter(r => (!r.fin_ts && r.inicio_ts) || r.status === 'ABIERTO' || r.status === 'PAUSADO');
    console.log(`Encontrados ${abiertos.length} partes abiertos\\n`);
    
    for (const p of abiertos) {
        console.log(`---------`);
        console.log(`ID: ${p.id}  Casa: ${p.casa}`);
        console.log(`Usuario: ${p.usuario_nombre}`);
        console.log(`Status: ${p.status}`);
        console.log(`inicio_ts: ${p.inicio_ts}`);
        console.log(`ultimo_reanudar_ts: ${p.ultimo_reanudar_ts}`);
        console.log(`tiempo_acumulado_seg (raw Sheets): "${p.tiempo_acumulado_seg}"`);
        console.log(`pausas_json: ${p.pausas_json}`);
        const tieneNueFields = p.tiempo_acumulado_seg !== '' && p.tiempo_acumulado_seg != null;
        console.log(`Tiene nuevos fields (fase 3): ${tieneNueFields}`);
        const tcAcumulado = getTiempoAcumuladoSeg(p);
        const tcLegacy = getTiempoLegacySeg(p);
        const tcEfectivo = getTiempoActualSeg(p);
        console.log(`Valores procesados -> Acumulado parseado: ${tcAcumulado}`);
        console.log(`Valores procesados -> Efectivo (legacy): ${tcLegacy}`);
        console.log(`Valores procesados -> Efectivo (final getTiempoActualSeg): ${tcEfectivo}`);
        console.log(`JSON final property: { tiempo_efectivo_seg: ${tcEfectivo}, tiempo_acumulado_seg: ${tcAcumulado} }`);
    }
    console.log('------------------------');
}

debugTiempos().catch(console.error);
