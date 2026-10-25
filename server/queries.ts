import type { DB } from './db.ts';
import { getMeta } from './db.ts';
import { PAGE_SIZE } from '../shared/query.ts';
import { LABEL_BY_SLUG, REVIEW_COUNT_STEPS } from '../shared/reviews.ts';
import type { CatalogResponse, Facet, FacetGroup, GameCardData, GamesQuery, GamesResponse, Screenshot, SortKey } from '../shared/types.ts';
import { FACET_GROUPS } from '../shared/types.ts';
import { steamStoreUrl } from './ingest.ts';

type Param = string | number;
type Skip = FacetGroup | 'label' | 'reviews';

const ORDER_BY: Record<SortKey, string> = {
  rating_desc: 'g.review_rating IS NULL, g.review_rating DESC, g.appid ASC',
  rating_asc: 'g.review_rating IS NULL, g.review_rating ASC, g.appid ASC',
  reviews_desc: 'g.review_total IS NULL, g.review_total DESC, g.appid ASC',
  name_asc: 'g.name_sort ASC, g.appid ASC',
  name_desc: 'g.name_sort DESC, g.appid DESC',
  release_desc: 'g.release_date IS NULL, g.release_date DESC, g.name_sort ASC',
};

const GROUP_KEY: Record<FacetGroup, keyof Pick<GamesQuery, 'genre' | 'feature' | 'theme' | 'cd'>> = {
  genre: 'genre',
  feature: 'feature',
  theme: 'theme',
  content_descriptor: 'cd',
};

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * WHERE clause for the catalog. OR inside a group, AND across groups and with the
 * review thresholds. `skip` leaves one condition out, for contextual counts.
 * Unknown data (no reviews, unknown descriptors) never satisfies a filter on it.
 */
export function buildWhere(q: GamesQuery, skip?: Skip): { sql: string; params: Param[] } {
  const parts: string[] = [`g.app_type = 'game'`];
  const params: Param[] = [];

  // Trademark signs never block a match: "fc 26" finds "EA SPORTS FC™ 26".
  const term = q.q.replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (term) {
    parts.push(`replace(replace(replace(lower(g.name), '™', ''), '®', ''), '©', '') LIKE ? ESCAPE '\\'`);
    params.push(`%${escapeLike(term)}%`);
  }
  if (q.label.length && skip !== 'label') {
    parts.push(`g.review_label IN (${q.label.map(() => '?').join(', ')})`);
    params.push(...q.label);
  }
  if (q.reviews !== null && skip !== 'reviews') {
    parts.push('g.review_total >= ?');
    params.push(q.reviews);
  }

  for (const group of FACET_GROUPS) {
    if (group === skip) continue;
    const slugs = q[GROUP_KEY[group]];
    if (!slugs.length) continue;
    const ids = slugs.map((s) => `${group}:${s}`);
    const marks = ids.map(() => '?').join(', ');
    const exists = `EXISTS (SELECT 1 FROM game_facet f WHERE f.appid = g.appid AND f.facet_id IN (${marks}))`;
    if (group === 'content_descriptor') {
      parts.push(`g.descriptors_known = 1 AND ${q.cdMode === 'exclude' ? 'NOT ' : ''}${exists}`);
    } else {
      parts.push(exists);
    }
    params.push(...ids);
  }
  return { sql: parts.join(' AND '), params };
}

function cardTags(db: DB, appids: number[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  if (!appids.length) return out;
  const marks = appids.map(() => '?').join(', ');
  // Themes first (the mood), then genres; three at most.
  const rows = db
    .prepare(
      `SELECT gf.appid, f.label FROM game_facet gf JOIN facet f ON f.id = gf.facet_id
       WHERE gf.appid IN (${marks}) AND f.grp IN ('theme', 'genre')
       ORDER BY gf.appid, CASE f.grp WHEN 'theme' THEN 0 ELSE 1 END, f.label`,
    )
    .all(...appids) as { appid: number; label: string }[];
  for (const r of rows) {
    const list = out.get(r.appid) ?? [];
    if (list.length < 3) list.push(r.label);
    out.set(r.appid, list);
  }
  return out;
}

interface Row {
  appid: number;
  name: string;
  thumbnail_url: string | null;
  review_positive: number | null;
  review_negative: number | null;
  review_rating: number | null;
  review_label: string | null;
  reviews_source: string | null;
  release_date: string | null;
  developer: string | null;
  publisher: string | null;
  short_description: string | null;
  screenshots: string | null;
  store_fetched_at: string | null;
}

const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';

function parseShots(json: string | null): Screenshot[] | null {
  if (json === null) return null;
  try {
    return JSON.parse(json) as Screenshot[];
  } catch {
    return [];
  }
}

export function queryGames(db: DB, q: GamesQuery, pageSize = PAGE_SIZE): GamesResponse {
  const where = buildWhere(q);
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM game g WHERE ${where.sql}`).get(...where.params) as { n: number }).n;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(q.page, pageCount);
  const rows = db
    .prepare(
      `SELECT g.appid, g.name, g.thumbnail_url, g.review_positive, g.review_negative, g.review_rating, g.review_label, g.reviews_source,
              g.release_date, g.developer, g.publisher, g.short_description, g.screenshots, g.store_fetched_at
       FROM game g WHERE ${where.sql} ORDER BY ${ORDER_BY[q.sort]} LIMIT ? OFFSET ?`,
    )
    .all(...where.params, pageSize, (page - 1) * pageSize) as unknown as Row[];

  const tags = cardTags(db, rows.map((r) => r.appid));
  const items: GameCardData[] = rows.map((r) => {
    const pos = r.review_positive ?? 0;
    const neg = r.review_negative ?? 0;
    const label = r.review_label ? LABEL_BY_SLUG.get(r.review_label) ?? null : null;
    return {
      appid: r.appid,
      name: r.name,
      thumbnailUrl: r.thumbnail_url,
      steamUrl: steamStoreUrl(r.appid),
      tags: tags.get(r.appid) ?? [],
      reviews:
        r.review_rating === null
          ? null
          : { positive: pos, negative: neg, total: pos + neg, rating: r.review_rating, label: label?.label ?? null, tone: label?.tone ?? null, basis: r.reviews_source === 'steam_search' ? 'english' : 'all' },
      releaseDate: r.release_date,
      developer: r.developer,
      publisher: r.publisher,
      description: r.short_description,
      screenshots: parseShots(r.screenshots),
      capsuleUrl: `${CDN}/${r.appid}/library_600x900.jpg`,
      storeChecked: r.store_fetched_at !== null,
    };
  });

  return { items, total, page, pageSize, pageCount, counts: facetCounts(db, q), reviewCounts: reviewCounts(db, q) };
}

/** For each group: how many games match every other active filter and carry the facet. */
export function facetCounts(db: DB, q: GamesQuery): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const group of FACET_GROUPS) {
    const w = buildWhere(q, group);
    // Nothing else filters: plain totals from the index (descriptors only exist where known).
    if (w.params.length === 0) {
      const rows = db
        .prepare('SELECT facet_id AS id, COUNT(*) AS n FROM game_facet WHERE facet_id >= ? AND facet_id < ? GROUP BY facet_id')
        .all(`${group}:`, `${group};`) as { id: string; n: number }[];
      for (const r of rows) counts[r.id] = r.n;
      continue;
    }
    const extra = group === 'content_descriptor' ? ' AND g.descriptors_known = 1' : '';
    const rows = db
      .prepare(
        `SELECT gf.facet_id AS id, COUNT(*) AS n FROM game_facet gf JOIN game g ON g.appid = gf.appid
         WHERE gf.facet_id >= ? AND gf.facet_id < ? AND ${w.sql}${extra} GROUP BY gf.facet_id`,
      )
      .all(`${group}:`, `${group};`, ...w.params) as { id: string; n: number }[];
    for (const r of rows) counts[r.id] = r.n;
  }
  return counts;
}

/** How many games each rating and review-count option would leave, given the other filters. */
export function reviewCounts(db: DB, q: GamesQuery): Record<string, number> {
  const out: Record<string, number> = {};
  const l = buildWhere(q, 'label');
  const rows = db
    .prepare(`SELECT g.review_label AS slug, COUNT(*) AS n FROM game g WHERE ${l.sql} AND g.review_label IS NOT NULL GROUP BY g.review_label`)
    .all(...l.params) as { slug: string; n: number }[];
  for (const row of rows) out[`label:${row.slug}`] = row.n;
  const c = buildWhere(q, 'reviews');
  const countSums = REVIEW_COUNT_STEPS.map((s) => `SUM(g.review_total >= ${s}) AS "reviews:${s}"`).join(', ');
  Object.assign(out, db.prepare(`SELECT ${countSums} FROM game g WHERE ${c.sql}`).get(...c.params));
  for (const k of Object.keys(out)) out[k] = Number(out[k] ?? 0);
  return out;
}

export function catalog(db: DB): CatalogResponse {
  // Only games carry filter links, so a facet's total is a count over its index.
  const facets = db
    .prepare(
      `SELECT f.id, f.slug, f.label, f.grp, f.source_id,
              (SELECT COUNT(*) FROM game_facet gf WHERE gf.facet_id = f.id) AS total
       FROM facet f ORDER BY f.grp, total DESC, f.label`,
    )
    .all() as { id: string; slug: string; label: string; grp: FacetGroup; source_id: string | null; total: number }[];

  const stats = db
    .prepare(
      `SELECT COUNT(*) AS n, SUM(descriptors_known) AS known, SUM(release_date IS NOT NULL) AS dated,
              SUM(review_total > 0) AS reviewed,
              COUNT(DISTINCT reviews_source) AS sources, MAX(reviews_source) AS source
       FROM game WHERE app_type = 'game'`,
    )
    .get() as { n: number; known: number | null; dated: number | null; reviewed: number | null; sources: number; source: string | null };
  const pending = (db.prepare(`SELECT COUNT(*) AS n FROM game WHERE details_at IS NULL`).get() as { n: number }).n;

  const sorts: SortKey[] = [];
  const reviewed = stats.reviewed ?? 0;
  // Review sorts only when most of the catalog has review counts; release sort when nearly all have dates.
  if (stats.n > 0 && reviewed / stats.n >= 0.5) sorts.push('rating_desc', 'rating_asc', 'reviews_desc');
  if (stats.n > 0 && (stats.dated ?? 0) / stats.n >= 0.9) sorts.push('release_desc');
  sorts.push('name_asc', 'name_desc');

  const heartbeat = getMeta(db, 'import_heartbeat');
  const mode = getMeta(db, 'catalog_mode');
  return {
    mode: mode === 'steam' ? 'steam' : mode === 'mirror' ? 'mirror' : 'demo',
    gameCount: stats.n,
    pendingCount: pending,
    importRunning: !!heartbeat && Date.now() - Date.parse(heartbeat) < 5 * 60_000,
    lastUpdated: getMeta(db, 'last_updated') ?? heartbeat,
    sorts,
    descriptorsKnown: stats.known ?? 0,
    reviewsKnown: reviewed,
    reviewsSource: reviewed === 0 ? null : stats.sources > 1 ? 'mixed' : (stats.source as 'steam' | 'steamspy'),
    reviewsUpdated: getMeta(db, 'reviews_updated'),
    facets: facets.map<Facet>((f) => ({
      id: f.id,
      slug: f.slug,
      label: f.label,
      group: f.grp,
      sourceId: f.source_id,
      total: f.total,
    })),
  };
}
