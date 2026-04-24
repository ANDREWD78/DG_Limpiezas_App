'use strict';
const sheets = require('../../services/sheets');
require('dotenv').config({ path: __dirname + '/../../.env' });

const SNAPSHOT_COLS = [
    'reserva_id', 'external_id', 'casa', 'estado_reserva', 'fecha_entrada',
    'fecha_salida', 'hora_entrada', 'hora_salida', 'huespedes', 'viajero_nombre',
    'email', 'telefono', 'accommodation_id', 'unit_id', 'canal', 'origen',
    'updated_ts', 'importe_total', 'comision_partner', 'comision_avaibook', 'comision_total', 'importe_neto'
];

async function fixHeaders() {
    console.log('--- REPARANDO CABECERAS EN ReservasAvaibook ---');
    try {
        const gSheets = sheets.getSheets();
        await gSheets.spreadsheets.values.update({
            spreadsheetId: sheets.SHEET_ID(),
            range: 'ReservasAvaibook!1:1',
            valueInputOption: 'RAW',
            requestBody: { values: [SNAPSHOT_COLS] },
        });
        console.log('✅ Cabeceras corregidas.');
    } catch (e) {
        console.error('❌ Error fixing headers:', e);
    }
}

fixHeaders();
