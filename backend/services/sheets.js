'use strict';
// NOTA: googleapis instanciado al levantar el servidor de forma síncrona 
// para prevenir que peticiones HTTP entrantes congelen el event loop
// durante su larga carga inicial (causa de los Empty Reply from server).
const path = require('path');
const { google } = require('googleapis');

let _auth = null;

function getAuth() {
    if (_auth) return _auth;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        _auth = new google.auth.GoogleAuth({
            credentials,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file',
            ],
        });
    } else {
        const keyFile = path.resolve(__dirname, '..', '..', 'credentials', 'service-account.json');
        _auth = new google.auth.GoogleAuth({
            keyFile,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file',
            ],
        });
    }
    return _auth;
}

function getSheets() {
    return google.sheets({ version: 'v4', auth: getAuth() });
}

const SHEET_ID = () => process.env.SHEET_ID;
const DEFAULT_FULL_RANGE = 'A:ZZZ';

// ─── Leer rango ───────────────────────────────────────────────────────────────
async function readRange(tab, range = DEFAULT_FULL_RANGE) {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID(),
        range: `${tab}!${range}`,
    });
    return res.data.values || [];
}

// ─── Leer pestaña como array de objetos ───────────────────────────────────────
async function readSheetAsObjects(tab) {
    const rows = await readRange(tab);
    if (rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map((row, i) => {
        const obj = { _row: i + 2 };
        headers.forEach((h, j) => { obj[h] = row[j] ?? ''; });
        return obj;
    });
}

// ─── Añadir fila ──────────────────────────────────────────────────────────────
async function appendRow(tab, values) {
    const sheets = getSheets();
    return sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID(),
        range: `${tab}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [values] },
    });
}

// ─── Añadir filas en lote (batch) ─────────────────────────────────────────────
async function appendRows(tab, rows) {
    if (!rows || rows.length === 0) return;
    const sheets = getSheets();
    return sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID(),
        range: `${tab}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: rows },
    });
}

// ─── Añadir fila como objeto (respeta/añade cabeceras) ───────────────────────
async function appendRowAsObject(tab, obj) {
    const sheets = getSheets();
    
    // 1. Leer cabeceras actuales
    let existing = [];
    try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID(), range: `${tab}!1:1` });
        existing = res.data.values ? res.data.values[0] : [];
    } catch {}

    // 2. Identificar nuevas cabeceras
    const keys = Object.keys(obj);
    const missing = keys.filter(k => !existing.includes(k));

    // 3. Añadir cabeceras si faltan
    if (existing.length === 0) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID(), range: `${tab}!A1`,
            valueInputOption: 'RAW', requestBody: { values: [keys] }
        });
        existing = keys;
    } else if (missing.length > 0) {
        const startCol = colLetter(existing.length + 1);
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID(), range: `${tab}!${startCol}1`,
            valueInputOption: 'RAW', requestBody: { values: [missing] }
        });
        existing = [...existing, ...missing];
    }

    // 4. Mapear objeto a array en el orden exacto de las cabeceras
    const rowValues = existing.map(h => obj[h] ?? '');
    return sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID(),
        range: `${tab}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowValues] },
    });
}

// ─── Actualizar fila por número ───────────────────────────────────────────────
async function updateRow(tab, rowNumber, values) {
    const sheets = getSheets();
    return sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID(),
        range: `${tab}!A${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [values] },
    });
}

// ─── Actualizar una sola celda ────────────────────────────────────────────────
async function updateCell(tab, rowNumber, col, value) {
    const sheets = getSheets();
    return sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID(),
        range: `${tab}!${col}${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[value]] },
    });
}

// ─── Buscar fila por campo ────────────────────────────────────────────────────
async function findRow(tab, field, value) {
    const rows = await readSheetAsObjects(tab);
    return rows.find(r => r[field] === String(value)) || null;
}

// ─── Actualizar fila basada en objeto (Alineación con cabeceras) ──────────────
async function updateRowAsObject(tab, rowNumber, rowData) {
    const gSheets = getSheets();
    
    // 1. Leer cabeceras actuales (Fila 1)
    const headerRes = await gSheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID(),
        range: `${tab}!1:1`,
    });
    
    let headers = headerRes.data.values ? headerRes.data.values[0] : [];
    
    // 2. Si faltan cabeceras en la hoja que vienen en obj, las añadimos al final
    let headersUpdated = false;
    for (const key of Object.keys(rowData)) {
        if (!headers.includes(key) && key !== '_row') {
            headers.push(key);
            headersUpdated = true;
        }
    }
    
    // 3. Escribir nuevas cabeceras si hubo cambios
    if (headersUpdated) {
        await gSheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID(),
            range: `${tab}!1:1`,
            valueInputOption: 'RAW',
            requestBody: { values: [headers] },
        });
    }

    // 4. Mapear el objeto al orden de cabeceras estricto
    const orderedValues = headers.map(header => {
        const val = rowData[header];
        return val == null ? '' : String(val);
    });

    // 5. Actualizar la fila en Sheets
    return await gSheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID(),
        range: `${tab}!A${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [orderedValues] },
    });
}

// ─── Leer config como objeto clave/valor ─────────────────────────────────────
async function readConfig() {
    const rows = await readSheetAsObjects('Config');
    const cfg = {};
    rows.forEach(r => { if (r.key) cfg[r.key] = r.value; });
    return cfg;
}

// ─── Garantizar que una hoja tiene cabeceras (idempotente) ─────────────────────
async function ensureSheetHeaders(tab, requiredHeaders) {
    const gSheets = getSheets();
    let existingRows = [];
    try {
        const res = await gSheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID(),
            range: `${tab}!1:1`,
        });
        existingRows = res.data.values || [];
    } catch {
        // La hoja podría no existir aún
    }

    const existing = existingRows[0] || [];
    if (requiredHeaders.every((h, i) => existing[i] === h)) return;

    const missing = requiredHeaders.filter(h => !existing.includes(h));

    if (existing.length === 0) {
        await gSheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID(),
            range: `${tab}!A1`,
            valueInputOption: 'RAW',
            requestBody: { values: [requiredHeaders] },
        });
    } else if (missing.length > 0) {
        const startCol = colLetter(existing.length + 1);
        await gSheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID(),
            range: `${tab}!${startCol}1`,
            valueInputOption: 'RAW',
            requestBody: { values: [missing] },
        });
    }
}

function colLetter(n) {
    let s = '';
    while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); }
    return s;
}

// ─── Vaciar rango de datos (ej. omitiendo cabecera) ───────────────────────────
async function clearDataRange(tab, fromRowNumber = 2) {
    const gSheets = getSheets();
    return gSheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID(),
        range: `${tab}!A${fromRowNumber}:ZZZ`,
    });
}

// ─── Sobreescribir hoja manteniendo cabeceras (Update atómico + Clear restos) ──
async function overwriteSheetData(tab, newRows) {
    const gSheets = getSheets();
    
    // Si resultaron 0 filas válidas, limpiamos legítimamente el cuerpo bajo cabeceras.
    if (!newRows || newRows.length === 0) {
        return await clearDataRange(tab, 2);
    }
    
    // 1. Sobreescribimos con update desde la fila 2. 
    // Esto pisa el contenido viejo sin borrar primero (atómico y sin hueco vacío)
    await gSheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID(),
        range: `${tab}!A2`,
        valueInputOption: 'RAW',
        requestBody: { values: newRows },
    });
    
    // 2. Limpiamos solo el tramo final de basura sobrante si la vieja tabla era más larga
    const nextEmptyRow = newRows.length + 2;
    await gSheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID(),
        range: `${tab}!A${nextEmptyRow}:ZZZ`,
    });
}

module.exports = { readRange, readSheetAsObjects, appendRow, appendRows, appendRowAsObject, updateRow, updateRowAsObject, updateCell, findRow, readConfig, ensureSheetHeaders, clearDataRange, overwriteSheetData, getSheets, SHEET_ID };
