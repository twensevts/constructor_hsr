'use strict';
/**
 * JWT-аутентификация.
 * Требует заголовок: Authorization: Bearer <token>
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

/** Middleware: обязательная аутентификация */
function requireAuth(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized — token required' });
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
    }
}

/** Middleware: опциональная аутентификация (req.user может быть null) */
function optionalAuth(req, _res, next) {
    const header = req.headers['authorization'] || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
        try { req.user = jwt.verify(token, JWT_SECRET); } catch { /* ok */ }
    }
    next();
}

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
}

module.exports = { requireAuth, optionalAuth, signToken };
