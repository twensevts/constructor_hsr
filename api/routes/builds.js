'use strict';

const router = require('express').Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');

const VALID_SLOTS = ['head', 'hands', 'body', 'feet', 'sphere', 'rope'];

async function getBuildWithDetails(db, buildId) {
    const buildQ = await db.query(
        `SELECT b.*, c.name AS character_name, c.element, c.rarity, c.icon_url,
                ARRAY_AGG(DISTINCT t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
         FROM builds b
         LEFT JOIN characters c ON c.id = b.character_id
         LEFT JOIN build_tags  bt ON bt.build_id = b.id
         LEFT JOIN tags        t  ON t.id = bt.tag_id
         WHERE b.id = $1
         GROUP BY b.id, c.name, c.element, c.rarity, c.icon_url`,
        [buildId]
    );
    const build = buildQ.rows[0];
    if (!build) return null;

    const piecesQ = await db.query(
        `SELECT bp.*, rs.name AS set_name, rs.icon_url AS set_icon,
                s.name AS main_stat_name, s.unit AS main_stat_unit
         FROM build_pieces bp
         LEFT JOIN relic_sets rs ON rs.id = bp.set_id
         LEFT JOIN stats      s  ON s.id  = bp.main_stat_id
         WHERE bp.build_id = $1
         ORDER BY ARRAY_POSITION(ARRAY['head','hands','body','feet','sphere','rope'], bp.slot)`,
        [buildId]
    );

    const pieces = await Promise.all(piecesQ.rows.map(async piece => {
        const subsQ = await db.query(
            `SELECT bs.*, s.name, s.unit
             FROM build_substats bs
             JOIN stats s ON s.id = bs.stat_id
             WHERE bs.piece_id = $1
             ORDER BY bs.sort_order`,
            [piece.id]
        );
        return { ...piece, substats: subsQ.rows };
    }));

    return { ...build, pieces };
}

function ownsOrPublic(build, userId) {
    return build.is_public || (userId && build.user_id === userId);
}

router.get('/', requireAuth, async (req, res, next) => {
    const { character_id, element, tag, sort = 'created_at_desc', limit = 50, offset = 0 } = req.query;
    try {
        const params = [req.user.sub];
        let where = 'WHERE b.user_id = $1';
        let i = 2;

        if (character_id) { where += ` AND b.character_id = $${i++}`; params.push(character_id); }
        if (element)      { where += ` AND c.element = $${i++}`;      params.push(element); }
        if (tag)          { where += ` AND $${i++} = ANY(ARRAY_AGG(t.name))`; params.push(tag); }

        const orderMap = {
            'created_at_desc': 'b.created_at DESC',
            'created_at_asc':  'b.created_at ASC',
            'name_asc':        'b.name ASC',
            'name_desc':       'b.name DESC'
        };
        const orderBy = orderMap[sort] || 'b.created_at DESC';

        params.push(parseInt(limit), parseInt(offset));
        const { rows } = await req.db.query(
            `SELECT b.id, b.name, b.character_id, b.is_public, b.created_at, b.updated_at,
                    c.name AS character_name, c.element, c.rarity, c.icon_url,
                    COUNT(bp.id)                            AS pieces_count,
                    COUNT(bp.id) FILTER (WHERE bp.obtained) AS obtained_count,
                    ARRAY_AGG(DISTINCT t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
             FROM builds b
             LEFT JOIN characters   c  ON c.id = b.character_id
             LEFT JOIN build_pieces bp ON bp.build_id = b.id
             LEFT JOIN build_tags   bt ON bt.build_id = b.id
             LEFT JOIN tags         t  ON t.id = bt.tag_id
             ${where}
             GROUP BY b.id, c.name, c.element, c.rarity, c.icon_url
             ORDER BY ${orderBy}
             LIMIT $${i++} OFFSET $${i}`,
            params
        );
        res.json({ builds: rows });
    } catch (err) {
        next(err);
    }
});

router.get('/public', optionalAuth, async (req, res, next) => {
    const { element, tag, limit = 30 } = req.query;
    try {
        const params = [];
        let where = 'WHERE b.is_public = TRUE';
        let i = 1;
        if (element) { where += ` AND c.element = $${i++}`; params.push(element); }
        params.push(parseInt(limit));

        const { rows } = await req.db.query(
            `SELECT b.id, b.name, b.character_id, b.created_at,
                    c.name AS character_name, c.element, c.rarity,
                    u.username,
                    ARRAY_AGG(DISTINCT t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
             FROM builds b
             LEFT JOIN characters c  ON c.id = b.character_id
             LEFT JOIN users      u  ON u.id = b.user_id
             LEFT JOIN build_tags bt ON bt.build_id = b.id
             LEFT JOIN tags       t  ON t.id = bt.tag_id
             ${where}
             GROUP BY b.id, c.name, c.element, c.rarity, u.username
             ORDER BY b.created_at DESC
             LIMIT $${i}`,
            params
        );
        res.json({ builds: rows });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
    try {
        const build = await getBuildWithDetails(req.db, req.params.id);
        if (!build) return res.status(404).json({ error: 'Build not found' });
        if (!ownsOrPublic(build, req.user?.sub)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json(build);
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    const { name, character_id, notes, tags = [], pieces = [] } = req.body;
    if (!name || !character_id) {
        return res.status(422).json({ error: 'name и character_id обязательны' });
    }
    const client = await req.db.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `INSERT INTO builds (user_id, name, character_id, notes, is_public)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [null, name, character_id, notes || null, true]
        );
        const build = rows[0];

        for (const tagName of tags) {
            const t = await client.query(
                `INSERT INTO tags (name) VALUES ($1)
                 ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                 RETURNING id`,
                [String(tagName).trim().toLowerCase().slice(0, 50)]
            );
            await client.query(
                'INSERT INTO build_tags (build_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                [build.id, t.rows[0].id]
            );
        }

        for (const piece of pieces) {
            if (!VALID_SLOTS.includes(piece.slot)) continue;
            const { rows: pr } = await client.query(
                `INSERT INTO build_pieces
                    (build_id, slot, set_id, main_stat_id, main_stat_value, obtained, drop_chance)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                [
                    build.id, piece.slot,
                    piece.setId || null,
                    piece.mainStat?.id || null,
                    piece.mainStat?.value?.toString() || null,
                    !!piece.obtained,
                    piece.dropChance || null
                ]
            );
            const pieceId = pr[0].id;
            const substats = Array.isArray(piece.substats) ? piece.substats.slice(0, 4) : [];
            for (let i = 0; i < substats.length; i++) {
                const s = substats[i];
                if (!s?.id) continue;
                await client.query(
                    `INSERT INTO build_substats (piece_id, stat_id, upgrades, quality, value, sort_order)
                     VALUES ($1,$2,$3,$4,$5,$6)`,
                    [pieceId, s.id, s.upgrades || 0, s.quality || 'mid',
                     s.value?.toString() || null, i]
                );
            }
        }

        await client.query('COMMIT');
        const full = await getBuildWithDetails(req.db, build.id);
        res.status(201).json(full);
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

router.put('/:id', requireAuth, async (req, res, next) => {
    const { name, character_id, notes, is_public, tags = [], pieces = [] } = req.body;
    const client = await req.db.connect();
    try {
        const check = await client.query(
            'SELECT user_id FROM builds WHERE id = $1', [req.params.id]
        );
        if (!check.rows[0]) return res.status(404).json({ error: 'Not found' });
        if (check.rows[0].user_id !== req.user.sub) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await client.query('BEGIN');

        await client.query(
            `UPDATE builds SET name=$1, character_id=$2, notes=$3, is_public=$4, updated_at=NOW()
             WHERE id=$5`,
            [name, character_id, notes || null, !!is_public, req.params.id]
        );

        await client.query('DELETE FROM build_tags WHERE build_id=$1', [req.params.id]);
        for (const tagName of tags) {
            const t = await client.query(
                `INSERT INTO tags (name) VALUES ($1)
                 ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
                [String(tagName).trim().toLowerCase().slice(0, 50)]
            );
            await client.query(
                'INSERT INTO build_tags (build_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                [req.params.id, t.rows[0].id]
            );
        }

        await client.query('DELETE FROM build_pieces WHERE build_id=$1', [req.params.id]);
        for (const piece of pieces) {
            if (!VALID_SLOTS.includes(piece.slot)) continue;
            const { rows: pr } = await client.query(
                `INSERT INTO build_pieces
                    (build_id, slot, set_id, main_stat_id, main_stat_value, obtained, drop_chance)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                [
                    req.params.id, piece.slot,
                    piece.setId || null,
                    piece.mainStat?.id || null,
                    piece.mainStat?.value?.toString() || null,
                    !!piece.obtained,
                    piece.dropChance || null
                ]
            );
            const pieceId = pr[0].id;
            const substats = Array.isArray(piece.substats) ? piece.substats.slice(0, 4) : [];
            for (let i = 0; i < substats.length; i++) {
                const s = substats[i];
                if (!s?.id) continue;
                await client.query(
                    `INSERT INTO build_substats (piece_id, stat_id, upgrades, quality, value, sort_order)
                     VALUES ($1,$2,$3,$4,$5,$6)`,
                    [pieceId, s.id, s.upgrades || 0, s.quality || 'mid',
                     s.value?.toString() || null, i]
                );
            }
        }

        await client.query('COMMIT');
        const full = await getBuildWithDetails(req.db, req.params.id);
        res.json(full);
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

router.patch('/:id/pieces/:slot/obtained', requireAuth, async (req, res, next) => {
    const { slot } = req.params;
    if (!VALID_SLOTS.includes(slot)) {
        return res.status(422).json({ error: 'Invalid slot' });
    }
    const { obtained } = req.body;
    if (typeof obtained !== 'boolean') {
        return res.status(422).json({ error: 'obtained must be boolean' });
    }
    try {
        const build = await req.db.query('SELECT user_id FROM builds WHERE id=$1', [req.params.id]);
        if (!build.rows[0]) return res.status(404).json({ error: 'Not found' });
        if (build.rows[0].user_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });

        await req.db.query(
            'UPDATE build_pieces SET obtained=$1 WHERE build_id=$2 AND slot=$3',
            [obtained, req.params.id, slot]
        );
        res.json({ ok: true, slot, obtained });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
    try {
        const { rows } = await req.db.query(
            'DELETE FROM builds WHERE id=$1 AND user_id=$2 RETURNING id',
            [req.params.id, req.user.sub]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Not found or forbidden' });
        res.json({ ok: true, deleted: rows[0].id });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
