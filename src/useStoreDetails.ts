import { useEffect, useMemo, useState } from 'react';
import type { GameCardData, Screenshot } from '../shared/types.ts';

interface StoreEntry {
  description: string | null;
  screenshots: Screenshot[] | null;
  developer: string | null;
  publisher: string | null;
  checked: boolean;
}

/**
 * Descriptions and screenshots come from the Steam store, fetched by the server on
 * demand for the games on screen. Results merge into the page as they arrive.
 */
export function useStoreDetails(items: GameCardData[] | undefined) {
  const [extra, setExtra] = useState<Record<number, StoreEntry>>({});
  const [loading, setLoading] = useState(false);
  const [reachable, setReachable] = useState(true);
  const missing = (items ?? []).filter((g) => !g.storeChecked && !extra[g.appid]?.checked).map((g) => g.appid);
  const key = missing.join(',');

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/store?appids=${key}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { details: Record<number, StoreEntry>; storeReachable: boolean }) => {
        setExtra((prev) => ({ ...prev, ...body.details }));
        setReachable(body.storeReachable);
      })
      .catch(() => setReachable(false))
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [key]);

  const merged = useMemo(
    () =>
      items?.map((g) => {
        const e = extra[g.appid];
        if (!e) return g;
        return {
          ...g,
          description: e.description ?? g.description,
          screenshots: e.screenshots ?? g.screenshots,
          developer: g.developer ?? e.developer,
          publisher: g.publisher ?? e.publisher,
          storeChecked: g.storeChecked || e.checked,
        };
      }),
    [items, extra],
  );

  return { items: merged, loading: loading && reachable, reachable };
}
