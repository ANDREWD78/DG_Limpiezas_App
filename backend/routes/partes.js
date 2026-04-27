'use strict';
const router = require('express').Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const sheets = require('../services/sheets');
const { uploadPartPhoto } = require('../services/supabaseStorage');
const tg = require('../services/telegram');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Bloque 1: Supabase client ────────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');
const supabase = (() => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { console.error('[PARTES] Supabase no configurado'); return null; }
    return createClient(url, key, { auth: { persistSession: false } });
})();

function uid() { return `P-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function getMadridParts(d) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).formatToParts(d);
    const p = {};
    for (const part of parts) p[part.type] = part.value;
    let h = p.hour; if (h === '24') h = '00';
    return { yy: p.year, mm: p.month, dd: p.day, H: h, M: p.minute, S: p.second };
}

function now(d = new Date()) {
    const p = getMadridParts(d);
    const dateStr = `${p.yy}-${p.mm}-${p.dd}`;
    const timeStr = `${p.H}:${p.M}:${p.S}`;
    const localD = new Date(dateStr + 'T' + timeStr + 'Z');
    let offsetMins = Math.round((localD - d) / 60000);
    const sign = offsetMins >= 0 ? '+' : '-';
    offsetMins = Math.abs(offsetMins);
    const zH = String(Math.floor(offsetMins / 60)).padStart(2, '0');
    const zM = String(offsetMins % 60).padStart(2, '0');
    return `${dateStr}T${timeStr}${sign}${zH}:${zM}`;
}

function today(d = new Date()) {
    const p = getMadridParts(d);
    return `${p.yy}-${p.mm}-${p.dd}`;
}

function hhmm(d = new Date()) {
    const p = getMadridParts(new Date(d));
    return `${p.H}:${p.M}`;
}
function diffMin(ts1, ts2) {
    return Math.max(0, Math.round((new Date(ts2) - new Date(ts1)) / 60000));
}
function fmtTelegramDate(ts) {
    if (!ts) return '';
    try {
        const d = new Date(ts);
        const f = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' });
        const h = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
        return `${f} · ${h}`;
    } catch { return ts; }
}

// ─── Helpers de tiempo acumulado ─────────────────────────────────────────────

// Convierte pausas_json de Supabase (array JS) o Sheets (string JSON) → array
function _safeJsonArr(v) {
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v || '[]'); } catch { return []; }
}

// Segundos entre dos timestamps ISO. Tolerante a nulos o inválidos → 0.
function segEntre(ts1, ts2) {
    if (!ts1 || !ts2) return 0;
    const diff = new Date(ts2) - new Date(ts1);
    return Math.max(0, Math.round(diff / 1000));
}

// Leer tiempo_acumulado_seg con fallback 0 (partes sin el campo nuevo).
function getTiempoAcumuladoSeg(fila) {
    const raw = parseFloat(fila.tiempo_acumulado_seg);
    return isNaN(raw) ? 0 : raw;
}

// Fallback legacy: tiempo efectivo calculado desde inicio_ts + pausas_json.
// Solo se usa cuando las columnas nuevas están vacías (partes anteriores a la Fase 3).
function getTiempoLegacySeg(fila) {
    if (!fila.inicio_ts) return 0;
    const fin = fila.fin_ts || now();
    let totalSeg = segEntre(fila.inicio_ts, fin);
    const pausas = _safeJsonArr(fila.pausas_json); // soporta tanto array (Supabase) como string (Sheets)
    for (const p of pausas) {
        const pFin = p.fin || fin;
        totalSeg -= segEntre(p.inicio, pFin);
    }
    return Math.max(0, totalSeg);
}

// Tiempo total actual del parte en segundos según su status.
// ABIERTO  → acumulado + tramo desde ultimo_reanudar_ts hasta ahora
// PAUSADO  → acumulado (congelado)
// CERRADO  → acumulado (ya cerrado al finalizar)
// Legacy   → si los campos nuevos están vacíos, usa getTiempoLegacySeg
function getTiempoActualSeg(fila) {
    const status = fila.status || 'ABIERTO';
    const acumulado = getTiempoAcumuladoSeg(fila);
    const tieneNuevosFields = fila.tiempo_acumulado_seg !== '' && fila.tiempo_acumulado_seg != null;

    if (!tieneNuevosFields) return getTiempoLegacySeg(fila); // compatibilidad partes antiguos

    if (status === 'ABIERTO' && fila.ultimo_reanudar_ts) {
        return acumulado + segEntre(fila.ultimo_reanudar_ts, now());
    }
    return acumulado; // PAUSADO, CERRADO, o sin ultimo_reanudar_ts
}

// Formatea segundos como cronómetro HH:MM:SS (o MM:SS si < 1 hora).
function fmtSegCrono(seg) {
    const s = Math.max(0, Math.floor(seg));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const mm2 = String(mm).padStart(2, '0');
    const ss2 = String(ss).padStart(2, '0');
    return hh > 0
        ? `${hh}:${mm2}:${ss2}`
        : `${mm2}:${ss2}`;
}

// Mapa una fila de partes_limpieza al objeto parte consumido por el frontend
function _mapParte(r) {
    let cp = null;
    try { cp = r.checklist_progreso_json ? JSON.parse(r.checklist_progreso_json) : {}; } catch { }
    let fa = [];
    try { fa = r.fotos_antes_json ? JSON.parse(r.fotos_antes_json) : []; } catch { }

    return {
        id: r.id, session_id: r.session_id, cleaning_session_id: r.cleaning_session_id,
        casa: r.casa, tipo: r.tipo_limpieza, status: r.status,
        inicio_ts: r.inicio_ts, ultimo_reanudar_ts: r.ultimo_reanudar_ts, fin_ts: r.fin_ts,
        tiempo_efectivo_seg: getTiempoActualSeg(r), // Fase 3
        tiempo_acumulado_seg: getTiempoAcumuladoSeg(r),
        checklist_progreso: cp,
        fotos_antes: fa,
        suciedad_1a5: r.suciedad_1a5,
    };
}

// Mapa una fila al objeto abierto inicial (usado en admin.js)
function _mapParteOpen(r) {
    if (!r) return null;
    const tiempoActualSeg = getTiempoActualSeg(r);
    return {
        id: r.id, session_id: r.session_id,
        casa: r.casa, tipo: r.tipo_limpieza,
        inicio_ts: r.inicio_ts, fecha: r.fecha,
        usuario_nombre: r.usuario_nombre,
        status: r.status || 'ABIERTO',
        tiempo_actual_seg: tiempoActualSeg,
        tiempo_actual_hhmm: fmtSegCrono(tiempoActualSeg),
        tiempo_acumulado_seg: getTiempoAcumuladoSeg(r),
        ultimo_reanudar_ts: r.ultimo_reanudar_ts || '',
        duracion_actual_min: Math.round(tiempoActualSeg / 60),
        pausas_json: r.pausas_json || '[]',
    };
}

// ─── FASE NUEVA: CALENDARIO TRABAJADORAS ─────────────────────────────────────
const { getReservasFusionadas } = require('../services/reservas');

router.get('/calendario', requireAuth, async (req, res, next) => {
    try {
        const u = req.session.user;
        const permits = u.casas_permitidas || [];
        const isAdmin = u.rol === 'admin';

        if (!isAdmin && permits.length === 0) {
            return res.status(403).json({ error: 'No tienes casas permitidas en tu perfil.' });
        }

        const todas = await getReservasFusionadas();

        let filtradas = todas;
        if (!isAdmin) {
            filtradas = todas.filter(r => permits.includes(r.casa));
        }

        // Rango de fechas dinámico según rol
        const hoyMesActual = new Date();
        hoyMesActual.setDate(1);

        const calcIni = new Date(hoyMesActual);
        if (isAdmin) calcIni.setMonth(calcIni.getMonth() - 1);

        const calcLimiteCalendario = new Date(hoyMesActual);
        calcLimiteCalendario.setMonth(calcLimiteCalendario.getMonth() + (isAdmin ? 11 : 4));
        calcLimiteCalendario.setDate(0);

        const fechaIniCalendario = today(calcIni);
        const fechaFinCalendario = today(calcLimiteCalendario);

        const reservasCalendario = filtradas.filter(r => {
            if (String(r.estado_reserva || '').toLowerCase().includes('cancel')) return false;
            return (r.fecha_entrada <= fechaFinCalendario && r.fecha_salida >= fechaIniCalendario);
        });

        res.json({
            reservasCalendario,
            fecha: today()
        });

    } catch (err) { next(err); }
});

// ─── Esquema canónico de columnas de PartesLimpieza (41 cols) ─────────────────
// Se mantiene para _buildSheetRow (backup INSERT en Sheets)
const PARTE_COLS = [
    'id',                      // 1
    'session_id',              // 2
    'fecha',                   // 3
    'casa',                    // 4
    'tipo_limpieza',           // 5
    'suciedad_1a5',            // 6
    'inicio_ts',               // 7
    'fin_ts',                  // 8
    'duracion_min',            // 9
    'user_id',                 // 10
    'usuario_nombre',          // 11
    'motivo_demora',           // 12
    'motivo_demora_detalle',   // 13
    'checklist_json',          // 14
    'resumen',                 // 15
    'pendiente',               // 16
    'ropa_sucia_estado',       // 17
    'lena_rellenada',          // 18
    'pellets_rellenado',       // 19
    'casa_lista',              // 20
    'casa_lista_falta_texto',  // 21
    'drive_folder_url',        // 22
    'fotos_cierre_urls_json',  // 23
    'coste_estimado_eur',      // 24
    'created_by',              // 25
    'tareas_realizadas',       // 26
    'status',                  // 27
    'cleaning_session_id',     // 28
    'last_alert_ts_open_part', // 29
    'admin_editado',           // 30
    'admin_editado_por',       // 31
    'admin_editado_ts',        // 32
    'admin_edit_motivo',       // 33
    'inicio_ts_original',      // 34
    'fin_ts_original',         // 35
    'limpieza_profunda_texto', // 36
    'tiempo_efectivo_min',     // 37
    'pausas_json',             // 38
    'observaciones',           // 39
    'tiempo_acumulado_seg',    // 40
    'ultimo_reanudar_ts',      // 41
    'tareas_periodicas_json',  // 42
];

// Construye un array de valores en el orden exacto de PARTE_COLS.
function buildParteRow(data = {}) {
    return PARTE_COLS.map(k => {
        if (k === 'pausas_json') return data[k] ?? '[]';
        const v = data[k];
        return v == null ? '' : String(v);
    });
}

// Helper para backup Sheets en INSERT: re-serializa campos JSONB antes de pasarlos al array
function _buildSheetRow(data) {
    return buildParteRow({
        ...data,
        pausas_json:            JSON.stringify(data.pausas_json ?? []),
        checklist_json:         JSON.stringify(data.checklist_json ?? {}),
        fotos_cierre_urls_json: JSON.stringify(data.fotos_cierre_urls_json ?? {}),
        tareas_periodicas_json: JSON.stringify(data.tareas_periodicas_json ?? []),
        admin_editado:          data.admin_editado ? 'true' : '',
        suciedad_1a5:           data.suciedad_1a5 != null ? String(data.suciedad_1a5) : '',
        coste_estimado_eur:     data.coste_estimado_eur != null ? String(data.coste_estimado_eur) : '',
        inicio_ts:              data.inicio_ts || '',
        fin_ts:                 data.fin_ts || '',
        ultimo_reanudar_ts:     data.ultimo_reanudar_ts || '',
        last_alert_ts_open_part: data.last_alert_ts_open_part || '',
        admin_editado_ts:       data.admin_editado_ts || '',
        inicio_ts_original:     data.inicio_ts_original || '',
        fin_ts_original:        data.fin_ts_original || '',
    });
}

const SABAYES_CASAS = ['MIRADOR', 'CASON'];


// ─── Bloque 2: GET /api/partes/open ──────────────────────────────────────────
router.get('/open', requireAuth, async (req, res, next) => {
    try {
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const user = req.session.user;

        const { data: abiertos, error } = await supabase
            .from('partes_limpieza')
            .select('*')
            .eq('user_id', user.user_id)
            .in('status', ['ABIERTO', 'PAUSADO'])
            .order('inicio_ts', { ascending: false });
        if (error) return next(error);

        console.log(`\n[BACKEND /open] Petición de usuario: ${user.nombre} / ID: ${user.user_id}`);
        console.log(`[BACKEND /open] Crudos encontrados: ${(abiertos || []).length}`);
        (abiertos || []).forEach(a => console.log(`   -> ID: ${a.id} | Casa: ${a.casa} | Status: ${a.status} | Inicio: ${a.inicio_ts}`));

        if (!abiertos || !abiertos.length) {
            console.log(`[BACKEND /open] Devolviendo { open: false }`);
            return res.json({ open: false });
        }

        // El parte "principal": el ABIERTO; si todos pausados, el primero
        const open = abiertos.find(r => r.status === 'ABIERTO') || abiertos[0];

        // Usar nuevo modelo de tiempo
        const durMin = Math.round(getTiempoActualSeg(open) / 60);

        // ── Stale alert (async, no bloquea respuesta) ─────────────────────
        (async () => {
            try {
                const cfg = await sheets.readSheetAsObjects('Config').catch(() => []);
                const alertHours = parseFloat(
                    cfg.find(r => r.key === 'alert_open_part_hours')?.value || '8'
                );
                const throttleHours = parseFloat(
                    cfg.find(r => r.key === 'open_part_alert_cooldown_hours')?.value || '12'
                );

                if (durMin < alertHours * 60) return;

                const lastAlert = open.last_alert_ts_open_part;
                if (lastAlert) {
                    const sinceAlert = (Date.now() - new Date(lastAlert)) / 3600000;
                    if (sinceAlert < throttleHours) return;
                }

                const hh = Math.floor(durMin / 60);
                const mm = durMin % 60;
                await tg.enviarMensaje(
                    `⚠️ Parte abierto demasiado tiempo\n` +
                    `— Usuario: ${open.usuario_nombre}\n` +
                    `— Casa: ${open.casa} · ${open.tipo_limpieza}\n` +
                    `— Abierto desde: ${fmtTelegramDate(open.inicio_ts)}\n` +
                    `— Duración: ${hh}h ${mm}m`
                );

                // Actualizar last_alert_ts_open_part en Supabase (no en Sheets)
                const nowTs = now();
                await supabase
                    .from('partes_limpieza')
                    .update({ last_alert_ts_open_part: nowTs })
                    .eq('id', open.id);
            } catch { /* silencioso */ }
        })();

        console.log('[DEBUG /open] parte principal:', {
            id: open.id, status: open.status,
            tiempo_acumulado_seg: open.tiempo_acumulado_seg,
            ultimo_reanudar_ts: open.ultimo_reanudar_ts,
            tiempo_actual_seg: getTiempoActualSeg(open),
            tiempo_actual_hhmm: fmtSegCrono(getTiempoActualSeg(open)),
        });

        console.log(`[BACKEND /open] Despachando JSON final de ${abiertos.length} partes.`);
        res.json({
            open: true,
            stale: durMin > (8 * 60),
            duracion_actual_min: durMin,
            parte: {
                id: open.id, session_id: open.session_id,
                casa: open.casa, tipo: open.tipo_limpieza,
                inicio_ts: open.inicio_ts, fecha: open.fecha,
                usuario_nombre: open.usuario_nombre,
                status: open.status || 'ABIERTO',
                suciedad_1a5: open.suciedad_1a5,
            },
            partes: abiertos.map(r => {
                const mapped = _mapParte(r);
                console.log(`\n[LOG API PARTES] Parte Abierto — ID: ${mapped.id}`);
                console.log(`Casa: ${mapped.casa} | Usuario: ${r.usuario_nombre} | Status: ${mapped.status}`);
                console.log(`Inicio: ${mapped.inicio_ts} | Último reanudar: ${mapped.ultimo_reanudar_ts}`);
                console.log(`Pausas JSON: ${JSON.stringify(r.pausas_json)}`);
                console.log(`Acumulado leído: ${r.tiempo_acumulado_seg} -> ${mapped.tiempo_acumulado_seg}`);
                console.log(`Efectivo calculado: ${mapped.tiempo_efectivo_seg}`);
                console.log(`JSON FINAL -> { tiempo_efectivo_seg: ${mapped.tiempo_efectivo_seg}, tiempo_acumulado_seg: ${mapped.tiempo_acumulado_seg} }`);
                return mapped;
            }),
        });
    } catch (err) { next(err); }
});


// ─── Bloque 3: GET /api/partes/active ─────────────────────────────────────────
router.get('/active', requireAuth, async (req, res, next) => {
    try {
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const { casa } = req.query;
        const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

        const { data: active, error } = await supabase
            .from('partes_limpieza')
            .select('session_id, cleaning_session_id, usuario_nombre, inicio_ts')
            .eq('casa', casa)
            .is('fin_ts', null)
            .gte('inicio_ts', cutoff)
            .not('status', 'eq', 'ANULADO')
            .order('inicio_ts', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) return next(error);

        if (!active) return res.json({ found: false });
        res.json({
            found: true,
            session_id: active.session_id,
            cleaning_session_id: active.cleaning_session_id || active.session_id,
            usuario: active.usuario_nombre,
            inicio_ts: active.inicio_ts,
        });
    } catch (err) { next(err); }
});


// ─── Bloque 4: GET /api/partes/open-by-casa ───────────────────────────────────
router.get('/open-by-casa', requireAuth, async (req, res, next) => {
    try {
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const { casa, exclude_id, csid } = req.query;

        let q = supabase
            .from('partes_limpieza')
            .select('id, cleaning_session_id, session_id, drive_folder_url, fotos_cierre_urls_json')
            .eq('casa', casa)
            .is('fin_ts', null)
            .not('status', 'eq', 'ANULADO');
        if (csid) q = q.eq('cleaning_session_id', csid);
        if (exclude_id) q = q.neq('id', exclude_id);

        const { data: others, error } = await q;
        if (error) return next(error);

        // Detectar si ya hay fotos en esta sesión de limpieza (incluye partes cerrados)
        let hasPhotos = false;
        if (csid) {
            const { data: sesionPartes } = await supabase
                .from('partes_limpieza')
                .select('drive_folder_url, fotos_cierre_urls_json')
                .eq('cleaning_session_id', csid)
                .not('status', 'eq', 'ANULADO');
            hasPhotos = (sesionPartes || []).some(r => {
                const hasUrl = r.drive_folder_url && r.drive_folder_url.trim().length > 0;
                const hasJson = r.fotos_cierre_urls_json && Object.keys(r.fotos_cierre_urls_json).length > 0;
                return hasUrl || hasJson;
            });
        }

        const count = (others || []).length;
        res.json({ count, isLast: count === 0, hasPhotos });
    } catch (err) { next(err); }
});


// ─── Bloque 5: GET /api/partes — listar (admin) ───────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
    try {
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const casa = req.query.casa;
        const limit = parseInt(req.query.limit) || 50;

        let q = supabase
            .from('partes_limpieza')
            .select('*')
            .not('status', 'eq', 'ANULADO')
            .order('inicio_ts', { ascending: false })
            .limit(limit);
        if (casa) q = q.eq('casa', casa);

        const { data, error } = await q;
        if (error) return next(error);
        res.json(data || []);
    } catch (err) { next(err); }
});


// ─── Bloque 6: POST /api/partes/iniciar ──────────────────────────────────────
router.post('/iniciar', requireAuth, async (req, res, next) => {
    try {
        // ── DIAGNÓSTICO TEMPORAL ──────────────────────────────────────────────
        console.log('[PARTES /iniciar] body:', JSON.stringify(req.body));
        console.log('[PARTES /iniciar] user:', JSON.stringify({
            user_id: req.session?.user?.user_id,
            nombre:  req.session?.user?.nombre,
            rol:     req.session?.user?.rol,
        }));
        console.log('[PARTES /iniciar] supabase:', supabase ? 'OK' : 'NULL');

        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const { casa, tipo_limpieza, cleaning_session_id: joinCleaningSession } = req.body;
        const user = req.session.user;

        // ── Guardia: validación con reglas Sabayés (sin cache ni retry — Supabase es consistente) ──
        const { data: abiertosUsuario, error: errAbiertos } = await supabase
            .from('partes_limpieza')
            .select('id, casa, status')
            .eq('user_id', user.user_id)
            .in('status', ['ABIERTO', 'PAUSADO']);
        if (errAbiertos) return next(errAbiertos);

        console.log('[PARTES /iniciar] abiertosUsuario:', JSON.stringify(abiertosUsuario));

        if ((abiertosUsuario || []).length >= 2) {
            return res.status(409).json({ error: 'Límite de partes abiertos alcanzado (máximo 2)' });
        }

        if ((abiertosUsuario || []).length === 1) {
            const existente = abiertosUsuario[0];
            const esSabayes =
                SABAYES_CASAS.includes(existente.casa) &&
                SABAYES_CASAS.includes(casa) &&
                existente.casa !== casa;

            if (esSabayes && existente.status === 'PAUSADO') {
                // ✓ Excepción Sabayés válida: parte pausado en otra casa del grupo
            } else if (esSabayes && existente.status === 'ABIERTO') {
                return res.status(409).json({
                    error: `Pausa primero tu parte de ${existente.casa} antes de abrir ${casa}`,
                    sabayes: true,
                    parteId: existente.id,
                    open: true,
                });
            } else {
                // Contrato frontend: incluir parte para que el frontend pueda continuar
                return res.status(409).json({
                    error: 'Ya tienes un parte abierto',
                    open: true,
                    parte: _mapParte(existente),
                });
            }
        }

        // ── Resolver cleaning_session_id ──────────────────────────────────────
        let cleaning_session_id = null;

        if (joinCleaningSession) {
            // Verificar que el CSI pasado por el frontend existe y está activo en la misma casa
            const { data: matchingOpen } = await supabase
                .from('partes_limpieza')
                .select('cleaning_session_id')
                .eq('casa', casa)
                .is('fin_ts', null)
                .eq('cleaning_session_id', joinCleaningSession)
                .maybeSingle();
            if (matchingOpen) {
                cleaning_session_id = matchingOpen.cleaning_session_id;
            }
        }

        if (!cleaning_session_id) {
            // Buscar parte abierto reciente en la misma casa (últimas 8h) para compartir CSI
            const cutoff8h = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
            const { data: sameSession } = await supabase
                .from('partes_limpieza')
                .select('cleaning_session_id')
                .eq('casa', casa)
                .is('fin_ts', null)
                .gte('inicio_ts', cutoff8h)
                .limit(1)
                .maybeSingle();

            cleaning_session_id = sameSession?.cleaning_session_id || uid();
        }

        const id = uid();
        const session_id = uid();
        const inicio_ts = now();

        const newParte = {
            id,
            session_id,
            cleaning_session_id,
            fecha: today(),
            casa,
            tipo_limpieza,
            inicio_ts,
            status: 'ABIERTO',
            user_id: user.user_id || user.nombre,
            usuario_nombre: user.nombre,
            created_by: user.nombre,
            tiempo_acumulado_seg: 0,
            ultimo_reanudar_ts: inicio_ts,
            pausas_json: [],
            checklist_json: {},
            fotos_cierre_urls_json: {},
            tareas_periodicas_json: [],
        };

        console.log('[PARTES /iniciar] newParte:', JSON.stringify(newParte));

        const { error: errInsert } = await supabase
            .from('partes_limpieza')
            .insert(newParte);
        if (errInsert) {
            console.error('[PARTES /iniciar] Supabase insert error:', JSON.stringify(errInsert));
            return res.status(500).json({ error: 'Error guardando parte' });
        }
        console.log('[PARTES /iniciar] Supabase insert OK:', id);

        // Backup Sheets — INSERT único (non-blocking, no bloqueante)
        sheets.appendRow('PartesLimpieza', _buildSheetRow(newParte))
            .catch(e => console.error('[PARTES][SHEETS BACKUP] iniciar:', e.message));

        res.json({ ok: true, id, session_id, cleaning_session_id, inicio_ts });
    } catch (err) { next(err); }
});


// ─── Bloque 7: POST /api/partes/:id/pausar ───────────────────────────────────
router.post('/:id/pausar', requireAuth, async (req, res, next) => {
    try {
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const { id } = req.params;
        const user = req.session.user;

        const { data: fila, error: errGet } = await supabase
            .from('partes_limpieza')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (errGet) return next(errGet);

        if (!fila) return res.status(404).json({ error: 'Parte no encontrado' });
        if (fila.status !== 'ABIERTO') {
            return res.status(409).json({ error: `No se puede pausar un parte en estado ${fila.status}` });
        }

        // Verificar propiedad (admin puede pausar cualquier parte)
        const esAdmin = user.rol === 'admin';
        const esPropietario = fila.user_id === user.user_id || fila.usuario_nombre === user.nombre;
        if (!esAdmin && !esPropietario) {
            return res.status(403).json({ error: 'No puedes pausar el parte de otro usuario' });
        }

        const nowTs = now();
        const pausas = _safeJsonArr(fila.pausas_json);

        const acumAntes = getTiempoAcumuladoSeg(fila);
        const tramoActivo = segEntre(fila.ultimo_reanudar_ts, nowTs);
        console.log('[DEBUG /pausar]', {
            id, status: fila.status,
            tiempo_acumulado_seg_fila: fila.tiempo_acumulado_seg,
            ultimo_reanudar_ts_fila: fila.ultimo_reanudar_ts,
            nowTs, acumAntes, tramoActivo,
            nuevoAcum: acumAntes + tramoActivo,
        });

        pausas.push({ inicio: nowTs, fin: null });
        const acumPausar = acumAntes + tramoActivo;

        const { error: errUpdate } = await supabase
            .from('partes_limpieza')
            .update({
                status: 'PAUSADO',
                pausas_json: pausas,
                tiempo_acumulado_seg: acumPausar,
                ultimo_reanudar_ts: null,
            })
            .eq('id', id);
        if (errUpdate) return next(errUpdate);

        // NO backup Sheets en updates
        res.json({ ok: true, status: 'PAUSADO', pausas_json: JSON.stringify(pausas) });
    } catch (err) { next(err); }
});


// ─── Bloque 8: POST /api/partes/:id/reanudar ─────────────────────────────────
router.post('/:id/reanudar', requireAuth, async (req, res, next) => {
    try {
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const { id } = req.params;
        const user = req.session.user;

        const { data: fila, error: errGet } = await supabase
            .from('partes_limpieza')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (errGet) return next(errGet);

        if (!fila) return res.status(404).json({ error: 'Parte no encontrado' });
        if (fila.status !== 'PAUSADO') {
            return res.status(409).json({ error: `No se puede reanudar un parte en estado ${fila.status || 'ABIERTO'}` });
        }

        // Verificar propiedad
        const esAdmin = user.rol === 'admin';
        const esPropietario = fila.user_id === user.user_id || fila.usuario_nombre === user.nombre;
        if (!esAdmin && !esPropietario) {
            return res.status(403).json({ error: 'No puedes reanudar el parte de otro usuario' });
        }

        // Auto-pausar otros partes ABIERTO del mismo usuario (excepción Sabayés)
        const { data: otrosActivos } = await supabase
            .from('partes_limpieza')
            .select('*')
            .eq('user_id', user.user_id)
            .eq('status', 'ABIERTO')
            .neq('id', id);

        const autoPausados = [];
        for (const otro of (otrosActivos || [])) {
            const pausaNowTs = now();
            const pausasOtro = _safeJsonArr(otro.pausas_json);
            const lastPausaOtro = pausasOtro[pausasOtro.length - 1];
            if (!lastPausaOtro || lastPausaOtro.fin) {
                pausasOtro.push({ inicio: pausaNowTs, fin: null });
            }
            const otroAcumulado = getTiempoAcumuladoSeg(otro) + segEntre(otro.ultimo_reanudar_ts, pausaNowTs);
            await supabase
                .from('partes_limpieza')
                .update({
                    status: 'PAUSADO',
                    pausas_json: pausasOtro,
                    tiempo_acumulado_seg: otroAcumulado,
                    ultimo_reanudar_ts: null,
                })
                .eq('id', otro.id);
            autoPausados.push(otro.id);
        }

        // Reanudar: cerrar último tramo de pausa abierto
        const reanudarNowTs = now();
        const pausas = _safeJsonArr(fila.pausas_json);
        const lastPausa = pausas[pausas.length - 1];
        if (lastPausa && !lastPausa.fin) {
            lastPausa.fin = reanudarNowTs;
        }

        const { error: errUpdate } = await supabase
            .from('partes_limpieza')
            .update({
                status: 'ABIERTO',
                pausas_json: pausas,
                tiempo_acumulado_seg: getTiempoAcumuladoSeg(fila),
                ultimo_reanudar_ts: reanudarNowTs,
            })
            .eq('id', id);
        if (errUpdate) return next(errUpdate);

        // NO backup Sheets en updates
        res.json({ ok: true, status: 'ABIERTO', pausas_json: JSON.stringify(pausas), auto_pausados: autoPausados });
    } catch (err) { next(err); }
});


// ─── Bloque 9: POST /api/partes/:id/finalizar ────────────────────────────────
const fotosUpload = upload.fields([
    { name: 'fotos_cierre', maxCount: 20 },
    { name: 'fotos_antes', maxCount: 10 },
]);

router.post('/:id/finalizar', requireAuth, fotosUpload, async (req, res, next) => {
    try {
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const { id } = req.params;
        const user = req.session.user;
        const body = req.body;
        const fin_ts = now();

        // Recuperar la fila desde Supabase
        const { data: fila, error: errGet } = await supabase
            .from('partes_limpieza')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (errGet) return next(errGet);
        if (!fila) return res.status(404).json({ error: 'Parte no encontrado' });

        const duracion_min = diffMin(fila.inicio_ts, fin_ts);
        const coste = duracion_min && user.tarifa
            ? ((duracion_min / 60) * parseFloat(user.tarifa || 12)).toFixed(2)
            : '';

        // Subir fotos a Supabase Storage
        const casa = fila.casa;
        const fechaStr = today().split('-').reverse().join('-'); // DD-MM-YYYY
        const folderName = `${fechaStr}_${id}`;
        let driveFolderUrl = '';
        let fotosUrls = {};

        const todasLasFotos = [
            ...(req.files?.fotos_cierre || []).map(f => ({ ...f, zona: 'cierre' })),
            ...(req.files?.fotos_antes || []).map(f => ({ ...f, zona: 'antes' })),
        ];

        if (todasLasFotos.length > 0) {
            for (const f of todasLasFotos) {
                const fileName = `${Date.now()}_${f.originalname}`;
                const filePath = `${casa}/${folderName}/${fileName}`;
                const storedPath = await uploadPartPhoto(f.buffer, filePath, f.mimetype);
                const zona = f.zona || 'general';
                if (!fotosUrls[zona]) fotosUrls[zona] = [];
                fotosUrls[zona].push(storedPath);
            }
        }

        // Valores del body
        const suciedad       = body.suciedad_1a5 || '';
        const checklistJson  = body.checklist_json || '{}';
        const resumen        = body.resumen || '';
        const pendiente      = body.pendiente || '';
        const ropaSucia      = body.ropa_sucia_estado || '';
        const lena           = body.lena_rellenada || '';
        const pellets        = body.pellets_rellenado || '';
        const casaLista      = body.casa_lista || '';
        const casaListaFalta = body.casa_lista_falta_texto || '';
        const motiDemora     = body.motivo_demora || '';
        const motiDetalle    = body.motivo_demora_detalle || '';
        const tareasRealizadas = body.tareas_realizadas || '';

        // Procesar pausas y calcular tiempo efectivo
        const pausas = _safeJsonArr(fila.pausas_json);
        const lastPausa = pausas[pausas.length - 1];
        if (lastPausa && !lastPausa.fin) {
            lastPausa.fin = fin_ts;
        }

        // Tiempo acumulado final
        const segFinal = fila.status === 'ABIERTO' && fila.ultimo_reanudar_ts
            ? getTiempoAcumuladoSeg(fila) + segEntre(fila.ultimo_reanudar_ts, fin_ts)
            : getTiempoActualSeg(fila);
        const tiempoEfectivo = Math.round(segFinal / 60);

        // Parsear checklist_json: puede venir como string del body
        let checklistObj = {};
        try { checklistObj = JSON.parse(checklistJson); } catch { checklistObj = {}; }

        // Parsear tareas_periodicas_json
        let tareasPeriodicasObj = [];
        try { tareasPeriodicasObj = JSON.parse(body.tareas_periodicas_json || '[]'); } catch { tareasPeriodicasObj = []; }

        // Update en Supabase (sin backup Sheets en updates)
        const { error: errUpdate } = await supabase
            .from('partes_limpieza')
            .update({
                fin_ts,
                status: 'CERRADO',
                suciedad_1a5: parseInt(suciedad) || null,
                duracion_min,
                tiempo_efectivo_min: tiempoEfectivo,
                tiempo_acumulado_seg: segFinal,
                pausas_json: pausas,
                checklist_json: checklistObj,
                resumen,
                pendiente,
                ropa_sucia_estado: ropaSucia,
                lena_rellenada: lena,
                pellets_rellenado: pellets,
                casa_lista: casaLista,
                casa_lista_falta_texto: casaListaFalta,
                motivo_demora: motiDemora,
                motivo_demora_detalle: motiDetalle,
                tareas_realizadas: tareasRealizadas,
                limpieza_profunda_texto: body.limpieza_profunda_texto || null,
                observaciones: body.observaciones || null,
                drive_folder_url: driveFolderUrl || null,
                fotos_cierre_urls_json: fotosUrls,
                coste_estimado_eur: coste ? parseFloat(coste) : null,
                ultimo_reanudar_ts: null,
                tareas_periodicas_json: tareasPeriodicasObj,
            })
            .eq('id', id);
        if (errUpdate) return next(errUpdate);

        // isLast: otros partes abiertos con el mismo cleaning_session_id
        const cleaningSID = fila.cleaning_session_id || fila.session_id;
        const { data: otrosAbiertos } = await supabase
            .from('partes_limpieza')
            .select('id')
            .eq('cleaning_session_id', cleaningSID)
            .neq('id', id)
            .is('fin_ts', null)
            .not('status', 'eq', 'ANULADO');
        const isLast = !otrosAbiertos || otrosAbiertos.length === 0;

        // Notificación Telegram (non-blocking) — leer consumibles e incidencias de Supabase
        (async () => {
            try {
                const [consResult, incsResult] = await Promise.all([
                    supabase.from('consumibles').select('*').eq('parte_id', id),
                    supabase.from('incidencias').select('*').eq('parte_id', id),
                ]);
                const consList = consResult.data || [];
                const incsList = incsResult.data || [];

                await tg.notificarParte({
                    casa,
                    tipo_limpieza: fila.tipo_limpieza,
                    usuario_nombre: user.nombre,
                    inicio_ts: fila.inicio_ts,
                    fin_ts,
                    duracion_min,
                    tiempo_efectivo_min: String(tiempoEfectivo),
                    suciedad_1a5: suciedad,
                    casa_lista: casaLista,
                    casa_lista_falta_texto: casaListaFalta,
                    tareas_realizadas: tareasRealizadas,
                    limpieza_profunda_texto: body.limpieza_profunda_texto || '',
                    observaciones: body.observaciones || '',
                    fotos_cierre_urls_json: JSON.stringify(fotosUrls),
                    checklist_json: body.checklist_json || '',
                    drive_folder_url: driveFolderUrl || '',
                    tareas_periodicas_json: body.tareas_periodicas_json || '',
                    consumibles: consList,
                    incidencias: incsList,
                });
            } catch (e) { console.error('[TG notificarParte]', e.message); }
        })();

        // ─── Tareas periódicas — sigue escribiendo en Sheets (sin cambio) ────
        (async () => {
            try {
                const tpRaw = body.tareas_periodicas_json;
                if (!tpRaw || tpRaw === '[]') return;
                const tareasSelec = JSON.parse(tpRaw);
                if (!tareasSelec.length) return;

                const tpRows = await sheets.readSheetAsObjects('TareasPeriodicas');
                const finTs = fin_ts;

                for (const t of tareasSelec) {
                    const frow = tpRows.find(r => r.id === t.task_id);

                    await sheets.appendRow('TareasPeriodicasLog', [
                        `TPL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        t.task_id,
                        id,
                        fila.session_id || '',
                        finTs,
                        fila.casa,
                        frow?.zona || '',
                        t.nombre,
                        String(t.done),
                        user.id || '',
                        user.nombre || '',
                        '',
                        finTs,
                    ]);

                    if (t.done && frow) {
                        const meses = parseInt(frow.periodicidad_meses) || 1;
                        const proxima = new Date(finTs);
                        proxima.setMonth(proxima.getMonth() + meses);
                        const headers = Object.keys(frow).filter(k => k !== '_row');
                        const updatedRow = headers.map(h => {
                            if (h === 'ultima_realizacion_ts') return finTs;
                            if (h === 'proxima_realizacion_ts') return now(proxima);
                            if (h === 'ultima_realizacion_user') return user.nombre || '';
                            if (h === 'ultima_realizacion_parte_id') return id;
                            if (h === 'updated_ts') return finTs;
                            return frow[h];
                        });
                        await sheets.updateRow('TareasPeriodicas', frow._row, updatedRow);
                    }
                }
                console.log('[TP] procesadas:', tareasSelec.length);
            } catch (e) {
                console.error('[TP] error (parte cerrado igualmente):', e.message);
            }
        })();

        res.json({ ok: true, duracion_min, coste, drive_folder_url: driveFolderUrl, isLast });
    } catch (err) { next(err); }
});

module.exports = router;
