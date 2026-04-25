'use strict';
const sheets = require('../services/sheets');
const avaibook = require('../services/avaibook');
const syncGratal = require('./syncGratal');

let isSyncing = false;
let lastSyncTs = 0;
const COOLDOWN_MS = 60 * 1000; // 1 minuto

// Columnas explícitas de la hoja snapshot (deben coincidir con el schema de Avaibook)
const SNAPSHOT_COLS = [
    'reserva_id',
    'external_id',
    'casa',
    'estado_reserva',
    'fecha_entrada',
    'fecha_salida',
    'hora_entrada',
    'hora_salida',
    'huespedes',
    'viajero_nombre',
    'email',
    'telefono',
    'accommodation_id',
    'unit_id',
    'canal',
    'origen',
    'updated_ts',
    'importe_total',
    'comision_partner',
    'comision_avaibook',
    'comision_total',
    'importe_neto'
];

async function syncAvaibook() {
    if (isSyncing) {
        console.log('🔄 [Avaibook Sync] Ignorando: hay otra sincronización en curso.');
        return { ok: false, reason: 'Ya en curso' };
    }
    
    if (Date.now() - lastSyncTs < COOLDOWN_MS) {
        console.log('⏳ [Avaibook Sync] Ignorando: cooldown de 1 minuto activo para proteger cuota.');
        return { ok: true, stats: { procesadas: 0, insertadas: 0, reason: 'Cooldown activo' } };
    }
    
    isSyncing = true;
    const stats = { bajadas: 0, insertadas: 0, error: null };
    console.log('🔄 [Avaibook Sync] Iniciando descarga de reservas...');

    try {
        // 1. Descargar y normalizar de la API general y Bloqueos de calendario
        const [reservasActivas, bloqueos] = await Promise.all([
            avaibook.fetchReservasActivas(),
            avaibook.fetchBloqueosCalendario()
        ]);
        
        // 1.5 Workaround temporal: Leer IDs forzados si existen en `ReservasForzadasID`
        // NOTA: Con el uso de checkinStartDate en fetchReservasActivas, esta hoja
        // queda exclusivamente como un salvavidas puntual para casos excepcionales.
        // En operativa normal (y en producción), la hoja debe mantenerse vacía.
        let reservasForzadas = [];
        try {
            await sheets.ensureSheetHeaders('ReservasForzadasID', ['reserva_id']);
            const rowsForzadas = await sheets.readSheetAsObjects('ReservasForzadasID');
            const forcedIds = rowsForzadas.map(r => r.reserva_id).filter(Boolean);
            
            if (forcedIds.length > 0) {
                console.log(`[Avaibook Sync] Consultando ${forcedIds.length} IDs forzados...`);
                for (const id of forcedIds) {
                    const rForzada = await avaibook.fetchReservaById(id);
                    if (rForzada) {
                        reservasForzadas.push(rForzada);
                    }
                }
            }
        } catch(e) {
            console.log('[Avaibook Sync] No se pudo procesar la hoja de IDs forzados, se ignora.', e.message);
        }

        // Merge evitando duplicados. Prevalecen las activas por si tuvieran cambios más recientes.
        const mapIDs = new Set(reservasActivas.map(r => r.reserva_id));
        const extraForzadas = reservasForzadas.filter(r => !mapIDs.has(r.reserva_id));
        
        const reservasTodas = [...reservasActivas, ...extraForzadas];
        
        // Merge reservas con bloqueos
        const reservas = [...reservasTodas, ...bloqueos];
        stats.bajadas = reservas.length;
        
        // 2. Asegurarnos que la tabla existe y tiene cabeceras. Si no, se crea.
        await sheets.ensureSheetHeaders('ReservasAvaibook', SNAPSHOT_COLS);

        // 3. Preparar las filas en memoria ANTES de interactuar con la hoja
        const rowsToInsert = reservas.map(res => SNAPSHOT_COLS.map(k => String(res[k] ?? '')));
        console.log(`[Avaibook Sync] Preparadas ${rowsToInsert.length} filas válidas tras la descarga.`);
        
        // 4. Escribir en Sheets (crítico): update atómico + clear residual (1 reintento)
        console.log(`[Avaibook Sync] Ejecutando overwriteSheetData en ReservasAvaibook...`);
        try {
            await sheets.overwriteSheetData('ReservasAvaibook', rowsToInsert);
            console.log(`[Avaibook Sync] overwriteSheetData completado OK en el primer intento.`);
        } catch (errAppend) {
            console.log(`[Avaibook Sync] Error al hacer overwriteSheetData: ${errAppend.message}. Reintentando en 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            await sheets.overwriteSheetData('ReservasAvaibook', rowsToInsert);
            console.log(`[Avaibook Sync] overwriteSheetData completado OK en el reintento.`);
        }
        
        stats.insertadas = rowsToInsert.length;

        lastSyncTs = Date.now();
        console.log(`✅ [Avaibook Sync] Completado. Insertadas: ${stats.insertadas}`);

        // 5. Actualizar hoja derivada de Gratal para n8n
        try {
            await syncGratal();
        } catch (errGratal) {
            console.error('[Avaibook Sync] Error al actualizar ReservasGratal:', errGratal.message);
        }

        return { ok: true, stats };
    } catch (e) {
        console.error('❌ [Avaibook Sync] Error:', e.message);
        stats.error = e.message;
        return { ok: false, stats };
    } finally {
        isSyncing = false;
    }
}

module.exports = syncAvaibook;
