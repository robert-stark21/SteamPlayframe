import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { MIGRATIONS } from './migrations.ts';

export type DB = DatabaseSync;

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    // Keep the write-ahead log from growing without bound on disk.
    db.exec('PRAGMA journal_size_limit = 67108864;');
  }
  migrate(db);
  return db;
}

/** A finished snapshot (Vercel): no migrations, no writes, no WAL. */
export function openDbReadOnly(path: string): DB {
  return new DatabaseSync(path, { readOnly: true });
}

/**
 * The local server's two connections to a live database an import may be writing:
 * one only reads; the other writes and gives up after 250 ms instead of freezing the
 * event loop (node:sqlite calls are synchronous).
 *
 * Never open a live WAL database with readOnly: a read-only connection cannot use the
 * shared WAL index, so SQLite re-reads the whole write-ahead log on every query
 * (seconds to minutes while an import is writing).
 */
export function openServerDbs(path: string): { read: DB; write: DB } {
  const write = openDb(path); // applies migrations
  write.exec('PRAGMA busy_timeout = 250;');
  const read = new DatabaseSync(path);
  read.exec('PRAGMA busy_timeout = 2000;');
  return { read, write };
}

export function migrate(db: DB): number {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);');
  let applied = 0;
  for (const m of MIGRATIONS) {
    // The server and an import may start together: take the write lock first, then
    // check again, so only one process applies each migration.
    db.exec('BEGIN IMMEDIATE');
    try {
      const done = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?').get(m.id);
      if (!done) {
        db.exec(m.sql);
        db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(m.id, m.name, new Date().toISOString());
        applied++;
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  return applied;
}

export function transaction<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getMeta(db: DB, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(db: DB, key: string, value: string): void {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
