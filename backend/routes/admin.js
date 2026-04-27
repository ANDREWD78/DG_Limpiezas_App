'use strict';
const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const sheets = require('../services/sheets');
const tg = require('../services/telegram');
const syncGratal = require('../jobs/syncGratal');
const { now, today, getMadridParts } = require('../services/time');

const { createClient } = require('@supabase/supabase-js');
const supabase = (() => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { console.error('[ADMIN] Supabase no configurado'); return null; }
    return createClient(url, key, { auth: { persistSession: false } });
})();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function _safeJsonArr(v) {
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v || '[]'); } catch { return []; }
}
function nextMonthStart(mes) {
    const [y, m] = mes.split('-').map(Number);
    const nm = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    return `${nm}-01`;
}

function diffMin(ts1, ts2) {
    const ms = (ts2 ? new Date(ts2) : new Date()) - new Date(ts1);
    return Math.max(0, Math.round(ms / 60000));
}
function calcCoste(durMin, tarifa = 12) { return ((durMin / 60) * tarifa).toFixed(2); }

// ── Helpers de tiempo (espejo de partes.js, sin cross-import) ─────────────────────
function segEntre(ts1, ts2) {
    if (!ts1 || !ts2) return 0;
    return Math.max(0, Math.round((new Date(ts2) - new Date(ts1)) / 1000));
}
function getTiempoAcumuladoSeg(fila) {
    const raw = parseFloat(fila.tiempo_acumulado_seg);
    return isNaN(raw) ? 0 : raw;
}

function getTiempoLegacySegAdmin(fila) {
    if (!fila.inicio_ts) return 0;
    const fin = fila.fin_ts || now();
    let totalSeg = segEntre(fila.inicio_ts, fin);
    const pausas = _safeJsonArr(fila.pausas_json);
    for (const p of pausas) {
        const pFin = p.fin || fin;
        totalSeg -= segEntre(p.inicio, pFin);
    }
    return Math.max(0, totalSeg);
}

function getTiempoActualSegAdmin(fila) {
    const status = fila.status || 'ABIERTO';
    const acumulado = getTiempoAcumuladoSeg(fila);
    const tieneNuevosFields = fila.tiempo_acumulado_seg !== '' && fila.tiempo_acumulado_seg != null;

    if (!tieneNuevosFields) return getTiempoLegacySegAdmin(fila);

    if (status === 'ABIERTO' && fila.ultimo_reanudar_ts) {
        return acumulado + segEntre(fila.ultimo_reanudar_ts, now());
    }
    return acumulado; // PAUSADO, CERRADO, o sin ultimo_reanudar_ts
}

// ── PARTE_COLS (42 cols) — espejo exacto de partes.js ─────────────────────────
const PARTE_COLS_ADMIN = [
    'id', 'session_id', 'fecha', 'casa', 'tipo_limpieza', 'suciedad_1a5',
    'inicio_ts', 'fin_ts', 'duracion_min', 'user_id', 'usuario_nombre',
    'motivo_demora', 'motivo_demora_detalle', 'checklist_json', 'resumen', 'pendiente',
    'ropa_sucia_estado', 'lena_rellenada', 'pellets_rellenado',
    'casa_lista', 'casa_lista_falta_texto', 'drive_folder_url', 'fotos_cierre_urls_json',
    'coste_estimado_eur', 'created_by', 'tareas_realizadas',
    'status', 'cleaning_session_id', 'last_alert_ts_open_part',
    'admin_editado', 'admin_editado_por', 'admin_editado_ts', 'admin_edit_motivo',
    'inicio_ts_original', 'fin_ts_original',
    'limpieza_profunda_texto', 'tiempo_efectivo_min', 'pausas_json', 'observaciones',
    'tiempo_acumulado_seg', 'ultimo_reanudar_ts', 'tareas_periodicas_json',
];
function buildParteRow(data = {}) {
    return PARTE_COLS_ADMIN.map(k => {
        if (k === 'pausas_json') return data[k] ?? '[]';
        const v = data[k];
        return v == null ? '' : String(v);
    });
}

/**
 * Convierte fecha y hora local del formulario (HH:mm) a un ISO robusto con offset de Madrid.
 * Evalúa si corresponde +01:00 o +02:00 para esa fecha específica.
 */
function formToMadridISO(fecha, hora) {
    // Probamos con los dos offsets posibles en España
    for (const offset of ['+01:00', '+02:00']) {
        const iso = `${fecha}T${hora}:00${offset}`;
        const parts = getMadridParts(new Date(iso));
        // Si la hora resultante en Madrid coincide con la del formulario, es el offset correcto
        if (`${parts.H}:${parts.M}` === hora) return iso;
    }
    // Fallback: usar el helper now() que calcula el offset dinámicamente
    return now(new Date(`${fecha}T${hora}:00`));
}

// Calcula tiempo efectivo respetando pausas_json registradas.
// Si el parte estaba ABIERTO, suma el tramo activo hasta finTs.
// Si estaba PAUSADO, usa el acumulado congelado.
function calcTiempoEfectivo(fila, finTs) {
    const pausas = _safeJsonArr(fila.pausas_json);
    const last = pausas[pausas.length - 1];
    if (last && !last.fin) last.fin = finTs;
    const acum = getTiempoAcumuladoSeg(fila);
    const status = fila.status || 'ABIERTO';
    let segFinal;
    if (status === 'ABIERTO' && fila.ultimo_reanudar_ts) {
        segFinal = acum + segEntre(fila.ultimo_reanudar_ts, finTs);
    } else {
        segFinal = acum || 0;
    }
    return {
        tiempoEfectivoMin: Math.max(0, Math.round(segFinal / 60)),
        tiempoAcumuladoSeg: Math.max(0, Math.round(segFinal)),
        pausasJsonFinal: JSON.stringify(pausas),
    };
}

function getLunesDomingo() {
    const hoy = new Date();
    const diasDesdeLunes = (hoy.getDay() + 6) % 7;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diasDesdeLunes);
    lunes.setHours(0, 0, 0, 0);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);
    return { lunesTs: now(lunes), domingoTs: now(domingo) };
}

// ─── Upsert ResumenCostesMensual ──────────────────────────────────────────────
async function upsertResumenMensual(mesStr, partesTodos) {
    try {
        const CABECERAS = ['mes', 'casa', 'partes', 'total_min', 'total_horas',
            'coste_total', 'coste_medio_parte', 'coste_medio_dia'];
        await sheets.ensureSheetHeaders('ResumenCostesMensual', CABECERAS);

        const partesMes = partesTodos.filter(p => p.fecha?.startsWith(mesStr) && p.fin_ts);
        const rows = await sheets.readSheetAsObjects('ResumenCostesMensual');
        const CASAS_TOTAL = ['MIRADOR', 'CASON', 'GRATAL', 'TOTAL'];

        for (const casa of CASAS_TOTAL) {
            const subset = casa === 'TOTAL' ? partesMes : partesMes.filter(p => p.casa === casa);
            const numPartes = subset.length;
            const total_min = subset.reduce((s, p) => s + parseInt(p.duracion_min || 0), 0);
            const total_horas = (total_min / 60).toFixed(2);
            const coste_total = subset.reduce((s, p) => s + parseFloat(p.coste_estimado_eur || 0), 0).toFixed(2);
            const coste_medio_parte = numPartes ? (parseFloat(coste_total) / numPartes).toFixed(2) : '0.00';
            const diasUnicos = new Set(subset.map(p => p.fecha)).size;
            const coste_medio_dia = diasUnicos ? (parseFloat(coste_total) / diasUnicos).toFixed(2) : '0.00';

            const newRow = [mesStr, casa, numPartes, total_min, total_horas,
                coste_total, coste_medio_parte, coste_medio_dia];
            const existing = rows.find(r => r.mes === mesStr && r.casa === casa);

            if (existing) {
                await sheets.updateRow('ResumenCostesMensual', existing._row, newRow);
            } else {
                await sheets.appendRow('ResumenCostesMensual', newRow);
            }
        }
    } catch (e) {
        console.error('[ResumenMensual] Error al actualizar hoja:', e.message);
    }
}
// ─── GET /api/admin/init-sheets — inicializar cabeceras en Sheets ─────────────
router.get('/init-sheets', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const PARTE_HEADERS = [
            // Cols 1-9
            'id', 'session_id', 'fecha', 'casa', 'tipo_limpieza',
            'suciedad_1a5', 'inicio_ts', 'fin_ts', 'duracion_min',
            // Cols 10-16
            'user_id', 'usuario_nombre',
            'motivo_demora', 'motivo_demora_detalle',
            'checklist_json', 'resumen', 'pendiente',
            // Cols 17-25
            'ropa_sucia_estado', 'lena_rellenada', 'pellets_rellenado',
            'casa_lista', 'casa_lista_falta_texto',
            'drive_folder_url', 'fotos_cierre_urls_json',
            'coste_estimado_eur', 'created_by',
            // Cols 26-29
            'tareas_realizadas', 'status', 'cleaning_session_id',
            'last_alert_ts_open_part',
            // Cols 30-35: auditoría admin
            'admin_editado', 'admin_editado_por', 'admin_editado_ts',
            'admin_edit_motivo', 'inicio_ts_original', 'fin_ts_original',
            // Cols 36-39: v2
            'limpieza_profunda_texto', 'tiempo_efectivo_min',
            'pausas_json', 'observaciones',
            // Cols 40-42: v3 (tiempo acumulado, pausas granulares)
            'tiempo_acumulado_seg', 'ultimo_reanudar_ts', 'tareas_periodicas_json',
        ];

        const LP_HEADERS = [
            'tarea_id', 'casa', 'zona', 'descripcion', 'cadencia_dias',
            'ultima_fecha', 'proxima_fecha', 'estado',
            'ultimo_parte_id_realizado', 'creado_por', 'notas',
        ];

        const results = {};

        // PartesLimpieza — siempre existe
        try {
            await sheets.ensureSheetHeaders('PartesLimpieza', PARTE_HEADERS);
            results.PartesLimpieza = 'ok';
        } catch (e) {
            results.PartesLimpieza = 'error: ' + e.message;
        }

        // LimpiezasProfundasPendientes — solo si la pestaña ya existe en el Sheet
        try {
            await sheets.ensureSheetHeaders('LimpiezasProfundasPendientes', LP_HEADERS);
            results.LimpiezasProfundasPendientes = 'ok';
        } catch (e) {
            results.LimpiezasProfundasPendientes = 'error (¿pestaña creada en Sheets?): ' + e.message;
        }

        res.json({ ok: true, results });
    } catch (err) { next(err); }
});

const { getReservasFusionadas } = require('../services/reservas');

// ... [existing imports]
// ─── GET /api/admin/dashboard ─────────────────────────────────────────────────
router.get('/dashboard', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const hoy = today();
        const mesActual = hoy.slice(0, 7);
        const { lunesTs, domingoTs } = getLunesDomingo();

        const reqs = [
            sheets.readSheetAsObjects('PartesLimpieza'),
            sheets.readSheetAsObjects('IncidenciasMantenimiento'),
            sheets.readSheetAsObjects('Consumibles'),
            sheets.readConfig(),
            getReservasFusionadas()
        ];
        let [partes, incidencias, consumibles, cfg, reservasContexto] = await Promise.all(reqs);

        // Exclusión maestra de partes ANULADOS
        partes = partes.filter(p => String(p.status).toUpperCase() !== 'ANULADO');

        const limiteFuturo = new Date();
        limiteFuturo.setDate(limiteFuturo.getDate() + 7);
        const fechaLimite = today(limiteFuturo);
        
        const proxEntradas = reservasContexto
            .filter(r => r.fecha_entrada >= hoy && r.fecha_entrada <= fechaLimite && !String(r.estado_reserva || '').toLowerCase().includes('cancel'))
            .sort((a,b) => a.fecha_entrada.localeCompare(b.fecha_entrada));
            
        const proxSalidas = reservasContexto
            .filter(r => r.fecha_salida >= hoy && r.fecha_salida <= fechaLimite && !String(r.estado_reserva || '').toLowerCase().includes('cancel'))
            .sort((a,b) => a.fecha_salida.localeCompare(b.fecha_salida));

        // Rango ampliado explicitamente de -1 a +10 meses (12 meses visuales en total)
        const hoyMesActual = new Date();
        // Empezamos desde el inicio del mes actual MENOS 1 mes
        hoyMesActual.setDate(1); 
        hoyMesActual.setMonth(hoyMesActual.getMonth() - 1);
        
        const calcLimiteCalendario = new Date(hoyMesActual);
        // Desplazamos 12 meses hacia el futuro desde el mes -1 (= +11 en crudo).
        // Al hacer setDate(0), retrocede al último día del mes inmediatamente anterior (= +10).
        calcLimiteCalendario.setMonth(calcLimiteCalendario.getMonth() + 12);
        calcLimiteCalendario.setDate(0); // Último día del mes tope final (+10)

        const fechaIniCalendario = today(hoyMesActual);
        const fechaFinCalendario = today(calcLimiteCalendario);

        const reservasCalendario = reservasContexto
            .filter(r => {
                if (String(r.estado_reserva || '').toLowerCase().includes('cancel')) return false;
                // Si la reserva se sobrelapa con [fechaIniCalendario, fechaFinCalendario]
                return (r.fecha_entrada <= fechaFinCalendario && r.fecha_salida >= fechaIniCalendario);
            });

        // ─── Cálculos Dashboard ────────────────────────────────────────────────────────
        const hoyPartes = partes.filter(p => p.fecha === hoy);
        const partesAbiertos = partes
            .filter(p => !p.fin_ts && p.inicio_ts)
            .map(p => {
                const { _row, ...safe } = p;
                safe.duracion_actual_min = diffMin(p.inicio_ts, null);
                return safe;
            });

        const partesCerrados = partes.filter(p => p.fin_ts);
        const sumaT = partesCerrados.reduce((acc, p) => acc + parseInt(p.duracion_min || 0), 0);
        const tiempoMedio = partesCerrados.length ? Math.round(sumaT / partesCerrados.length) : 0;

        const costeSemana = partes.filter(p => p.fecha >= lunesTs.slice(0, 10) && p.fecha <= domingoTs.slice(0, 10))
            .reduce((s, p) => s + parseFloat(p.coste_estimado_eur || 0), 0).toFixed(2);
            
        const partesMes = partes.filter(p => p.fecha?.startsWith(mesActual));
        const costeMes = partesMes.reduce((s, p) => s + parseFloat(p.coste_estimado_eur || 0), 0).toFixed(2);
        
        const costeHoy = hoyPartes.reduce((s, p) => s + parseFloat(p.coste_estimado_eur || 0), 0).toFixed(2);
        
        const partesAnyo = partes.filter(p => p.fecha && p.fecha.startsWith(hoy.slice(0, 4)));
        const costeAnyo = partesAnyo.reduce((s, p) => s + parseFloat(p.coste_estimado_eur || 0), 0).toFixed(2);
        
        const medioPorParte = partesCerrados.length ? (partesCerrados.reduce((s, p) => s + parseFloat(p.coste_estimado_eur || 0), 0) / partesCerrados.length).toFixed(2) : '0.00';
        
        const totalHorasMes = (partesMes.reduce((s, p) => s + parseInt(p.duracion_min || 0), 0) / 60).toFixed(1);

        const incNoResueltas = incidencias.filter(i => i.estado !== 'Resuelta');
        const incUrgentesDetalle = incNoResueltas.filter(i => i.prioridad === 'Urgente');
        const consPendientes = consumibles.filter(c => c.estado === 'Pendiente');
        const consUrgentesDetalle = consPendientes.filter(c => c.urgencia === 'Urgente');
        
        const incidenciasRecientes = incidencias.filter(i => i.estado !== 'Resuelta').slice(-5).reverse();

        const limitFDT = new Date();
        limitFDT.setHours(limitFDT.getHours() - 3);
        const fueraDetiempo = partesAbiertos.filter(p => new Date(p.inicio_ts) < limitFDT);

        // Agrupación por casa
        const casas = ['MIRADOR', 'CASON', 'GRATAL'];
        const porCasa = casas.map(c => ({
            casa: c,
            incPendientes: incNoResueltas.filter(i => i.casa === c).length,
            incUrgentes: incNoResueltas.filter(i => i.casa === c && i.prioridad === 'Urgente').length,
            consPendientes: consPendientes.filter(x => x.casa === c).length,
        }));

        const costePorCasa = {};
        const ultimosPartesPorCasa = {};
        casas.forEach(c => {
            const pMesC = partes.filter(p => p.casa === c && p.fecha?.startsWith(mesActual));
            const pSemC = partes.filter(p => p.casa === c && p.fecha >= lunesTs.slice(0, 10) && p.fecha <= domingoTs.slice(0, 10));
            costePorCasa[c] = {
                mesEur: pMesC.reduce((s, p) => s + parseFloat(p.coste_estimado_eur || 0), 0).toFixed(2),
                semanaEur: pSemC.reduce((s, p) => s + parseFloat(p.coste_estimado_eur || 0), 0).toFixed(2),
                anyoEur: partesAnyo.filter(p => p.casa === c).reduce((s, p) => s + parseFloat(p.coste_estimado_eur || 0), 0).toFixed(2)
            };
            
            ultimosPartesPorCasa[c] = partes.filter(p => p.casa === c).reverse().slice(0, 30).map(({ _row, ...r }) => r);
        });

        const normalizeTime = (t, defaultTime) => {
            if (!t || typeof t !== 'string' || !t.trim()) return defaultTime;
            const cleaned = t.trim().substring(0, 5); // Take "HH:MM"
            return /^\d{2}:\d{2}$/.test(cleaned) ? cleaned : defaultTime;
        };

        const ultimaSalidaPorCasa = {};
        casas.forEach(c => {
             const pasadas = reservasContexto.filter(r => r.casa === c && r.fecha_salida <= hoy && !String(r.estado_reserva || '').toLowerCase().includes('cancel'));
             pasadas.sort((a,b) => {
                 const tA = normalizeTime(a.hora_salida, '11:00');
                 const tB = normalizeTime(b.hora_salida, '11:00');
                 return (`${b.fecha_salida}T${tB}`).localeCompare(`${a.fecha_salida}T${tA}`);
             });
             const max = pasadas[0];
             ultimaSalidaPorCasa[c] = max ? `${max.fecha_salida}T${normalizeTime(max.hora_salida, '11:00')}:00` : null;
        });

        // ─── Cálculos Económicos Dashboard ──────────────────────────────────────────────
        const resReales = reservasContexto.filter(r => {
            const st = String(r.estado_reserva || '').toLowerCase();
            if (st.includes('cancel') || st.includes('anul')) return false;
            if (r.estado_reserva === 'BLOCKED' || r.origen === 'MANUAL_BLOCK') return false;
            return true;
        });

        const economiaCompleta = { meses: {}, anos: {} };

        resReales.forEach(r => {
            if (!r.fecha_entrada) return;
            const mes = r.fecha_entrada.slice(0, 7);
            const ano = r.fecha_entrada.slice(0, 4);
            const bruto = parseFloat(r.importe_total || 0);
            const comision = parseFloat(r.comision_total || 0);
            const neto = parseFloat(r.importe_neto || 0);
            const c = r.casa;

            const initCasas = () => ({
                MIRADOR: {bruto:0, comision:0, neto:0},
                CASON: {bruto:0, comision:0, neto:0},
                GRATAL: {bruto:0, comision:0, neto:0}
            });

            if(!economiaCompleta.meses[mes]) economiaCompleta.meses[mes] = { bruto: 0, comision: 0, neto: 0, porCasa: initCasas() };
            economiaCompleta.meses[mes].bruto += bruto;
            economiaCompleta.meses[mes].comision += comision;
            economiaCompleta.meses[mes].neto += neto;
            if(c && economiaCompleta.meses[mes].porCasa[c]) {
                economiaCompleta.meses[mes].porCasa[c].bruto += bruto;
                economiaCompleta.meses[mes].porCasa[c].comision += comision;
                economiaCompleta.meses[mes].porCasa[c].neto += neto;
            }

            if(!economiaCompleta.anos[ano]) economiaCompleta.anos[ano] = { bruto: 0, comision: 0, neto: 0, porCasa: initCasas() };
            economiaCompleta.anos[ano].bruto += bruto;
            economiaCompleta.anos[ano].comision += comision;
            economiaCompleta.anos[ano].neto += neto;
            if(c && economiaCompleta.anos[ano].porCasa[c]) {
                economiaCompleta.anos[ano].porCasa[c].bruto += bruto;
                economiaCompleta.anos[ano].porCasa[c].comision += comision;
                economiaCompleta.anos[ano].porCasa[c].neto += neto;
            }
        });

        // Standalone Neto prox 30d
        const limit30d = new Date();
        limit30d.setDate(limit30d.getDate() + 30);
        const limit30dStr = today(limit30d);
        const res30d = resReales.filter(r => r.fecha_entrada >= hoy && r.fecha_entrada <= limit30dStr);
        const neto30d = res30d.reduce((s, r) => s + parseFloat(r.importe_neto || 0), 0);

        // ── Upsert ResumenCostesMensual (asíncrono, no bloquea respuesta) ──────
        upsertResumenMensual(mesActual, partes).catch(() => { });

        res.json({
            fecha: hoy,
            totalPartesHoy: hoyPartes.length,
            tiempoMedioMin: tiempoMedio,
            costeDiaEur: costeHoy,
            incPendientes: incNoResueltas.length,
            incUrgentes: incUrgentesDetalle.length,
            consPendientes: consPendientes.length,
            // Fases nuevas
            incUrgentesDetalle,
            consUrgentesDetalle,
            fueraDetiempo,
            porCasa,
            costes: {
                hoyEur: costeHoy,
                semanaEur: costeSemana,
                mesEur: costeMes,
                anyoEur: costeAnyo,
                medioPorParteEur: medioPorParte,
                totalHorasMes,
                porCasa: costePorCasa,
            },
            ultimosPartes: hoyPartes.slice().reverse().slice(0, 5).map(({ _row, ...r }) => r),
            partesAbiertos,
            incidenciasRecientes,
            proxEntradas,
            proxSalidas,
            reservasCalendario,
            // Datos directos para Ficha de Casa V1
            incidenciasAbiertas: incNoResueltas,
            consumiblesPendientes: consPendientes,
            ultimosPartesPorCasa,
            ultimaSalidaPorCasa,
            economiaCompleta,
            neto30d
        });
    } catch (err) { next(err); }
});

// ─── GET /api/admin/usuarios ──────────────────────────────────────────────────
router.get('/usuarios', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const rows = await sheets.readSheetAsObjects('Usuarios');
        res.json(rows.map(({ _row, pin_hash, ...r }) => r));
    } catch (err) { next(err); }
});

// ─── POST /api/admin/usuarios (Crear Usuario) ─────────────────────────────────
router.post('/usuarios', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { nombre, apellidos, telefono, email, pin, rol, activo, tarifa_eur_hora } = req.body;

        if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
        if (!telefono?.trim() || !email?.trim()) return res.status(400).json({ error: 'Debes proporcionar tanto un teléfono como un email' });
        
        const pinClean = String(pin || '').trim();
        if (!pinClean || !/^\d{4}$/.test(pinClean)) return res.status(400).json({ error: 'El PIN debe ser exactamente 4 cifras' });

        const rows = await sheets.readSheetAsObjects('Usuarios');
        
        // Anti-duplicidad de PIN
        if (rows.some(u => String(u.pin_hash) === pinClean)) {
            return res.status(409).json({ error: 'Este PIN ya está en uso por otro empleado. Por favor, elige otro.' });
        }

        const nowTs = now();
        let tarifaNormalizada = '';
        if (tarifa_eur_hora?.trim()) {
            const val = parseFloat(tarifa_eur_hora.replace(',', '.'));
            tarifaNormalizada = isNaN(val) ? '' : String(val);
        }

        const newId = `USER-${Date.now()}`;

        const nuevoUsuario = {
            user_id: newId,
            nombre: nombre.trim(),
            apellidos: apellidos?.trim() || '',
            telefono: telefono?.trim() || '',
            email: email?.trim() || '',
            pin_hash: pinClean,
            rol: rol || 'limpieza',
            activo: activo || 'Sí',
            tarifa_eur_hora: tarifaNormalizada,
            created_ts: nowTs,
            updated_ts: nowTs,
            origen_alta: 'admin'
        };

        await sheets.appendRowAsObject('Usuarios', nuevoUsuario);
        res.status(201).json({ ok: true, id: newId });
    } catch (err) { next(err); }
});

// ─── PUT /api/admin/usuarios/:id (Editar Usuario) ─────────────────────────────
router.put('/usuarios/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nombre, apellidos, telefono, email, rol, activo, tarifa_eur_hora } = req.body;

        if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
        if (!telefono?.trim() || !email?.trim()) return res.status(400).json({ error: 'Debes proporcionar tanto un teléfono como un email' });

        const rows = await sheets.readSheetAsObjects('Usuarios');
        const fila = rows.find(r => r.user_id === id);
        
        if (!fila) return res.status(404).json({ error: 'Usuario no encontrado' });

        let tarifaNormalizada = fila.tarifa_eur_hora || '';
        if (tarifa_eur_hora !== undefined) {
             if (tarifa_eur_hora.trim() === '') {
                 tarifaNormalizada = '';
             } else {
                 const val = parseFloat(tarifa_eur_hora.replace(',', '.'));
                 tarifaNormalizada = isNaN(val) ? fila.tarifa_eur_hora : String(val);
             }
        }

        const updatedUser = {
            ...fila,
            nombre: nombre.trim(),
            apellidos: apellidos !== undefined ? apellidos.trim() : fila.apellidos,
            telefono: telefono !== undefined ? telefono.trim() : fila.telefono,
            email: email !== undefined ? email.trim() : fila.email,
            rol: rol || fila.rol || 'limpieza',
            activo: activo || fila.activo || 'Sí',
            tarifa_eur_hora: tarifaNormalizada,
            updated_ts: now()
        };

        await sheets.updateRowAsObject('Usuarios', fila._row, updatedUser);
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// ─── PATCH /api/admin/usuarios/:id/pin (Cambio de PIN manual) ──────────────────
router.patch('/usuarios/:id/pin', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { pin } = req.body;

        const pinClean = String(pin || '').trim();
        if (!pinClean || !/^\d{4}$/.test(pinClean)) return res.status(400).json({ error: 'El PIN debe ser exactamente 4 cifras' });

        const rows = await sheets.readSheetAsObjects('Usuarios');
        const fila = rows.find(r => r.user_id === id);
        if (!fila) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Anti-duplicidad de PIN
        if (rows.some(u => String(u.pin_hash) === pinClean && u.user_id !== id)) {
            return res.status(409).json({ error: 'Este PIN ya está en uso por otro empleado. Por favor, elige otro.' });
        }

        const updatedUser = {
            ...fila,
            pin_hash: pinClean,
            updated_ts: now()
        };

        await sheets.updateRowAsObject('Usuarios', fila._row, updatedUser);
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// ─── GET /api/admin/resumen-mensual ──────────────────────────────────────────
router.get('/resumen-mensual', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const mes = req.query.mes || today().slice(0, 7);

        const { data, error } = await supabase
            .from('partes_limpieza')
            .select('user_id, usuario_nombre, fecha, duracion_min, coste_estimado_eur, status')
            .neq('status', 'ANULADO')
            .gte('fecha', `${mes}-01`)
            .lt('fecha', nextMonthStart(mes));
        if (error) return next(error);

        const resumen = {};
        (data || []).forEach(p => {
            const k = p.user_id || p.usuario_nombre;
            if (!resumen[k]) resumen[k] = { nombre: p.usuario_nombre, minutos: 0, coste: 0 };
            resumen[k].minutos += parseInt(p.duracion_min || 0);
            resumen[k].coste += parseFloat(p.coste_estimado_eur || 0);
        });

        const lista = Object.values(resumen).map(r => ({
            ...r, horas: (r.minutos / 60).toFixed(1), coste: r.coste.toFixed(2),
        }));
        res.json({ mes, empleadas: lista });
    } catch (err) { next(err); }
});



// ─── GET /api/admin/partes-abiertos ─────────────────────────────────────────
router.get('/partes-abiertos', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const { data, error } = await supabase
            .from('partes_limpieza')
            .select('*')
            .is('fin_ts', null)
            .neq('status', 'ANULADO')
            .order('inicio_ts', { ascending: false });
        if (error) return next(error);
        const abiertos = (data || [])
            .filter(r => r.inicio_ts)
            .map(r => ({
                ...r,
                duracion_actual_min: diffMin(r.inicio_ts, null),
                tiempo_efectivo_seg: getTiempoActualSegAdmin(r),
                tiempo_acumulado_seg: getTiempoAcumuladoSeg(r),
            }));
        res.json(abiertos);
    } catch (err) { next(err); }
});

// ─── POST /api/admin/partes/:id/cerrar — cierre forzado con auditoría ────────
// Cierra un parte abierto respetando sus pausas previas.
// Calcula tiempo_efectivo sumando sesiones reales, NO con diffMin bruto.
router.post('/partes/:id/cerrar', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { fin_ts: finCustom, motivo } = req.body;
        const admin = req.session.user;

        if (!motivo?.trim()) return res.status(400).json({ error: 'El motivo es obligatorio' });
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });

        const { data: fila, error: selErr } = await supabase
            .from('partes_limpieza').select('*').eq('id', id).single();
        if (selErr || !fila) return res.status(404).json({ error: 'Parte no encontrado' });
        if (fila.fin_ts) return res.status(409).json({ error: 'Parte ya cerrado' });

        const nowTs = now();
        const finFinal = finCustom || nowTs;

        // Validar que fin sea posterior al inicio
        if (new Date(finFinal) <= new Date(fila.inicio_ts))
            return res.status(400).json({ error: 'La hora de fin debe ser posterior al inicio del parte' });
        if (new Date(finFinal) > new Date(nowTs))
            return res.status(400).json({ error: 'La hora de fin no puede ser en el futuro' });

        // Calcular tiempo efectivo respetando pausas registradas
        const { tiempoEfectivoMin, tiempoAcumuladoSeg, pausasJsonFinal } = calcTiempoEfectivo(fila, finFinal);
        const durMin = diffMin(fila.inicio_ts, finFinal);
        const coste = calcCoste(tiempoEfectivoMin);

        const { error: updErr } = await supabase.from('partes_limpieza').update({
            fin_ts: finFinal,
            duracion_min: durMin,
            coste_estimado_eur: parseFloat(coste),
            resumen: fila.resumen || 'Cerrado manualmente por admin',
            pausas_json: _safeJsonArr(pausasJsonFinal),
            tiempo_efectivo_min: tiempoEfectivoMin,
            tiempo_acumulado_seg: tiempoAcumuladoSeg,
            ultimo_reanudar_ts: null,
            status: 'CERRADO_FORZADO',
            admin_editado: true,
            admin_editado_por: admin.user_id || admin.nombre,
            admin_editado_ts: nowTs,
            admin_edit_motivo: motivo.trim(),
            inicio_ts_original: fila.inicio_ts_original || fila.inicio_ts,
            fin_ts_original: fila.fin_ts_original || null,
        }).eq('id', id);
        if (updErr) return next(updErr);

        tg.enviarMensaje(
            `🔴 Parte cerrado por admin\n` +
            `— Usuario: ${fila.usuario_nombre}\n` +
            `— Casa: ${fila.casa} · ${fila.tipo_limpieza}\n` +
            `— Inicio: ${fila.inicio_ts}\n` +
            `— Fin fijado: ${finFinal}\n` +
            `— Tiempo efectivo: ${tiempoEfectivoMin}min (respetando pausas)\n` +
            `— Admin: ${admin.nombre}\n` +
            `— Motivo: ${motivo.trim()}`
        ).catch(() => { });

        res.json({ ok: true, fin_ts: finFinal, duracion_min: durMin, tiempo_efectivo_min: tiempoEfectivoMin, coste });
    } catch (err) { next(err); }
});

// ─── POST /api/admin/partes/:id/editar-horas — editar timestamps con auditoría
router.post('/partes/:id/editar-horas', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { inicio_ts: inicioNew, fin_ts: finNew, motivo } = req.body;
        const admin = req.session.user;

        if (!motivo?.trim()) return res.status(400).json({ error: 'El motivo es obligatorio' });
        if (!inicioNew) return res.status(400).json({ error: 'inicio_ts requerido' });

        if (finNew && new Date(finNew) <= new Date(inicioNew))
            return res.status(400).json({ error: 'fin_ts debe ser posterior a inicio_ts' });
        // Permitimos futuro cercano (hasta 24h) para posibles correcciones el mismo día
        if (finNew && new Date(finNew) > new Date(Date.now() + 86400000))
            return res.status(400).json({ error: 'fin_ts no puede ser absurdamente en el futuro (+24h)' });

        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const { data: fila, error: selErr } = await supabase
            .from('partes_limpieza').select('*').eq('id', id).single();
        if (selErr || !fila) return res.status(404).json({ error: 'Parte no encontrado' });

        const nowTs = now();
        const durMin = finNew ? diffMin(inicioNew, finNew) : (parseInt(fila.duracion_min) || null);
        const coste = finNew ? parseFloat(calcCoste(durMin)) : (parseFloat(fila.coste_estimado_eur) || null);

        const { error: updErr } = await supabase.from('partes_limpieza').update({
            inicio_ts: inicioNew,
            fin_ts: finNew !== undefined ? (finNew || null) : fila.fin_ts,
            duracion_min: durMin,
            coste_estimado_eur: coste,
            status: fila.status || (finNew ? 'CERRADO' : 'ABIERTO'),
            admin_editado: true,
            admin_editado_por: admin.user_id || admin.nombre,
            admin_editado_ts: nowTs,
            admin_edit_motivo: motivo.trim(),
            inicio_ts_original: fila.inicio_ts_original || fila.inicio_ts,
            fin_ts_original: fila.fin_ts_original || fila.fin_ts || null,
        }).eq('id', id);
        if (updErr) return next(updErr);

        res.json({ ok: true, inicio_ts: inicioNew, fin_ts: finNew, duracion_min: durMin, coste });
    } catch (err) { next(err); }
});

// ─── PATCH /api/admin/partes/:id/ajustar-tiempo — corrección manual de tiempo efectivo
// Permite al admin corregir tiempo_efectivo_min sin tocar timestamps.
// Queda etiquetado con tiempo_efectivo_admin_override='true' para distinguirlo del automático.
router.patch('/partes/:id/ajustar-tiempo', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { tiempo_efectivo_min, motivo } = req.body;
        const admin = req.session.user;

        if (!motivo?.trim()) return res.status(400).json({ error: 'El motivo es obligatorio' });
        const minutos = parseInt(tiempo_efectivo_min);
        if (isNaN(minutos) || minutos < 0)
            return res.status(400).json({ error: 'tiempo_efectivo_min debe ser un número >= 0' });

        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const { data: fila, error: selErr } = await supabase
            .from('partes_limpieza').select('id, admin_edit_motivo, inicio_ts, fin_ts, inicio_ts_original, fin_ts_original').eq('id', id).single();
        if (selErr || !fila) return res.status(404).json({ error: 'Parte no encontrado' });

        const nowTs = now();
        const costeAjustado = calcCoste(minutos);

        const { error: updErr } = await supabase.from('partes_limpieza').update({
            tiempo_efectivo_min: minutos,
            coste_estimado_eur: parseFloat(costeAjustado),
            admin_editado: true,
            admin_editado_por: admin.user_id || admin.nombre,
            admin_editado_ts: nowTs,
            admin_edit_motivo: fila.admin_edit_motivo
                ? `${fila.admin_edit_motivo} | [tiempo] ${motivo.trim()}`
                : `[tiempo] ${motivo.trim()}`,
            inicio_ts_original: fila.inicio_ts_original || fila.inicio_ts,
            fin_ts_original: fila.fin_ts_original || fila.fin_ts || null,
        }).eq('id', id);
        if (updErr) return next(updErr);

        res.json({ ok: true, tiempo_efectivo_min: minutos, coste_estimado_eur: costeAjustado });
    } catch (err) { next(err); }
});

// ─── POST /api/admin/partes/:id/anular — Anulación lógica de un parte ────────
router.post('/partes/:id/anular', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        const admin = req.session.user;

        if (!motivo?.trim()) return res.status(400).json({ error: 'El motivo es obligatorio' });
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });

        const { data: fila, error: selErr } = await supabase
            .from('partes_limpieza').select('id, admin_edit_motivo, usuario_nombre, casa, tipo_limpieza, inicio_ts').eq('id', id).single();
        if (selErr || !fila) return res.status(404).json({ error: 'Parte no encontrado' });

        const { error: updErr } = await supabase.from('partes_limpieza').update({
            status: 'ANULADO',
            admin_editado: true,
            admin_editado_por: admin.user_id || admin.nombre,
            admin_editado_ts: now(),
            admin_edit_motivo: fila.admin_edit_motivo
                ? `${fila.admin_edit_motivo} | [ANULADO] ${motivo.trim()}`
                : `[ANULADO] ${motivo.trim()}`,
        }).eq('id', id);
        if (updErr) return next(updErr);

        tg.enviarMensaje(
            `❌ Parte ANULADO por admin\n` +
            `— Usuario: ${fila.usuario_nombre}\n` +
            `— Casa: ${fila.casa} · ${fila.tipo_limpieza}\n` +
            `— Inicio: ${fila.inicio_ts}\n` +
            `— Admin: ${admin.nombre}\n` +
            `— Motivo: ${motivo.trim()}`
        ).catch(() => { });

        res.json({ ok: true });
    } catch (err) { next(err); }
});

// ─── Tareas Periódicas Admin ──────────────────────────────────────────────────
const TP_TAB = 'TareasPeriodicas';
const TPL_TAB = 'TareasPeriodicasLog';

// Esquema canónico de TareasPeriodicas (15 cols, en orden de la hoja)
const TP_COLS = [
    'id', 'casa', 'zona', 'nombre', 'periodicidad_meses', 'activa',
    'ultima_realizacion_ts', 'proxima_realizacion_ts',
    'ultima_realizacion_user', 'ultima_realizacion_parte_id',
    'descripcion', 'created_ts', 'updated_ts',
    'frecuencia_valor', 'frecuencia_unidad'
];
function buildTPRow(data) {
    return TP_COLS.map(k => data[k] ?? '');
}

// GET /api/admin/tareas-periodicas
router.get('/tareas-periodicas', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const rows = await sheets.readSheetAsObjects(TP_TAB);
        const ahora = new Date();
        const enriched = rows.map(({ _row, ...r }) => {
            let estado = 'ok';
            if (!r.proxima_realizacion_ts || r.proxima_realizacion_ts.trim() === '') {
                estado = 'vencida';
            } else {
                const prox = new Date(r.proxima_realizacion_ts);
                const dias = (prox - ahora) / 86400000;
                if (isNaN(prox.getTime()) || prox <= ahora) estado = 'vencida';
                else if (dias <= 7) estado = 'proxima';
            }
            return { ...r, estado };
        });
        res.json(enriched);
    } catch (err) { next(err); }
});

// POST /api/admin/tareas-periodicas — crear
router.post('/tareas-periodicas', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { casa, zona, nombre, periodicidad_meses, frecuencia_valor, frecuencia_unidad, descripcion } = req.body;

        // Strict Schema Validation para nuevas tareas
        if (!casa || !nombre || !frecuencia_valor || !frecuencia_unidad)
            return res.status(400).json({ error: 'casa, nombre, frecuencia_valor y frecuencia_unidad son obligatorios' });

        const id = `TP-${Date.now()}`;
        const ts = now();
        const row = buildTPRow({
            id, casa, zona: zona || '', nombre,
            periodicidad_meses: '', // STRICT RULE: Dejamos la legacy vacía para no crear ambigüedad
            frecuencia_valor: String(frecuencia_valor),
            frecuencia_unidad: String(frecuencia_unidad),
            activa: 'Sí',
            ultima_realizacion_ts: '', proxima_realizacion_ts: '',
            ultima_realizacion_user: '', ultima_realizacion_parte_id: '',
            descripcion: descripcion || '',
            created_ts: ts, updated_ts: ts,
        });
        await sheets.appendRow(TP_TAB, row);
        res.json({ ok: true, id });
    } catch (err) { next(err); }
});

// PUT /api/admin/tareas-periodicas/:id — editar
router.put('/tareas-periodicas/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const rows = await sheets.readSheetAsObjects(TP_TAB);
        const fila = rows.find(r => r.id === req.params.id);
        if (!fila) return res.status(404).json({ error: 'Tarea no encontrada' });

        const { nombre, zona, frecuencia_valor, frecuencia_unidad, activa, descripcion } = req.body;
        const updated = buildTPRow({
            ...fila,
            nombre: nombre ?? fila.nombre,
            zona: zona ?? fila.zona,
            frecuencia_valor: frecuencia_valor != null ? String(frecuencia_valor) : fila.frecuencia_valor,
            frecuencia_unidad: frecuencia_unidad ?? fila.frecuencia_unidad,
            activa: activa ?? fila.activa,
            descripcion: descripcion ?? fila.descripcion,
            updated_ts: now(),
        });
        await sheets.updateRow(TP_TAB, fila._row, updated);
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// POST /api/admin/tareas-periodicas/:id/marcar-hecha
router.post('/tareas-periodicas/:id/marcar-hecha', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const admin = req.session.user;
        const rows = await sheets.readSheetAsObjects(TP_TAB);
        const fila = rows.find(r => r.id === req.params.id);
        if (!fila) return res.status(404).json({ error: 'Tarea no encontrada' });

        const finTs = now();
        const proxima = new Date(finTs);

        // Lógica Transicional de Fechas
        if (fila.frecuencia_valor && fila.frecuencia_unidad) {
            // Tarea nueva/migrada: Usar esquema limpio
            const val = parseInt(fila.frecuencia_valor) || 1;
            if (fila.frecuencia_unidad === 'semanas') {
                proxima.setDate(proxima.getDate() + (val * 7));
            } else {
                proxima.setMonth(proxima.getMonth() + val);
            }
        } else {
            // Tarea legacy: Fallback a meses de la columna antigua
            const meses = parseInt(fila.periodicidad_meses) || 1;
            proxima.setMonth(proxima.getMonth() + meses);
        }

        const updated = buildTPRow({
            ...fila,
            ultima_realizacion_ts: finTs,
            proxima_realizacion_ts: now(proxima),
            ultima_realizacion_user: admin.nombre || '',
            ultima_realizacion_parte_id: 'ADMIN-MANUAL',
            updated_ts: finTs,
        });

        await sheets.updateRow(TP_TAB, fila._row, updated);
        await sheets.appendRow(TPL_TAB, [
            `TPL-${Date.now()}`, fila.id, 'ADMIN-MANUAL', '', finTs,
            fila.casa, fila.zona || '', fila.nombre, 'true',
            admin.user_id || admin.nombre || '', admin.nombre || '',
            req.body.observaciones || '', finTs,
        ]);
        res.json({ ok: true, proxima_realizacion_ts: now(proxima) });
    } catch (err) { next(err); }
});

// GET /api/admin/tareas-periodicas-log
router.get('/tareas-periodicas-log', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const rows = await sheets.readSheetAsObjects(TPL_TAB);
        const { casa } = req.query;
        const filtered = casa ? rows.filter(r => r.casa === casa) : rows;
        res.json(filtered.reverse().slice(0, 200).map(({ _row, ...r }) => r));
    } catch (err) { next(err); }
});

// POST /api/admin/sync-reservas
router.post('/sync-reservas', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const syncAvaibook = require('../jobs/syncAvaibook');
        const result = await syncAvaibook();
        if (!result.ok) {
            return res.status(409).json({ error: result.reason || (result.stats && result.stats.error) || 'Fallo sincronización' });
        }
        res.json({ ok: true, stats: result.stats });
    } catch (err) {
        next(err);
    }
});

// POST /api/admin/overrides
router.post('/overrides', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        let { reserva_id, cuna, num_cunas, late_checkout, late_checkout_hora, nota_interna, nota_equipo } = req.body;
        
        if (!reserva_id) return res.status(400).json({ error: 'reserva_id es obligatorio' });

        // Reglas de Validación
        if (cuna !== 'Sí') {
            cuna = 'No';
            num_cunas = 0;
        } else {
            num_cunas = parseInt(num_cunas) || 1;
            if (num_cunas < 0) num_cunas = 0;
            if (num_cunas > 3) num_cunas = 3;
        }

        if (late_checkout !== 'Sí') {
            late_checkout = 'No';
            late_checkout_hora = '';
        } else {
            late_checkout_hora = String(late_checkout_hora || '').trim();
        }

        nota_interna = String(nota_interna || '').trim();
        nota_equipo = String(nota_equipo || '').trim();
        const ts = now();

        const dataObj = {
            reserva_id: String(reserva_id),
            cuna,
            num_cunas: String(num_cunas),
            late_checkout,
            late_checkout_hora,
            nota_interna,
            nota_equipo,
            updated_ts: ts
        };

        const overrides = await sheets.readSheetAsObjects('ReservasOverrides').catch(() => []);
        const targetRow = overrides.find(o => String(o.reserva_id) === String(reserva_id));

        if (targetRow) {
            // Upsert: Update if exists
            await sheets.updateRowAsObject('ReservasOverrides', targetRow._row, dataObj);
        } else {
            // Upsert: Append new row explicitly as object to avoid column ordering issues
            await sheets.appendRowAsObject('ReservasOverrides', dataObj);
        }

        res.json({ ok: true, data: dataObj });

        // Trigger sync Gratal (asíncrono)
        syncGratal().catch(e => console.error('[Overrides] Error triggering syncGratal:', e.message));
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/admin/partes/manual — crear parte cerrado directamente ─────────
router.post('/partes/manual', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const {
            user_id, casa, tipo_limpieza, fecha, hora_inicio, hora_fin,
            motivo_manual, casa_lista, tareas_realizadas, observaciones
        } = req.body;

        // 1. Validaciones básicas
        if (!user_id) return res.status(400).json({ error: 'Debes seleccionar una trabajadora' });
        if (!casa) return res.status(400).json({ error: 'La casa es obligatoria' });
        if (!fecha) return res.status(400).json({ error: 'La fecha es obligatoria' });
        if (!hora_inicio || !hora_fin) return res.status(400).json({ error: 'Las horas de inicio y fin son obligatorias' });
        if (hora_fin <= hora_inicio) return res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio' });

        // 2. Obtener datos de la trabajadora (nombre y tarifa)
        const usuarios = await sheets.readSheetAsObjects('Usuarios');
        const worker = usuarios.find(u => u.user_id === user_id);
        if (!worker) return res.status(404).json({ error: 'Trabajadora no encontrada' });

        const tarifaBase = parseFloat(String(worker.tarifa_eur_hora || worker.Tarifa || '12').replace(',', '.'));
        const tarifa = isNaN(tarifaBase) ? 12 : tarifaBase;
        const nombreWorker = worker.nombre || worker.Nombre || user_id;

        // 3. Construir Timestamps de forma explícita para Madrid
        const inicio_ts = formToMadridISO(fecha, hora_inicio);
        const fin_ts = formToMadridISO(fecha, hora_fin);
        const durMin = diffMin(inicio_ts, fin_ts);
        const coste = calcCoste(durMin, tarifa);

        // 4. Construir el objeto del parte
        const idManual = `P-MANUAL-${Date.now()}`;
        const adminUser = req.session.user;

        const manualData = {
            id: idManual,
            session_id: idManual,
            cleaning_session_id: `S-MANUAL-${Date.now()}`,
            fecha,
            casa,
            tipo_limpieza: tipo_limpieza || 'Cambio de huéspedes',
            inicio_ts,
            fin_ts,
            duracion_min: String(durMin),
            tiempo_efectivo_min: String(durMin),
            tiempo_acumulado_seg: String(durMin * 60),
            // Nota: tiempo_efectivo_seg NO se guarda como columna porque es propiedad calculada en la API
            ultimo_reanudar_ts: '', // Vacío: el parte nace ya CERRADO
            user_id,
            usuario_nombre: nombreWorker,
            coste_estimado_eur: coste,
            status: 'CERRADO',
            admin_editado: 'Sí',
            admin_editado_por: adminUser.nombre,
            admin_editado_ts: now(),
            admin_edit_motivo: `[ALTA MANUAL] ${motivo_manual || 'Olvido de fichaje'}`,
            casa_lista: casa_lista === 'Sí' ? 'Sí' : 'No',
            tareas_realizadas: tareas_realizadas || '',
            observaciones: observaciones || '',
            created_by: adminUser.nombre
        };

        // 5a. Guardar en Supabase (primario)
        if (!supabase) return res.status(500).json({ error: 'Base de datos no disponible' });
        const { error: insErr } = await supabase.from('partes_limpieza').insert({
            id: idManual,
            session_id: idManual,
            cleaning_session_id: manualData.cleaning_session_id,
            fecha,
            casa,
            tipo_limpieza: manualData.tipo_limpieza,
            inicio_ts,
            fin_ts,
            duracion_min: durMin,
            tiempo_efectivo_min: durMin,
            tiempo_acumulado_seg: durMin * 60,
            ultimo_reanudar_ts: null,
            user_id,
            usuario_nombre: nombreWorker,
            coste_estimado_eur: parseFloat(coste),
            status: 'CERRADO',
            admin_editado: true,
            admin_editado_por: adminUser.nombre,
            admin_editado_ts: manualData.admin_editado_ts,
            admin_edit_motivo: manualData.admin_edit_motivo,
            casa_lista: manualData.casa_lista,
            tareas_realizadas: tareas_realizadas || null,
            observaciones: observaciones || null,
            created_by: adminUser.nombre,
            pausas_json: [],
        });
        if (insErr) return next(insErr);

        // 5b. Backup en Sheets (no bloquea la respuesta si falla)
        sheets.appendRow('PartesLimpieza', buildParteRow(manualData)).catch(e =>
            console.error('[partes/manual] Error backup Sheets:', e.message)
        );

        res.json({ ok: true, id: idManual, duracion_min: durMin, coste_estimado_eur: coste });
    } catch (err) {
        next(err);
    }
});

// ─── CONFIG ────────────────────────────────────────────────────────────────
// POST /api/admin/config/temporada
router.post('/config/temporada', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { temporada } = req.body;
        if (!['invierno', 'entretiempo', 'verano'].includes(temporada)) {
            return res.status(400).json({ error: 'Valor de temporada inválido. Debe ser: invierno, entretiempo o verano.' });
        }

        const row = await sheets.findRow('Config', 'key', 'temporada');
        if (row) {
            await sheets.updateCell('Config', row._row, 'B', temporada);
        } else {
            await sheets.appendRow('Config', ['temporada', temporada]);
        }

        res.json({ message: 'Temporada actualizada correctamente', temporada });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
