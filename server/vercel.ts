/**
 * Vercel function entry: the JSON API over a read-only database snapshot.
 *
 * The snapshot ships gzip-compressed next to this file (Vercel refuses single files over
 * 100 MB); the first request on a fresh instance unpacks it into the instance's /tmp,
 * about half a second, and every later request reuses it.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, createWriteStream, existsSync, renameSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { openDbReadOnly } from './db.ts';
import { createApi } from './api.ts';

const packed = join(dirname(fileURLToPath(import.meta.url)), 'playframe.db.gz');

async function load() {
  // Keyed by the packed size, so a new deployment never reads an old unpacked copy.
  const target = join(tmpdir(), `playframe-${statSync(packed).size}.db`);
  if (!existsSync(target)) {
    const part = `${target}.part`;
    await pipeline(createReadStream(packed), createGunzip(), createWriteStream(part));
    renameSync(part, target);
  }
  return createApi(openDbReadOnly(target), { readOnly: true, country: process.env.STEAM_COUNTRY || 'US' });
}

let ready: ReturnType<typeof load> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'https://playframe.local');
  // The route rewrite may hand us /api?__path=games; restore /api/games.
  const sub = url.searchParams.get('__path');
  if (sub !== null) {
    url.pathname = `/api/${sub}`;
    url.searchParams.delete('__path');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  ready ??= load().catch((err) => {
    ready = null; // let the next request try again
    throw err;
  });
  let api;
  try {
    api = await ready;
  } catch (err) {
    console.error('[vercel] snapshot load failed', err);
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ error: 'The catalog is starting up. Try again in a moment.' }));
  }
  const r = await api.handle(url);
  res.writeHead(r.status, {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    // The snapshot only changes on redeploy, so the edge may keep answers a few minutes.
    'cache-control': r.cacheSeconds ? `public, s-maxage=${r.cacheSeconds}, stale-while-revalidate=86400` : 'no-store',
  });
  res.end(JSON.stringify(r.body));
}
