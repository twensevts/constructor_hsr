'use strict';

const router = require('express').Router();

router.get('/', async (req, res, next) => {
    const { element, rarity, search } = req.query;
    try {
        const params = [];
        let where = 'WHERE 1=1';
        let i = 1;
        if (element) { where += ` AND element = $${i++}`; params.push(element); }
        if (rarity)  { where += ` AND rarity  = $${i++}`; params.push(parseInt(rarity)); }
        if (search)  { where += ` AND name ILIKE $${i++}`; params.push(`%${search}%`); }

        const { rows } = await req.db.query(
            `SELECT id, name, icon_url, splash_url, rarity, element, path, game_version
             FROM characters ${where}
             ORDER BY name ASC`,
            params
        );
        res.json({ characters: rows });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const { rows } = await req.db.query(
            'SELECT * FROM characters WHERE id = $1', [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Character not found' });
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
