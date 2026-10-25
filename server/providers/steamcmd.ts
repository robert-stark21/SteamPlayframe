/**
 * steamcmd.net (api.steamcmd.net/v1/info/<appid>): a public mirror of Steam's own app
 * data (PICS). It returns ids, not labels; taxonomy.ts maps the ids. One app per request.
 */
import type { NormalizedGame } from '../ingest.ts';
import { steamStoreUrl } from '../ingest.ts';
import { STEAM_CATEGORIES, STEAM_GENRES } from '../taxonomy.ts';
import { HttpError, fetchJson } from './http.ts';

interface Common {
  type?: string;
  name?: string;
  genres?: Record<string, string>;
  category?: Record<string, string>;
  store_tags?: Record<string, string>;
  content_descriptors?: Record<string, string>;
  steam_release_date?: string;
  header_image?: Record<string, string>;
  releasestate?: string;
}

const values = (o: Record<string, string> | undefined) => Object.values(o ?? {}).map(Number).filter(Number.isInteger);

/** null when the mirror has no record for this app. */
export async function appInfo(appid: number, fetchedAt: string): Promise<NormalizedGame | null> {
  let body: { status?: string; data?: Record<string, { common?: Common; extended?: { developer?: string; publisher?: string } }> };
  try {
    body = await fetchJson(`https://api.steamcmd.net/v1/info/${appid}`, { timeoutMs: 30_000, retries: 4, baseDelayMs: 3000 });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
  const c = body.data?.[String(appid)]?.common;
  const ext = body.data?.[String(appid)]?.extended;
  if (!c?.type || !c.name) return null;

  const header = c.header_image?.english ?? Object.values(c.header_image ?? {})[0];
  const released = Number(c.steam_release_date);
  return {
    appid,
    name: c.name.trim(),
    appType: c.type.toLowerCase(),
    thumbnailUrl: header ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/${header}` : null,
    releaseDate: Number.isFinite(released) && released > 0 ? new Date(released * 1000).toISOString().slice(0, 10) : null,
    genres: values(c.genres).flatMap((id) => (STEAM_GENRES[id] ? [{ label: STEAM_GENRES[id], sourceId: `steam_genre:${id}` }] : [])),
    categories: Object.keys(c.category ?? {})
      .map((k) => Number(k.replace('category_', '')))
      .flatMap((id) => (STEAM_CATEGORIES[id] ? [{ label: STEAM_CATEGORIES[id], sourceId: `steam_category:${id}` }] : [])),
    tags: [],
    // Steam's app record lists descriptors when a game has them; no field means none.
    contentDescriptors: values(c.content_descriptors).map((id) => ({ id })),
    storeTagIds: values(c.store_tags),
    developer: ext?.developer?.trim() || null,
    publisher: ext?.publisher?.trim() || null,
    source: 'steamcmd',
    sourceUrl: steamStoreUrl(appid),
    fetchedAt,
  };
}
