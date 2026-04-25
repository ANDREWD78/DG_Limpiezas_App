'use strict';
const express = require('express');
const router = express.Router();
const sheets = require('../services/sheets');
const { requireAuth } = require('../middleware/auth');

const TP_TAB = 'TareasPeriodicas';

/**
 * GET /api/tareas-periodicas?casa=MIRADOR
 * Devuelve tareas activas para esa casa cuya proxima_realizacion_ts ya vencio o está vacía.
 */
router.get('/', requireAuth, async (req, res, next) => {
    try {
        const { casa } = req.query;
        if (!casa) return res.status(400).json({ error: 'casa requerida' });

        const rows = await sheets.readSheetAsObjects(TP_TAB);
        const ahora = new Date();

        const pendientes = rows.filter(r => {
            if (r.activa !== 'Sí') return false;
            if (r.casa !== casa) return false;
            // Toca si no tiene próxima fecha o si ya venció
            if (!r.proxima_realizacion_ts || r.proxima_realizacion_ts.trim() === '') return true;
            const proxima = new Date(r.proxima_realizacion_ts);
            return isNaN(proxima.getTime()) || proxima <= ahora;
        });

        res.json({ tareas: pendientes });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
