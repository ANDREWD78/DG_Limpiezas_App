'use strict';

const { readSheetAsObjects, appendRows } = require('../services/sheets');
const { today, now } = require('../services/time');

// Columnas estables (deben coincidir 1:1 con ReservasAvaibook en syncAvaibook.js)
const HEADERS_ESTABLES = [
    'reserva_id', 'external_id', 'casa', 'estado_reserva', 'fecha_entrada', 'fecha_salida',
    'hora_entrada', 'hora_salida', 'huespedes', 'viajero_nombre', 'email', 'telefono',
    'accommodation_id', 'unit_id', 'canal', 'origen', 'updated_ts',
    'importe_total', 'comision_partner', 'comision_avaibook', 'comision_total', 'importe_neto'
];

/**
 * Job mensual: Lee de ReservasAvaibook, extrae las ya cerradas el mes pasado o antes,
 * y las archiva en ReservasHistoricas, deduplicando por reserva_id.
 */
async function run() {
    try {
        console.log(`[${now()}] 📦 Iniciando proceso de Archivado Histórico...`);

        // 1. Obtener operativas actuales e histórico
        const sheetOperativa = 'ReservasAvaibook';
        const sheetHistorica = 'ReservasHistoricas';

        const operativas = await readSheetAsObjects(sheetOperativa);
        const historicas = await readSheetAsObjects(sheetHistorica);

        console.log(`   - Reservas operativas leídas: ${operativas.length}`);
        console.log(`   - Reservas históricas actuales: ${historicas.length}`);

        // 2. Determinar la fecha límite (primer día del mes actual, 00:00)
        // Todo lo que tenga fecha_salida < primerDiaMesActual es elegible.
        const tHoy = new Date();
        const tFirstDay = new Date(tHoy.getFullYear(), tHoy.getMonth(), 1);
        const limitStr = today(tFirstDay); // Ej: "2026-03-01"

        // 3. Filtrar candidatas
        const historicasIds = new Set(historicas.map(r => String(r.reserva_id)));

        const candidatas = operativas.filter(r => {
            const est = (r.estado_reserva || '').toUpperCase();
            const ori = (r.origen || '').toUpperCase();

            // Excluir canceladas/basura (alineado con admin.js)
            if (['CANCELLED', 'VOID', 'ANULADA'].includes(est)) return false;
            
            // Excluir bloqueos de disponibilidad
            if (est === 'BLOCKED' || ori === 'MANUAL_BLOCK') return false;
            
            // Excluir si la salida no ha pasado al mes anterior cerrado
            if (!r.fecha_salida || r.fecha_salida >= limitStr) return false;

            return true;
        });

        // 4. Deduplicar (solo insertar en histórico las que NO están ya ahí)
        const nuevasAArchivar = candidatas.filter(r => !historicasIds.has(String(r.reserva_id)));

        console.log(`   - Reservas candidatas cerradas (< ${limitStr}): ${candidatas.length}`);
        console.log(`   - De las cuales ya estaban archivadas: ${candidatas.length - nuevasAArchivar.length}`);
        console.log(`   - Nuevas listas para archivar: ${nuevasAArchivar.length}`);

        if (nuevasAArchivar.length === 0) {
            console.log(`[${now()}] ✅ Nada que archivar. Proceso finalizado sin cambios.`);
            return { insertadas: 0 };
        }

        // 5. Preparar volcado a ReservasHistoricas (usando esquema idéntico a ReservasAvaibook)
        const rowsToAppend = nuevasAArchivar.map(r => {
            return HEADERS_ESTABLES.map(h => r[h] !== undefined && r[h] !== null ? String(r[h]) : '');
        });

        console.log(`⏳ Escribiendo ${rowsToAppend.length} filas en '${sheetHistorica}'...`);
        await appendRows(sheetHistorica, rowsToAppend);

        console.log(`[${now()}] ✅ Archivado exitoso: ${rowsToAppend.length} reservas históricas consolidadas.`);
        return { insertadas: rowsToAppend.length };

    // NOTA: No borramos las de ReservasAvaibook aquí porque la próxima pasada diaria de syncAvaibook.js
    // ya lo reemplazará enteramente limpiándolo si la ventana móvil (-1 mes) ha avanzado. 
    // De este modo la arquitectura es resiliente y sin riesgo de borrado en cascada.

    } catch (err) {
        console.error(`[${now()}] ❌ Error en Archivado Histórico:`, err);
        throw err;
    }
}

module.exports = run;
