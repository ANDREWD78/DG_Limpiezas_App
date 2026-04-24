require('dotenv').config({ path: __dirname + '/.env' });
const syncAvaibook = require('./jobs/syncAvaibook');

async function testSync() {
    console.log("Testeando sincronización de Avaibook con tabla forzada...");
    const result = await syncAvaibook();
    console.log("Resultado de sincronización:", result);
}

testSync();
