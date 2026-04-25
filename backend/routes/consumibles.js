'use strict';
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const sheets = require('../services/sheets');
const telegram = require('../services/telegram');
const { createClient } = require('@supabase/supabase-js');
const { CONSUMIBLES_BASE, CONSUMIBLES_GRATAL } = require('../data/constants');
const { today } = require('../services/time');

// Configuración Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

function uid() { return `C-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`; }

function buildConsumoRow(data = {}) {
    // Columnas exactas de Consumibles:
    return [
        data.req_id || '',
        data.parte_id || '',
        data.session_id || '',
        data.fecha || '',
        data.casa || '',
        data.item || '',
        data.item_otro || '',
        data.cantidad || '',
        data.urgencia || '',
        data.nota || '',
        data.estado || '',
        data.marcado_por || '',
        data.fecha_cambio_estado || ''
    ];
}

// POST /api/consumibles — registrar items que faltan (checkboxes)
router.post('/', requireAuth, async (req, res, next) => {
    try {
        const { parte_id, session_id, casa, items } = req.body;
        // items = [{ item, item_otro, urgencia, nota }]
        const user = req.session.user;
        const fecha = today();
        const isoNow = new Date().toISOString();

        if (!Array.isArray(items) || !items.length) {
            return res.status(400).json({ error: 'No hay items' });
        }

        // --- 1. SUPABASE MAIN ---
        if (!supabase) {
            console.error('[SUPABASE] Cliente no inicializado. Abortando.');
            return res.status(500).json({ error: 'Base de datos principal (Supabase) no disponible' });
        }

        const insertData = items.map(({ item, item_otro, urgencia, nota, cantidad }) => {
            const isUrgente = (urgencia && urgencia.toLowerCase() === 'urgente');
            return {
                req_id: uid(),
                parte_id: parte_id || null,
                session_id: session_id || null,
                casa,
                item,
                item_otro: item_otro || null,
                cantidad: cantidad || null, 
                urgencia: isUrgente ? 'Urgente' : 'Normal',
                estado: 'Pendiente',
                nota: nota || null,
                marcado_por: user.nombre,
                origen: req.body.fuente || 'app',
                fecha_creacion: isoNow
            };
        });

        const { error } = await supabase.from('consumibles').insert(insertData);
        if (error) {
            console.error('[SUPABASE] ERROR guardando consumibles', error.message);
            return res.status(500).json({ error: 'Error guardando en base principal (Supabase)' });
        }
        console.log(`[SUPABASE] OK consumible guardado (${insertData.length} items)`);

        // --- 2. SHEETS BACKUP ---
        const rows = insertData.map(db => buildConsumoRow({
            req_id: db.req_id,
            parte_id: db.parte_id || '',
            session_id: db.session_id || '',
            fecha,
            casa: db.casa,
            item: db.item,
            item_otro: db.item_otro || '',
            cantidad: db.cantidad || '', 
            urgencia: db.urgencia,
            nota: db.nota || '',
            estado: db.estado,
            marcado_por: db.marcado_por,
            fecha_cambio_estado: ''
        }));

        for (const row of rows) {
            await sheets.appendRow('Consumibles', row);
        }

        // Telegram: aviso solo en alta rápida (sin parte)
        if (req.body.fuente === 'alta_rapida') {
            telegram.notificarConsumiblesRapidos({
                casa,
                usuario: user.nombre,
                items,
            }).catch(e => console.error('[TG consumibles]', e.message));
        }

        res.json({ ok: true, count: rows.length });
    } catch (err) { next(err); }
});

// GET /api/consumibles
router.get('/', requireAuth, async (req, res, next) => {
    try {
        if (!supabase) {
            console.error('[SUPABASE] Cliente no inicializado en GET consumibles');
            return res.status(500).json({ error: 'Base de datos no disponible' });
        }

        const casa = req.query.casa;
        const estado = req.query.estado;

        let query = supabase
            .from('consumibles')
            .select('*')
            .order('fecha_creacion', { ascending: false })
            .limit(200);

        if (casa) query = query.eq('casa', casa);
        if (estado) query = query.eq('estado', estado);

        const { data, error } = await query;

        if (error) {
            console.error('[SUPABASE] ERROR leyendo consumibles:', error.message);
            return res.status(500).json({ error: 'Error leyendo consumibles de la BD principal' });
        }

        // Mapeo inverso a shape legacy para no romper el frontend
        const formatLegacyDate = (iso) => {
            if (!iso) return '';
            try {
                const d = new Date(iso);
                if (Number.isNaN(d.getTime())) return iso;
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                return `${dd}-${mm}-${d.getFullYear()}`;
            } catch (e) {
                return iso;
            }
        };

        const legacyShape = data.map(db => ({
            req_id: db.req_id || '',
            parte_id: db.parte_id || '',
            session_id: db.session_id || '',
            fecha: formatLegacyDate(db.fecha_creacion),
            casa: db.casa || '',
            item: db.item || '',
            item_otro: db.item_otro || '',
            cantidad: db.cantidad !== null ? db.cantidad : '',
            urgencia: db.urgencia || '',
            nota: db.nota || '',
            estado: db.estado || '',
            marcado_por: db.marcado_por || '',
            fecha_cambio_estado: formatLegacyDate(db.fecha_resolucion)
        }));

        res.json(legacyShape);
    } catch (err) { next(err); }
});

// PATCH /api/consumibles/:id — cambiar estado y/o urgencia (admin)
router.patch('/:id', requireAuth, async (req, res, next) => {
    try {
        const { estado, urgencia } = req.body;
        const req_id = req.params.id;

        // --- 1. SUPABASE MAIN ---
        if (!supabase) {
            console.error('[SUPABASE] Cliente no inicializado. Abortando.');
            return res.status(500).json({ error: 'Base de datos principal (Supabase) no disponible' });
        }

        const payload = {};
        if (estado) {
            const estLower = estado.toLowerCase();
            payload.estado = estLower === 'repuesto' ? 'Repuesto' : (estLower === 'descartado' ? 'Descartado' : 'Pendiente');
            if (payload.estado === 'Repuesto' || payload.estado === 'Descartado') {
                payload.fecha_resolucion = new Date().toISOString();
            } else {
                payload.fecha_resolucion = null;
            }
        }
        if (urgencia) {
            payload.urgencia = (urgencia.toLowerCase() === 'urgente') ? 'Urgente' : 'Normal';
        }

        if (Object.keys(payload).length > 0) {
            const { data, error } = await supabase.from('consumibles')
                .update(payload)
                .eq('req_id', req_id)
                .select();
            
            if (error) {
                console.error('[SUPABASE] ERROR actualizando consumible', error.message);
                return res.status(500).json({ error: 'Error actualizando base principal (Supabase)' });
            }
            if (!data || data.length === 0) {
                console.warn(`[SUPABASE] Consumible no encontrado: ${req_id}`);
                return res.status(404).json({ error: 'Consumible no encontrado en Supabase' });
            }
            console.log(`[SUPABASE] OK consumible actualizado (${req_id})`);
        }

        // --- 2. SHEETS BACKUP ---
        const rows = await sheets.readSheetAsObjects('Consumibles');
        const row = rows.find(r => r.req_id === req_id);
        
        if (!row) {
            console.warn(`[SHEETS] Consumible no encontrado en sheets: ${req_id}`);
            return res.status(404).json({ error: 'No encontrado' });
        }
        
        const nuevaUrgencia = urgencia ? ((urgencia.toLowerCase() === 'urgente') ? 'Urgente' : 'Normal') : row.urgencia;
        const nuevoEstado = estado ? ((estado.toLowerCase() === 'repuesto') ? 'Repuesto' : (estado.toLowerCase() === 'descartado' ? 'Descartado' : 'Pendiente')) : row.estado;

        let nuevaFechaResolucion = row.fecha_cambio_estado || '';
        if (nuevoEstado === 'Repuesto' || nuevoEstado === 'Descartado') {
            nuevaFechaResolucion = today();
        }

        const updated = buildConsumoRow({
            ...row,
            urgencia: nuevaUrgencia,
            estado: nuevoEstado,
            fecha_cambio_estado: nuevaFechaResolucion
        });
        await sheets.updateRow('Consumibles', row._row, updated);
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// GET /api/consumibles/catalogo?casa=X
router.get('/catalogo', requireAuth, async (req, res, next) => {
    try {
        if (!supabase) {
            console.error('[SUPABASE] Cliente no inicializado en GET catalogo');
            return res.status(500).json({ error: 'Base de datos no disponible' });
        }

        const casa = req.query.casa;
        const casaFilter = casa ? ['ALL', casa] : ['ALL'];

        const { data, error } = await supabase
            .from('consumibles_catalogo')
            .select('nombre, orden')
            .in('casa', casaFilter)
            .eq('activo', true)
            .order('orden', { ascending: true })
            .order('nombre', { ascending: true });

        if (error) {
            console.error('[SUPABASE] ERROR leyendo catalogo:', error.message);
            return res.status(500).json({ error: 'Error leyendo catálogo de consumibles' });
        }

        const seen = new Set();
        const lista = (data || [])
            .map(r => r.nombre)
            .filter(n => {
                if (seen.has(n)) return false;
                seen.add(n);
                return true;
            });

        res.json(lista);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
