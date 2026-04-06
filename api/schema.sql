-- ============================================================
-- HSR Character Constructor — PostgreSQL Schema
-- ============================================================
-- Требования: PostgreSQL 14+
-- Запуск:  psql -U postgres -d hsr_constructor -f schema.sql
-- ============================================================

-- Расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- ПОЛЬЗОВАТЕЛИ
-- ────────────────────────────────────────────────────────────

CREATE TABLE users (
    id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      VARCHAR(50)   NOT NULL UNIQUE,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- ПЕРСОНАЖИ  (справочник, засевается из characters.json)
-- ────────────────────────────────────────────────────────────

CREATE TABLE characters (
    id           VARCHAR(100)  PRIMARY KEY,          -- acheron, argenti …
    name         VARCHAR(100)  NOT NULL,
    icon_url     TEXT,
    splash_url   TEXT,
    rarity       SMALLINT      NOT NULL DEFAULT 5    -- 4 или 5
                               CHECK (rarity IN (4, 5)),
    element      VARCHAR(50),                         -- Lightning, Fire …
    path         VARCHAR(50),                         -- The Hunt, Nihility …
    game_version VARCHAR(10),                         -- 2.1, 3.0 …
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- НАБОРЫ РЕЛИКВИЙ  (справочник, засевается из relic_sets.json)
-- ────────────────────────────────────────────────────────────

CREATE TABLE relic_sets (
    id         VARCHAR(100)  PRIMARY KEY,
    name       VARCHAR(200)  NOT NULL,
    icon_url   TEXT,
    type       VARCHAR(10)   NOT NULL CHECK (type IN ('cavern', 'planar')),
    bonus_2pc  TEXT,
    bonus_4pc  TEXT,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Отдельные предметы набора (один на каждый слот)
CREATE TABLE relic_items (
    id       VARCHAR(100) PRIMARY KEY,
    set_id   VARCHAR(100) NOT NULL REFERENCES relic_sets(id) ON DELETE CASCADE,
    slot     VARCHAR(10)  NOT NULL
             CHECK (slot IN ('head','hands','body','feet','sphere','rope')),
    name     VARCHAR(200) NOT NULL,
    icon_url TEXT
);

CREATE INDEX idx_relic_items_set ON relic_items(set_id);

-- ────────────────────────────────────────────────────────────
-- ХАРАКТЕРИСТИКИ  (справочник)
-- ────────────────────────────────────────────────────────────

CREATE TABLE stats (
    id         VARCHAR(50)  PRIMARY KEY,    -- hp, atk_pct, crit_dmg …
    name       VARCHAR(100) NOT NULL,       -- «HP», «Урон крита» …
    unit       VARCHAR(5)   DEFAULT '',     -- '' или '%'
    is_main    BOOLEAN      DEFAULT FALSE,
    is_sub     BOOLEAN      DEFAULT FALSE,
    sub_weight SMALLINT     DEFAULT 1       -- вес для вероятности выпадения
);

-- ────────────────────────────────────────────────────────────
-- ТЕГИ
-- ────────────────────────────────────────────────────────────

CREATE TABLE tags (
    id   SERIAL       PRIMARY KEY,
    name VARCHAR(50)  NOT NULL UNIQUE
);

-- ────────────────────────────────────────────────────────────
-- БИЛДЫ (сеты персонажей)
-- ────────────────────────────────────────────────────────────

CREATE TABLE builds (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
    creator_key  TEXT,
    name         VARCHAR(100) NOT NULL,
    character_id VARCHAR(100) NOT NULL REFERENCES characters(id),
    notes        TEXT,
    is_public    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_builds_user      ON builds(user_id);
CREATE INDEX idx_builds_character ON builds(character_id);
CREATE INDEX idx_builds_public    ON builds(is_public) WHERE is_public = TRUE;

-- Связь «билд — теги» (многие-ко-многим)
CREATE TABLE build_tags (
    build_id UUID    NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
    PRIMARY KEY (build_id, tag_id)
);

CREATE INDEX idx_build_tags_build ON build_tags(build_id);
CREATE INDEX idx_build_tags_tag   ON build_tags(tag_id);

-- Лайки билдов (многие-ко-многим)
CREATE TABLE build_likes (
    build_id   UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (build_id, user_id)
);

CREATE INDEX idx_build_likes_build ON build_likes(build_id);

-- ────────────────────────────────────────────────────────────
-- ПРЕДМЕТЫ БИЛДА  (один слот = одна строка)
-- ────────────────────────────────────────────────────────────

CREATE TABLE build_pieces (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    build_id        UUID         NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    slot            VARCHAR(10)  NOT NULL
                    CHECK (slot IN ('head','hands','body','feet','sphere','rope')),
    set_id          VARCHAR(100) REFERENCES relic_sets(id),
    main_stat_id    VARCHAR(50)  REFERENCES stats(id),
    main_stat_value VARCHAR(20),       -- «705», «43.2%» — значение при макс. уровне
    obtained        BOOLEAN      NOT NULL DEFAULT FALSE,
    drop_chance     NUMERIC(24, 12),   -- вычисленный % шанса выпадения
    UNIQUE (build_id, slot)
);

CREATE INDEX idx_build_pieces_build ON build_pieces(build_id);

-- Подстаты предмета (до 4 штук)
CREATE TABLE build_substats (
    id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    piece_id   UUID         NOT NULL REFERENCES build_pieces(id) ON DELETE CASCADE,
    stat_id    VARCHAR(50)  NOT NULL REFERENCES stats(id),
    upgrades   SMALLINT     NOT NULL DEFAULT 0 CHECK (upgrades BETWEEN 0 AND 5),
    quality    VARCHAR(5)   NOT NULL DEFAULT 'mid'
               CHECK (quality IN ('low','mid','high')),
    value      VARCHAR(20),            -- итоговое строковое значение (с учётом прокачки)
    sort_order SMALLINT     NOT NULL DEFAULT 0
);

CREATE INDEX idx_build_substats_piece ON build_substats(piece_id);

-- ────────────────────────────────────────────────────────────
-- АВТО-ОБНОВЛЕНИЕ updated_at
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_builds_updated_at
    BEFORE UPDATE ON builds
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ────────────────────────────────────────────────────────────
-- ПРЕДСТАВЛЕНИЕ: краткая сводка по билду
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_build_summary AS
SELECT
    b.id,
    b.name                                           AS build_name,
    b.user_id,
    u.username,
    b.character_id,
    c.name                                           AS character_name,
    c.element,
    c.rarity,
    b.is_public,
    b.created_at,
    b.updated_at,
    COUNT(DISTINCT bp.id)                            AS pieces_count,
    COUNT(DISTINCT bp.id) FILTER (WHERE bp.obtained) AS obtained_count,
    ARRAY_AGG(DISTINCT t.name ORDER BY t.name)       AS tags
FROM builds b
LEFT JOIN users         u  ON u.id         = b.user_id
LEFT JOIN characters    c  ON c.id         = b.character_id
LEFT JOIN build_pieces  bp ON bp.build_id  = b.id
LEFT JOIN build_tags    bt ON bt.build_id  = b.id
LEFT JOIN tags          t  ON t.id         = bt.tag_id
GROUP BY b.id, u.username, c.name, c.element, c.rarity;

-- ────────────────────────────────────────────────────────────
-- НАЧАЛЬНЫЕ ДАННЫЕ (справочники статов)
-- ────────────────────────────────────────────────────────────

INSERT INTO stats (id, name, unit, is_main, is_sub, sub_weight) VALUES
  ('hp',        'HP',           '',  TRUE,  TRUE,  6),
  ('atk',       'ATK',          '',  TRUE,  TRUE,  4),
  ('def',       'DEF',          '',  FALSE, TRUE,  4),
  ('hp_pct',    'HP%',          '%', TRUE,  TRUE,  3),
  ('atk_pct',   'ATK%',         '%', TRUE,  TRUE,  3),
  ('def_pct',   'DEF%',         '%', TRUE,  TRUE,  3),
  ('spd',       'Скорость',     '',  TRUE,  TRUE,  3),
  ('crit_rate', 'Шанс крита',   '%', TRUE,  TRUE,  2),
  ('crit_dmg',  'Урон крита',   '%', TRUE,  TRUE,  2),
  ('eff_hit',   'Эффект попад.','%', TRUE,  FALSE, 2),
  ('eff_res',   'Сопр. эффек.', '%', FALSE, TRUE,  2),
  ('brk_eff',   'Эфф. пробоя',  '%', TRUE,  FALSE, 2),
  ('heal_out',  'Леч. наддача', '%', TRUE,  FALSE, 1),
  ('energy_reg','Восп. энергии','%', TRUE,  FALSE, 1),
  ('dmg_bonus', 'Бонус урона',  '%', TRUE,  FALSE, 1)
ON CONFLICT (id) DO NOTHING;
