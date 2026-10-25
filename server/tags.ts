import type { DB } from './db.ts';
import { transaction } from './db.ts';
import { rebuildThemes } from './ingest.ts';

/**
 * Learns which Steam tag id carries a tag name, then places games in themes from
 * their own top Steam tags only.
 *
 * Steam's app data gives each game's top tags as ids; SteamSpy lists games under a tag
 * *name*, but loosely (a game with a few votes for "Horror" is listed). For a name, the
 * matching id is the one whose carriers SteamSpy almost all lists under that name
 * (high coverage), with the most such games (support). Generic ids like "Indie" have
 * low coverage in any one list; narrower ids like "Psychological Horror" lose on support.
 */
export const MIN_COVERAGE = 0.8;
export const MIN_SUPPORT = 5;

export interface Learned {
  name: string;
  tagId: number | null;
  coverage: number;
  support: number;
}

export function learnTag(db: DB, name: string): Learned {
  const best = db
    .prepare(
      `WITH listed AS (SELECT appid FROM spy_tag WHERE tag_name = ?),
            cand AS (
              SELECT st.tag_id, COUNT(*) AS support FROM game_store_tag st JOIN listed l ON l.appid = st.appid
              GROUP BY st.tag_id HAVING support >= ?
            )
       SELECT c.tag_id, c.support, c.support * 1.0 / (SELECT COUNT(*) FROM game_store_tag x WHERE x.tag_id = c.tag_id) AS coverage
       FROM cand c WHERE coverage >= ? ORDER BY c.support DESC, coverage DESC LIMIT 1`,
    )
    .get(name, MIN_SUPPORT, MIN_COVERAGE) as { tag_id: number; support: number; coverage: number } | undefined;
  return best ? { name, tagId: best.tag_id, coverage: best.coverage, support: best.support } : { name, tagId: null, coverage: 0, support: 0 };
}

/** Learn every name, keep each id for the name with the strongest claim, then rebuild themes. */
export function learnAndApply(db: DB, names: string[]): Learned[] {
  const results = names.map((n) => learnTag(db, n));
  const byId = new Map<number, Learned>();
  for (const r of results) {
    if (r.tagId === null) continue;
    const prev = byId.get(r.tagId);
    if (!prev || r.support > prev.support) byId.set(r.tagId, r);
  }
  const at = new Date().toISOString();
  transaction(db, () => {
    db.exec('DELETE FROM tag_dict');
    const ins = db.prepare('INSERT INTO tag_dict (tag_id, name, coverage, support, learned_at) VALUES (?, ?, ?, ?, ?)');
    for (const r of byId.values()) ins.run(r.tagId, r.name, r.coverage, r.support, at);
    // Tags used for themes now come only from each game's own top Steam tags.
    db.exec('DELETE FROM game_tag');
    db.exec(
      `INSERT OR IGNORE INTO game_tag (appid, tag_id, tag_name, rank)
       SELECT st.appid, st.tag_id, d.name, st.rank FROM game_store_tag st JOIN tag_dict d ON d.tag_id = st.tag_id
       JOIN game g ON g.appid = st.appid AND g.app_type = 'game'`,
    );
  });
  rebuildThemes(db);
  return results.map((r) => (r.tagId !== null && byId.get(r.tagId) !== r ? { ...r, tagId: null } : r));
}
