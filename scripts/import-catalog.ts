/**
 * Full-catalog import through public mirrors, for networks that cannot reach Steam directly.
 *
 *   1. List: SteamSpy's full app list, one page of 1,000 a minute: appid, name, review counts.
 *   2. Details: steamcmd.net (Steam's app data) per app, most-reviewed first, a few in parallel:
 *      type (only "game" is listed), genres, features, content descriptors, release date, artwork.
 *   3. Themes: SteamSpy's games for each theme tag, by tag name.
 *
 * Both run at once, so popular games become filterable within minutes while the long
 * tail fills in. Safe to stop and re-run: the list page and every app's details are
 * checkpointed in the database, and nothing is deleted when a request fails.
 *
 * Usage: npm run import [-- --concurrency 4] [-- --max-pages 5] [-- --refresh-list]
 */
import { config } from '../server/config.ts';
import { getMeta, openDb, setMeta, transaction } from '../server/db.ts';
import { ensureDescriptorFacets } from '../server/descriptors.ts';
import { DETAILS_VERSION, applyDetails, markDetailsMissing, steamStoreUrl, upsertListed } from '../server/ingest.ts';
import { learnAndApply } from '../server/tags.ts';
import { appInfo } from '../server/providers/steamcmd.ts';
import { searchGamesPage, storeDnsServers } from '../server/providers/steamstore.ts';
import { STEAMSPY_LIST_INTERVAL_MS, listPage, tagAppids } from '../server/providers/steamspy.ts';
import { sleep } from '../server/providers/http.ts';
import { THEME_SOURCE_TAGS } from '../server/taxonomy.ts';

const args = process.argv.slice(2);
const arg = (name: string, d: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const CONCURRENCY = Math.min(8, Math.max(1, arg('--concurrency', 4)));
const MAX_PAGES = arg('--max-pages', 0);

const db = openDb(config.databasePath);
const log = (msg: string) => console.log(`[import ${new Date().toISOString().slice(11, 19)}] ${msg}`);
const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
let listDone = false;
let searchDone = false;
let listedPages = 0;
let stopping = false;
process.on('SIGINT', () => {
  log('Stopping after the requests in flight. Run again to continue.');
  stopping = true;
});

function beat() {
  setMeta(db, 'import_heartbeat', new Date().toISOString());
}

async function listLoop() {
  if (args.includes('--refresh-list')) setMeta(db, 'import_list_page', '0');
  let page = Number(getMeta(db, 'import_list_page') ?? 0);
  if (getMeta(db, 'import_list_done') === '1' && !args.includes('--refresh-list')) {
    listDone = true;
    log('Game list already complete (pass --refresh-list to fetch it again).');
    return;
  }
  setMeta(db, 'import_list_done', '0');
  let pages = 0;
  while (!stopping) {
    const fetchedAt = new Date().toISOString();
    let rows;
    try {
      rows = await listPage(page);
    } catch (err) {
      log(`List page ${page} failed (${(err as Error).message}); retrying in a minute`);
      await sleep(STEAMSPY_LIST_INTERVAL_MS);
      continue;
    }
    if (rows.length === 0) {
      setMeta(db, 'import_list_done', '1');
      log(`Game list complete: ${page} pages, ${count(`SELECT COUNT(*) AS n FROM game`)} apps listed`);
      break;
    }
    transaction(db, () => {
      if (getMeta(db, 'catalog_mode') === 'demo' || getMeta(db, 'catalog_mode') === null) {
        db.exec(`DELETE FROM game WHERE source = 'demo_fixture'`);
        setMeta(db, 'catalog_mode', 'mirror');
      }
      for (const r of rows) {
        upsertListed(db, r.appid, r.name, { positive: r.positive, negative: r.negative, source: 'steamspy', fetchedAt }, steamStoreUrl(r.appid));
      }
      setMeta(db, 'import_list_page', String(page + 1));
      setMeta(db, 'reviews_updated', fetchedAt);
      beat();
    });
    log(`List page ${page}: ${rows.length} apps (pending details: ${count(`SELECT COUNT(*) AS n FROM game WHERE details_at IS NULL`)})`);
    page++;
    pages++;
    listedPages++;
    if (MAX_PAGES && pages >= MAX_PAGES) {
      log(`Stopped the list at --max-pages ${MAX_PAGES}`);
      break;
    }
    await sleep(STEAMSPY_LIST_INTERVAL_MS);
  }
  listDone = true;
}

/** Steam's own store search: every game it lists, newest first, 100 a page, every 2 seconds. */
async function searchLoop() {
  if (!storeDnsServers.length && !args.includes('--search')) {
    log('Steam search skipped: set STEAM_DNS (or pass --search) when the system resolver cannot reach Steam.');
    searchDone = true;
    return;
  }
  if (args.includes('--refresh-search')) setMeta(db, 'import_search_start', '0');
  if (getMeta(db, 'import_search_done') === '1' && !args.includes('--refresh-search')) {
    log('Steam search list already complete (pass --refresh-search to walk it again).');
    searchDone = true;
    return;
  }
  setMeta(db, 'import_search_done', '0');
  let start = Number(getMeta(db, 'import_search_start') ?? 0);
  let total = Infinity;
  let failures = 0;
  while (!stopping && start < total) {
    try {
      const page = await searchGamesPage(start);
      total = page.total || total;
      if (!page.rows.length) break;
      const at = new Date().toISOString();
      let added = 0;
      transaction(db, () => {
        for (const r of page.rows) {
          const known = db.prepare('SELECT 1 FROM game WHERE appid = ?').get(r.appid);
          if (!known) added++;
          upsertListed(db, r.appid, r.name, r.reviews ? { ...r.reviews, source: 'steam_search', fetchedAt: at } : null, steamStoreUrl(r.appid), 'steam_search');
        }
        start += 100;
        setMeta(db, 'import_search_start', String(start));
        beat();
      });
      failures = 0;
      if (start % 2000 === 0 || added > 50) log(`Steam search: ${start}/${total === Infinity ? '?' : total} walked, ${added} new on this page`);
    } catch (err) {
      failures++;
      const wait = Math.min(300_000, 15_000 * 2 ** Math.min(failures, 4));
      log(`Steam search at ${start} failed (${(err as Error).message}); waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    await sleep(2000);
  }
  if (!stopping && start >= total) {
    setMeta(db, 'import_search_done', '1');
    log(`Steam search list complete: ${total} games walked`);
  }
  searchDone = true;
}

async function detailsLoop() {
  const inFlight = new Set<number>();
  let done = 0, games = 0, missing = 0, failed = 0;
  const started = Date.now();
  const next = db.prepare(
    `SELECT appid FROM game WHERE details_at IS NULL OR (app_type = 'game' AND details_v < ${DETAILS_VERSION})
     ORDER BY review_total IS NULL, review_total DESC, appid LIMIT 400`,
  );
  let queue: number[] = [];

  const worker = async () => {
    while (!stopping) {
      if (!queue.length) {
        queue = (next.all() as { appid: number }[]).map((r) => r.appid).filter((id) => !inFlight.has(id));
        if (!queue.length) {
          if (listDone && searchDone && inFlight.size === 0) return;
          await sleep(5000);
          continue;
        }
      }
      const appid = queue.shift()!;
      if (inFlight.has(appid)) continue;
      inFlight.add(appid);
      const at = new Date().toISOString();
      try {
        const g = await appInfo(appid, at);
        transaction(db, () => {
          if (g) applyDetails(db, g);
          else markDetailsMissing(db, appid, at);
        });
        if (!g) missing++;
        else if (g.appType === 'game') games++;
      } catch (err) {
        failed++;
        if (failed % 20 === 1) log(`Details for ${appid} failed: ${(err as Error).message} (will retry next run)`);
        await sleep(2000);
      } finally {
        inFlight.delete(appid);
      }
      done++;
      if (done % 250 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        const pending = count(`SELECT COUNT(*) AS n FROM game WHERE details_at IS NULL`);
        beat();
        log(`Details: ${done} this run (${games} games, ${missing} not found, ${failed} failed), ${rate.toFixed(1)}/s, ${pending} pending, about ${Math.round(pending / rate / 60)} min left`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  log(`Details pass ended: ${done} apps (${games} games, ${missing} not found, ${failed} failed)`);
}

async function themesPass(fetchLists = true) {
  if (fetchLists) {
    log(`Theme tags: fetching ${THEME_SOURCE_TAGS.length} tag lists from SteamSpy`);
    for (const tag of THEME_SOURCE_TAGS) {
      if (stopping) return;
      try {
        const ids = await tagAppids(tag);
        transaction(db, () => {
          db.prepare('DELETE FROM spy_tag WHERE tag_name = ?').run(tag);
          const ins = db.prepare('INSERT OR IGNORE INTO spy_tag (tag_name, appid) VALUES (?, ?)');
          for (const id of ids) ins.run(tag, id);
        });
      } catch (err) {
        log(`  ${tag} failed: ${(err as Error).message}`);
      }
      await sleep(1500);
    }
  }
  // Match names to Steam tag ids, then place games in themes from their own top tags.
  for (const r of learnAndApply(db, THEME_SOURCE_TAGS)) {
    log(`  ${r.name}: ${r.tagId === null ? 'no confident match yet' : `tag ${r.tagId}, coverage ${(r.coverage * 100).toFixed(0)}%, ${r.support} games`}`);
  }
  setMeta(db, 'themes_updated', new Date().toISOString());
  log("Themes rebuilt from each game's top Steam tags");
}

async function main() {
  log(`Database ${config.databasePath}, ${CONCURRENCY} detail workers`);
  ensureDescriptorFacets(db);
  if (args.includes('--themes-only')) {
    await themesPass(args.includes('--refetch-tags') || count('SELECT COUNT(*) AS n FROM spy_tag') === 0);
    return;
  }
  const themes = (async () => {
    // Themes need listed apps: a first pass once the most-owned games are in, a full one when the list is done.
    while (!listDone && listedPages < 10 && !stopping) await sleep(5000);
    if (stopping) return;
    await themesPass();
    if (listDone) return;
    while (!listDone && !stopping) await sleep(5000);
    if (!stopping) await themesPass();
  })();
  await Promise.all([listLoop(), searchLoop(), detailsLoop(), themes]);
  db.exec(`DELETE FROM facet WHERE grp != 'content_descriptor' AND id NOT IN (SELECT DISTINCT facet_id FROM game_facet)`);
  setMeta(db, 'last_updated', new Date().toISOString());
  beat();
  log(`Indexed games: ${count(`SELECT COUNT(*) AS n FROM game WHERE app_type = 'game'`)}; pending: ${count(`SELECT COUNT(*) AS n FROM game WHERE details_at IS NULL`)}`);
}

main()
  .catch((err) => {
    log(`Import stopped: ${(err as Error).message}. The catalog keeps what was stored.`);
    process.exitCode = 1;
  })
  .finally(() => db.close());
