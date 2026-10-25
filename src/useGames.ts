import { useCallback, useEffect, useRef, useState } from 'react';
import type { GamesQuery, GamesResponse } from '../shared/types.ts';
import { serializeQuery } from '../shared/query.ts';
import { fetchGames } from './api.ts';

export type Status = 'loading' | 'ready' | 'error';

/**
 * Fetches a page of results. A new query aborts the request in flight, so a
 * slow old response can never overwrite a newer one.
 */
export function useGames(query: GamesQuery) {
  const [data, setData] = useState<GamesResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);
  const key = serializeQuery({ ...query, view: 'grid' });

  useEffect(() => {
    const id = ++seq.current;
    const ctrl = new AbortController();
    setStatus('loading');
    fetchGames(query, ctrl.signal)
      .then((res) => {
        if (id !== seq.current) return;
        setData(res);
        setError(null);
        setStatus('ready');
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError' || id !== seq.current) return;
        setError(err.message);
        setStatus('error');
      });
    return () => ctrl.abort();
    // `key` stands for the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, status, error, retry };
}

/** Result count for a draft query (the mobile drawer), debounced. */
export function useDraftCount(query: GamesQuery | null, delay = 250) {
  const [count, setCount] = useState<number | null>(null);
  const key = query ? serializeQuery({ ...query, page: 1 }) : null;
  useEffect(() => {
    if (!query) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetchGames({ ...query, page: 1 }, ctrl.signal)
        .then((r) => setCount(r.total))
        .catch(() => setCount(null));
    }, delay);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return count;
}
