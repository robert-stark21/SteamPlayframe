import { config } from '../server/config.ts';
import { openDb } from '../server/db.ts';

// openDb applies pending migrations.
const db = openDb(config.databasePath);
const rows = db.prepare('SELECT id, name, applied_at FROM schema_migrations ORDER BY id').all();
console.log(`[migrate] ${config.databasePath} is at migration ${rows.length}`);
console.table(rows);
db.close();
