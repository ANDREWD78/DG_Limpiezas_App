'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const archivarHistorico = require('../jobs/archivarHistorico');

async function main() {
    console.log('======================================================');
    console.log('🚀 EJECUTANDO ARCHIVADO HISTÓRICO MASIVO MANUAMENTE');
    console.log('======================================================\n');
    
    try {
        await archivarHistorico();
        console.log('\n✅ Proceso completado exitosamente.');
    } catch (err) {
        console.error('\n❌ Proceso abortado por error:', err);
    } finally {
        process.exit();
    }
}

main();
