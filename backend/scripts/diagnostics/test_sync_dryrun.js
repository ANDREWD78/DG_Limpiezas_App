const avaibook = require('../../services/avaibook');
require('dotenv').config({ path: __dirname + '/../../.env' });

async function dryRunSync() {
    console.log('--- EMPEZANDO DRY RUN AVAIBOOK SYNC ---');
    try {
        console.log('1. Fetching reservas reales...');
        // Modificamos el .env temporalmente para que getAuthHeaders() funcione si no lo coge
        if (!process.env.AVAIBOOK_TOKEN) {
            console.error('Falta AVAIBOOK_TOKEN en env');
            return;
        }

        const reservasActivas = await avaibook.fetchReservasActivas();
        console.log(`✅ Obtenidas ${reservasActivas.length} reservas activas.`);

        console.log('\n2. Fetching bloqueos de calendario...');
        const bloqueos = await avaibook.fetchBloqueosCalendario();
        console.log(`✅ Obtenidos ${bloqueos.length} bloqueos manuales.`);

        const todas = [...reservasActivas, ...bloqueos];
        
        console.log(`\nTOTAL REGISTROS A SINCRONIZAR: ${todas.length}`);

        const SNAPSHOT_COLS = [
            'reserva_id', 'external_id', 'casa', 'estado_reserva', 'fecha_entrada',
            'fecha_salida', 'hora_entrada', 'hora_salida', 'huespedes', 'viajero_nombre',
            'email', 'telefono', 'accommodation_id', 'unit_id', 'canal', 'origen',
            'updated_ts', 'importe_total', 'comision_partner', 'comision_avaibook', 'comision_total', 'importe_neto'
        ];

        // Mapeamos temporalmente una fila para enseñar la serialización real de los 0
        const mappedRow = (res) => SNAPSHOT_COLS.map(k => String(res[k] ?? ''));

        // Mostrar un ejemplo de reserva real
        const reservaEjemplo = reservasActivas.length > 0 ? reservasActivas[0] : null;
        if (reservaEjemplo) {
            console.log('\n--- MUESTRA: RESERVA REAL (con economía) ---');
            console.dir(reservaEjemplo, { depth: null, colors: true });
        }

        // Mostrar un ejemplo de bloqueo manual
        const bloqueoEjemplo = bloqueos.length > 0 ? bloqueos[0] : null;
        if (bloqueoEjemplo) {
            console.log('\n--- MUESTRA: BLOQUEO DE CALENDARIO (Objeto Crudo) ---');
            console.dir(bloqueoEjemplo, { depth: null, colors: true });
            console.log('\n--- MUESTRA: BLOQUEO (Fila Serializada para Sheets) ---');
            console.log(mappedRow(bloqueoEjemplo));
        }

        console.log('\n✅ DRY RUN COMPLETADO. NO SE HA ESCRITO EN GOOGLE SHEETS.');

    } catch (e) {
        console.error('❌ Error en el dry run:', e);
    }
}

dryRunSync();
