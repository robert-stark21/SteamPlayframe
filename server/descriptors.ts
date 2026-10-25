import type { DB } from './db.ts';
import { STEAM_CONTENT_DESCRIPTORS, slugify } from './taxonomy.ts';

/** Make Valve's documented descriptors selectable even before any game carries one. */
export function ensureDescriptorFacets(db: DB): void {
  const stmt = db.prepare(
    `INSERT INTO facet (id, grp, slug, label, source_id) VALUES (?, 'content_descriptor', ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  );
  for (const [id, label] of Object.entries(STEAM_CONTENT_DESCRIPTORS)) {
    const slug = slugify(label);
    stmt.run(`content_descriptor:${slug}`, slug, label, `steam_content_descriptor:${id}`);
  }
}
