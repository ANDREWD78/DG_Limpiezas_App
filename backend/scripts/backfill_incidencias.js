'use strict';

/**
 * Backfill de Incidencias: Google Sheets -> Supabase DB
 *
 * Requisitos:
 * - Tabla Supabase: incidencias
 * - Columna UNIQUE: ticket_id
 * - Variables de entorno disponibles en backend/.env:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 * - Servicio de Sheets operativo
 *
 * Uso:
 *   cd backend
 *   node scripts/backfill_incidencias.js
 *
 * Opcional:
 *   node scripts/backfill_incidencias.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const sheets = require('../services/sheets');

const SHEET_NAME = 'IncidenciasMantenimiento';
const TABLE_NAME = 'incidencias';
const DRY_RUN = process.argv.includes('--dry-run');

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

function asString(v, fallback = '') {
    if (v === undefined || v === null) return fallback;
    return String(v).trim();
}

function asNullableString(v) {
    const s = asString(v, '');
    return s || null;
}

function normalizeEnum(value, allowed, fallback = null) {
    const v = asString(value, '').toUpperCase();
    if (!v) return fallback;
    return allowed.includes(v) ? v : fallback;
}

function parseDateLike(value) {
    const raw = asString(value, '');
    if (!raw) return null;

    // ISO o parseable por Date
    const isoTry = new Date(raw);
    if (!Number.isNaN(isoTry.getTime())) return isoTry.toISOString();

    // dd/mm/yyyy o dd/mm/yyyy hh:mm
    const m = raw.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
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

function normalizeFotosJson(value) {
    if (value === undefined || value === null) return [];

    if (Array.isArray(value)) return value.filter(Boolean);

    const raw = String(value).trim();
    if (!raw || raw === '[]') return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
        return [];
    } catch {
        return [];
    }
}

function normalizeEstado(value) {
    const raw = asString(value, '').toUpperCase();

    const map = {
        ABIERTA: 'PENDIENTE',
        ABIERTO: 'PENDIENTE',
        PENDIENTE: 'PENDIENTE',
        'EN CURSO': 'EN_CURSO',
        EN_CURSO: 'EN_CURSO',
        RESUELTA: 'RESUELTA',
        RESUELTO: 'RESUELTA',
        DESCARTADA: 'DESCARTADA',
        DESCARTADO: 'DESCARTADA'
    };

    return map[raw] || 'PENDIENTE';
}

function normalizePrioridad(value) {
    const raw = asString(value, '').toUpperCase();

    const map = {
        URGENTE: 'URGENTE',
        ALTA: 'ALTA',
        MEDIA: 'MEDIA',
        NORMAL: 'MEDIA',
        BAJA: 'BAJA'
    };

    return map[raw] || 'MEDIA';
}

function buildSupabaseRow(row) {
    const ticket_id = asString(
        pick(row, ['ticket_id', 'Ticket ID', 'ticket', 'id_ticket']),
        ''
    );

    if (!ticket_id) return null;

    const fotos = normalizeFotosJson(
        pick(row, ['fotos_urls_json', 'Fotos URLs JSON', 'fotos', 'fotos_json'], '[]')
    );

    return {
        ticket_id,
        parte_id: asNullableString(pick(row, ['parte_id', 'Parte ID'])),
        session_id: asNullableString(pick(row, ['session_id', 'Session ID'])),
        fecha_creacion: parseDateLike(
            pick(row, ['fecha_creacion', 'Fecha Creación', 'fecha', 'created_at'])
        ) || new Date().toISOString(),
        casa: asString(pick(row, ['casa', 'Casa']), ''),
        categoria: asString(pick(row, ['categoria', 'Categoría']), ''),
        categoria_otro: asNullableString(pick(row, ['categoria_otro', 'Categoría Otro'])),
        ubicacion: asNullableString(pick(row, ['ubicacion', 'Ubicación'])),
        prioridad: normalizePrioridad(pick(row, ['prioridad', 'Prioridad'])),
        estado: normalizeEstado(pick(row, ['estado', 'Estado'])),
        descripcion: asString(pick(row, ['descripcion', 'Descripción']), ''),
        fotos_urls_json: fotos,
        video_url: asNullableString(pick(row, ['video_url', 'Video URL'])),
        responsable: asNullableString(pick(row, ['responsable', 'Responsable'])),
        fecha_cierre: parseDateLike(pick(row, ['fecha_cierre', 'Fecha Cierre'])),
        notas_admin: asNullableString(pick(row, ['notas_admin', 'Notas Admin'])),
        origen: 'sheets',
        migrado_desde_sheets: true
    };
}

async function chunkedUpsert(rows, size = 200) {
    let inserted = 0;

    for (let i = 0; i < rows.length; i += size) {
        const chunk = rows.slice(i, i + size);

        const { error } = await supabase
            .from(TABLE_NAME)
            .upsert(chunk, { onConflict: 'ticket_id' });

        if (error) {
            throw error;
        }

        inserted += chunk.length;
        console.log(`   ↳ Upsert OK: ${inserted}/${rows.length}`);
    }
}

async function main() {
    console.log('🔄 Backfill incidencias: inicio');
    console.log(`   Hoja origen: ${SHEET_NAME}`);
    console.log(`   Tabla destino: ${TABLE_NAME}`);
    if (DRY_RUN) console.log('   Modo: DRY RUN');

    const rows = await sheets.readSheetAsObjects(SHEET_NAME);
    console.log(`📄 Filas leídas desde Sheets: ${rows.length}`);

    const seen = new Set();
    const duplicates = [];
    const mapped = [];
    let skippedWithoutTicket = 0;

    for (const row of rows) {
        const mappedRow = buildSupabaseRow(row);

        if (!mappedRow) {
            skippedWithoutTicket += 1;
            continue;
        }

        if (seen.has(mappedRow.ticket_id)) {
            duplicates.push(mappedRow.ticket_id);
            continue;
        }

        seen.add(mappedRow.ticket_id);
        mapped.push(mappedRow);
    }

    console.log(`✅ Filas válidas para migrar: ${mapped.length}`);
    console.log(`⚠️ Filas sin ticket_id: ${skippedWithoutTicket}`);
    console.log(`⚠️ Duplicados por ticket_id: ${duplicates.length}`);

    if (duplicates.length) {
        console.log('   Duplicados detectados (primeros 20):');
        duplicates.slice(0, 20).forEach(id => console.log(`   - ${id}`));
    }

    if (DRY_RUN) {
        console.log('🧪 DRY RUN completado. No se ha escrito nada en Supabase.');
        return;
    }

    await chunkedUpsert(mapped, 200);

    console.log('🎉 Backfill incidencias completado OK');
    console.log(`   Total upsertadas: ${mapped.length}`);
}

main().catch((err) => {
    console.error('❌ Error en backfill_incidencias:', err.message || err);
    process.exit(1);
});