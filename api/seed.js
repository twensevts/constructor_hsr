'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');

const db = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'hsr_constructor',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASS     || '',
});

const ROOT = path.join(__dirname, '..');

async function seedCharacters(client) {
    const raw = fs.readFileSync(path.join(ROOT, 'assets/characters.json'), 'utf8');
    const chars = JSON.parse(raw);
    let inserted = 0;

    for (const c of chars) {
        const rarity = c.rarity === '5 Star' ? 5 : 4;
        const { rowCount } = await client.query(
            `INSERT INTO characters (id, name, icon_url, splash_url, rarity, element, path, game_version)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (id) DO NOTHING`,
            [
                c.id,
                c.name,
                c.icon   || null,
                c.splash || null,
                rarity,
                c.combat_type || null,
                c.path        || null,
                c.version     || null
            ]
        );
        inserted += rowCount;
    }
    console.log(`characters: ${inserted} inserted (${chars.length} total)`);
}

async function seedRelicSets(client) {
    const raw = fs.readFileSync(path.join(ROOT, 'assets/relic_sets.json'), 'utf8');
    const sets = JSON.parse(raw);
    let setsInserted = 0;
    let itemsInserted = 0;

    for (const s of sets) {
        const { rowCount: sr } = await client.query(
            `INSERT INTO relic_sets (id, name, icon_url, type, bonus_2pc, bonus_4pc)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (id) DO NOTHING`,
            [
                s.id,
                s.name,
                s.icon              || null,
                s.type,
                s.bonuses?.['2_piece'] || null,
                s.bonuses?.['4_piece'] || null
            ]
        );
        setsInserted += sr;

        if (Array.isArray(s.items)) {
            for (const item of s.items) {
                const { rowCount: ir } = await client.query(
                    `INSERT INTO relic_items (id, set_id, slot, name, icon_url)
                     VALUES ($1,$2,$3,$4,$5)
                     ON CONFLICT (id) DO NOTHING`,
                    [item.id, s.id, item.slot, item.name, item.icon || null]
                );
                itemsInserted += ir;
            }
        }
    }
    console.log(`relic_sets: ${setsInserted} inserted (${sets.length} total)`);
    console.log(`relic_items: ${itemsInserted} inserted`);
}

async function main() {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await seedCharacters(client);
        await seedRelicSets(client);
        await client.query('COMMIT');
        console.log('Seeding complete.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Seeding failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await db.end();
    }
}

main();
