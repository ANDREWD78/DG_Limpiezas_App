'use strict';
const sheets = require('../../services/sheets');
require('dotenv').config({ path: __dirname + '/../../.env' });

async function checkHeaders() {
    try {
        const rows = await sheets.readRange('ReservasAvaibook', '1:1');
        console.log('--- HEADERS ACTUALES ---');
        console.log(JSON.stringify(rows[0]));
        console.log('Número de columnas:', rows[0].length);
    } catch (e) {
        console.error('Error:', e);
    }
}

checkHeaders();
