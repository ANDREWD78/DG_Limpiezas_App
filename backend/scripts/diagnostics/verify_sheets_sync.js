'use strict';
const sheets = require('../../services/sheets');
require('dotenv').config({ path: __dirname + '/../../.env' });

async function checkSheet() {
    console.log('--- VERIFICANDO CONTENIDO DE ReservasAvaibook ---');
    try {
        const rows = await sheets.readSheetAsObjects('ReservasAvaibook');
        console.log(`Leídas ${rows.length} filas.`);
        
        const manualBlocks = rows.filter(r => r.origen === 'MANUAL_BLOCK');
        console.log(`Bloqueos manuales encontrados: ${manualBlocks.length}`);
        
        if (manualBlocks.length > 0) {
            console.log('--- Ejemplo Bloqueo Manual: ---');
            console.dir(manualBlocks[0], { depth: null });
        }
        
        const realBookings = rows.filter(r => r.origen === 'AVAIBOOK');
        const bookingsWithEconomy = realBookings.filter(r => r.importe_total !== '0' && r.importe_total !== '');
        console.log(`Reservas con economía detectada: ${bookingsWithEconomy.length}`);
        
        if (bookingsWithEconomy.length > 0) {
            console.log('--- Ejemplo Reserva con Economía: ---');
            console.dir(bookingsWithEconomy[0], { depth: null });
        }
        
    } catch (e) {
        console.error('❌ Error reading sheet:', e);
    }
}

checkSheet();
