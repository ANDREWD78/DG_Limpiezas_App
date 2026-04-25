'use strict';
const router = require('express').Router();
const sheets = require('../services/sheets');
const { requireAuth } = require('../middleware/auth');
const { CHECKLIST_POR_CASA } = require('../data/checklist');

// GET /api/config
router.get('/', requireAuth, async (req, res, next) => {
    try {
        const cfg = await sheets.readConfig();
        // Parsear objetivos_json si viene como string
        if (cfg.objetivos_json && typeof cfg.objetivos_json === 'string') {
            try { cfg.objetivos_json = JSON.parse(cfg.objetivos_json); } catch { }
        }
        if (cfg.consumibles_catalogo && typeof cfg.consumibles_catalogo === 'string') {
            cfg.consumibles_catalogo = cfg.consumibles_catalogo.split('|').map(s => s.trim()).filter(Boolean);
        }
        cfg.checklist = CHECKLIST_POR_CASA; // expuesto al frontend
        res.json(cfg);
    } catch (err) { next(err); }
});

module.exports = router;
