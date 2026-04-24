const sheets = require('./services/sheets');
require('dotenv').config({ path: __dirname + '/.env' });

const ids = [
    'C655D5566C', '3FD30B6121', '1981AB4ED4', '8957C2670F', '2F51F2F879',
    'EACE16A9A4', 'BBE30CDAD4', '9312510F76', '8A859F82C3', 'C1AC83F6EB',
    '1CF140A7CC', 'FC72E218FE', 'B4541D4583', 'D52B5041C8', '42C28F148E',
    '3C1392B053', 'B8CDA68D29', '4CA6BFCC43', 'D889B2D3E0', '5DE8735E5A',
    '4DAD69C0F4', 'DE8F1EDE6E', '73D7F2AB2B', 'A1A8D418CA', '40DD6D0D9D',
    '279D5D9F4C', 'C7E1A5B5A4', 'D31BA0A16A', '2D7D886A56', '98C6E6450D',
    'EFA6DB4ACD', '9257A2301E', 'E965F93A39', '8D9B322D07', '34B2A0A390',
    '408085F1BE', '0436F7A326', 'FD5E9D7621', 'E1DE4FD444'
];

async function insertForcedIds() {
    try {
        console.log("Creando pestaña ReservasForzadasID si no existe...");
        const gSheets = sheets.getSheets();
        try {
            await gSheets.spreadsheets.batchUpdate({
                spreadsheetId: sheets.SHEET_ID(),
                resource: { requests: [{ addSheet: { properties: { title: 'ReservasForzadasID' } } }] }
            });
            console.log("Pestaña creada por primera vez.");
        } catch (e) {
            // Seguramente 400 ya existe, lo ignoramos
        }

        console.log("Creando cabecera...");
        await sheets.ensureSheetHeaders('ReservasForzadasID', ['reserva_id']);
        
        console.log("Limpiando hoja...");
        await sheets.clearDataRange('ReservasForzadasID', 2);
        
        console.log("Insertando los 39 IDs...");
        for (const id of ids) {
            await sheets.appendRow('ReservasForzadasID', [id]);
        }
        console.log("OK!");
    } catch (e) {
        console.error("Error insertando IDs:", e);
    }
}

insertForcedIds();
