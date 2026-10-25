import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { config } from './config.ts';
import { openDb } from './db.ts';
import { catalog, queryGames } from './queries.ts';
import { applyStoreDetails } from './ingest.ts';
import { storeDetails } from './providers/steamstore.ts';
import { parseQuery, serializeQuery } from '../shared/query.ts';
import type { CatalogResponse, GamesResponse } from '../shared/types.ts';

const db = openDb(config.databasePath);

// Results stay fresh enough for browsing while an import is writing; short caches keep
// repeated pages and Back/Forward fast on a large catalog.
const CACHE_MS = 20_000;
let catalogCache: { at: number; body: CatalogResponse } | null = null;
const gamesCache = new Map<string, { at: number; body: GamesResponse }>();
/**
 * Store details on demand: rows already fetched come from the database; missing ones are
 * fetched from the Steam store a few at a time and stored. When the store cannot be
 * reached, stop asking it for a minute and answer with what the database has.
 */
const STORE_TTL_DAYS = 30;
const storeInFlight = new Map<number, Promise<void>>();
let storeDownUntil = 0;
let storeFailures = 0;
let storeActive = 0;
const storeWaiters: (() => void)[] = [];
async function withStoreSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (storeActive >= 4) await new Promise<void>((r) => storeWaiters.push(r));
  storeActive++;
  try {
    return await fn();
  } finally {
    storeActive--;
    storeWaiters.shift()?.();
  }
}

type StoreRow = { appid: number; short_description: string | null; screenshots: string | null; developer: string | null; publisher: string | null; store_fetched_at: string | null };

async function storeFor(ids: number[]) {
  const stale = new Date(Date.now() - STORE_TTL_DAYS * 864e5).toISOString();
  const marks = ids.map(() => '?').join(',') || 'NULL';
  const need = (db.prepare(`SELECT appid FROM game WHERE appid IN (${marks}) AND (store_fetched_at IS NULL OR store_fetched_at < ?)`).all(...ids, stale) as { appid: number }[]).map((r) => r.appid);

  if (need.length && Date.now() > storeDownUntil) {
    await Promise.all(
      need.map((appid) => {
        if (!storeInFlight.has(appid)) {
          const p = withStoreSlot(async () => {
            if (Date.now() < storeDownUntil) return;
            const at = new Date().toISOString();
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                applyStoreDetails(db, appid, await storeDetails(appid, config.country), at);
                storeFailures = 0;
                return;
              } catch (err) {
                const status = (err as { status?: number }).status;
                // Rate-limited: back off at once. Network errors: retry this game once, and
                // pause the store only when several in a row fail.
                if (status === 429) {
                  storeDownUntil = Date.now() + 60_000;
                  return;
                }
                if (status) return;
                if (attempt === 1 && ++storeFailures >= 3) storeDownUntil = Date.now() + 60_000;
              }
            }
          }).finally(() => storeInFlight.delete(appid));
          storeInFlight.set(appid, p);
        }
        return storeInFlight.get(appid);
      }),
    );
    gamesCache.clear();
  }

  const rows = db
    .prepare(`SELECT appid, short_description, screenshots, developer, publisher, store_fetched_at FROM game WHERE appid IN (${marks})`)
    .all(...ids) as StoreRow[];
  const details: Record<number, { description: string | null; screenshots: { thumb: string; full: string }[] | null; developer: string | null; publisher: string | null; checked: boolean }> = {};
  for (const r of rows) {
    details[r.appid] = {
      description: r.short_description,
      screenshots: r.screenshots ? (JSON.parse(r.screenshots) as { thumb: string; full: string }[]) : null,
      developer: r.developer,
      publisher: r.publisher,
      checked: r.store_fetched_at !== null,
    };
  }
  return { details, storeReachable: Date.now() > storeDownUntil };
}

function cachedCatalog(): CatalogResponse {
  if (!catalogCache || Date.now() - catalogCache.at > CACHE_MS) catalogCache = { at: Date.now(), body: catalog(db) };
  return catalogCache.body;
}
const distDir = resolve('dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string) {
  if (!existsSync(distDir)) {
    json(res, 404, { error: 'Front end not built. Run `npm run build`, or use `npm run dev`.' });
    return;
  }
  const safe = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let file = join(distDir, safe);
  if (!file.startsWith(distDir) || !existsSync(file) || statSync(file).isDirectory()) file = join(distDir, 'index.html');
  const type = MIME[extname(file)] ?? 'application/octet-stream';
  const immutable = file.includes(`${join(distDir, 'assets')}`);
  res.writeHead(200, {
    'content-type': type,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });

    if (url.pathname === '/api/health') return json(res, 200, { ok: true });

    if (url.pathname === '/api/catalog') return json(res, 200, cachedCatalog());

    if (url.pathname === '/api/games') {
      const q = { ...parseQuery(url.searchParams), view: 'grid' as const };
      // A sort the catalog cannot back falls back to its first one.
      const sorts = cachedCatalog().sorts;
      if (!sorts.includes(q.sort)) q.sort = sorts[0];
      const key = serializeQuery(q);
      const hit = gamesCache.get(key);
      if (hit && Date.now() - hit.at < CACHE_MS) return json(res, 200, hit.body);
      const body = queryGames(db, q);
      gamesCache.set(key, { at: Date.now(), body });
      if (gamesCache.size > 300) gamesCache.delete(gamesCache.keys().next().value!);
      return json(res, 200, body);
    }

    if (url.pathname === '/api/store') {
      const ids = (url.searchParams.get('appids') ?? '')
        .split(',')
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 48);
      storeFor(ids)
        .then((body) => json(res, 200, body))
        .catch((err) => {
          console.error('[api] store', err);
          json(res, 500, { error: 'Store details could not be read.' });
        });
      return;
    }

    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error('[api]', err);
    return json(res, 500, { error: 'The catalog could not be read.' });
  }
});

server.listen(config.apiPort, '127.0.0.1', () => {
  console.log(`[api] PLAYFRAME API on http://127.0.0.1:${config.apiPort} (db: ${config.databasePath})`);
});
