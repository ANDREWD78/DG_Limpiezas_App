'use strict';
const router = require('express').Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const sheets = require('../services/sheets');
const { uploadPartPhoto } = require('../services/supabaseStorage');
const tg = require('../services/telegram');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Cache en memoria: pausas recientes (cubre latencia de Google Sheets) ────
// Cuando POST /pausar guarda con éxito, registra una marca aquí.
// POST /iniciar la consulta antes de rechazar con 409 Sabayés.
// Key: parteId | Value: { ts (ms), user_id, casa }
const _pausaReciente = new Map();
const PAUSA_TTL_MS = 10_000; // 10 s — más que suficiente para cualquier latencia de Sheets

// Elimina del Map todas las entradas ya caducadas.
// Se llama en cada set y en cada get para evitar acumulación de basura.
function _purgarPausas() {
    const ahora = Date.now();
    for (const [id, marca] of _pausaReciente) {
        if (ahora - marca.ts >= PAUSA_TTL_MS) _pausaReciente.delete(id);
    }
}

// Helper para el retry interno de /iniciar (absorber latencia de Sheets)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SABAYES_RETRY_DELAYS = [300, 600, 1000]; // ms — máx ~1.9s total

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

// ─── Helpers FASE 3: modelo de tiempo acumulado ──────────────────────────────

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
    let pausas = [];
    try { pausas = JSON.parse(fila.pausas_json || '[]'); } catch { /* fila corrupta — ignorar */ }
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

// Mapa una fila de PartesLimpieza al objeto parte consumido por el frontend
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

// Mapa una fila de PartesLimpieza al objeto abierto inicial (antes F3)
function _mapParteOpen(r) {
    if (!r) return null;
    const tiempoActualSeg = getTiempoActualSeg(r);
    return {
        id: r.id, session_id: r.session_id,
        casa: r.casa, tipo: r.tipo_limpieza,
        inicio_ts: r.inicio_ts, fecha: r.fecha,
        usuario_nombre: r.usuario_nombre,
        status: r.status || 'ABIERTO',
        // Tiempo efectivo trabajado (nuevo modelo)
        tiempo_actual_seg: tiempoActualSeg,
        tiempo_actual_hhmm: fmtSegCrono(tiempoActualSeg),
        tiempo_acumulado_seg: getTiempoAcumuladoSeg(r),
        ultimo_reanudar_ts: r.ultimo_reanudar_ts || '',
        // Compatibilidad legacy (consumido por código existente)
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
            fecha: today() // Fecha actual en Madrid para sincronización de "Hoy" en frontend
        });

    } catch (err) { next(err); }
});

// ─── Esquema canónico de columnas de PartesLimpieza (41 cols) ───────────────────
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

// Construye un array de 41 valores en el orden exacto de PARTE_COLS.
// Cualquier clave no presente en data queda como string vacío ''
// (excepto pausas_json que tiene default '[]').
function buildParteRow(data = {}) {
    return PARTE_COLS.map(k => {
        if (k === 'pausas_json') return data[k] ?? '[]';
        const v = data[k];
        return v == null ? '' : String(v);
    });
}

const SABAYES_CASAS = ['MIRADOR', 'CASON'];

// Un parte está "abierto" si su status es ABIERTO/PAUSADO,
// o si no tiene status y no tiene fin_ts (compatibilidad con partes históricos)
function estaAbierto(r) {
    if (r.status === 'ABIERTO' || r.status === 'PAUSADO') return true;
    if (!r.status && !r.fin_ts) return true;
    return false;
}



// ─── GET /api/partes/open — parte abierto del usuario + stale alert ───────────
router.get('/open', requireAuth, async (req, res, next) => {
    try {
        const user = req.session.user;
        const rows = await sheets.readSheetAsObjects('PartesLimpieza');

        // Criterio por status primero (Fase 4), fallback !fin_ts para partes históricos
        const abiertos = rows.filter(r =>
            (r.user_id === user.user_id || r.usuario_nombre === user.nombre) &&
            estaAbierto(r)
        );

        console.log(`\n[BACKEND /open] Petición de usuario: ${user.nombre} / ID: ${user.user_id}`);
        console.log(`[BACKEND /open] Crudos encontrados: ${abiertos.length}`);
        abiertos.forEach(a => console.log(`   -> ID: ${a.id} | Casa: ${a.casa} | Status: ${a.status || 'ABIERTO'} | Inicio: ${a.inicio_ts}`));

        if (!abiertos.length) {
            console.log(`[BACKEND /open] Devolviendo { open: false }`);
            return res.json({ open: false });
        }

        // El parte “principal”: el ABIERTO; si todos pausados, el primero
        const open = abiertos.find(r => r.status === 'ABIERTO') || abiertos[0];

        // Usar nuevo modelo de tiempo (no Date.now() - inicio_ts)
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

                const nowTs = now();
                const buildAudit = (f) => {
                    const row = buildParteRow({
                        ...f,
                        last_alert_ts_open_part: nowTs,   // actualizar timestamp de alerta
                        tiempo_acumulado_seg: f.tiempo_acumulado_seg || '0',
                    });
                    console.log('[ROW LEN buildAudit]', row.length, row.slice(-6));
                    return row;
                };
                await sheets.updateRow('PartesLimpieza', open._row, buildAudit(open));
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
            // parte{} mantiene compatibilidad con todo el código existente
            parte: {
                id: open.id, session_id: open.session_id,
                casa: open.casa, tipo: open.tipo_limpieza,
                inicio_ts: open.inicio_ts, fecha: open.fecha,
                usuario_nombre: open.usuario_nombre,
                status: open.status || 'ABIERTO',
                suciedad_1a5: open.suciedad_1a5,
            },
            // partes[] nuevo: lista completa para el modo 2 tarjetas en reanudar.js
            partes: abiertos.map(r => {
                const mapped = _mapParte(r);
                console.log(`\\n[LOG API PARTES] Parte Abierto — ID: ${mapped.id}`);
                console.log(`Casa: ${mapped.casa} | Usuario: ${r.usuario_nombre || req.session?.user?.nombre} | Status: ${mapped.status}`);
                console.log(`Inicio: ${mapped.inicio_ts} | Último reanudar: ${mapped.ultimo_reanudar_ts}`);
                console.log(`Pausas JSON: ${r.pausas_json}`);
                console.log(`Acumulado leído: ${r.tiempo_acumulado_seg || 'vacio'} -> ${mapped.tiempo_acumulado_seg}`);
                console.log(`Efectivo calculado: ${mapped.tiempo_efectivo_seg}`);
                console.log(`JSON FINAL -> { tiempo_efectivo_seg: ${mapped.tiempo_efectivo_seg}, tiempo_acumulado_seg: ${mapped.tiempo_acumulado_seg} }`);
                return mapped;
            }),
        });
    } catch (err) { next(err); }
});


// ─── GET /api/partes/active?casa=X — buscar parte concurrente para join ────────

// Devuelve cleaning_session_id del parte abierto más reciente en esa casa.
// El frontend lo usa para proponer al usuario unirse a la misma sesión.
router.get('/active', requireAuth, async (req, res, next) => {
    try {
        const { casa } = req.query;
        const rows = await sheets.readSheetAsObjects('PartesLimpieza');
        // Misma casa, abierto (sin fin_ts), iniciado en las últimas 8h
        const cutoff = now(new Date(Date.now() - 8 * 60 * 60 * 1000));
        const actives = rows.filter(r =>
            String(r.status).toUpperCase() !== 'ANULADO' &&
            r.casa === casa &&
            !r.fin_ts &&
            r.inicio_ts >= cutoff
        ).sort((a, b) => b.inicio_ts.localeCompare(a.inicio_ts)); // más reciente primero
        const active = actives[0];
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

// ─── GET /api/partes/open-by-casa — otros partes abiertos (last-person check)
router.get('/open-by-casa', requireAuth, async (req, res, next) => {
    try {
        const { casa, exclude_id, csid } = req.query;
        const rows = await sheets.readSheetAsObjects('PartesLimpieza');
        const others = rows.filter(r => {
            if (String(r.status).toUpperCase() === 'ANULADO') return false;
            if (r.casa !== casa || r.fin_ts || r.id === exclude_id) return false;
            // Si se pasa csid, filtrar solo por la misma sesión de limpieza
            if (csid) {
                return (r.cleaning_session_id === csid || r.session_id === csid);
            }
            return true;
        });

        // FASE 1: Detectar si alguien ya ha subido fotos en esta misma sesión de limpieza
        let hasPhotos = false;
        if (csid) {
            hasPhotos = rows.some(r => {
                if (String(r.status).toUpperCase() === 'ANULADO') return false;
                // Mismo csid
                if (r.cleaning_session_id !== csid && r.session_id !== csid) return false;
                // Verificar si hay fotos válidas (url de drive o array json con datos)
                const hasUrl = r.drive_folder_url && r.drive_folder_url.trim().length > 0;
                let hasJson = false;
                if (r.fotos_cierre_urls_json) {
                    try { const j = JSON.parse(r.fotos_cierre_urls_json); hasJson = Object.keys(j).length > 0; } catch {}
                }
                return hasUrl || hasJson;
            });
        }

        res.json({ count: others.length, isLast: others.length === 0, hasPhotos });
    } catch (err) { next(err); }
});


// ─── POST /api/partes/iniciar ────────────────────────────────────────────────
router.post('/iniciar', requireAuth, async (req, res, next) => {
    try {
        const { casa, tipo_limpieza, cleaning_session_id: joinCleaningSession } = req.body;
        const user = req.session.user;

        // ── Guardia: validación con reglas Sabayés ────────────────────────────
        // Status como fuente primaria; fallback !fin_ts para partes históricos
        const all = await sheets.readSheetAsObjects('PartesLimpieza');
        const abiertosUsuario = all.filter(r =>
            (r.user_id === user.user_id || r.usuario_nombre === user.nombre) &&
            estaAbierto(r)
        );

        if (abiertosUsuario.length >= 2) {
            return res.status(409).json({ error: 'Límite de partes abiertos alcanzado (máximo 2)' });
        }

        if (abiertosUsuario.length === 1) {
            const existente = abiertosUsuario[0];
            const esSabayes =
                SABAYES_CASAS.includes(existente.casa) &&
                SABAYES_CASAS.includes(casa) &&
                existente.casa !== casa;

            if (esSabayes && existente.status === 'PAUSADO') {
                // ✓ Excepción Sabayés válida: MIRADOR pausado + CASON activo (o viceversa)
                // Continuar sin bloquear
            } else if (esSabayes && (existente.status === 'ABIERTO' || !existente.status)) {
                // Comprobar cache de pausa reciente antes de rechazar con 409.
                // Sheets puede no haber propagado aún el PAUSADO escrito hace instantes.
                _purgarPausas();
                const marca = _pausaReciente.get(existente.id);
                const userId = user.user_id || user.nombre;
                const cacheHit = marca &&
                    (Date.now() - marca.ts) < PAUSA_TTL_MS &&
                    marca.user_id === userId &&
                    marca.casa === existente.casa; // validar también la casa

                if (cacheHit) {
                    // La pausa existe pero Sheets aún no la refleja — tratar como PAUSADO
                    _pausaReciente.delete(existente.id); // consumir: no reutilizable
                    console.log(`[iniciar] Sabayés cache hit: parte ${existente.id} (${existente.casa}) tratado como PAUSADO — ${Date.now() - marca.ts}ms desde la pausa`);
                    // Continuar sin 409 → crear el nuevo parte
                } else {
                    // Sin cache válido: retry interno — releer Sheets hasta 3 veces
                    // antes de rechazar. Absorbe la latencia de propagación de Sheets.
                    let resuelto = false;
                    for (const delay of SABAYES_RETRY_DELAYS) {
                        await sleep(delay);
                        const allRetry = await sheets.readSheetAsObjects('PartesLimpieza');
                        const existenteRetry = allRetry.find(r => r.id === existente.id);
                        const statusRetry = existenteRetry?.status;
                        console.log(`[iniciar] Sabayés retry ${delay}ms: parte ${existente.id} status=${statusRetry}`);
                        // Resuelto si el parte ya no está ABIERTO (o desapareció de Sheets)
                        if (!existenteRetry ||
                            statusRetry === 'PAUSADO' ||
                            statusRetry === 'CERRADO' ||
                            statusRetry === 'CERRADO_FORZADO') {
                            resuelto = true;
                            break;
                        }
                    }

                    if (!resuelto) {
                        // Todos los reintentos exhaustos: 409 real
                        return res.status(409).json({
                            error: `Pausa primero tu parte de ${existente.casa} antes de abrir ${casa}`,
                            sabayes: true,
                            parteId: existente.id,
                            open: true,
                            activo: _mapParte(existente),
                        });
                    }
                }
            } else {
                // No es excepción Sabayés — bloquear
                return res.status(409).json({
                    error: 'Ya tienes un parte abierto',
                    open: true,
                    parte: _mapParte(existente),
                });
            }
        }

        // continuar con la creación del parte

        // Resolver cleaning_session_id
        // Si el frontend pasa uno (join), verificar que existe un parte abierto con ese CSI en la misma casa.
        // Si no existe o no coincide, crear uno nuevo.
        let cleaning_session_id = null;
        if (joinCleaningSession) {
            const matchingOpen = all.find(r =>
                r.casa === casa &&
                !r.fin_ts &&
                (r.cleaning_session_id === joinCleaningSession || r.session_id === joinCleaningSession)
            );
            if (matchingOpen) {
                cleaning_session_id = matchingOpen.cleaning_session_id || matchingOpen.session_id;
            }
        }
        if (!cleaning_session_id) {
            // Sin join existente → buscar parte abierto reciente en la misma casa (últimas 8h)
            const cutoff = now(new Date(Date.now() - 8 * 60 * 60 * 1000));
            const sameSession = all.find(r =>
                r.casa === casa && !r.fin_ts && r.inicio_ts >= cutoff
            );
            if (sameSession) {
                // Hay alguien ya limpiando — mismo cleaning_session_id (join automático si el usuario eligió unirse)
                // Si el frontend no pasó joinCleaningSession es que el usuario eligió "nuevo parte" → CSI propio
                cleaning_session_id = !joinCleaningSession
                    ? uid() // nuevo CSI separado
                    : (sameSession.cleaning_session_id || sameSession.session_id);
            } else {
                cleaning_session_id = uid();
            }
        }

        const id = uid();
        const session_id = uid(); // cada parte tiene su propio session_id único
        const inicio_ts = now();

        const rowIniciar = buildParteRow({
            id,
            session_id,
            fecha: today(),
            casa,
            tipo_limpieza,
            inicio_ts,
            user_id: user.user_id || user.nombre,
            usuario_nombre: user.nombre,
            created_by: user.nombre,
            status: 'ABIERTO',
            cleaning_session_id,
            pausas_json: '[]',
            tiempo_acumulado_seg: '0',
            ultimo_reanudar_ts: inicio_ts,
        });
        console.log('[ROW LEN /iniciar]', rowIniciar.length, rowIniciar.slice(-6));
        await sheets.appendRow('PartesLimpieza', rowIniciar);

        res.json({ ok: true, id, session_id, cleaning_session_id, inicio_ts });
    } catch (err) { next(err); }
});

// ─── POST /api/partes/:id/finalizar — cerrar parte con todos los datos ────────
const fotosUpload = upload.fields([
    { name: 'fotos_cierre', maxCount: 20 },
    { name: 'fotos_antes', maxCount: 10 },
]);

router.post('/:id/finalizar', requireAuth, fotosUpload, async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.session.user;
        const body = req.body;
        const fin_ts = now();

        // Recuperar la fila para calcular duración
        const all = await sheets.readSheetAsObjects('PartesLimpieza');
        const fila = all.find(r => r.id === id);
        if (!fila) return res.status(404).json({ error: 'Parte no encontrado' });

        const duracion_min = diffMin(fila.inicio_ts, fin_ts);
        const coste = duracion_min && user.tarifa
            ? ((duracion_min / 60) * parseFloat(user.tarifa || 12)).toFixed(2)
            : '';

        // Subir fotos a Supabase Storage
        const casa = fila.casa;
        const fecha = today().split('-').reverse().join('-'); // DD-MM-YYYY
        const folderName = `${fecha}_${id}`;
        let driveFolderUrl = '';   // compatibilidad con la columna existente
        let fotosUrls = {};

        const todasLasFotos = [
            ...(req.files?.fotos_cierre || []).map(f => ({ ...f, zona: 'cierre' })),
            ...(req.files?.fotos_antes || []).map(f => ({ ...f, zona: 'antes' })),
        ];

        if (todasLasFotos.length > 0) {
            for (const f of todasLasFotos) {
                const fileName = `${Date.now()}_${f.originalname}`;
                const path = `${casa}/${folderName}/${fileName}`;

                const storedPath = await uploadPartPhoto(f.buffer, path, f.mimetype);

                const zona = f.zona || 'general';
                if (!fotosUrls[zona]) fotosUrls[zona] = [];
                fotosUrls[zona].push(storedPath);
            }
        }
        // Valores del body
        const suciedad = body.suciedad_1a5 || '';
        const checklistJson = body.checklist_json || '{}';
        const resumen = body.resumen || '';
        const pendiente = body.pendiente || '';
        const ropaSucia = body.ropa_sucia_estado || '';
        const lena = body.lena_rellenada || '';
        const pellets = body.pellets_rellenado || '';
        const casaLista = body.casa_lista || '';
        const casaListaFalta = body.casa_lista_falta_texto || '';
        const motiDemora = body.motivo_demora || '';
        const motiDetalle = body.motivo_demora_detalle || '';
        const tareasRealizadas = body.tareas_realizadas || '';

        // ── Procesar pausas y calcular tiempo efectivo ──────────────────────
        // 1. Cerrar pausa abierta si el parte se cierra mientras está PAUSADO
        // 2. Calcular tiempo efectivo usando el nuevo modelo de acumulado (Fase 3)
        const pausas = JSON.parse(fila.pausas_json || '[]');
        const lastPausa = pausas[pausas.length - 1];
        if (lastPausa && !lastPausa.fin) {
            lastPausa.fin = fin_ts; // cerrar tramo de pausa con el mismo fin_ts
        }
        const pausasJsonFinal = JSON.stringify(pausas);

        // Tiempo acumulado final: sumar tramo activo si venía ABIERTO
        const segFinal = fila.status === 'ABIERTO' && fila.ultimo_reanudar_ts
            ? getTiempoAcumuladoSeg(fila) + segEntre(fila.ultimo_reanudar_ts, fin_ts)
            : getTiempoActualSeg(fila); // PAUSADO o legacy
        const tiempoEfectivo = Math.round(segFinal / 60);


        const nuevaFila = buildParteRow({
            ...fila,
            // Sobreescribir con valores del cierre
            suciedad_1a5: suciedad,
            fin_ts,
            duracion_min: String(duracion_min),
            user_id: user.user_id || user.nombre,
            usuario_nombre: user.nombre,
            motivo_demora: motiDemora,
            motivo_demora_detalle: motiDetalle,
            checklist_json: checklistJson,
            resumen,
            pendiente,
            ropa_sucia_estado: ropaSucia,
            lena_rellenada: lena,
            pellets_rellenado: pellets,
            casa_lista: casaLista,
            casa_lista_falta_texto: casaListaFalta,
            drive_folder_url: driveFolderUrl,
            fotos_cierre_urls_json: JSON.stringify(fotosUrls),
            coste_estimado_eur: coste,
            created_by: user.nombre,
            tareas_realizadas: tareasRealizadas,
            status: 'CERRADO',
            cleaning_session_id: fila.cleaning_session_id || fila.session_id || '',
            limpieza_profunda_texto: body.limpieza_profunda_texto || '',
            tiempo_efectivo_min: String(tiempoEfectivo),
            pausas_json: pausasJsonFinal,
            observaciones: body.observaciones || '',
            tiempo_acumulado_seg: String(segFinal),
            ultimo_reanudar_ts: '',
            tareas_periodicas_json: body.tareas_periodicas_json || '',
        });
        console.log('[ROW LEN /finalizar]', nuevaFila.length, nuevaFila.slice(-6));
        await sheets.updateRow('PartesLimpieza', fila._row, nuevaFila);

        // Comprobar si es el último (server-side) con cleaning_session_id
        const cleaningSID = fila.cleaning_session_id || fila.session_id;
        const allAfter = await sheets.readSheetAsObjects('PartesLimpieza');
        const otherOpen = allAfter.filter(r =>
            r.id !== id &&
            !r.fin_ts &&
            (r.cleaning_session_id === cleaningSID || r.session_id === cleaningSID)
        );
        const isLast = otherOpen.length === 0;

        // Notificación Telegram v2 (no bloquea la respuesta)
        (async () => {
            try {
                // Leer consumibles e incidencias vinculados al parte (por parte_id)
                const [consList, incsList] = await Promise.all([
                    sheets.readSheetAsObjects('Consumibles')
                        .then(rows => rows.filter(r => r.parte_id === id))
                        .catch(() => []),
                    sheets.readSheetAsObjects('IncidenciasMantenimiento')
                        .then(rows => rows.map(r => ({ ...r, estado: r.estado === 'Abierta' ? 'Pendiente' : r.estado })).filter(r => r.parte_id === id))
                        .catch(() => []),
                ]);
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

        // ─── Tareas periódicas — try/catch: no bloquea el cierre ─────────────
        (async () => {
            try {
                const tpRaw = body.tareas_periodicas_json;
                if (!tpRaw || tpRaw === '[]') return;
                const tareasSelec = JSON.parse(tpRaw);
                if (!tareasSelec.length) return;

                const tpRows = await sheets.readSheetAsObjects('TareasPeriodicas');
                const finTs = fin_ts; // ya definido en linea 550 via now()

                for (const t of tareasSelec) {
                    const frow = tpRows.find(r => r.id === t.task_id);

                    // Log siempre (tarea mostrada, done o no)
                    await sheets.appendRow('TareasPeriodicasLog', [
                        `TPL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, // id
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
                        '', // observaciones
                        finTs,
                    ]);

                    // Actualizar TareasPeriodicas solo si done
                    if (t.done && frow) {
                        const meses = parseInt(frow.periodicidad_meses) || 1;
                        const proxima = new Date(finTs);
                        proxima.setMonth(proxima.getMonth() + meses);
                        // Reescribir fila con columnas actualizadas
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

// ─── GET /api/partes — listar (admin) ─────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
    try {
        const rows = await sheets.readSheetAsObjects('PartesLimpieza');
        const casa = req.query.casa;
        const limit = parseInt(req.query.limit) || 50;
        let filtered = rows.filter(r => String(r.status).toUpperCase() !== 'ANULADO');
        if (casa) filtered = filtered.filter(r => r.casa === casa);
        res.json(filtered.reverse().slice(0, limit).map(({ _row, ...rest }) => rest));
    } catch (err) { next(err); }
});

// ─── POST /api/partes/:id/pausar ──────────────────────────────────────────────
// Pausa un parte ABIERTO. Solo el propietario o un admin puede pausar.
// Añade {inicio: now, fin: null} a pausas_json. status → PAUSADO.
router.post('/:id/pausar', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.session.user;
        const rows = await sheets.readSheetAsObjects('PartesLimpieza');
        const fila = rows.find(r => r.id === id);

        if (!fila) return res.status(404).json({ error: 'Parte no encontrado' });
        if (fila.status !== 'ABIERTO' && fila.status) {
            return res.status(409).json({ error: `No se puede pausar un parte en estado ${fila.status}` });
        }

        // Verificar propiedad (admin puede pausar cualquier parte)
        const esAdmin = user.rol === 'admin';
        const esPropietario = fila.user_id === user.user_id || fila.usuario_nombre === user.nombre;
        if (!esAdmin && !esPropietario) {
            return res.status(403).json({ error: 'No puedes pausar el parte de otro usuario' });
        }

        // Añadir tramo de pausa abierto
        const pausas = JSON.parse(fila.pausas_json || '[]');
        const nowTs = now(); // capturar timestamp único para pausas y cols v3

        // DEBUG ── eliminar cuando el bug esté confirmado
        const acumAntes = getTiempoAcumuladoSeg(fila);
        const tramoActivo = segEntre(fila.ultimo_reanudar_ts, nowTs);
        console.log('[DEBUG /pausar]', {
            id, status: fila.status,
            tiempo_acumulado_seg_fila: fila.tiempo_acumulado_seg,
            ultimo_reanudar_ts_fila: fila.ultimo_reanudar_ts,
            nowTs,
            acumAntes,
            tramoActivo,
            nuevoAcum: acumAntes + tramoActivo,
        });
        // END DEBUG

        pausas.push({ inicio: nowTs, fin: null });

        // Construir fila actualizada (preservar todas las columnas)
        const acumPausar = getTiempoAcumuladoSeg(fila) + segEntre(fila.ultimo_reanudar_ts, nowTs);
        const filaActualizada = buildParteRow({
            ...fila,
            status: 'PAUSADO',
            cleaning_session_id: fila.cleaning_session_id || fila.session_id || '',
            pausas_json: JSON.stringify(pausas),
            tiempo_acumulado_seg: String(acumPausar),
            ultimo_reanudar_ts: '',
        });
        console.log('[ROW LEN /pausar]', filaActualizada.length, filaActualizada.slice(-6));

        await sheets.updateRow('PartesLimpieza', fila._row, filaActualizada);

        // Registrar marca de pausa reciente para cubrir latencia de Sheets en POST /iniciar
        _purgarPausas();
        _pausaReciente.set(id, {
            ts: Date.now(),
            user_id: user.user_id || user.nombre,
            casa: fila.casa,
        });
        console.log(`[pausar] marca reciente registrada para parte ${id} (${fila.casa}) — TTL ${PAUSA_TTL_MS}ms`);

        res.json({ ok: true, status: 'PAUSADO', pausas_json: JSON.stringify(pausas) });
    } catch (err) { next(err); }
});

// ─── POST /api/partes/:id/reanudar ────────────────────────────────────────────
// Reanuda un parte PAUSADO. Solo el propietario o un admin puede reanudar.
// Cierra el último tramo de pausa (fin = now). status → ABIERTO.
// Bloquea si el usuario ya tiene otro ACTIVO que no sea el caso Sabayés.
router.post('/:id/reanudar', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.session.user;
        const rows = await sheets.readSheetAsObjects('PartesLimpieza');
        const fila = rows.find(r => r.id === id);

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

        // Verificar que el usuario no tiene ya otro ACTIVO (fuera del Sabayés controlado)
        const otrosActivos = rows.filter(r =>
            r.id !== id &&
            (r.user_id === user.user_id || r.usuario_nombre === user.nombre) &&
            r.status === 'ABIERTO'
        );
        // Auto-pausar cualquier otro parte ABIERTO del mismo usuario (excepción Sabayés)
        const autoPausados = [];
        for (const otro of otrosActivos) {
            let pausasOtro = [];
            try { pausasOtro = JSON.parse(otro.pausas_json || '[]'); } catch { /* ignore */ }
            // Capturar el timestamp único para esta auto-pausa
            const pausaNowTs = now();
            // Abrir un tramo de pausa si el último está abierto o no hay ninguno
            const lastPausaOtro = pausasOtro[pausasOtro.length - 1];
            if (!lastPausaOtro || lastPausaOtro.fin) {
                pausasOtro.push({ inicio: pausaNowTs, fin: null });
            }
            // Calcular acumulado correcto: sumar tramo desde ultimo_reanudar_ts hasta ahora
            const otroAcumulado = getTiempoAcumuladoSeg(otro) + segEntre(otro.ultimo_reanudar_ts, pausaNowTs);
            const filaOtro = buildParteRow({
                ...otro,
                status: 'PAUSADO',
                cleaning_session_id: otro.cleaning_session_id || otro.session_id || '',
                pausas_json: JSON.stringify(pausasOtro),
                tiempo_acumulado_seg: String(otroAcumulado),
                ultimo_reanudar_ts: '',
            });
            console.log('[ROW LEN /reanudar auto-pausa]', filaOtro.length, filaOtro.slice(-6));
            await sheets.updateRow('PartesLimpieza', otro._row, filaOtro);
            autoPausados.push(otro.id);
        }

        // Cerrar el último tramo de pausa abierto con el mismo timestamp que se usará
        // como ultimo_reanudar_ts para mantener coherencia
        const reanudarNowTs = now();
        const pausas = JSON.parse(fila.pausas_json || '[]');
        const lastPausa = pausas[pausas.length - 1];
        if (lastPausa && !lastPausa.fin) {
            lastPausa.fin = reanudarNowTs;
        }

        const filaActualizada = buildParteRow({
            ...fila,
            status: 'ABIERTO',
            cleaning_session_id: fila.cleaning_session_id || fila.session_id || '',
            pausas_json: JSON.stringify(pausas),
            tiempo_acumulado_seg: String(getTiempoAcumuladoSeg(fila)),
            ultimo_reanudar_ts: reanudarNowTs,
        });
        console.log('[ROW LEN /reanudar]', filaActualizada.length, filaActualizada.slice(-6));
        await sheets.updateRow('PartesLimpieza', fila._row, filaActualizada);
        res.json({ ok: true, status: 'ABIERTO', pausas_json: JSON.stringify(pausas), auto_pausados: autoPausados });
    } catch (err) { next(err); }
});

module.exports = router;

