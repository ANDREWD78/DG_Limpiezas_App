'use strict';
const syncAvaibook = require('../../jobs/syncAvaibook');
require('dotenv').config({ path: __dirname + '/../../.env' });

async function run() {
    console.log('--- INICIANDO SYNC REAL DE AVAIBOOK ---');
    try {
        const result = await syncAvaibook();
        console.log('Resultado:', JSON.stringify(result, null, 2));
        if (result.ok) {
            console.log('✅ Sincronización completada con éxito.');
        } else {
            console.log('❌ Error en la sincronización:', result.reason || result.stats?.error);
        }
    } catch (e) {
        console.error('❌ Error fatal:', e);
    }
}

run();
