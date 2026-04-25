'use strict';
const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const sheets = require('../services/sheets');

// ─── Columnas de LimpiezasProfundasPendientes ────────────────────────────────
// tarea_id | casa | zona | descripcion | cadencia_dias | ultima_fecha |
// proxima_fecha | estado | ultimo_parte_id_realizado | creado_por | notas

const TAB = 'LimpiezasProfundasPendientes';
const HEADERS = [
    'tarea_id', 'casa', 'zona', 'descripcion', 'cadencia_dias',
    'ultima_fecha', 'proxima_fecha', 'estado',
    'ultimo_parte_id_realizado', 'creado_por', 'notas',
];
const { today, getMadridParts } = require('../services/time');

function uid() { return `LP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

function calcProxima(ultimaFecha, cadenciaDias) {
    if (!ultimaFecha) return '';
    const d = new Date(ultimaFecha);
    d.setDate(d.getDate() + parseInt(cadenciaDias || 30));
    return today(d);
}

// Garantiza que la hoja tiene cabeceras (idempotente)
async function ensureHeaders() {
    await sheets.ensureSheetHeaders(TAB, HEADERS);
}

// ─── GET /api/limpiezas-profundas ─────────────────────────────────────────────
// Filtros: ?casa= ?estado=activa|archivada ?vencidas=true
router.get('/', requireAuth, async (req, res, next) => {
    try {
        await ensureHeaders();
        const rows = await sheets.readSheetAsObjects(TAB);
        const { casa, estado, vencidas } = req.query;

        let result = rows;

        if (casa) result = result.filter(r => r.casa === casa);
        if (estado) result = result.filter(r => r.estado === estado);

        // Filtro especial: solo las que tienen proxima_fecha <= hoy
        if (vencidas === 'true') {
            const hoy = today();
            result = result.filter(r => r.estado === 'activa' && r.proxima_fecha && r.proxima_fecha <= hoy);
        }

        // Añadir campo calculado: días hasta próxima ejecución
        const hoy = today();
        result = result.map(({ _row, ...r }) => ({
            ...r,
            dias_restantes: r.proxima_fecha
                ? Math.ceil((new Date(r.proxima_fecha) - new Date(hoy)) / 86400000)
                : null,
        }));

        // Ordenar: primero vencidas/urgentes, luego por proxima_fecha
        result.sort((a, b) => (a.proxima_fecha || '9999').localeCompare(b.proxima_fecha || '9999'));

        res.json(result);
    } catch (err) { next(err); }
});

// ─── POST /api/limpiezas-profundas — crear tarea (admin) ─────────────────────
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { casa, zona, descripcion, cadencia_dias, ultima_fecha, notas } = req.body;
        const admin = req.session.user;

        if (!casa) return res.status(400).json({ error: 'casa es obligatorio' });
        if (!zona) return res.status(400).json({ error: 'zona es obligatorio' });
        if (!descripcion) return res.status(400).json({ error: 'descripcion es obligatorio' });
        if (!cadencia_dias || isNaN(parseInt(cadencia_dias))) {
            return res.status(400).json({ error: 'cadencia_dias debe ser un número' });
        }

        await ensureHeaders();

        const tarea_id = uid();
        const proxima_fecha = calcProxima(ultima_fecha || today(), cadencia_dias);

        await sheets.appendRow(TAB, [
            tarea_id,
            casa,
            zona,
            descripcion,
            String(cadencia_dias),
            ultima_fecha || '',          // ultima_fecha: vacía si es nueva (nunca realizada)
            proxima_fecha,
            'activa',
            '',                          // ultimo_parte_id_realizado: vacío en creación
            admin.nombre || admin.user_id,
            notas || '',
        ]);

        res.json({ ok: true, tarea_id, proxima_fecha });
    } catch (err) { next(err); }
});

// ─── PATCH /api/limpiezas-profundas/:id — editar tarea (admin) ───────────────
// Permite editar: descripcion, cadencia_dias, zona, notas, estado (archivar)
router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        await ensureHeaders();
        const rows = await sheets.readSheetAsObjects(TAB);
        const row = rows.find(r => r.tarea_id === req.params.id);
        if (!row) return res.status(404).json({ error: 'Tarea no encontrada' });

        const { descripcion, cadencia_dias, zona, notas, estado, ultima_fecha } = req.body;

        // Si cambia cadencia o ultima_fecha, recalcular proxima_fecha
        const nuevaCadencia = cadencia_dias !== undefined ? String(cadencia_dias) : row.cadencia_dias;
        const nuevaUltima = ultima_fecha !== undefined ? ultima_fecha : row.ultima_fecha;
        const nuevaProxima = (cadencia_dias !== undefined || ultima_fecha !== undefined)
            ? calcProxima(nuevaUltima, nuevaCadencia)
            : row.proxima_fecha;

        // Validar estado
        const nuevoEstado = estado !== undefined ? estado : row.estado;
        if (!['activa', 'archivada'].includes(nuevoEstado)) {
            return res.status(400).json({ error: 'estado debe ser activa o archivada' });
        }

        const updated = [
            row.tarea_id,
            row.casa,
            zona !== undefined ? zona : row.zona,
            descripcion !== undefined ? descripcion : row.descripcion,
            nuevaCadencia,
            nuevaUltima,
            nuevaProxima,
            nuevoEstado,
            row.ultimo_parte_id_realizado || '',
            row.creado_por,
            notas !== undefined ? notas : row.notas,
        ];

        await sheets.updateRow(TAB, row._row, updated);
        res.json({ ok: true, proxima_fecha: nuevaProxima });
    } catch (err) { next(err); }
});

// ─── POST /api/limpiezas-profundas/:id/ejecutar ───────────────────────────────
// Registra que la tarea se realizó: actualiza ultima_fecha, recalcula proxima_fecha,
// guarda ultimo_parte_id_realizado. La tarea se mantiene activa (no se archiva).
router.post('/:id/ejecutar', requireAuth, async (req, res, next) => {
    try {
        await ensureHeaders();
        const rows = await sheets.readSheetAsObjects(TAB);
        const row = rows.find(r => r.tarea_id === req.params.id);
        if (!row) return res.status(404).json({ error: 'Tarea no encontrada' });
        if (row.estado !== 'activa') {
            return res.status(409).json({ error: 'Solo se pueden ejecutar tareas activas' });
        }

        const { parte_id, fecha_ejecucion } = req.body;
        const nuevaUltima = fecha_ejecucion || today();
        const nuevaProxima = calcProxima(nuevaUltima, row.cadencia_dias);

        const updated = [
            row.tarea_id,
            row.casa,
            row.zona,
            row.descripcion,
            row.cadencia_dias,
            nuevaUltima,             // ultima_fecha: hoy o la fecha indicada
            nuevaProxima,            // proxima_fecha recalculada
            'activa',                // sigue activa — es recurrente
            parte_id || row.ultimo_parte_id_realizado || '',  // vincula el parte
            row.creado_por,
            row.notas,
        ];

        await sheets.updateRow(TAB, row._row, updated);
        res.json({ ok: true, ultima_fecha: nuevaUltima, proxima_fecha: nuevaProxima });
    } catch (err) { next(err); }
});

module.exports = router;
