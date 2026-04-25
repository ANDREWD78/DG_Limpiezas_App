'use strict';
const sheets = require('../services/sheets');
const { now } = require('../services/time');

const GRATAL_COLS = [
    'reserva_id',
    'estado_reserva',
    'fecha_entrada',
    'fecha_salida',
    'hora_entrada',
    'hora_salida',
    'late_checkout',
    'late_checkout_hora',
    'checkin_real',
    'checkout_real',
    'updated_ts'
];

/**
 * Genera y mantiene la hoja "ReservasGratal" a partir de Avaibook y Overrides.
 * Solo incluye reservas activas de casa "GRATAL".
 */
async function syncGratal() {
    console.log('🔄 [Gratal Sync] Iniciando actualización de ReservasGratal...');
    const stats = { procesadas: 0, insertadas: 0, eliminadas: 0 };

    try {
        // 1. Leer fuentes
        const [rAvaibook, rOverrides] = await Promise.all([
            sheets.readSheetAsObjects('ReservasAvaibook').catch(() => []),
            sheets.readSheetAsObjects('ReservasOverrides').catch(() => [])
        ]);

        const mapOverrides = new Map(rOverrides.map(o => [o.reserva_id, o]));

        // 2. Filtrar y procesar solo Gratal no canceladas
        const gratalData = rAvaibook
            .filter(r => {
                const casaMatch = String(r.casa || '').toUpperCase() === 'GRATAL';
                const estado = String(r.estado_reserva || '').toUpperCase();
                // Excluir si el estado contiene 'CANCEL' o 'ANUL' o 'VOID'
                const isCancelled = estado.includes('CANCEL') || estado.includes('ANUL') || estado.includes('VOID');
                return casaMatch && !isCancelled;
            })
            .map(ra => {
                const ov = mapOverrides.get(ra.reserva_id) || {};
                
                // Determinar hora efectiva de salida (priorizar late checkout)
                // En ReservasOverrides se guarda como "Sí" / "No"
                const lateCheckout = (String(ov.late_checkout) === 'Sí');
                const effectiveCheckoutTime = (lateCheckout && ov.late_checkout_hora) 
                    ? ov.late_checkout_hora 
                    : ra.hora_salida;

                return {
                    reserva_id: ra.reserva_id,
                    estado_reserva: ra.estado_reserva,
                    fecha_entrada: ra.fecha_entrada,
                    fecha_salida: ra.fecha_salida,
                    hora_entrada: ra.hora_entrada,
                    hora_salida: ra.hora_salida,
                    late_checkout: lateCheckout ? 'true' : 'false',
                    late_checkout_hora: ov.late_checkout_hora || '',
                    checkin_real: `${ra.fecha_entrada} ${ra.hora_entrada}`,
                    checkout_real: `${ra.fecha_salida} ${effectiveCheckoutTime}`,
                    updated_ts: now()
                };
            });

        stats.procesadas = gratalData.length;

        // 3. Asegurar cabeceras
        await sheets.ensureSheetHeaders('ReservasGratal', GRATAL_COLS);

        // 4. Preparar datos y actualizar atómicamente
        const rowsToInsert = gratalData.map(res => GRATAL_COLS.map(k => String(res[k] || '')));
        console.log(`[Gratal Sync] Preparadas ${rowsToInsert.length} filas válidas correspondientes a Gratal.`);
        
        console.log(`[Gratal Sync] Ejecutando overwriteSheetData en ReservasGratal...`);
        try {
            await sheets.overwriteSheetData('ReservasGratal', rowsToInsert);
            console.log(`[Gratal Sync] overwriteSheetData completado OK en el primer intento.`);
        } catch (errAppend) {
            console.log(`[Gratal Sync] Error al hacer overwriteSheetData: ${errAppend.message}. Reintentando en 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            await sheets.overwriteSheetData('ReservasGratal', rowsToInsert);
            console.log(`[Gratal Sync] overwriteSheetData completado OK en el reintento.`);
        }
        
        stats.insertadas = rowsToInsert.length;

        console.log(`✅ [Gratal Sync] Completado. Procesadas: ${stats.procesadas}, Insertadas: ${stats.insertadas}`);
        return { ok: true, stats };
    } catch (e) {
        console.error('❌ [Gratal Sync] Error:', e.message);
        return { ok: false, error: e.message };
    }
}

module.exports = syncGratal;
