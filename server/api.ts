/**
 * The JSON API, shared by the local Node server (server/index.ts) and the Vercel
 * function (server/vercel.ts). Routes: /api/health, /api/catalog, /api/games, /api/store.
 */
import type { DB } from './db.ts';
import { catalog, queryGames } from './queries.ts';
import { applyStoreDetails, type StoreDetails } from './ingest.ts';
import { storeDetails } from './providers/steamstore.ts';
import { parseQuery, serializeQuery } from '../shared/query.ts';
import type { CatalogResponse, GamesResponse, Screenshot } from '../shared/types.ts';

export interface ApiOptions {
  /** A read-only database (the Vercel snapshot): store details are kept in memory, not written. */
  readOnly: boolean;
  country: string;
}

export interface ApiResult {
  status: number;
  body: unknown;
  /** Seconds a CDN may cache the answer; 0 = never. */
  cacheSeconds: number;
}

type StoreEntry = { description: string | null; screenshots: Screenshot[] | null; developer: string | null; publisher: string | null; checked: boolean };
type StoreRow = { appid: number; short_description: string | null; screenshots: string | null; developer: string | null; publisher: string | null; store_fetched_at: string | null };

export function createApi(db: DB, opts: ApiOptions & { writeDb?: DB }) {
  // Short caches keep repeated pages and Back/Forward fast on a large catalog, and stay
  // fresh enough while an import is writing.
  const CACHE_MS = 20_000;
  let catalogCache: { at: number; body: CatalogResponse } | null = null;
  const gamesCache = new Map<string, { at: number; body: GamesResponse }>();
  const cachedCatalog = (): CatalogResponse => {
    if (!catalogCache || Date.now() - catalogCache.at > CACHE_MS) catalogCache = { at: Date.now(), body: catalog(db) };
    return catalogCache.body;
  };

  /**
   * Store details on demand. Fetched rows come from the database; missing ones are fetched
   * from the Steam store a few at a time and stored (in memory when read-only). When the
   * store cannot be reached, stop asking it for a minute and answer with what we have.
   */
  const STORE_TTL_DAYS = 30;
  const memory = new Map<number, StoreDetails | null>();
  const inFlight = new Map<number, Promise<void>>();
  let downUntil = 0;
  let failures = 0;
  let active = 0;
  const waiters: (() => void)[] = [];
  const slot = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= 4) await new Promise<void>((r) => waiters.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      waiters.shift()?.();
    }
  };

  const fetchOne = (appid: number) =>
    slot(async () => {
      if (Date.now() < downUntil) return;
      const at = new Date().toISOString();
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const d = await storeDetails(appid, opts.country);
          if (opts.readOnly || !opts.writeDb) memory.set(appid, d);
          else {
            try {
              applyStoreDetails(opts.writeDb, appid, d, at);
            } catch {
              // The import holds the write lock: show it now from memory, save it next time.
              memory.set(appid, d);
            }
          }
          failures = 0;
          return;
        } catch (err) {
          const status = (err as { status?: number }).status;
          // Rate-limited: back off at once. Network errors: retry this game once, and pause
          // the store only when several in a row fail.
          if (status === 429) {
            downUntil = Date.now() + 60_000;
            return;
          }
          if (status) return;
          if (attempt === 1 && ++failures >= 3) downUntil = Date.now() + 60_000;
        }
      }
    });

  async function storeFor(ids: number[]) {
    const stale = new Date(Date.now() - STORE_TTL_DAYS * 864e5).toISOString();
    const marks = ids.map(() => '?').join(',') || 'NULL';
    const need = (db.prepare(`SELECT appid FROM game WHERE appid IN (${marks}) AND (store_fetched_at IS NULL OR store_fetched_at < ?)`).all(...ids, stale) as { appid: number }[])
      .map((r) => r.appid)
      .filter((id) => !memory.has(id));

    if (need.length && Date.now() > downUntil) {
      await Promise.all(
        need.map((appid) => {
          if (!inFlight.has(appid)) inFlight.set(appid, fetchOne(appid).finally(() => inFlight.delete(appid)));
          return inFlight.get(appid);
        }),
      );
      if (!opts.readOnly) gamesCache.clear();
    }

    const rows = db
      .prepare(`SELECT appid, short_description, screenshots, developer, publisher, store_fetched_at FROM game WHERE appid IN (${marks})`)
      .all(...ids) as StoreRow[];
    const details: Record<number, StoreEntry> = {};
    for (const r of rows) {
      const m = memory.get(r.appid);
      if (m !== undefined) {
        details[r.appid] = { description: m?.description ?? null, screenshots: m?.screenshots ?? [], developer: r.developer ?? m?.developer ?? null, publisher: r.publisher ?? m?.publisher ?? null, checked: true };
        continue;
      }
      details[r.appid] = {
        description: r.short_description,
        screenshots: r.screenshots ? (JSON.parse(r.screenshots) as Screenshot[]) : null,
        developer: r.developer,
        publisher: r.publisher,
        checked: r.store_fetched_at !== null,
      };
    }
    return { details, storeReachable: Date.now() > downUntil };
  }

  /** Answer one API request. */
  async function handle(url: URL): Promise<ApiResult> {
    try {
      if (url.pathname === '/api/health') return { status: 200, body: { ok: true }, cacheSeconds: 0 };
      if (url.pathname === '/api/catalog') return { status: 200, body: cachedCatalog(), cacheSeconds: opts.readOnly ? 300 : 0 };
      if (url.pathname === '/api/games') {
        const q = { ...parseQuery(url.searchParams), view: 'grid' as const };
        // A sort the catalog cannot back falls back to its first one.
        const sorts = cachedCatalog().sorts;
        if (!sorts.includes(q.sort)) q.sort = sorts[0];
        const key = serializeQuery(q);
        const hit = gamesCache.get(key);
        if (hit && Date.now() - hit.at < CACHE_MS) return { status: 200, body: hit.body, cacheSeconds: opts.readOnly ? 300 : 0 };
        const body = queryGames(db, q);
        gamesCache.set(key, { at: Date.now(), body });
        if (gamesCache.size > 300) gamesCache.delete(gamesCache.keys().next().value!);
        return { status: 200, body, cacheSeconds: opts.readOnly ? 300 : 0 };
      }
      if (url.pathname === '/api/store') {
        const ids = (url.searchParams.get('appids') ?? '')
          .split(',')
          .map((s) => Number.parseInt(s, 10))
          .filter((n) => Number.isInteger(n) && n > 0)
          .slice(0, 48);
        return { status: 200, body: await storeFor(ids), cacheSeconds: 0 };
      }
      return { status: 404, body: { error: 'Not found' }, cacheSeconds: 0 };
    } catch (err) {
      console.error('[api]', err);
      return { status: 500, body: { error: 'The catalog could not be read.' }, cacheSeconds: 0 };
    }
  }

  return { handle };
}
