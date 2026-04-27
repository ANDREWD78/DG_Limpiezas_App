'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
console.log('[BACKFILL] Script iniciado');

// ─── Flags ────────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const SKIP_EXIST  = args.includes('--skip-existing');
const FORCE       = args.includes('--force');

// ─── Constantes ───────────────────────────────────────────────────────────────
const VALID_STATUSES = ['ABIERTO', 'PAUSADO', 'CERRADO', 'CERRADO_FORZADO', 'ANULADO'];
const VALID_CASAS    = ['MIRADOR', 'CASON', 'GRATAL'];
const CHUNK_SIZE     = 200;

const STATUS_ALIASES = {
    'CERRADO FORZADO':  'CERRADO_FORZADO',
    'CERRADO_FORZADO':  'CERRADO_FORZADO',
    'CERRADO':          'CERRADO',
    'ABIERTO':          'ABIERTO',
    'PAUSADO':          'PAUSADO',
    'ANULADO':          'ANULADO',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toTs(v) {
    if (!v || String(v).trim() === '') return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function safeJson(v, fallback) {
    if (v !== null && v !== undefined && typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return fallback; }
}

function inferStatus(r) {
    const raw = String(r.status || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (STATUS_ALIASES[raw]) return STATUS_ALIASES[raw];
    if (raw) console.warn(`  [WARN] id=${r.id} — status desconocido "${r.status}"`);
    return toTs(r.fin_ts) ? 'CERRADO' : 'ABIERTO';
}

function buildSupabaseRow(r) {
    const id = String(r.id || '').trim();
    if (!id) return null;

    // Validar casa
    const casa = String(r.casa || '').trim().toUpperCase();
    if (!VALID_CASAS.includes(casa)) {
        console.warn(`  [SKIP] id=${id} — casa inválida: "${r.casa}"`);
        return null;
    }

    // Validar/inferir fecha
    let fecha = r.fecha || null;
    if (!fecha && r.inicio_ts) {
        try { fecha = new Date(r.inicio_ts).toISOString().slice(0, 10); } catch {}
    }
    if (!fecha) {
        console.warn(`  [SKIP] id=${id} — sin fecha ni inicio_ts`);
        return null;
    }

    // inicio_ts con fallback
    const inicio_ts = toTs(r.inicio_ts) || `${fecha}T00:00:00Z`;
    const status = inferStatus(r);
    if (!toTs(r.inicio_ts) && ['ABIERTO', 'PAUSADO'].includes(status)) {
        console.warn(`  [WARN] id=${id} — ${status} sin inicio_ts, usando ${inicio_ts}`);
    }

    return {
        id,
        fecha,
        casa,
        status,
        session_id:               r.session_id || null,
        cleaning_session_id:      r.cleaning_session_id || r.session_id || null,
        tipo_limpieza:            r.tipo_limpieza || 'Sin especificar',
        user_id:                  r.user_id || r.usuario_nombre || 'legacy',
        usuario_nombre:           r.usuario_nombre || 'Legacy',
        created_by:               r.created_by || r.usuario_nombre || null,
        inicio_ts,
        fin_ts:                   toTs(r.fin_ts),
        ultimo_reanudar_ts:       toTs(r.ultimo_reanudar_ts),
        last_alert_ts_open_part:  toTs(r.last_alert_ts_open_part),
        suciedad_1a5:             parseInt(r.suciedad_1a5) || null,
        tiempo_acumulado_seg:     parseInt(r.tiempo_acumulado_seg) || 0,
        tiempo_efectivo_min:      parseInt(r.tiempo_efectivo_min) || 0,
        duracion_min:             parseInt(r.duracion_min) || 0,
        pausas_json:              safeJson(r.pausas_json, []),
        checklist_json:           safeJson(r.checklist_json, {}),
        fotos_cierre_urls_json:   safeJson(r.fotos_cierre_urls_json, {}),
        tareas_periodicas_json:   safeJson(r.tareas_periodicas_json, []),
        coste_estimado_eur:       parseFloat(r.coste_estimado_eur) || null,
        admin_editado:            r.admin_editado === 'true' || r.admin_editado === 'Sí',
        admin_editado_por:        r.admin_editado_por || null,
        admin_editado_ts:         toTs(r.admin_editado_ts),
        admin_edit_motivo:        r.admin_edit_motivo || null,
        inicio_ts_original:       toTs(r.inicio_ts_original),
        fin_ts_original:          toTs(r.fin_ts_original),
        resumen:                  r.resumen || null,
        pendiente:                r.pendiente || null,
        ropa_sucia_estado:        r.ropa_sucia_estado || null,
        lena_rellenada:           r.lena_rellenada || null,
        pellets_rellenado:        r.pellets_rellenado || null,
        casa_lista:               r.casa_lista || null,
        casa_lista_falta_texto:   r.casa_lista_falta_texto || null,
        observaciones:            r.observaciones || null,
        tareas_realizadas:        r.tareas_realizadas || null,
        limpieza_profunda_texto:  r.limpieza_profunda_texto || null,
        motivo_demora:            r.motivo_demora || null,
        motivo_demora_detalle:    r.motivo_demora_detalle || null,
        drive_folder_url:         r.drive_folder_url || null,
    };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('[ERROR] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
        process.exit(1);
    }

    // Requires pesados lazy — aquí dentro para ver exactamente dónde cuelga
    console.log('[BACKFILL] Cargando Supabase client...');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('[BACKFILL] Cargando servicio Sheets...');
    const sheets = require('../services/sheets');
    console.log('[BACKFILL] Servicio Sheets cargado');

    console.log(`\n[BACKFILL] backfill_partes.js`);
    console.log(`  Modo: ${DRY_RUN ? 'DRY-RUN (sin escrituras)' : SKIP_EXIST ? 'SKIP-EXISTING (INSERT, ignora conflictos)' : FORCE ? 'FORCE (UPSERT completo)' : '?'}`);
    console.log('');

    // Seguridad: sin flag explícito, abortar si tabla ya tiene datos
    if (!DRY_RUN && !SKIP_EXIST && !FORCE) {
        const { count, error: countErr } = await supabase
            .from('partes_limpieza')
            .select('id', { count: 'exact', head: true });
        if (countErr) {
            console.error('[ERROR] No se pudo consultar partes_limpieza:', countErr.message);
            process.exit(1);
        }
        if (count > 0) {
            console.error(`[ABORT] partes_limpieza ya tiene ${count} filas.`);
            console.error('        Usa --force (pre-deploy, UPSERT) o --skip-existing (post-deploy, INSERT).');
            process.exit(1);
        }
    }

    // Leer PartesLimpieza de Sheets
    console.log('[BACKFILL] Leyendo hoja PartesLimpieza...');
    const rawRows = await sheets.readSheetAsObjects('PartesLimpieza');
    console.log(`[BACKFILL] Sheets cargado: ${rawRows.length} filas\n`);

    // Mapear y filtrar
    console.log('[BACKFILL] Mapeando filas...');
    let skipped = 0;
    const mapped = [];
    for (const r of rawRows) {
        const row = buildSupabaseRow(r);
        if (!row) { skipped++; continue; }
        mapped.push(row);
    }
    console.log(`[BACKFILL] Mapeo terminado: ${mapped.length} válidas, ${skipped} saltadas`);

    console.log(`[BACKFILL] Válidas: ${mapped.length} | Saltadas: ${skipped}`);

    if (DRY_RUN) {
        console.log('\n[DRY-RUN] Primeras 5 filas mapeadas:');
        mapped.slice(0, 5).forEach((r, i) => {
            console.log(`  [${i + 1}] id=${r.id} casa=${r.casa} status=${r.status} fecha=${r.fecha} inicio_ts=${r.inicio_ts}`);
        });
        // Mostrar distribución de status
        const byStatus = {};
        mapped.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
        console.log('\n[DRY-RUN] Distribución por status:');
        Object.entries(byStatus).forEach(([s, c]) => console.log(`  ${s}: ${c}`));
        console.log('\n[DRY-RUN] Sin escrituras. Usa --force para ejecutar.\n');
        return;
    }

    // Upsert / Insert en chunks
    const ignoreDups = SKIP_EXIST;
    let inserted = 0;
    let errors   = 0;

    for (let i = 0; i < mapped.length; i += CHUNK_SIZE) {
        const chunk = mapped.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
            .from('partes_limpieza')
            .upsert(chunk, { onConflict: 'id', ignoreDuplicates: ignoreDups });
        if (error) {
            console.error(`  [ERROR] chunk ${i}–${i + chunk.length}: ${error.message}`);
            errors += chunk.length;
        } else {
            inserted += chunk.length;
            process.stdout.write(`  [OK] ${inserted}/${mapped.length} filas procesadas\r`);
        }
    }

    console.log(`\n[BACKFILL] Completado: ${inserted} OK, ${errors} errores, ${skipped} saltadas`);

    if (errors > 0) {
        console.error('[BACKFILL] Hubo errores. Revisar los mensajes anteriores.');
        process.exit(1);
    }

    // Verificación final
    const { count: finalCount } = await supabase
        .from('partes_limpieza')
        .select('id', { count: 'exact', head: true });
    console.log(`[BACKFILL] Verificación: ${finalCount} filas en partes_limpieza\n`);
}

main().catch(e => {
    console.error('[ERROR] Fatal:', e.message);
    process.exit(1);
});
