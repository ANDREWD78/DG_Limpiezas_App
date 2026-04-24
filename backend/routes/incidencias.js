'use strict';
const router = require('express').Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const sheets = require('../services/sheets');
const { uploadIncidenciaPhoto, getIncidenciaSignedUrl } = require('../services/supabaseStorage');
const tg = require('../services/telegram');
const { createClient } = require('@supabase/supabase-js');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );
}

const { CATEGORIAS_INCIDENCIA, UBICACIONES } = require('../data/constants');
const { today, hhmm } = require('../services/time');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // Limite global de multer a 50MB (para permitir el vídeo)
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'fotos') {
            if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.mimetype)) {
                return cb(new Error('FORMATO_FOTO_INVALIDO'));
            }
        } else if (file.fieldname === 'video') {
            if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.mimetype)) {
                return cb(new Error('FORMATO_VIDEO_INVALIDO'));
            }
        }
        cb(null, true);
    }
});

const uploadMiddleware = upload.fields([
    { name: 'fotos', maxCount: 10 },
    { name: 'video', maxCount: 1 }
]);

function uid() { return `T-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

function buildIncidenciaRow(data = {}) {
    // Definimos las columnas exactas del sheet IncidenciasMantenimiento
    return [
        data.ticket_id || '',
        data.parte_id || '',
        data.session_id || '',
        data.fecha_creacion || '',
        data.casa || '',
        data.categoria || '',
        data.categoria_otro || '',
        data.ubicacion || '',
        data.prioridad || '',
        data.estado || '',
        data.descripcion || '',
        data.fotos_urls_json || '',
        data.video_url || '',
        data.responsable || '',
        data.fecha_cierre || '',
        data.notas_admin || ''
    ];
}

// POST /api/incidencias \u2014 crear ticket
router.post('/', requireAuth, (req, res, next) => {
    uploadMiddleware(req, res, async (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Archivo demasiado grande' });
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                if (err.field === 'video') return res.status(400).json({ error: 'Solo se permite 1 v\u00eddeo' });
                return res.status(400).json({ error: 'Demasiadas fotos (m\u00e1x 10)' });
            }
            if (err.message === 'FORMATO_FOTO_INVALIDO') return res.status(400).json({ error: 'Formato de imagen no permitido' });
            if (err.message === 'FORMATO_VIDEO_INVALIDO') return res.status(400).json({ error: 'Formato de v\u00eddeo no permitido' });
            return res.status(400).json({ error: 'Error al subir los archivos' });
        }

        try {
            const user = req.session.user;
            const { parte_id, session_id, casa, categoria, categoria_otro,
                ubicacion, prioridad, descripcion, nota } = req.body;

            if (!descripcion) return res.status(400).json({ error: 'Descripci\u00f3n obligatoria' });
            
            const fotosFiles = req.files?.fotos || [];
            const videoFiles = req.files?.video || [];

            if (!fotosFiles.length && !videoFiles.length)
                return res.status(400).json({ error: 'Se necesita al menos una foto o un v\u00eddeo' });

            // Validaci\u00f3n estricta de tama\u00f1o 5MB para cada foto (el limite global de Multer es 50MB para el video)
            if (fotosFiles.some(f => f.size > 5 * 1024 * 1024)) {
                return res.status(400).json({ error: 'Archivo demasiado grande (m\u00e1x 5MB por foto)' });
            }

            const ticket_id = uid();
            const fecha = today();
            const hora = hhmm();

            // Subir fotos a Supabase Storage
            const folderName = `${fecha}_${ticket_id}`;
            const bucket_prefix = `${casa}/incidencias/${folderName}`;
            const fotosUrls_arr = [];
        let videoUrl = '';

        for (const f of fotosFiles) {
            const fileName = `${Date.now()}_${f.originalname}`;
            const path = `${bucket_prefix}/${fileName}`;
            const finalPath = await uploadIncidenciaPhoto(f.buffer, path, f.mimetype);
            fotosUrls_arr.push(finalPath);
        }

        // Video: si existe, subirlo también al bucket de incidencias
        for (const f of videoFiles) {
            const fileName = `${Date.now()}_${f.originalname}`;
            const path = `${bucket_prefix}/video_${fileName}`;
            videoUrl = await uploadIncidenciaPhoto(f.buffer, path, f.mimetype);
        }

        const fotosUrls = JSON.stringify(fotosUrls_arr);

        // Columnas IncidenciasMantenimiento:
        const prioridadFinal = prioridad || 'Normal';

        // 1. Guardar en Supabase (Primary)
        if (!supabase) {
            console.error('[SUPABASE] ERROR cr\u00edtico: credenciales (URL/KEY) no configuradas en entorno.');
            return res.status(500).json({ error: 'Configuraci\u00f3n de base de datos ausente' });
        }

        // Normalizaci\u00f3n de prioridad para Supabase (evitar "NORMAL")
        const prioridadSupabaseMap = {
            'URGENTE': 'URGENTE',
            'ALTA': 'ALTA',
            'MEDIA': 'MEDIA',
            'NORMAL': 'MEDIA',
            'BAJA': 'BAJA'
        };
        const prioridadSupabase = prioridadSupabaseMap[prioridadFinal.toUpperCase()] || 'MEDIA';

        const supabaseData = {
            ticket_id,
            parte_id: parte_id || null,
            session_id: session_id || null,
            fecha_creacion: new Date().toISOString(),
            casa,
            categoria,
            categoria_otro: categoria_otro || null,
            ubicacion: ubicacion || null,
            prioridad: prioridadSupabase,
            estado: 'PENDIENTE',
            descripcion,
            fotos_urls_json: fotosUrls_arr,
            video_url: videoUrl || null,
            responsable: user.nombre || null,
            origen: 'app',
            migrado_desde_sheets: false
        };

        const { error: supaErr } = await supabase.from('incidencias').insert(supabaseData);
        if (supaErr) {
            console.error('[SUPABASE] ERROR insertando incidencia:', supaErr.message || supaErr);
            return res.status(500).json({ error: 'Error al guardar la incidencia (BD)' });
        }
        console.log(`[SUPABASE] OK incidencia guardada (${ticket_id})`);

        // 2. Guardar en Sheets (Backup temporal)
        const rowData = buildIncidenciaRow({
            ticket_id,
            parte_id,
            session_id,
            fecha_creacion: `${fecha}T${hora}`,
            casa,
            categoria,
            categoria_otro,
            ubicacion,
            prioridad: prioridadFinal,
            estado: 'Pendiente',
            descripcion,
            fotos_urls_json: fotosUrls,
            video_url: videoUrl,
            responsable: user.nombre
        });

        await sheets.appendRow('IncidenciasMantenimiento', rowData);

        // Generar signed URLs para Telegram (7 d\u00edas)
        // Se hace un Promise.all para generarlas en paralelo de forma r\u00e1pida
        const fotosUrlsTg = await Promise.all(
            fotosUrls_arr.map(p => getIncidenciaSignedUrl(p).catch(() => null))
        ).then(urls => urls.filter(Boolean));

        const videoUrlTg = videoUrl ? await getIncidenciaSignedUrl(videoUrl).catch(() => null) : null;

        tg.notificarIncidencia({
            casa, categoria, ubicacion, prioridad: prioridadFinal, descripcion,
            limpiador: user.nombre, fotoUrls: fotosUrlsTg, videoUrl: videoUrlTg,
        }).catch(console.error);

        res.json({ ok: true, ticket_id });
    } catch (err) { next(err); }
    });
});

// GET /api/incidencias
router.get('/', requireAuth, async (req, res, next) => {
    try {
        if (!supabase) {
            console.error('[SUPABASE] ERROR cr\u00edtico: credenciales (URL/KEY) no configuradas en entorno.');
            return res.status(500).json({ error: 'Configuraci\u00f3n de base de datos ausente' });
        }

        let query = supabase
            .from('incidencias')
            .select('*')
            .order('fecha_creacion', { ascending: false })
            .limit(100);

        const estado = req.query.estado;
        const casa = req.query.casa;

        if (estado) {
            // Mapear el param frontend al ENUM estricto de Supabase
            let eqEstado = estado.toUpperCase();
            if (eqEstado === 'ABIERTA' || eqEstado === 'PENDIENTE') eqEstado = 'PENDIENTE';
            if (eqEstado === 'EN CURSO') eqEstado = 'EN_CURSO';
            if (eqEstado === 'RESUELTO' || eqEstado === 'RESUELTA') eqEstado = 'RESUELTA';
            if (eqEstado === 'DESCARTADO' || eqEstado === 'DESCARTADA') eqEstado = 'DESCARTADA';
            
            query = query.eq('estado', eqEstado);
        }
        
        if (casa) {
            query = query.eq('casa', casa);
        }

        const { data: rows, error } = await query;

        if (error) {
            console.error('[SUPABASE] ERROR leyendo incidencias:', error.message || error);
            return res.status(500).json({ error: 'Error al obtener incidencias desde la BD' });
        }

        // Mapeo retrocompatible para el Frontend: convertir ENUMs ("PENDIENTE") a formato original ("Pendiente")
        const mappedRows = rows.map(r => {
            let frontEstado = r.estado;
            if (r.estado === 'PENDIENTE') frontEstado = 'Pendiente';
            if (r.estado === 'EN_CURSO') frontEstado = 'En Curso';
            if (r.estado === 'RESUELTA') frontEstado = 'Resuelta';
            if (r.estado === 'DESCARTADA') frontEstado = 'Descartada';
            
            return { ...r, estado: frontEstado };
        });

        // Enriquecer con signed URLs (seguras, bucket privado)
        const enriched = await Promise.all(mappedRows.map(async (inc) => {
            // Fotos
            let fotos_signed_urls = [];
            let paths = [];
            
            // Supabase devuelve JSONB como Array real, Sheets lo devolv\u00eda como string
            if (Array.isArray(inc.fotos_urls_json)) {
                paths = inc.fotos_urls_json;
            } else if (typeof inc.fotos_urls_json === 'string' && inc.fotos_urls_json !== '[]') {
                try { paths = JSON.parse(inc.fotos_urls_json); } catch (_) {}
            }

            if (paths.length > 0) {
                fotos_signed_urls = (await Promise.all(
                    paths.map(async p => {
                        if (p.startsWith('http://') || p.startsWith('https://')) return p;
                        return await getIncidenciaSignedUrl(p).catch(() => null);
                    })
                )).filter(Boolean);
            }
            
            // Vídeo
            let video_signed_url = null;
            if (inc.video_url) {
                if (inc.video_url.startsWith('http://') || inc.video_url.startsWith('https://')) {
                    video_signed_url = inc.video_url;
                } else {
                    video_signed_url = await getIncidenciaSignedUrl(inc.video_url).catch(() => null);
                }
            }
            return { ...inc, fotos_signed_urls, video_signed_url };
        }));

        res.json(enriched);
    } catch (err) { next(err); }
});

// PATCH /api/incidencias/:id — actualizar estado y/o prioridad
router.patch('/:id', requireAuth, async (req, res, next) => {
    try {
        const { estado, notas_admin, responsable, prioridad, casa, categoria, ubicacion, descripcion } = req.body;
        const ticket_id = req.params.id;

        if (!supabase) {
            console.error('[SUPABASE] ERROR cr\u00edtico: credenciales (URL/KEY) no configuradas en entorno.');
            return res.status(500).json({ error: 'Configuraci\u00f3n de base de datos ausente' });
        }

        // 1. DUAL-WRITE: Supabase (Primary)
        const { data: supaRow, error: supaReadErr } = await supabase
            .from('incidencias')
            .select('*')
            .eq('ticket_id', ticket_id)
            .single();

        if (supaReadErr || !supaRow) {
            console.error('[SUPABASE] ERROR leyendo incidencia para update:', supaReadErr || 'No encontrada');
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        // Normalizaci\u00f3n de ENUMs Supabase
        const mapearEstado = (est) => {
            const upper = est.toUpperCase();
            if (upper === 'ABIERTA' || upper === 'PENDIENTE') return 'PENDIENTE';
            if (upper === 'EN CURSO' || upper === 'EN_CURSO') return 'EN_CURSO';
            if (upper === 'RESUELTA' || upper === 'RESUELTO') return 'RESUELTA';
            if (upper === 'DESCARTADA' || upper === 'DESCARTADO') return 'DESCARTADA';
            return 'PENDIENTE';
        };

        const mapearPrioridad = (pri) => {
            const upper = pri.toUpperCase();
            if (upper === 'URGENTE') return 'URGENTE';
            if (upper === 'ALTA') return 'ALTA';
            if (upper === 'MEDIA' || upper === 'NORMAL') return 'MEDIA';
            if (upper === 'BAJA') return 'BAJA';
            return 'MEDIA';
        };

        const supaNuevoEstado = estado ? mapearEstado(estado) : supaRow.estado;
        const supaNuevaPrioridad = prioridad ? mapearPrioridad(prioridad) : supaRow.prioridad;
        
        let supaFechaCierre = supaRow.fecha_cierre;
        if (supaNuevoEstado === 'RESUELTA' && supaRow.estado !== 'RESUELTA') {
            supaFechaCierre = new Date().toISOString();
        }

        const updateData = {
            estado: supaNuevoEstado,
            prioridad: supaNuevaPrioridad,
            fecha_cierre: supaNuevoEstado === 'RESUELTA' ? supaFechaCierre : supaRow.fecha_cierre,
            notas_admin: notas_admin || supaRow.notas_admin,
            responsable: responsable || supaRow.responsable,
            casa: casa || supaRow.casa,
            categoria: categoria || supaRow.categoria,
            ubicacion: ubicacion || supaRow.ubicacion,
            descripcion: descripcion || supaRow.descripcion
        };

        const { error: supaUpdateErr } = await supabase
            .from('incidencias')
            .update(updateData)
            .eq('ticket_id', ticket_id);

        if (supaUpdateErr) {
            console.error('[SUPABASE] ERROR actualizando incidencia:', supaUpdateErr.message || supaUpdateErr);
            return res.status(500).json({ error: 'Error al actualizar la incidencia (BD)' });
        }
        
        console.log(`[SUPABASE] OK incidencia actualizada (${ticket_id})`);

        // 2. DUAL-WRITE: Sheets (Legacy/Backup temporal)
        try {
            let rows = await sheets.readSheetAsObjects('IncidenciasMantenimiento');
            const row = rows.find(r => r.ticket_id === ticket_id);
            if (row) {
                const estadoActual = row.estado === 'Abierta' ? 'Pendiente' : row.estado;
                const sheetsNuevoEstado = estado || estadoActual;
                const sheetsNuevaPrioridad = prioridad || row.prioridad;
                // Mantener formato original local `today()` DD/MM/YYYY para sheets si se resuelve
                const isResolving = sheetsNuevoEstado.toUpperCase() === 'RESUELTA' || sheetsNuevoEstado.toUpperCase() === 'RESUELTO';
                const fechaCierreSheets = isResolving ? today() : row.fecha_cierre;

                const updated = buildIncidenciaRow({
                    ...row,
                    estado: sheetsNuevoEstado,
                    prioridad: sheetsNuevaPrioridad,
                    fecha_cierre: fechaCierreSheets,
                    notas_admin: notas_admin || row.notas_admin,
                    responsable: responsable || row.responsable,
                    casa: casa || row.casa,
                    categoria: categoria || row.categoria,
                    ubicacion: ubicacion || row.ubicacion,
                    descripcion: descripcion || row.descripcion
                });

                await sheets.updateRow('IncidenciasMantenimiento', row._row, updated);
            }
        } catch (sheetsErr) {
            console.error('[SHEETS] ERROR backup actualizando incidencia:', sheetsErr.message || sheetsErr);
            // No bloqueamos. Si Supabase grab\u00f3 ok, el flujo manda.
        }

        res.json({ ok: true });
    } catch (err) { next(err); }
});

// GET /api/incidencias/meta — enums para el frontend
router.get('/meta', requireAuth, (req, res) => {
    res.json({ categorias: CATEGORIAS_INCIDENCIA, ubicaciones: UBICACIONES });
});

module.exports = router;
