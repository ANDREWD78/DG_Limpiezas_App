'use strict';
const router = require('express').Router();
// NOTA: qrcode se carga en lazy-load dentro del handler — su require() top-level
// bloqueaba el arranque del servidor por el peso del módulo al importarse.
const { CASAS } = require('../data/constants');

const BASE_URL = () => process.env.APP_URL || 'http://localhost:3000';

// GET /api/qr/:casa — genera QR como SVG
router.get('/:casa', async (req, res, next) => {
    try {
        const QRCode = require('qrcode'); // lazy: solo al generar QR
        const casa = req.params.casa.toUpperCase();
        if (!CASAS.includes(casa)) return res.status(400).json({ error: 'Casa inválida' });
        const url = `${BASE_URL()}/new?house=${casa}`;
        const svg = await QRCode.toString(url, { type: 'svg', width: 200, margin: 2 });
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);
    } catch (err) { next(err); }
});

// GET /api/qr — devuelve las 3 URLs de QR
router.get('/', (req, res) => {
    const base = BASE_URL();
    res.json(CASAS.map(casa => ({
        casa,
        url: `${base}/new?house=${casa}`,
        qrEndpoint: `${base}/api/qr/${casa}`,
    })));
});

module.exports = router;
