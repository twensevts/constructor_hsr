'use strict';
/**
 * GET /api/relics             — все наборы реликвий
 * GET /api/relics/:id         — один набор с предметами
 * GET /api/relics/stats/main  — главные статы по слотам
 * GET /api/relics/stats/sub   — подстаты
 */

const router = require('express').Router();

// Все наборы
router.get('/', async (req, res, next) => {
    const { type } = req.query; // 'cavern' | 'planar'
    try {
        const params = [];
        let where = '';
        if (type) { where = 'WHERE type = $1'; params.push(type); }

        const { rows } = await req.db.query(
            `SELECT id, name, icon_url, type, bonus_2pc, bonus_4pc
             FROM relic_sets ${where} ORDER BY name ASC`,
            params
        );
        res.json({ sets: rows });
    } catch (err) {
        next(err);
    }
});

// Один набор с предметами
router.get('/:id', async (req, res, next) => {
    try {
        const setQ = await req.db.query(
            'SELECT * FROM relic_sets WHERE id = $1', [req.params.id]
        );
        if (!setQ.rows[0]) return res.status(404).json({ error: 'Set not found' });

        const itemsQ = await req.db.query(
            'SELECT * FROM relic_items WHERE set_id = $1 ORDER BY slot',
            [req.params.id]
        );
        res.json({ ...setQ.rows[0], items: itemsQ.rows });
    } catch (err) {
        next(err);
    }
});

// Главные статы по слотам (читаем из таблицы stats)
router.get('/stats/main', async (req, res, next) => {
    try {
        const { rows } = await req.db.query(
            'SELECT id, name, unit FROM stats WHERE is_main = TRUE ORDER BY name'
        );
        res.json({ stats: rows });
    } catch (err) {
        next(err);
    }
});

// Подстаты
router.get('/stats/sub', async (req, res, next) => {
    try {
        const { rows } = await req.db.query(
            'SELECT id, name, unit, sub_weight FROM stats WHERE is_sub = TRUE ORDER BY sub_weight DESC, name'
        );
        res.json({ stats: rows });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
