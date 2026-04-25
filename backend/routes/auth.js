'use strict';
const router = require('express').Router();
const sheets = require('../services/sheets');
const { now } = require('../services/time');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { pin } = req.body;
        if (!pin) return res.status(400).json({ error: 'PIN requerido' });

        const usuarios = await sheets.readSheetAsObjects('Usuarios');
        // Compara PIN directamente (sin hash en v2 por simplicidad,
        // el campo pin_hash puede contener el PIN en texto o un hash simple)
        const user = usuarios.find(u => {
            // Buscamos PIN de forma robusta por si la cabecera tiene espacios o distinta capitalización
            const pinKey = Object.keys(u).find(k => k.trim().toUpperCase() === 'PIN_HASH' || k.trim().toUpperCase() === 'PIN');
            const stored = pinKey ? u[pinKey] : '';
            const activoKey = Object.keys(u).find(k => k.trim().toLowerCase() === 'activo');
            const activoVal = activoKey ? String(u[activoKey]).toLowerCase() : 'sí';
            return String(stored).trim() === String(pin).trim() && activoVal !== 'no';
        });

        if (!user) return res.status(401).json({ error: 'PIN incorrecto o usuario inactivo' });

        // Helper para extraer campos con tolerancia a espacios/mayúsculas en cabeceras
        const getField = (obj, key) => {
            const k = Object.keys(obj).find(x => x.trim().toLowerCase() === key.toLowerCase());
            return k ? obj[k] : undefined;
        };

        req.session.user = {
            user_id: getField(user, 'user_id') || getField(user, 'nombre'),
            nombre: getField(user, 'nombre'),
            rol: String(getField(user, 'rol') || 'limpiador').toLowerCase().trim(),
            tarifa: parseFloat(String(getField(user, 'tarifa_eur_hora') || getField(user, 'tarifa') || '12').replace(',', '.')),
            casas_permitidas: getField(user, 'casas_permitidas') ? String(getField(user, 'casas_permitidas')).split('|').map(s => s.trim()) : [],
            idioma_ui: String(getField(user, 'idioma_ui') || '').trim().toLowerCase() === 'ru' ? 'ru' : 'es',
        };

        res.json({ ok: true, user: req.session.user });
    } catch (err) { next(err); }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const { nombre, apellidos, telefono, email, pin } = req.body;
        
        // 1. Validaciones mínimas
        if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
        if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'El PIN debe ser exactamente 4 cifras' });
        if (!telefono?.trim() || !email?.trim()) return res.status(400).json({ error: 'Debes proporcionar tanto un teléfono como un email' });

        // 2. Control de duplicados de PIN
        const usuarios = await sheets.readSheetAsObjects('Usuarios');
        const pinExiste = usuarios.some(u => {
            const stored = u.pin_hash || u.PIN || '';
            return stored === String(pin).trim();
        });

        if (pinExiste) {
            return res.status(400).json({ error: 'Ese PIN ya está en uso. Por favor, elige otro PIN distinto.' });
        }

        const isoStr = now();
        const dateStr = isoStr.split('T')[0];

        // 3. Preparar nuevo usuario con campos solicitados
        const nuevoUsuario = {
            user_id: `usr_${Date.now()}`,
            nombre: nombre.trim(),
            apellidos: (apellidos || '').trim(),
            telefono: (telefono || '').trim(),
            email: (email || '').trim(),
            pin_hash: pin.trim(),
            rol: 'limpieza',
            activo: 'Sí', // valor exacto de la tabla Sheets actual
            tarifa_eur_hora: '20.57', // valor por defecto para nuevas empleadas
            created_at: dateStr, // conservamos compatibility con la v2 actual
            created_ts: isoStr,
            updated_ts: isoStr,
            origen_alta: 'auto'
        };

        // 4. Guardar usando el helper robusto
        await sheets.appendRowAsObject('Usuarios', nuevoUsuario);

        res.json({ ok: true });
    } catch (err) { 
        next(err); 
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    if (req.session?.user) return res.json({ ok: true, user: req.session.user });
    res.status(401).json({ ok: false });
});

module.exports = router;
