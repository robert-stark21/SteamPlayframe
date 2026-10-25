/**
 * Steam adapter. Every Steam endpoint lives here, so a schema change on Valve's
 * side touches one file.
 *
 * - App list: IStoreService/GetAppList (needs a Web API key; ISteamApps/GetAppList
 *   is deprecated). Without a key: ISteamChartsService/GetMostPlayedGames plus seeds.
 * - Tags: IStoreBrowseService/GetItems (tag ids per app) and IStoreService/GetTagList (names).
 * - Type, genres, categories, content descriptors, artwork, release date: the
 *   storefront appdetails endpoint. It has no published contract, so its parsing is
 *   defensive and isolated in parseAppDetails().
 */
import type { NormalizedGame } from '../ingest.ts';
import { steamStoreUrl } from '../ingest.ts';
import { fetchJson } from './http.ts';

const API = 'https://api.steampowered.com';
const STORE = 'https://store.steampowered.com';

export interface SteamOptions {
  key: string;
  country: string;
  language: string;
}

export async function listGameAppids(opts: SteamOptions, max: number, onPage?: (n: number) => void): Promise<number[]> {
  const out: number[] = [];
  let lastAppid = 0;
  for (;;) {
    const url =
      `${API}/IStoreService/GetAppList/v1/?key=${encodeURIComponent(opts.key)}` +
      `&include_games=true&include_dlc=false&include_software=false&include_videos=false&include_hardware=false` +
      `&max_results=10000&last_appid=${lastAppid}`;
    const body = await fetchJson<{ response?: { apps?: { appid: number }[]; have_more_results?: boolean; last_appid?: number } }>(url);
    const apps = body.response?.apps ?? [];
    for (const a of apps) if (Number.isInteger(a.appid)) out.push(a.appid);
    onPage?.(out.length);
    if (!body.response?.have_more_results || !body.response.last_appid || (max && out.length >= max)) break;
    lastAppid = body.response.last_appid;
  }
  return max ? out.slice(0, max) : out;
}

export async function mostPlayedAppids(): Promise<number[]> {
  const body = await fetchJson<{ response?: { ranks?: { appid: number }[] } }>(`${API}/ISteamChartsService/GetMostPlayedGames/v1/`);
  return (body.response?.ranks ?? []).map((r) => r.appid).filter((n) => Number.isInteger(n));
}

export async function tagNames(opts: SteamOptions): Promise<Map<number, string>> {
  const key = opts.key ? `&key=${encodeURIComponent(opts.key)}` : '';
  const body = await fetchJson<{ response?: { tags?: { tagid: number; name: string }[] } }>(
    `${API}/IStoreService/GetTagList/v1/?language=${encodeURIComponent(opts.language)}${key}`,
  );
  return new Map((body.response?.tags ?? []).map((t) => [t.tagid, t.name]));
}

/** Tag ids per app, ordered by weight. Batched (Valve accepts many ids per call). */
export async function storeItemTags(opts: SteamOptions, appids: number[]): Promise<Map<number, number[]>> {
  const input = {
    ids: appids.map((appid) => ({ appid })),
    context: { language: opts.language, country_code: opts.country },
    data_request: { include_tag_count: 20 },
  };
  const body = await fetchJson<{
    response?: { store_items?: { appid?: number; tagids?: number[]; tags?: { tagid: number; weight?: number }[] }[] };
  }>(`${API}/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`);
  const out = new Map<number, number[]>();
  for (const item of body.response?.store_items ?? []) {
    if (!item.appid) continue;
    const ordered = item.tags?.length
      ? [...item.tags].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).map((t) => t.tagid)
      : item.tagids ?? [];
    out.set(item.appid, ordered);
  }
  return out;
}

interface AppDetailsData {
  type?: string;
  name?: string;
  header_image?: string;
  genres?: { id: string | number; description: string }[];
  categories?: { id: number; description: string }[];
  content_descriptors?: { ids?: number[] | null; notes?: string | null };
  release_date?: { coming_soon?: boolean; date?: string };
}

export async function appDetails(opts: SteamOptions, appid: number): Promise<AppDetailsData | null> {
  const url = `${STORE}/api/appdetails?appids=${appid}&cc=${encodeURIComponent(opts.country)}&l=${encodeURIComponent(opts.language)}`;
  const body = await fetchJson<Record<string, { success: boolean; data?: AppDetailsData }>>(url, { retries: 5, baseDelayMs: 5000 });
  const entry = body?.[String(appid)];
  return entry?.success && entry.data ? entry.data : null;
}

function isoDate(text: string | undefined): string | null {
  if (!text) return null;
  const t = Date.parse(text.replace(/(\d+)(st|nd|rd|th)/, '$1'));
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Map one appdetails payload to the shared shape. Unknown stays unknown. */
export function parseAppDetails(
  appid: number,
  d: AppDetailsData,
  tags: { id: number | null; name: string }[],
  fetchedAt: string,
): NormalizedGame | null {
  if (!d.name || !d.type) return null;
  const cd = d.content_descriptors;
  // Present with an ids array (even empty) = verified. Missing = unknown.
  const contentDescriptors = cd && Array.isArray(cd.ids) ? cd.ids.filter((n) => Number.isInteger(n)).map((id) => ({ id })) : null;
  return {
    appid,
    name: d.name.trim(),
    appType: d.type.toLowerCase(),
    thumbnailUrl: d.header_image || null,
    releaseDate: d.release_date?.coming_soon ? null : isoDate(d.release_date?.date),
    genres: (d.genres ?? []).map((g) => ({ label: g.description, sourceId: `steam_genre:${g.id}` })),
    categories: (d.categories ?? []).map((c) => ({ label: c.description, sourceId: `steam_category:${c.id}` })),
    tags,
    contentDescriptors,
    source: 'steam',
    sourceUrl: steamStoreUrl(appid),
    fetchedAt,
  };
}
