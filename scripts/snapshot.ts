/**
 * Writes data/snapshot.db: a compact, read-only copy of the catalog for deployment.
 * Keeps games, filters, reviews and store details; drops apps that are not games and
 * the import's working tables. Safe to run while an import is writing.
 *
 * Usage: npm run snapshot
 */
import { existsSync, rmSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../server/config.ts';

const out = 'data/snapshot.db';
for (const f of [out, `${out}-journal`, `${out}-wal`, `${out}-shm`]) if (existsSync(f)) rmSync(f);

// Read-write on purpose: a read-only connection to a live WAL database re-reads the whole log.
const src = new DatabaseSync(config.databasePath);
src.exec('PRAGMA busy_timeout = 5000;');
src.exec(`VACUUM INTO '${out}'`);
src.close();

const db = new DatabaseSync(out);
// Drop the import's working tables first, then delete plainly: cascading a delete of
// ~55,000 non-game rows through ~1M tag rows is what made this step crawl.
db.exec('PRAGMA foreign_keys = OFF;');
db.exec('BEGIN');
for (const t of ['game_tag', 'game_store_tag', 'spy_tag', 'tag_dict']) db.exec(`DROP TABLE IF EXISTS ${t}`);
db.exec(`DROP TRIGGER IF EXISTS game_review_label`);
db.exec(`DELETE FROM game_facet WHERE appid IN (SELECT appid FROM game WHERE app_type != 'game')`);
db.exec(`DELETE FROM game WHERE app_type != 'game'`);
db.exec(`DELETE FROM facet WHERE grp != 'content_descriptor' AND id NOT IN (SELECT DISTINCT facet_id FROM game_facet)`);
db.exec(`DELETE FROM meta WHERE key LIKE 'import_%' OR key = 'sync_checkpoint'`);
db.prepare(`INSERT INTO meta (key, value) VALUES ('last_updated', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(new Date().toISOString());
db.exec('COMMIT');
db.exec('PRAGMA journal_mode = DELETE;');
db.exec('VACUUM');
db.exec('ANALYZE');
const games = (db.prepare('SELECT COUNT(*) AS n FROM game').get() as { n: number }).n;
const withStore = (db.prepare('SELECT COUNT(*) AS n FROM game WHERE store_fetched_at IS NOT NULL').get() as { n: number }).n;
db.close();

console.log(`[snapshot] ${out}: ${games} games (${withStore} with store details), ${(statSync(out).size / 1048576).toFixed(1)} MB`);
