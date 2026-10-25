import type { DB } from './db.ts';
import { transaction } from './db.ts';
import type { FacetGroup } from '../shared/types.ts';
import { FEATURE_LABELS, STEAM_CONTENT_DESCRIPTORS, THEMES, slugify, themesForTags } from './taxonomy.ts';
import { steamDbRating } from '../shared/reviews.ts';

export interface SourceLabel {
  label: string;
  /** Namespaced source id, e.g. 'steam_genre:1', 'steam_category:2'. */
  sourceId: string | null;
}

/** One app, normalized from any provider before it touches the database. */
export interface NormalizedGame {
  appid: number;
  name: string;
  appType: string;
  thumbnailUrl: string | null;
  releaseDate: string | null;
  genres: SourceLabel[];
  categories: SourceLabel[];
  tags: { id: number | null; name: string }[];
  /** null = unknown; [] = verified: no descriptors. */
  contentDescriptors: { id: number; label?: string }[] | null;
  source: 'steam' | 'steamcmd' | 'authorized_steamdb' | 'demo_fixture';
  sourceUrl: string;
  fetchedAt: string;
  /** Review counts, when the provider has them. */
  reviews?: ReviewCounts | null;
  developer?: string | null;
  publisher?: string | null;
  /** Steam's top tag ids for the app, in Steam's order. */
  storeTagIds?: number[];
}

/** Bump when the details parser learns new fields; older rows are fetched again. */
export const DETAILS_VERSION = 3;

export interface StoreDetails {
  description: string | null;
  screenshots: { thumb: string; full: string }[];
  developer: string | null;
  publisher: string | null;
}

/** Steam store extras: description and screenshots. Keeps the mirror's developer and publisher when present. */
export function applyStoreDetails(db: DB, appid: number, d: StoreDetails | null, at: string): void {
  db.prepare(
    `UPDATE game SET short_description = ?, screenshots = ?, developer = COALESCE(developer, ?),
       publisher = COALESCE(publisher, ?), store_fetched_at = ? WHERE appid = ?`,
  ).run(d?.description ?? null, JSON.stringify(d?.screenshots ?? []), d?.developer ?? null, d?.publisher ?? null, at, appid);
}

export interface ReviewCounts {
  positive: number;
  negative: number;
  /** steam_search: Steam's summary for English reviews, used only where SteamSpy has none. */
  source: 'steam' | 'steamspy' | 'steam_search';
  fetchedAt: string;
}

function setReviews(db: DB, appid: number, r: ReviewCounts | null): void {
  if (!r) return;
  const total = r.positive + r.negative;
  db.prepare(
    `UPDATE game SET review_positive = ?, review_negative = ?, review_total = ?, review_rating = ?,
       reviews_source = ?, reviews_fetched_at = ? WHERE appid = ?`,
  ).run(r.positive, r.negative, total, steamDbRating(r.positive, r.negative), r.source, r.fetchedAt, appid);
}

/**
 * A row from the full game list: name and review counts only. New apps wait as
 * 'pending' (hidden) until their details confirm they are games. Never touches details.
 */
export function upsertListed(db: DB, appid: number, name: string, reviews: ReviewCounts | null, sourceUrl: string, listSource: 'steamspy' | 'steam_search' = 'steamspy'): void {
  const prev = db.prepare('SELECT review_total, reviews_source FROM game WHERE appid = ?').get(appid) as { review_total: number | null; reviews_source: string | null } | undefined;
  db.prepare(
    `INSERT INTO game (appid, name, name_sort, app_type, source, source_url, fetched_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?)
     ON CONFLICT(appid) DO UPDATE SET name = CASE WHEN game.details_at IS NULL THEN excluded.name ELSE game.name END,
       name_sort = CASE WHEN game.details_at IS NULL THEN excluded.name_sort ELSE game.name_sort END`,
  ).run(appid, name, sortName(name) || name.toLowerCase(), listSource, sourceUrl, reviews?.fetchedAt ?? new Date().toISOString());
  if (!reviews) return;
  const has = (prev?.review_total ?? 0) > 0;
  const total = reviews.positive + reviews.negative;
  // All-language counts (SteamSpy, Steam) win; Steam's English-only search summary only fills a gap.
  if (reviews.source === 'steam_search') {
    if (!has || prev?.reviews_source === 'steam_search') setReviews(db, appid, reviews);
  } else if (total > 0 || !has) {
    setReviews(db, appid, reviews);
  }
}

/** Details for a listed app: type, artwork, date, genres, features, descriptors. Keeps themes and reviews. */
export function applyDetails(db: DB, g: NormalizedGame): void {
  db.prepare(
    `UPDATE game SET name = ?, name_sort = ?, app_type = ?, thumbnail_url = ?, release_date = ?,
       descriptors_known = ?, source = ?, source_url = ?, fetched_at = ?, details_at = ?,
       developer = COALESCE(?, developer), publisher = COALESCE(?, publisher), details_v = ? WHERE appid = ?`,
  ).run(
    g.name, sortName(g.name) || g.name.toLowerCase(), g.appType, g.thumbnailUrl, g.releaseDate,
    g.contentDescriptors === null ? 0 : 1, g.source, g.sourceUrl, g.fetchedAt, g.fetchedAt,
    g.developer ?? null, g.publisher ?? null, DETAILS_VERSION, g.appid,
  );
  db.prepare(`DELETE FROM game_facet WHERE appid = ? AND facet_id NOT LIKE 'theme:%'`).run(g.appid);
  if (g.storeTagIds) {
    db.prepare('DELETE FROM game_store_tag WHERE appid = ?').run(g.appid);
    const st = db.prepare('INSERT OR IGNORE INTO game_store_tag (appid, tag_id, rank) VALUES (?, ?, ?)');
    g.storeTagIds.forEach((id, i) => st.run(g.appid, id, i));
  }
  const link = db.prepare('INSERT OR IGNORE INTO game_facet (appid, facet_id) VALUES (?, ?)');
  for (const id of facetIdsFor(db, { ...g, tags: [] })) link.run(g.appid, id);
}

/** Mark an app whose details could not be found, so it is not retried every run. */
export function markDetailsMissing(db: DB, appid: number, at: string): void {
  db.prepare(`UPDATE game SET app_type = 'unknown', details_at = ? WHERE appid = ?`).run(at, appid);
}

/** One Steam tag, by name, for a set of apps: replaces that tag's rows and re-derives the themes it feeds. */
export function applyTag(db: DB, tagName: string, appids: number[]): number {
  db.prepare('DELETE FROM game_tag WHERE tag_name = ?').run(tagName);
  const ins = db.prepare('INSERT OR IGNORE INTO game_tag (appid, tag_id, tag_name, rank) SELECT appid, NULL, ?, 0 FROM game WHERE appid = ?');
  let n = 0;
  for (const appid of appids) n += Number(ins.run(tagName, appid).changes);
  return n;
}

export function steamStoreUrl(appid: number): string {
  return `https://store.steampowered.com/app/${appid}/`;
}

function sortName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9 ]+/g, '')
    .trim();
}

function ensureFacet(db: DB, group: FacetGroup, label: string, sourceId: string | null, slugOverride?: string): string {
  const slug = slugOverride ?? slugify(label);
  const id = `${group}:${slug}`;
  db.prepare(
    `INSERT INTO facet (id, grp, slug, label, source_id) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET label = excluded.label, source_id = COALESCE(excluded.source_id, facet.source_id)`,
  ).run(id, group, slug, label, sourceId);
  return id;
}

/** Facet ids for the four groups, derived from normalized source metadata. */
export function facetIdsFor(db: DB, g: NormalizedGame): string[] {
  const ids = new Set<string>();
  for (const genre of g.genres) ids.add(ensureFacet(db, 'genre', genre.label, genre.sourceId));
  for (const cat of g.categories) {
    if (FEATURE_LABELS.has(cat.label.trim().toLowerCase())) ids.add(ensureFacet(db, 'feature', cat.label, cat.sourceId));
  }
  for (const slug of themesForTags(g.tags.map((t) => t.name))) {
    ids.add(ensureFacet(db, 'theme', THEMES[slug].label, `theme_map_v1:${slug}`, slug));
  }
  for (const d of g.contentDescriptors ?? []) {
    // Valve's documented label keeps the slug stable across store languages.
    const label = STEAM_CONTENT_DESCRIPTORS[d.id] || d.label || `Content descriptor ${d.id}`;
    ids.add(ensureFacet(db, 'content_descriptor', label, `steam_content_descriptor:${d.id}`));
  }
  return [...ids];
}

/** Insert or update one game and replace its facets and tags. Safe to re-run. */
export function upsertGame(db: DB, g: NormalizedGame): void {
  db.prepare(
    `INSERT INTO game (appid, name, name_sort, app_type, thumbnail_url, release_date, descriptors_known, source, source_url, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(appid) DO UPDATE SET
       name = excluded.name, name_sort = excluded.name_sort, app_type = excluded.app_type,
       thumbnail_url = excluded.thumbnail_url, release_date = excluded.release_date,
       descriptors_known = excluded.descriptors_known, source = excluded.source,
       source_url = excluded.source_url, fetched_at = excluded.fetched_at`,
  ).run(
    g.appid,
    g.name,
    sortName(g.name) || g.name.toLowerCase(),
    g.appType,
    g.thumbnailUrl,
    g.releaseDate,
    g.contentDescriptors === null ? 0 : 1,
    g.source,
    g.sourceUrl,
    g.fetchedAt,
  );
  db.prepare('DELETE FROM game_facet WHERE appid = ?').run(g.appid);
  const link = db.prepare('INSERT OR IGNORE INTO game_facet (appid, facet_id) VALUES (?, ?)');
  for (const id of facetIdsFor(db, g)) link.run(g.appid, id);

  db.prepare('DELETE FROM game_tag WHERE appid = ?').run(g.appid);
  const tag = db.prepare('INSERT OR IGNORE INTO game_tag (appid, tag_id, tag_name, rank) VALUES (?, ?, ?, ?)');
  g.tags.forEach((t, i) => tag.run(g.appid, t.id, t.name, i));
  db.prepare('UPDATE game SET details_at = ? WHERE appid = ?').run(g.fetchedAt, g.appid);
  setReviews(db, g.appid, g.reviews ?? null);
}

/** Re-derive every game's themes from stored tags (after a THEME_MAP change). */
export function rebuildThemes(db: DB): void {
  transaction(db, () => {
    db.exec(`DELETE FROM game_facet WHERE facet_id LIKE 'theme:%'`);
    const rows = db.prepare('SELECT appid, tag_name FROM game_tag ORDER BY appid, rank').all() as { appid: number; tag_name: string }[];
    const byApp = new Map<number, string[]>();
    for (const r of rows) byApp.set(r.appid, [...(byApp.get(r.appid) ?? []), r.tag_name]);
    const link = db.prepare('INSERT OR IGNORE INTO game_facet (appid, facet_id) VALUES (?, ?)');
    for (const [appid, names] of byApp) {
      for (const slug of themesForTags(names)) {
        link.run(appid, ensureFacet(db, 'theme', THEMES[slug].label, `theme_map_v1:${slug}`, slug));
      }
    }
    db.exec(`DELETE FROM facet WHERE grp = 'theme' AND id NOT IN (SELECT DISTINCT facet_id FROM game_facet)`);
  });
}
