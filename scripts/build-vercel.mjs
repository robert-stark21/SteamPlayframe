// Builds .vercel/output (Vercel's Build Output API v3) for `vercel deploy --prebuilt`:
//   static/             the Vite site
//   functions/api.func  one Node function: the JSON API + the read-only database snapshot
// Usage: npm run build:vercel   (then: npx vercel deploy --prebuilt --prod)
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const out = '.vercel/output';
const fn = `${out}/functions/api.func`;

if (!existsSync('data/playframe.db')) {
  console.error('[build:vercel] data/playframe.db not found. Run `npm run import` (or `npm run db:seed-demo`) first.');
  process.exit(1);
}

run('npx tsc -p tsconfig.json --noEmit');
run('npx vite build');
run('npx tsx scripts/snapshot.ts');

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });
cpSync('dist', `${out}/static`, { recursive: true });

await build({
  entryPoints: ['server/vercel.ts'],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['node:*'],
  logLevel: 'warning',
});
cpSync('data/snapshot.db', `${fn}/playframe.db`);

writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', maxDuration: 30, memory: 1024 }, null, 2),
);

writeFileSync(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api/(.*)$', dest: '/api?__path=$1' },
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

const mb = (f) => (statSync(f).size / 1048576).toFixed(1);
console.log(`[build:vercel] ${out} ready: function ${mb(`${fn}/index.mjs`)} MB code + ${mb(`${fn}/playframe.db`)} MB data`);
console.log('[build:vercel] Deploy with: npx vercel deploy --prebuilt --prod');
