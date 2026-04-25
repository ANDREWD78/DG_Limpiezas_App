'use strict';

function requireAuth(req, res, next) {
    if (req.session?.user) return next();
    return res.status(401).json({ error: 'No autorizado' });
}

function requireAdmin(req, res, next) {
    if (req.session?.user?.rol === 'admin') return next();
    return res.status(403).json({ error: 'Solo administradores' });
}

module.exports = { requireAuth, requireAdmin };
