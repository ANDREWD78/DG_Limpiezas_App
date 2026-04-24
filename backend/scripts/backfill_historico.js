'use strict';
require('dotenv').config({ path: __dirname + '/../.env' }); // Support running from scripts or backend folder
const avaibook = require('../services/avaibook');
const sheets = require('../services/sheets');
const axios = require('axios');

// Columnas explícitas de la hoja snapshot (deben coincidir con el schema de ReservasAvaibook)
const SNAPSHOT_COLS = [
    'reserva_id', 'external_id', 'casa', 'estado_reserva',
    'fecha_entrada', 'fecha_salida', 'hora_entrada', 'hora_salida',
    'huespedes', 'viajero_nombre', 'email', 'telefono',
    'accommodation_id', 'unit_id', 'canal', 'origen',
    'updated_ts', 'importe_total', 'comision_partner',
    'comision_avaibook', 'comision_total', 'importe_neto'
];

const { today } = require('../services/time');

async function runBackfill() {
    // Aceptar fechas por argumentos de terminal: node backfill_historico.js 2024-01-01 2025-12-31
    const args = process.argv.slice(2);
    let startDate = args[0] || '2024-01-01';
    let endDate = args[1] || '2025-12-31';

    console.log(`[Backfill Histórico] Iniciando volcado desde ${startDate} hasta ${endDate}...`);

    try {
        const headers = {
            'X-AUTH-TOKEN': process.env.AVAIBOOK_TOKEN,
            'Accept': 'application/json'
        };

        if (!process.env.AVAIBOOK_TOKEN) {
            throw new Error('AVAIBOOK_TOKEN no definido en variables de entorno.');
        }

        let allList = [];
        
        // El endpoint principal de Avaibook a veces ignora offset/limit si hay muchos resultados.
        // Solución robusta: como un mes nunca supera las ~90 reservas (3 casas x 30 días), 
        // fraccionamos la petición grande en peticiones de 1 mes garantizando < 100 resultados.
        
        let currentStart = new Date(startDate);
        const endLimit = new Date(endDate);

        while (currentStart <= endLimit) {
            let chunkEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 0); // último día del mes
            if (chunkEnd > endLimit) chunkEnd = new Date(endLimit);

            const cStartStr = today(currentStart);
            const cEndStr = today(chunkEnd);

            console.log(`[Backfill] Descargando bloque temporal: ${cStartStr} a ${cEndStr}...`);
            const url = `https://api.avaibook.com/api/owner/bookings/?checkinStartDate=${cStartStr}&checkinEndDate=${cEndStr}`;
            
            const response = await axios.get(url, { headers });
            const items = response.data?.items || response.data || [];
            
            if (Array.isArray(items) && items.length > 0) {
                allList = allList.concat(items);
                console.log(`  -> Obtenidas ${items.length} reservas raw en este bloque.`);
            }

            // Pasar al día 1 del mes siguiente
            currentStart.setMonth(currentStart.getMonth() + 1);
            currentStart.setDate(1);
        }

        console.log(`[Backfill] Descargadas ${allList.length} reservas raw.`);

        // Reutilizamos la lógica central de la app
        const normalizadas = allList.map(avaibook.normalizarReserva).filter(Boolean);

        console.log(`[Backfill] Normalizadas ${normalizadas.length} reservas válidas (excluidas canceladas).`);

        // Leer la hoja actual de ReservasHistoricas para evitar duplicar si se ejecuta varias veces
        await sheets.ensureSheetHeaders('ReservasHistoricas', SNAPSHOT_COLS);
        const existingRows = await sheets.readSheetAsObjects('ReservasHistoricas').catch(() => []);
        const mapExisting = new Set(existingRows.map(r => String(r.reserva_id)));

        const nuevas = normalizadas.filter(r => !mapExisting.has(String(r.reserva_id)));
        console.log(`[Backfill] Faltan por insertar ${nuevas.length} reservas en ReservasHistoricas.`);

        if (nuevas.length > 0) {
            const rowsToInsert = nuevas.map(res => SNAPSHOT_COLS.map(k => String(res[k] ?? '')));
            
            // Inserción masiva en bloque (batch) para no agotar la cuota de la API (429)
            await sheets.appendRows('ReservasHistoricas', rowsToInsert);
            
            console.log(`[Backfill] ¡Éxito! Insertadas ${nuevas.length} filas en ReservasHistoricas en un solo lote.`);
        } else {
            console.log(`[Backfill] No hay filas nuevas que insertar.`);
        }

    } catch(e) {
        console.error('❌ [Backfill] Error:', e.message);
        if(e.response) console.error(e.response.data);
    }
}

runBackfill();
