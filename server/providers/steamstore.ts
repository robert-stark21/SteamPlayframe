/**
 * Steam store details (store.steampowered.com/api/appdetails): short description,
 * screenshots, developer and publisher. The endpoint has no published contract and
 * Valve throttles it (about 200 calls per 5 minutes), so callers fetch on demand and cache.
 *
 * STEAM_DNS (optional, e.g. "1.1.1.1"): resolve Steam hosts through these DNS servers
 * instead of the system resolver, for networks whose resolver does not answer for Steam.
 */
import { Resolver } from 'node:dns';
import { request } from 'node:https';
import type { LookupFunction } from 'node:net';
import type { StoreDetails } from '../ingest.ts';

const servers = (process.env.STEAM_DNS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
let lookup: LookupFunction | undefined;
if (servers.length) {
  const resolver = new Resolver({ timeout: 5000, tries: 2 });
  resolver.setServers(servers);
  lookup = ((hostname: string, options: { all?: boolean }, cb: (...a: unknown[]) => void) => {
    resolver.resolve4(hostname, (err, addrs) => {
      if (err || !addrs.length) return cb(err ?? new Error(`No address for ${hostname}`));
      if (options?.all) return cb(null, addrs.map((address) => ({ address, family: 4 })));
      cb(null, addrs[0], 4);
    });
  }) as unknown as LookupFunction;
}

export const storeDnsServers = servers;

function getJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = request(url, { lookup, headers: { accept: 'application/json', 'user-agent': 'PLAYFRAME (+self-hosted)' }, timeout: timeoutMs }, (res) => {
      if ((res.statusCode ?? 0) >= 400) {
        res.resume();
        return reject(Object.assign(new Error(`HTTP ${res.statusCode}`), { status: res.statusCode }));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body) as T);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timed out')));
    req.on('error', reject);
    req.end();
  });
}

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

/** null when the store has no page for this app. Throws when the store cannot be reached. */
export async function storeDetails(appid: number, country = 'US', language = 'english'): Promise<StoreDetails | null> {
  const body = await getJson<Record<string, { success: boolean; data?: {
    short_description?: string;
    screenshots?: { path_thumbnail: string; path_full: string }[];
    developers?: string[];
    publishers?: string[];
  } }>>(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=${country}&l=${language}&filters=basic,screenshots`);
  const d = body?.[String(appid)];
  if (!d?.success || !d.data) return null;
  return {
    description: d.data.short_description ? decode(d.data.short_description) : null,
    screenshots: (d.data.screenshots ?? []).slice(0, 4).map((s) => ({ thumb: s.path_thumbnail, full: s.path_full })),
    developer: d.data.developers?.join(', ') || null,
    publisher: d.data.publishers?.join(', ') || null,
  };
}

/** Steam's full tag list: [{ tagid, name }], about 430 tags. */
export async function steamTagList(language = 'english'): Promise<{ tagid: number; name: string }[]> {
  let body: { tagid: number; name: string }[] = [];
  // This route is reset now and then on some networks; a few spaced retries get through.
  for (let i = 0; ; i++) {
    try {
      body = await getJson<{ tagid: number; name: string }[]>(`https://store.steampowered.com/tagdata/populartags/${language}`);
      break;
    } catch (err) {
      if (i >= 4) throw err;
      await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
    }
  }
  return (Array.isArray(body) ? body : []).filter((t) => Number.isInteger(t.tagid) && typeof t.name === 'string' && t.name.trim());
}

export interface SearchRow {
  appid: number;
  name: string;
  /** Steam's summary for reviews in the store's language (English here). */
  reviews: { positive: number; negative: number } | null;
}

/**
 * One page (100) of Steam's own game list: store search, games only, newest first.
 * Covers every game the store lists, including releases SteamSpy has not caught up with.
 */
export async function searchGamesPage(start: number): Promise<{ total: number; rows: SearchRow[] }> {
  const url = `https://store.steampowered.com/search/results/?sort_by=Released_DESC&category1=998&infinite=1&start=${start}&count=100&cc=US&l=english`;
  const body = await getJson<{ total_count?: number; results_html?: string }>(url, 30000);
  const html = body.results_html ?? '';
  const rows: SearchRow[] = [];
  // One <a class="search_result_row"> per result; bundles and packages carry no single appid.
  for (const block of html.split('<a ').slice(1)) {
    const id = block.match(/data-ds-appid="(\d+)"/)?.[1];
    const name = block.match(/<span class="title">([^<]*)<\/span>/)?.[1];
    if (!id || !name) continue;
    const tip = block.match(/data-tooltip-html="[^"]*?(\d+)% of the ([\d,]+) user reviews/);
    let reviews: SearchRow['reviews'] = null;
    if (tip) {
      const total = Number(tip[2].replace(/,/g, ''));
      const positive = Math.round((Number(tip[1]) / 100) * total);
      reviews = { positive, negative: total - positive };
    }
    rows.push({ appid: Number(id), name: decode(name), reviews });
  }
  return { total: body.total_count ?? 0, rows };
}
