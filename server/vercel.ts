/**
 * Vercel function entry: the JSON API over the read-only database snapshot bundled
 * next to it (scripts/build-vercel.mjs puts it there as playframe.db).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDbReadOnly } from './db.ts';
import { createApi } from './api.ts';

const db = openDbReadOnly(join(dirname(fileURLToPath(import.meta.url)), 'playframe.db'));
const api = createApi(db, { readOnly: true, country: process.env.STEAM_COUNTRY || 'US' });

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
  const r = await api.handle(url);
  res.writeHead(r.status, {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    // The snapshot only changes on redeploy, so the edge may keep answers a few minutes.
    'cache-control': r.cacheSeconds ? `public, s-maxage=${r.cacheSeconds}, stale-while-revalidate=86400` : 'no-store',
  });
  res.end(JSON.stringify(r.body));
}
