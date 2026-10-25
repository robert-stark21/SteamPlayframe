import { useCallback, useEffect, useRef, useState } from 'react';
import type { GamesQuery, ViewMode } from '../shared/types.ts';
import { DEFAULT_QUERY, parseQuery, serializeQuery } from '../shared/query.ts';

type Mode = 'push' | 'replace';

/**
 * The query lives in the URL: reload and shared links restore it, and
 * Back/Forward move through it.
 */
export function useUrlQuery() {
  const [query, setQuery] = useState<GamesQuery>(() => parseQuery(window.location.search));
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    const onPop = () => setQuery(parseQuery(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const commit = useCallback((next: GamesQuery, mode: Mode = 'push') => {
    const qs = serializeQuery(next);
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (url !== `${window.location.pathname}${window.location.search}`) {
      window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
    }
    setQuery(next);
  }, []);

  /** Change filters, search or sort: back to page 1. */
  const update = useCallback(
    (patch: Partial<GamesQuery>, mode: Mode = 'push') => commit({ ...queryRef.current, ...patch, page: 1 }, mode),
    [commit],
  );

  const setPage = useCallback((page: number) => commit({ ...queryRef.current, page }), [commit]);

  /** Grid or list: same results, same page. */
  const setView = useCallback((view: ViewMode) => commit({ ...queryRef.current, view }, 'replace'), [commit]);

  /** Clear search, filters and descriptor mode; keep the sort. */
  const clearAll = useCallback(
    () => commit({ ...DEFAULT_QUERY, sort: queryRef.current.sort, view: queryRef.current.view }),
    [commit],
  );

  return { query, update, setPage, setView, clearAll, commit };
}
