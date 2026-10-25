/**
 * Steam catalog sync. Safe to re-run:
 * - upserts by appid, one transaction per batch;
 * - keeps a checkpoint in the meta table, so a stopped run continues where it left off
 *   (pass --restart to build a fresh candidate list);
 * - never deletes good data because a fetch failed. Demo rows are removed only after
 *   at least one Steam game has been stored.
 *
 * Usage: npm run sync [-- --restart] [-- --limit 200]
 */
import { config } from '../server/config.ts';
import { getMeta, openDb, setMeta, transaction } from '../server/db.ts';
import { ensureDescriptorFacets } from '../server/descriptors.ts';
import { upsertGame, type NormalizedGame } from '../server/ingest.ts';
import { sleep } from '../server/providers/http.ts';
import { appDetails, listGameAppids, mostPlayedAppids, parseAppDetails, storeItemTags, tagNames } from '../server/providers/steam.ts';

interface Checkpoint {
  startedAt: string;
  candidates: number[];
  index: number;
}

const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : config.syncLimit;
const opts = { key: config.steamApiKey, country: config.country, language: config.language };
const db = openDb(config.databasePath);
const log = (msg: string) => console.log(`[sync ${new Date().toISOString()}] ${msg}`);

async function candidates(): Promise<number[]> {
  const set = new Set<number>(config.seedAppids);
  if (opts.key) {
    log('Listing games with IStoreService/GetAppList');
    for (const id of await listGameAppids(opts, 0, (n) => log(`  ${n} appids listed`))) set.add(id);
  } else {
    log('No STEAM_API_KEY: starting from the most-played chart and SYNC_SEED_APPIDS');
    for (const id of await mostPlayedAppids()) set.add(id);
  }
  return [...set];
}

async function main() {
  let cp: Checkpoint | null = null;
  const saved = getMeta(db, 'sync_checkpoint');
  if (saved && !args.includes('--restart')) {
    cp = JSON.parse(saved) as Checkpoint;
    if (cp.index >= cp.candidates.length) cp = null;
    else log(`Resuming checkpoint from ${cp.startedAt}: ${cp.index}/${cp.candidates.length}`);
  }
  if (!cp) {
    cp = { startedAt: new Date().toISOString(), candidates: await candidates(), index: 0 };
    setMeta(db, 'sync_checkpoint', JSON.stringify(cp));
    log(`${cp.candidates.length} candidate apps`);
  }

  let names = new Map<number, string>();
  try {
    names = await tagNames(opts);
    log(`${names.size} tag names loaded`);
  } catch (err) {
    log(`Tag names unavailable (${(err as Error).message}); themes will be empty for this run`);
  }

  const stop = limit > 0 ? Math.min(cp.candidates.length, cp.index + limit) : cp.candidates.length;
  let ok = 0, skipped = 0, failed = 0;
  const BATCH = 25;

  while (cp.index < stop) {
    const batch = cp.candidates.slice(cp.index, Math.min(stop, cp.index + BATCH));
    let tagsByApp = new Map<number, number[]>();
    try {
      tagsByApp = await storeItemTags(opts, batch);
    } catch (err) {
      log(`Tags failed for batch at ${cp.index} (${(err as Error).message}); continuing without tags`);
    }

    const fetchedAt = new Date().toISOString();
    const rows: NormalizedGame[] = [];
    for (const appid of batch) {
      try {
        const d = await appDetails(opts, appid);
        const tags = (tagsByApp.get(appid) ?? []).flatMap((id) => (names.has(id) ? [{ id, name: names.get(id)! }] : []));
        const g = d ? parseAppDetails(appid, d, tags, fetchedAt) : null;
        if (g) rows.push(g);
        else skipped++;
      } catch (err) {
        failed++;
        log(`  ${appid} failed: ${(err as Error).message}`);
      }
      await sleep(config.detailsDelayMs);
    }

    transaction(db, () => {
      for (const g of rows) upsertGame(db, g);
      cp!.index += batch.length;
      setMeta(db, 'sync_checkpoint', JSON.stringify(cp));
    });
    ok += rows.length;
    log(`${cp.index}/${cp.candidates.length} processed (stored ${ok}, skipped ${skipped}, failed ${failed})`);
  }

  if (ok > 0) {
    transaction(db, () => {
      ensureDescriptorFacets(db);
      if (getMeta(db, 'catalog_mode') !== 'steam') {
        db.exec(`DELETE FROM game WHERE source = 'demo_fixture'`);
        db.exec(`DELETE FROM facet WHERE grp != 'content_descriptor' AND id NOT IN (SELECT DISTINCT facet_id FROM game_facet)`);
      }
      setMeta(db, 'catalog_mode', 'steam');
      setMeta(db, 'last_updated', new Date().toISOString());
    });
  }
  const games = (db.prepare(`SELECT COUNT(*) AS n FROM game WHERE app_type = 'game'`).get() as { n: number }).n;
  log(`Done this run: stored ${ok}, skipped ${skipped} (no data or not an app), failed ${failed}. Indexed games: ${games}.`);
  if (cp.index < cp.candidates.length) log(`Checkpoint at ${cp.index}/${cp.candidates.length}. Run again to continue.`);
}

main()
  .catch((err) => {
    log(`Sync stopped: ${(err as Error).message}. The existing catalog was left as it was.`);
    process.exitCode = 1;
  })
  .finally(() => db.close());
