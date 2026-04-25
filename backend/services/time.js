'use strict';

function getMadridParts(d) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).formatToParts(d);
    const p = {};
    for (const part of parts) p[part.type] = part.value;
    let h = p.hour; if (h === '24') h = '00';
    return { yy: p.year, mm: p.month, dd: p.day, H: h, M: p.minute, S: p.second };
}

function now(d = new Date()) {
    const p = getMadridParts(d);
    const dateStr = `${p.yy}-${p.mm}-${p.dd}`;
    const timeStr = `${p.H}:${p.M}:${p.S}`;
    const localD = new Date(dateStr + 'T' + timeStr + 'Z');
    let offsetMins = Math.round((localD - d) / 60000);
    const sign = offsetMins >= 0 ? '+' : '-';
    offsetMins = Math.abs(offsetMins);
    const zH = String(Math.floor(offsetMins / 60)).padStart(2, '0');
    const zM = String(offsetMins % 60).padStart(2, '0');
    return `${dateStr}T${timeStr}${sign}${zH}:${zM}`;
}

function today(d = new Date()) {
    const p = getMadridParts(d);
    return `${p.yy}-${p.mm}-${p.dd}`;
}

function hhmm(d = new Date()) {
    const p = getMadridParts(new Date(d));
    return `${p.H}:${p.M}`;
}

module.exports = {
    now,
    today,
    hhmm,
    getMadridParts
};
