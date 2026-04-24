'use strict';
const sheets = require('../../services/sheets');
require('dotenv').config({ path: __dirname + '/../../.env' });

async function clearSheet() {
    console.log('--- VACIANDO ReservasAvaibook TOTALMENTE ---');
    try {
        const gSheets = sheets.getSheets();
        await gSheets.spreadsheets.values.clear({
            spreadsheetId: sheets.SHEET_ID(),
            range: 'ReservasAvaibook!A1:ZZZ',
        });
        console.log('✅ Hoja vaciada.');
    } catch (e) {
        console.error('❌ Error clearing sheet:', e);
    }
}

clearSheet();
