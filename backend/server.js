'use strict';
process.stdout.write('[DIAG] 0a — inicio\n');
require('dotenv').config();
process.stdout.write('[DIAG] 0b — dotenv OK\n');

const express = require('express');
process.stdout.write('[DIAG] 0c — express OK\n');
const session = require('express-session');
process.stdout.write('[DIAG] 0d — express-session OK\n');
const FileStore = require('session-file-store')(session);
process.stdout.write('[DIAG] 0e — FileStore OK\n');
const cors = require('cors');
process.stdout.write('[DIAG] 0f — cors OK\n');
const path = require('path');
process.stdout.write('[DIAG] 0g — path OK\n');

console.log('[DIAG] 1 — requires base OK');
const scheduler = require('./jobs/scheduler');
console.log('[DIAG] 2 — scheduler OK');
const app = express();
app.set('trust proxy', 1);
console.log('[DIAG] 3 — express OK');

// ─── Middleware ───────────────────────────────────────────────────────────────
const corsOptions = { origin: true, credentials: true };
app.use(cors(corsOptions));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
console.log('[DIAG] 4 — cors+json OK');

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    proxy: true,
    resave: false,
    saveUninitialized: false,
    store: new FileStore({
        path: '/tmp/dg-limpiezas-sessions',
        ttl: 12 * 60 * 60,
        retries: 1,
        logFn: function () { }
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 12 * 60 * 60 * 1000,
    },
}));
console.log('[DIAG] 5 — session+FileStore OK');

// ─── Archivos estáticos ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));
console.log('[DIAG] 6 — static OK');

// ─── Rutas API ────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
console.log('[DIAG] 7 — auth OK');
app.use('/api/config', require('./routes/config'));
app.use('/api/partes', require('./routes/partes'));
console.log('[DIAG] 8 — config+partes OK');
app.use('/api/incidencias', require('./routes/incidencias'));
console.log('[DIAG] 9 — incidencias OK');
app.use('/api/consumibles', require('./routes/consumibles'));
console.log('[DIAG] 10 — consumibles OK');
app.use('/api/propuestas', require('./routes/propuestas'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/limpiezas-profundas', require('./routes/limpiezas_profundas'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/tareas-periodicas', require('./routes/tareas-periodicas'));
console.log('[DIAG] 11 — todas las rutas OK');

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ─── Error handler ───────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error('[ERROR]', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});

// ─── Arrancar ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
console.log('[DIAG] 12 — llamando app.listen...');
app.listen(PORT, '0.0.0.0', () => {
    console.log('[DIAG] 13 — callback listen OK');
    console.log(`\n🧹 DG Limpiezas v2 → http://localhost:${PORT}`);
    console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
    scheduler.start();

    // Lazy load de Avaibook para no bloquear el inicio del servidor
    const syncAvaibook = require('./jobs/syncAvaibook');

    // Arranque Inicial y Cron de Avaibook MVP (cada 15 min)
    if (process.env.NODE_ENV === 'production') {
        setTimeout(() => syncAvaibook().catch(e => console.error('[Intro Sync Avaibook Error]', e)), 10000);
        setInterval(() => syncAvaibook().catch(e => console.error('[Cron Sync Avaibook Error]', e)), 15 * 60 * 1000);
        console.log('   Sync automática (Avaibook) ACTIVADA.');
    } else {
        console.log('   Sync automática (Avaibook) DESACTIVADA en desarrollo.');
    }
});
