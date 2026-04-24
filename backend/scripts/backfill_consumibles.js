'use strict';

/**
 * Backfill de Consumibles: Google Sheets -> Supabase DB
 *
 * Requisitos:
 * - Tabla Supabase: consumibles
 * - Columna UNIQUE: req_id
 * - Variables de entorno disponibles en backend/.env:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 * - Servicio de Sheets operativo
 *
 * Uso:
 *   cd backend
 *   node scripts/backfill_consumibles.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const sheets = require('../services/sheets');

const SHEET_NAME = 'Consumibles';
const TABLE_NAME = 'consumibles';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en backend/.env');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

function pick(obj, keys, fallback = null) {
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
            return obj[key];
        }
    }
    return fallback;
}

function asString(val, fallback = '') {
    if (val === undefined || val === null) return fallback;
    const s = String(val).trim();
    return s || fallback;
}

function asNullableString(val) {
    const s = asString(val, '');
    return s || null;
}

function parseDateLike(value) {
    const raw = asString(value, '');
    if (!raw) return null;

    // Intentar ISO nativo
    const isoTry = new Date(raw);
    if (!Number.isNaN(isoTry.getTime())) return isoTry.toISOString();

    // Tolerancia a dd/mm/yyyy o dd-mm-yyyy (con horas opcionales)
    const m = raw.match(
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (m) {
        const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = m;
        const d = new Date(
            Number(yyyy),
            Number(mm) - 1,
            Number(dd),
            Number(hh),
            Number(mi),
            Number(ss)
        );
        if (!Number.isNaN(d.getTime())) return d.toISOString();
    }

    return null;
}

function normalizeUrgencia(val) {
    const v = asString(val, '').toUpperCase();
    if (v === 'URGENTE') return 'Urgente';
    return 'Normal';
}

function normalizeEstado(val) {
    const v = asString(val, '').toUpperCase();
    if (v === 'REPUESTO') return 'Repuesto';
    if (v === 'DESCARTADO') return 'Descartado';
    return 'Pendiente';
}

function normalizeCantidad(val) {
    const str = asString(val, '');
    if (!str) return null;
    const num = parseInt(str, 10);
    if (Number.isNaN(num)) return null;
    return num;
}

async function run() {
    console.log(`\n🚀 Iniciando backfill de ${SHEET_NAME} a Supabase (${TABLE_NAME})...\n`);

    let rows;
    try {
        rows = await sheets.readSheetAsObjects(SHEET_NAME);
    } catch (e) {
        console.error('❌ Error leyendo de Sheets:', e.message);
        process.exit(1);
    }

    console.log(`📖 Total de filas en la hoja: ${rows.length}`);

    let mappedRows = 0;
    let successfulUpserts = 0;
    let skippedRows = 0;
    let errorBatches = 0;

    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
        const batch = rows.slice(i, i + BATCH_SIZE);
        const upsertData = [];

        for (const row of batch) {
            const req_id = asString(pick(row, ['req_id']));
            if (!req_id) {
                console.warn(`\n[!] Fila saltada (sin req_id). Fila Google Sheets aprox: ${row._row}`);
                skippedRows++;
                continue;
            }

            const mapped = {
                req_id,
                parte_id: asNullableString(pick(row, ['parte_id'])),
                session_id: asNullableString(pick(row, ['session_id'])),
                casa: asString(pick(row, ['casa']), 'Desconocida'),
                item: asString(pick(row, ['item']), 'Desconocido'),
                item_otro: asNullableString(pick(row, ['item_otro'])),
                cantidad: normalizeCantidad(pick(row, ['cantidad'])),
                urgencia: normalizeUrgencia(pick(row, ['urgencia'])),
                estado: normalizeEstado(pick(row, ['estado'])),
                nota: asNullableString(pick(row, ['nota'])),
                marcado_por: asNullableString(pick(row, ['marcado_por'])),
                fecha_creacion: parseDateLike(pick(row, ['fecha'])) || new Date().toISOString(),
                fecha_resolucion: parseDateLike(pick(row, ['fecha_cambio_estado'])),
                origen: 'sheets',
                migrado_desde_sheets: true
            };

            upsertData.push(mapped);
            mappedRows++;
        }

        if (upsertData.length > 0) {
            try {
                const { error } = await supabase
                    .from(TABLE_NAME)
                    .upsert(upsertData, { onConflict: 'req_id' });
                
                if (error) {
                    console.error(`\n❌ Error Supabase en lote ${currentBatch}/${totalBatches}:`, error.message);
                    errorBatches++;
                } else {
                    successfulUpserts += upsertData.length;
                    process.stdout.write(` [Lote ${currentBatch}/${totalBatches} OK]`);
                }
            } catch (e) {
                console.error(`\n❌ Excepción en lote ${currentBatch}/${totalBatches}:`, e.message);
                errorBatches++;
            }
        }
    }

    console.log('\n\n--- 📊 RESUMEN DEL BACKFILL ---');
    console.log(`⚙️  Filas preparadas (mappedRows): ${mappedRows}`);
    console.log(`✅ Filas sincronizadas en Supabase (successfulUpserts): ${successfulUpserts}`);
    console.log(`⚠️  Filas saltadas por defecto de datos (skippedRows): ${skippedRows}`);
    console.log(`❌ Lotes fallidos (errorBatches): ${errorBatches}`);
    
    if (errorBatches === 0) {
        console.log(`\n🎉 Backfill completado exitosamente.`);
    } else {
        console.log(`\n⚠️ Backfill finalizado, pero hubo errores en algunos lotes.`);
    }
    
    process.exit(errorBatches > 0 ? 1 : 0);
}

run();
