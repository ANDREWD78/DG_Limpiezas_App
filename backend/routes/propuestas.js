'use strict';
/**
 * propuestas.js — Gestión de propuestas de consumibles "Otro"
 *
 * Hoja: ConsumiblesPropuestas
 * Columnas (13):
 *   prop_id | fecha | casa | tipo_limpieza | user_id | usuario_nombre |
 *   propuesta_texto | urgencia | estado | aprobado_por | aprobado_ts |
 *   editado_nombre_final | observaciones
 *
 * Estados: PENDIENTE → APROBADA | RECHAZADA
 */
'use strict';
const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const sheets = require('../services/sheets');
const catalogo = require('../services/catalogoService');
const { today, now } = require('../services/time');

const SHEET = 'ConsumiblesPropuestas';
const HEADERS = [
    'prop_id', 'fecha', 'casa', 'tipo_limpieza', 'user_id', 'usuario_nombre',
    'propuesta_texto', 'urgencia', 'estado', 'aprobado_por', 'aprobado_ts',
    'editado_nombre_final', 'observaciones',
];

function uid() { return 'PR-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5); }

/** Serializar fila de propuesta (13 cols) */
function toRow(p) {
    return [
        p.prop_id, p.fecha, p.casa, p.tipo_limpieza || '',
        p.user_id || '', p.usuario_nombre || '',
        p.propuesta_texto || '', p.urgencia || 'Media',
        p.estado || 'PENDIENTE',
        p.aprobado_por || '', p.aprobado_ts || '',
        p.editado_nombre_final || '', p.observaciones || '',
    ];
}

// ─── POST /api/propuestas — crear propuesta desde limpieza ───────────────────
router.post('/', requireAuth, async (req, res, next) => {
    try {
        const { propuesta_texto, casa, tipo_limpieza, urgencia, observaciones } = req.body;
        if (!propuesta_texto?.trim()) return res.status(400).json({ error: 'propuesta_texto requerido' });
        const user = req.session.user;

        // Garantizar headers (idempotente)
        await sheets.ensureSheetHeaders(SHEET, HEADERS).catch(() => { });

        await sheets.appendRow(SHEET, toRow({
            prop_id: uid(), fecha: today(), casa, tipo_limpieza,
            user_id: user.user_id || '', usuario_nombre: user.nombre,
            propuesta_texto: propuesta_texto.trim(),
            urgencia: urgencia || 'Media',
            estado: 'PENDIENTE',
            observaciones: observaciones || '',
        }));
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// ─── GET /api/propuestas — listar propuestas (admin) ─────────────────────────
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const rows = await sheets.readSheetAsObjects(SHEET);
        const estado = req.query.estado; // PENDIENTE / APROBADA / RECHAZADA / (vacío = todo)
        const filtered = estado ? rows.filter(r => r.estado === estado) : rows;
        res.json(filtered.reverse().slice(0, 100).map(({ _row, ...r }) => r));
    } catch (err) { next(err); }
});

// ─── POST /api/propuestas/:id/aprobar ────────────────────────────────────────
router.post('/:id/aprobar', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { nombre_final, observaciones } = req.body;
        const admin = req.session.user;

        const rows = await sheets.readSheetAsObjects(SHEET);
        const row = rows.find(r => r.prop_id === req.params.id);
        if (!row) return res.status(404).json({ error: 'Propuesta no encontrada' });

        const finalName = (nombre_final || row.propuesta_texto).trim();
        const nowTs = now();

        // Intentar añadir al catálogo (dedup interno)
        const result = await catalogo.addItemToCatalogo(finalName);

        // Actualizar propuesta
        await sheets.updateRow(SHEET, row._row, toRow({
            ...row,
            estado: 'APROBADA',
            aprobado_por: admin.nombre,
            aprobado_ts: nowTs,
            editado_nombre_final: finalName,
            observaciones: observaciones || row.observaciones || '',
        }));

        res.json({ ok: true, nombre_final: finalName, ya_existia: !result.added });
    } catch (err) { next(err); }
});

// ─── POST /api/propuestas/:id/rechazar ───────────────────────────────────────
router.post('/:id/rechazar', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { observaciones } = req.body;
        const admin = req.session.user;

        const rows = await sheets.readSheetAsObjects(SHEET);
        const row = rows.find(r => r.prop_id === req.params.id);
        if (!row) return res.status(404).json({ error: 'Propuesta no encontrada' });

        await sheets.updateRow(SHEET, row._row, toRow({
            ...row,
            estado: 'RECHAZADA',
            aprobado_por: admin.nombre,
            aprobado_ts: now(),
            observaciones: observaciones || row.observaciones || '',
        }));
        res.json({ ok: true });
    } catch (err) { next(err); }
});

module.exports = router;
