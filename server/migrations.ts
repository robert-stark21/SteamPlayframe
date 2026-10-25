/** Steam's summary label as SQL over a row prefix ('' or 'NEW.'); keep in step with steamReviewSlug(). */
function labelCase(p: string): string {
  const pct = `${p}review_positive * 100.0 / ${p}review_total`;
  return `CASE
        WHEN ${p}review_total IS NULL OR ${p}review_total < 10 THEN NULL
        WHEN ${pct} >= 80 THEN CASE
          WHEN ${p}review_total >= 500 AND ${pct} >= 95 THEN 'overwhelmingly-positive'
          WHEN ${p}review_total >= 50 THEN 'very-positive' ELSE 'positive' END
        WHEN ${pct} >= 70 THEN 'mostly-positive'
        WHEN ${pct} >= 40 THEN 'mixed'
        WHEN ${pct} >= 20 THEN 'mostly-negative'
        WHEN ${p}review_total >= 500 THEN 'overwhelmingly-negative'
        WHEN ${p}review_total >= 50 THEN 'very-negative'
        ELSE 'negative' END`;
}

/** Ordered schema migrations. Never edit one that has shipped; append a new one. */
export const MIGRATIONS: { id: number; name: string; sql: string }[] = [
  {
    id: 1,
    name: 'init',
    sql: `
      CREATE TABLE game (
        appid             INTEGER PRIMARY KEY,
        name              TEXT    NOT NULL,
        name_sort         TEXT    NOT NULL,
        app_type          TEXT    NOT NULL,           -- 'game', 'demo', 'dlc', ... only 'game' is listed
        thumbnail_url     TEXT,
        release_date      TEXT,                       -- ISO date or NULL when unknown
        descriptors_known INTEGER NOT NULL DEFAULT 0,  -- 1: descriptor list verified (may be empty); 0: unknown
        source            TEXT    NOT NULL,           -- 'steam' | 'authorized_steamdb' | 'demo_fixture'
        source_url        TEXT    NOT NULL,
        fetched_at        TEXT    NOT NULL
      );
      CREATE INDEX game_list_idx ON game (app_type, name_sort, appid);

      CREATE TABLE facet (
        id        TEXT PRIMARY KEY,                   -- '<group>:<slug>'
        grp       TEXT NOT NULL CHECK (grp IN ('genre','feature','theme','content_descriptor')),
        slug      TEXT NOT NULL,
        label     TEXT NOT NULL,
        source_id TEXT,                               -- namespaced source id, e.g. 'steam_genre:1'
        UNIQUE (grp, slug)
      );

      CREATE TABLE game_facet (
        appid    INTEGER NOT NULL REFERENCES game(appid) ON DELETE CASCADE,
        facet_id TEXT    NOT NULL REFERENCES facet(id)  ON DELETE CASCADE,
        PRIMARY KEY (appid, facet_id)
      ) WITHOUT ROWID;
      CREATE INDEX game_facet_facet_idx ON game_facet (facet_id, appid);

      -- Raw Steam user tags, kept so themes can be re-derived when the mapping changes.
      CREATE TABLE game_tag (
        appid    INTEGER NOT NULL REFERENCES game(appid) ON DELETE CASCADE,
        tag_id   INTEGER,
        tag_name TEXT    NOT NULL,
        rank     INTEGER NOT NULL,
        PRIMARY KEY (appid, tag_name)
      ) WITHOUT ROWID;

      CREATE TABLE meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    id: 2,
    name: 'user_reviews',
    sql: `
      ALTER TABLE game ADD COLUMN review_positive INTEGER;     -- NULL = unknown
      ALTER TABLE game ADD COLUMN review_negative INTEGER;
      ALTER TABLE game ADD COLUMN review_total INTEGER;
      ALTER TABLE game ADD COLUMN review_rating REAL;          -- SteamDB formula, 0..1
      ALTER TABLE game ADD COLUMN reviews_source TEXT;         -- 'steam' | 'steamspy'
      ALTER TABLE game ADD COLUMN reviews_fetched_at TEXT;
      ALTER TABLE game ADD COLUMN details_at TEXT;             -- when type/genres/features/descriptors were last loaded; NULL = pending
      CREATE INDEX game_rating_idx ON game (app_type, review_rating);
      CREATE INDEX game_review_total_idx ON game (app_type, review_total);
      CREATE INDEX game_pending_idx ON game (details_at, review_total);
    `,
  },
  {
    id: 3,
    name: 'review_label_and_store_details',
    sql: `
      ALTER TABLE game ADD COLUMN review_label TEXT;           -- Steam summary label slug, NULL under 10 reviews
      ALTER TABLE game ADD COLUMN developer TEXT;
      ALTER TABLE game ADD COLUMN publisher TEXT;
      ALTER TABLE game ADD COLUMN short_description TEXT;
      ALTER TABLE game ADD COLUMN screenshots TEXT;            -- JSON [{thumb, full}], first few
      ALTER TABLE game ADD COLUMN store_fetched_at TEXT;       -- Steam store details; NULL = not fetched
      ALTER TABLE game ADD COLUMN details_v INTEGER NOT NULL DEFAULT 1;  -- below DETAILS_VERSION = re-fetch details
      UPDATE game SET review_label = ${labelCase('')};
      -- Every writer gets the label, whichever code path set the counts.
      CREATE TRIGGER game_review_label AFTER UPDATE OF review_positive, review_negative, review_total ON game
      BEGIN UPDATE game SET review_label = ${labelCase('NEW.')} WHERE appid = NEW.appid; END;
      CREATE INDEX game_label_idx ON game (app_type, review_label);
    `,
  },
  {
    id: 4,
    name: 'steam_store_tags',
    sql: `
      -- A game's top Steam tags as Steam ranks them (ids only; names come from tag_dict).
      CREATE TABLE game_store_tag (
        appid  INTEGER NOT NULL REFERENCES game(appid) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL,
        rank   INTEGER NOT NULL,
        PRIMARY KEY (appid, tag_id)
      ) WITHOUT ROWID;
      CREATE INDEX game_store_tag_tag_idx ON game_store_tag (tag_id, appid);
      -- Tag id ↔ name, learned by matching SteamSpy's per-tag game lists against store tags.
      CREATE TABLE tag_dict (
        tag_id   INTEGER PRIMARY KEY,
        name     TEXT NOT NULL,
        coverage REAL NOT NULL,   -- share of games carrying the id that SteamSpy lists under the name
        support  INTEGER NOT NULL,
        learned_at TEXT NOT NULL
      );
      -- SteamSpy's per-tag lists, kept so the dictionary can be re-learned without refetching.
      CREATE TABLE spy_tag (
        tag_name TEXT NOT NULL,
        appid    INTEGER NOT NULL,
        PRIMARY KEY (tag_name, appid)
      ) WITHOUT ROWID;
    `,
  },
];
