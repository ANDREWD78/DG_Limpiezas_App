'use strict';
const router = require('express').Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const sheets = require('../services/sheets');

const telegram = require('../services/telegram');
const email = require('../services/email');
const { today } = require('../services/time');

// multer en memoria (max 10MB por foto, hasta 5 fotos)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function generarId() {
    return `L-${Date.now()}`;
}

// POST /api/limpiezas — registrar nueva limpieza (con fotos opcionales)
router.post('/', requireAuth, upload.array('fotos', 5), async (req, res, next) => {
    try {
        const { piso, tipo, personas, horaInicio, horaFin, tiempoObjetivo, notas, consumibles } = req.body;
        const limpiador = req.session.user.nombre;

        const tiempoReal = calcularMinutos(horaInicio, horaFin);
        const id = generarId();
        const fecha = today();
        const subfolder = `${piso} ${fecha}`;

        // Subida de fotos deshabilitada (migrado a Supabase en flujo de partes)
        const fotosUrls = '';

        // Guardar en Sheet
        const fila = [
            id, fecha, horaInicio, horaFin, String(tiempoReal), piso, tipo,
            String(personas || ''), limpiador, fotosUrls, notas || '',
            String(tiempoObjetivo || ''), 'completada',
        ];
        await sheets.appendRow('Limpiezas', fila);

        // Notificaciones (en paralelo, errores no bloquean respuesta)
        const notifData = {
            piso, tipo, limpiador,
            tiempoMinutos: tiempoReal,
            tiempoObjetivo: parseInt(tiempoObjetivo) || 0,
            notas,
        };
        Promise.all([
            telegram.notificarLimpieza(notifData).catch(console.error),
            email.emailResumenLimpieza(notifData).catch(console.error),
        ]);

        res.json({ ok: true, id });
    } catch (err) {
        next(err);
    }
});

// GET /api/limpiezas — listar (admin)
router.get('/', requireAuth, async (req, res, next) => {
    try {
        const rows = await sheets.readSheetAsObjects('Limpiezas');
        const limit = parseInt(req.query.limit) || 50;
        const piso = req.query.piso;
        const filtered = piso ? rows.filter((r) => r.Piso === piso) : rows;
        res.json(filtered.reverse().slice(0, limit));
    } catch (err) {
        next(err);
    }
});

function calcularMinutos(inicio, fin) {
    if (!inicio || !fin) return 0;
    const [hI, mI] = inicio.split(':').map(Number);
    const [hF, mF] = fin.split(':').map(Number);
    return (hF * 60 + mF) - (hI * 60 + mI);
}

module.exports = router;
