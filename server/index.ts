/** Local server: the JSON API plus the built front end from dist/. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { config } from './config.ts';
import { openServerDbs } from './db.ts';
import { createApi } from './api.ts';

const dbs = openServerDbs(config.databasePath);
const api = createApi(dbs.read, { readOnly: false, writeDb: dbs.write, country: config.country });
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
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  const started = Date.now();
  api.handle(url).then((r) => {
    json(res, r.status, r.body);
    const ms = Date.now() - started;
    if (ms > 2000) console.warn(`[api] slow: ${ms} ms ${url.pathname}${url.search}`);
  });
});

server.listen(config.apiPort, '127.0.0.1', () => {
  console.log(`[api] PLAYFRAME API on http://127.0.0.1:${config.apiPort} (db: ${config.databasePath})`);
});
