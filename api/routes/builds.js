'use strict';

const router = require('express').Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');

const VALID_SLOTS = ['head', 'hands', 'body', 'feet', 'sphere', 'rope'];

async function resolveSetId(dbOrClient, rawSetId, cache = new Map()) {
    if (!rawSetId) return null;
    const key = String(rawSetId);
    if (cache.has(key)) return cache.get(key);

    const direct = await dbOrClient.query('SELECT id FROM relic_sets WHERE id = $1', [key]);
    if (direct.rows[0]?.id) {
        cache.set(key, direct.rows[0].id);
        return direct.rows[0].id;
    }

    const viaItem = await dbOrClient.query('SELECT set_id FROM relic_items WHERE id = $1', [key]);
    const resolved = viaItem.rows[0]?.set_id || null;
    cache.set(key, resolved);
    return resolved;
}

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
    const { element, username, sort = 'created_at_desc', limit = 30 } = req.query;
    const currentUserId = req.user?.sub || null;
    try {
        const params = [];
        let i = 1;
        let where = 'WHERE b.is_public = TRUE';
        if (element)  { where += ` AND c.element = $${i++}`;  params.push(element); }
        if (username) { where += ` AND u.username = $${i++}`; params.push(username); }

        const limitIdx = i++;
        params.push(parseInt(limit));
        const userIdx = i;
        params.push(currentUserId);

        const orderBy = sort === 'likes' ? 'likes_count DESC, b.created_at DESC' : 'b.created_at DESC';

        const { rows } = await req.db.query(
            `SELECT b.id, b.name, b.character_id, b.created_at,
                    c.name AS character_name, c.element, c.rarity,
                    u.username,
                    COUNT(DISTINCT l.user_id)::int              AS likes_count,
                    BOOL_OR(l.user_id = $${userIdx}::uuid)      AS user_has_liked,
                    COALESCE(
                        JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
                            'slot', bp.slot,
                            'setId', bp.set_id,
                            'obtained', bp.obtained
                        )) FILTER (WHERE bp.set_id IS NOT NULL),
                        '[]'::jsonb
                    ) AS pieces,
                    ARRAY_AGG(DISTINCT t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
             FROM builds b
             LEFT JOIN characters  c  ON c.id = b.character_id
             LEFT JOIN users       u  ON u.id = b.user_id
             LEFT JOIN build_likes l  ON l.build_id = b.id
             LEFT JOIN build_pieces bp ON bp.build_id = b.id
             LEFT JOIN build_tags  bt ON bt.build_id = b.id
             LEFT JOIN tags        t  ON t.id = bt.tag_id
             ${where}
             GROUP BY b.id, c.name, c.element, c.rarity, u.username
             ORDER BY ${orderBy}
             LIMIT $${limitIdx}`,
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

router.post('/', optionalAuth, async (req, res, next) => {
    const { name, character_id, notes, is_public, tags = [], pieces = [] } = req.body;
    if (!name || !character_id) {
        return res.status(422).json({ error: 'name и character_id обязательны' });
    }
    const userId = req.user?.sub || null;
    const creatorKey = req.headers['x-constructor-hsr-creator-key'] || null;
    const isPublic = typeof is_public === 'boolean' ? is_public : true;
    const client = await req.db.connect();
    const setIdCache = new Map();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `INSERT INTO builds (user_id, creator_key, name, character_id, notes, is_public)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [userId, userId ? null : creatorKey, name, character_id, notes || null, isPublic]
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
            const resolvedSetId = await resolveSetId(client, piece.setId, setIdCache);
            const { rows: pr } = await client.query(
                `INSERT INTO build_pieces
                    (build_id, slot, set_id, main_stat_id, main_stat_value, obtained, drop_chance)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                [
                    build.id, piece.slot,
                    resolvedSetId,
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
    const setIdCache = new Map();
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
            const resolvedSetId = await resolveSetId(client, piece.setId, setIdCache);
            const { rows: pr } = await client.query(
                `INSERT INTO build_pieces
                    (build_id, slot, set_id, main_stat_id, main_stat_value, obtained, drop_chance)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                [
                    req.params.id, piece.slot,
                    resolvedSetId,
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

router.patch('/:id/visibility', requireAuth, async (req, res, next) => {
    const { is_public } = req.body;
    if (typeof is_public !== 'boolean') {
        return res.status(422).json({ error: 'is_public must be boolean' });
    }
    try {
        const { rows } = await req.db.query(
            'UPDATE builds SET is_public=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING id, is_public',
            [is_public, req.params.id, req.user.sub]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Not found or forbidden' });
        res.json({ ok: true, id: rows[0].id, is_public: rows[0].is_public });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', optionalAuth, async (req, res, next) => {
    try {
        const creatorKey = req.headers['x-constructor-hsr-creator-key'] || null;
        const userId = req.user?.sub || null;
        const { rows } = await req.db.query(
            'DELETE FROM builds WHERE id=$1 AND (user_id=$2 OR creator_key=$3) RETURNING id',
            [req.params.id, userId, creatorKey]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Not found or forbidden' });
        res.json({ ok: true, deleted: rows[0].id });
    } catch (err) {
        next(err);
    }
});

router.post('/:id/like', requireAuth, async (req, res, next) => {
    try {
        await req.db.query(
            'INSERT INTO build_likes (build_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [req.params.id, req.user.sub]
        );
        const { rows } = await req.db.query(
            'SELECT COUNT(*)::int AS likes_count FROM build_likes WHERE build_id=$1',
            [req.params.id]
        );
        res.json({ ok: true, likes_count: rows[0].likes_count, user_has_liked: true });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id/like', requireAuth, async (req, res, next) => {
    try {
        await req.db.query(
            'DELETE FROM build_likes WHERE build_id=$1 AND user_id=$2',
            [req.params.id, req.user.sub]
        );
        const { rows } = await req.db.query(
            'SELECT COUNT(*)::int AS likes_count FROM build_likes WHERE build_id=$1',
            [req.params.id]
        );
        res.json({ ok: true, likes_count: rows[0].likes_count, user_has_liked: false });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
