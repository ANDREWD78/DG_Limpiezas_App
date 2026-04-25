'use strict';
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cors = require('cors');
const path = require('path');

const scheduler = require('./jobs/scheduler');
console.log('2️⃣ Scheduler cargado');
const app = express();
console.log('1️⃣ Express creado');
app.set('trust proxy', 1);

// ─── Middleware ───────────────────────────────────────────────────────────────
const corsOptions = { origin: true, credentials: true };
app.use(cors(corsOptions));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

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

// ─── Archivos estáticos ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── Rutas API ────────────────────────────────────────────────────────────────
console.log('3️⃣ Antes rutas auth');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/config', require('./routes/config'));
app.use('/api/partes', require('./routes/partes'));
console.log('5️⃣ Antes rutas incidencias');
app.use('/api/incidencias', require('./routes/incidencias'));
console.log('4️⃣ Antes rutas consumibles');
app.use('/api/consumibles', require('./routes/consumibles'));
app.use('/api/propuestas', require('./routes/propuestas'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/limpiezas-profundas', require('./routes/limpiezas_profundas'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/tareas-periodicas', require('./routes/tareas-periodicas'));

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
console.log('6️⃣ Antes app.listen');
app.listen(PORT, '0.0.0.0', () => {
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
