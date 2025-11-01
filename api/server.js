'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express    = require('express');
const cors       = require('cors');
const { Pool }   = require('pg');

const authRoutes       = require('./routes/auth');
const buildsRoutes     = require('./routes/builds');
const charactersRoutes = require('./routes/characters');
const relicsRoutes     = require('./routes/relics');

const db = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'hsr_constructor',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASS     || '',
    max:      parseInt(process.env.DB_POOL_MAX || '10'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

db.on('error', err => console.error('[DB] unexpected error:', err));

module.exports.db = db;

const app  = express();
const PORT = parseInt(process.env.PORT || '3000');

app.use(cors({
    origin:      process.env.CORS_ORIGIN || '*',
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

app.use((req, _res, next) => {
    req.db = db;
    next();
});

app.use('/api/auth',       authRoutes);
app.use('/api/builds',     buildsRoutes);
app.use('/api/characters', charactersRoutes);
app.use('/api/relics',     relicsRoutes);

app.use(express.static(require('path').join(__dirname, '..')));

app.get('/api/health', async (req, res) => {
    try {
        await req.db.query('SELECT 1');
        res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
    } catch {
        res.status(503).json({ status: 'error', db: 'disconnected' });
    }
});

app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[Error]', err);
    const status  = err.status || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;
    res.status(status).json({ error: message });
});

app.listen(PORT, () => {
    console.log(`HSR API server running on http://localhost:${PORT}`);
});
