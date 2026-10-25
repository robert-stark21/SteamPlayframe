/**
 * Loads the demo catalog. Refuses to run over a catalog filled by a Steam sync
 * unless --force is passed, so a demo never silently replaces real data.
 */
import { config } from '../server/config.ts';
import { getMeta, openDb, setMeta, transaction } from '../server/db.ts';
import { ensureDescriptorFacets } from '../server/descriptors.ts';
import { steamStoreUrl, upsertGame } from '../server/ingest.ts';
import { DEMO_FETCHED_AT, DEMO_GAMES } from '../data/demo-catalog.ts';

const db = openDb(config.databasePath);
const force = process.argv.includes('--force');

if (getMeta(db, 'catalog_mode') === 'steam' && !force) {
  console.error('[seed-demo] This database holds a Steam-synced catalog. Pass --force to replace it with the demo.');
  process.exit(1);
}

transaction(db, () => {
  db.exec(`DELETE FROM game WHERE source = 'demo_fixture'`);
  for (const g of DEMO_GAMES) {
    upsertGame(db, {
      appid: g.appid,
      name: g.name,
      appType: 'game',
      thumbnailUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`,
      releaseDate: null,
      genres: g.genres.map((label) => ({ label, sourceId: null })),
      categories: g.features.map((label) => ({ label, sourceId: null })),
      tags: g.tags.map((name) => ({ id: null, name })),
      contentDescriptors: null,
      source: 'demo_fixture',
      sourceUrl: steamStoreUrl(g.appid),
      fetchedAt: DEMO_FETCHED_AT,
    });
  }
  ensureDescriptorFacets(db);
  db.exec(`DELETE FROM facet WHERE grp != 'content_descriptor' AND id NOT IN (SELECT DISTINCT facet_id FROM game_facet)`);
  setMeta(db, 'catalog_mode', 'demo');
  setMeta(db, 'last_updated', DEMO_FETCHED_AT);
});

const n = (db.prepare(`SELECT COUNT(*) AS n FROM game WHERE app_type = 'game'`).get() as { n: number }).n;
console.log(`[seed-demo] Demo catalog loaded: ${n} games into ${config.databasePath}`);
db.close();
