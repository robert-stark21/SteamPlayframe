/**
 * SteamSpy (steamspy.com/api.php): the full game list with Steam review counts, and
 * games per Steam tag. Its stated limits: request=all once per 60 seconds, other
 * requests once per second. It answers "Too many connections" as plain text when busy.
 */
import { HttpError, sleep } from './http.ts';

const BASE = 'https://steamspy.com/api.php';

export interface SpyListed {
  appid: number;
  name: string;
  positive: number;
  negative: number;
}

async function getJson<T>(url: string, tries = 6, waitMs = 65_000): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90_000), headers: { 'user-agent': 'PLAYFRAME catalog import (+self-hosted)' } });
      const text = await res.text();
      if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
      if (!text.trim()) return {} as T; // an empty body past the last page
      return JSON.parse(text) as T; // "Too many connections" throws here and is retried
    } catch (err) {
      if (i >= tries - 1) throw err;
      await sleep(waitMs * (i + 1));
    }
  }
}

/** One page of the full list (1,000 apps). An empty array means past the end. */
export async function listPage(page: number): Promise<SpyListed[]> {
  const body = await getJson<Record<string, { appid: number; name: string; positive: number; negative: number }>>(`${BASE}?request=all&page=${page}`);
  return Object.values(body)
    .filter((r) => Number.isInteger(r.appid) && typeof r.name === 'string' && r.name.trim())
    .map((r) => ({ appid: r.appid, name: r.name.trim(), positive: Number(r.positive) || 0, negative: Number(r.negative) || 0 }));
}

/** Appids SteamSpy lists under one Steam tag, by its exact name. */
export async function tagAppids(tag: string): Promise<number[]> {
  const body = await getJson<Record<string, { appid: number }>>(`${BASE}?request=tag&tag=${encodeURIComponent(tag)}`, 4, 10_000);
  return Object.values(body).map((r) => r.appid).filter((n) => Number.isInteger(n));
}

export const STEAMSPY_LIST_INTERVAL_MS = 61_000;
