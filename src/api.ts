import type { CatalogResponse, GamesQuery, GamesResponse } from '../shared/types.ts';
import { serializeQuery } from '../shared/query.ts';

export class ApiError extends Error {}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { signal, headers: { accept: 'application/json' } });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError('The server could not be reached. Check your connection.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `The server answered ${res.status}.`);
  }
  return (await res.json()) as T;
}

export const fetchCatalog = (signal?: AbortSignal) => get<CatalogResponse>('/api/catalog', signal);

export const fetchGames = (q: GamesQuery, signal?: AbortSignal) => {
  const qs = serializeQuery(q);
  return get<GamesResponse>(`/api/games${qs ? `?${qs}` : ''}`, signal);
};
