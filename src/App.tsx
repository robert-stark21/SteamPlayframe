import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogResponse, SortKey } from '../shared/types.ts';
import { activeFilterCount } from '../shared/query.ts';
import { ApiError, fetchCatalog } from './api.ts';
import { toggle } from './facets.ts';
import { FrameMark, GridIcon, ListIcon, SlidersIcon } from './icons.tsx';
import { useStoreDetails } from './useStoreDetails.ts';
import { useGames } from './useGames.ts';
import { useUrlQuery } from './useUrlQuery.ts';
import { ActiveFilters } from './components/ActiveFilters.tsx';
import { FilterDrawer } from './components/FilterDrawer.tsx';
import { FilterPanel } from './components/FilterPanel.tsx';
import { GameGrid, GridSkeleton } from './components/GameGrid.tsx';
import { Pagination } from './components/Pagination.tsx';
import { SearchBar } from './components/SearchBar.tsx';

const SORT_LABEL: Record<SortKey, string> = {
  rating_desc: 'Best rated',
  rating_asc: 'Worst rated',
  reviews_desc: 'Most reviewed',
  name_asc: 'Name, A to Z',
  name_desc: 'Name, Z to A',
  release_desc: 'Newest release',
};

const SEARCH_DEBOUNCE_MS = 300;

function formatDate(iso: string | null): string {
  if (!iso) return 'not recorded';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function sourceLine(c: CatalogResponse | null): string {
  if (!c) return '';
  if (c.mode === 'demo') return 'Demo catalog: real Steam games with metadata curated by hand. An import replaces it.';
  const reviews = 'Rating: SteamDB’s published formula over Steam review counts.';
  if (c.mode === 'mirror') {
    return `Game list from the Steam store search and SteamSpy; review counts from SteamSpy (all languages), or Steam’s English summary where SteamSpy has none; type, genres, features and descriptors from Steam’s app data via steamcmd.net. ${reviews}`;
  }
  return `Data from the Steam store and the Steam Web API. ${reviews}`;
}

export function App() {
  const { query, update, setPage, setView, clearAll } = useUrlQuery();
  const { data, status, error, retry } = useGames(query);
  const store = useStoreDetails(data?.items);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [text, setText] = useState(query.q);
  const [slow, setSlow] = useState(false);
  const typing = useRef(false);
  const resultsRef = useRef<HTMLElement>(null);

  const loadCatalog = useCallback(() => {
    setCatalogError(null);
    const ctrl = new AbortController();
    fetchCatalog(ctrl.signal)
      .then(setCatalog)
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setCatalogError(err instanceof ApiError ? err.message : 'The catalog could not be loaded.');
      });
    return () => ctrl.abort();
  }, []);
  useEffect(loadCatalog, [loadCatalog]);

  // Back/Forward or Clear all changes the query: mirror it into the box.
  useEffect(() => {
    if (!typing.current) setText(query.q);
  }, [query.q]);

  // Debounced search. The first commit of a typing burst adds a history entry; the rest replace it.
  const burst = useRef(false);
  useEffect(() => {
    if (text.trim() === query.q) {
      typing.current = false;
      return;
    }
    typing.current = true;
    const t = setTimeout(() => {
      update({ q: text.trim() }, burst.current ? 'replace' : 'push');
      burst.current = true;
      typing.current = false;
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text, query.q, update]);
  useEffect(() => {
    burst.current = false;
  }, [query.genre, query.feature, query.theme, query.cd, query.cdMode, query.sort, query.page]);

  // Show "Updating" only when a refetch takes a moment.
  useEffect(() => {
    if (status !== 'loading') return setSlow(false);
    const t = setTimeout(() => setSlow(true), 200);
    return () => clearTimeout(t);
  }, [status]);

  // The drawer belongs to small screens only.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 64rem)');
    const onChange = () => mq.matches && setDrawerOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const goToPage = (p: number) => {
    setPage(p);
    resultsRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const handleClearAll = () => {
    typing.current = false;
    setText('');
    clearAll();
  };

  const filtersOn = activeFilterCount(query);
  const sorts: SortKey[] = catalog?.sorts ?? ['name_asc', 'name_desc'];
  const firstLoad = !data && status !== 'error';
  const total = data?.total ?? 0;

  return (
    <>
      <a className="skip" href="#results">Skip to results</a>
      <div className="frame">
        <header className="brand">
          <a className="wordmark" href="/" aria-label="PLAYFRAME, clear search and filters" onClick={(e) => { e.preventDefault(); handleClearAll(); }}>
            <span className="wordmark__mark"><FrameMark size={24} /></span>
            <span>PLAYFRAME</span>
          </a>
          {catalog?.mode === 'demo' && <span className="badge-demo">Demo catalog</span>}
          {catalog && catalog.mode !== 'demo' && catalog.importRunning && (
            <span className="badge-demo" role="status">Import running</span>
          )}
        </header>

        <div className="masthead">
          <h1 className="masthead__title">Find your next world.</h1>
          <div className="masthead__tools">
            <SearchBar value={text} onChange={setText} />
            <button type="button" className="btn btn--filters" onClick={() => setDrawerOpen(true)} disabled={!catalog}>
              <SlidersIcon size={18} />
              <span>Filters</span>
              {filtersOn > 0 && <span className="btn__badge num" aria-label={`${filtersOn} active`}>{filtersOn}</span>}
            </button>
          </div>
        </div>

        <aside className="filters" aria-labelledby="filters-title">
          <div className="filters__head">
            <h2 id="filters-title" className="filters__title">Filters</h2>
            {filtersOn > 0 && <span className="filters__n">{filtersOn} selected</span>}
            <button type="button" className="textbtn filters__clear" onClick={handleClearAll} disabled={filtersOn === 0 && !query.q}>
              Clear all
            </button>
          </div>
          {catalog ? (
            <FilterPanel
              catalog={catalog}
              state={query}
              counts={data?.counts ?? null}
              reviewCounts={data?.reviewCounts ?? null}
              onChange={(patch) => update(patch)}
            />
          ) : catalogError ? (
            <div className="state state--compact" role="alert">
              <p>{catalogError}</p>
              <button type="button" className="btn btn--quiet" onClick={loadCatalog}>Try again</button>
            </div>
          ) : (
            <div className="fskeleton" aria-hidden="true">
              {Array.from({ length: 4 }, (_, i) => <span key={i} className="sk sk--line" />)}
            </div>
          )}
        </aside>

        <main className="results" id="results" ref={resultsRef} tabIndex={-1} aria-labelledby="results-title">
          <div className="toolbar">
            <div className="toolbar__count">
              <h2 id="results-title" className="toolbar__title num">
                {firstLoad ? 'Loading games' : status === 'error' && !data ? 'Results' : `${total.toLocaleString('en')} ${total === 1 ? 'game' : 'games'}`}
              </h2>
              <p className="toolbar__meta" role="status" aria-live="polite">
                {slow && data ? 'Updating results…' : data && data.pageCount > 1 ? `Page ${data.page} of ${data.pageCount}` : ''}
              </p>
            </div>
            <div className="toolbar__controls">
            <fieldset className="viewtoggle">
              <legend className="visually-hidden">Layout</legend>
              {(['grid', 'list'] as const).map((v) => (
                <span className="viewtoggle__item" key={v}>
                  <input type="radio" id={`view-${v}`} name="view" checked={query.view === v} onChange={() => setView(v)} />
                  <label htmlFor={`view-${v}`} title={v === 'grid' ? 'Grid' : 'List with screenshots'}>
                    {v === 'grid' ? <GridIcon size={18} /> : <ListIcon size={18} />}
                    <span className="visually-hidden">{v === 'grid' ? 'Grid' : 'List with screenshots'}</span>
                  </label>
                </span>
              ))}
            </fieldset>
            <label className="sort">
              <span className="sort__label">Sort</span>
              <select value={sorts.includes(query.sort) ? query.sort : sorts[0]} onChange={(e) => update({ sort: e.target.value as SortKey })}>
                {sorts.map((s) => (
                  <option key={s} value={s}>{SORT_LABEL[s]}</option>
                ))}
              </select>
            </label>
            </div>
          </div>

          <ActiveFilters
            query={query}
            facets={catalog?.facets ?? []}
            onRemove={(key, slug) => update({ [key]: toggle(query[key], slug) })}
            onClearSearch={() => { typing.current = false; setText(''); update({ q: '' }); }}
            onRemoveLabel={(slug) => update({ label: query.label.filter((s) => s !== slug) })}
            onClearReviewCount={() => update({ reviews: null })}
            onClearAll={handleClearAll}
          />

          {status === 'error' ? (
            <div className="state" role="alert">
              <h3 className="state__title">The catalog did not load</h3>
              <p className="state__text">{error} Your filters are kept.</p>
              <button type="button" className="btn btn--primary" onClick={retry}>Try again</button>
            </div>
          ) : firstLoad ? (
            <GridSkeleton />
          ) : data && data.items.length === 0 ? (
            <div className="state">
              <h3 className="state__title">No games match all of these</h3>
              <p className="state__text">Remove a filter above, or start over with the whole catalog.</p>
              <button type="button" className="btn btn--primary" onClick={handleClearAll}>Clear filters</button>
            </div>
          ) : data ? (
            <>
              <GameGrid games={store.items ?? data.items} busy={status === 'loading'} view={query.view} loadingStore={store.loading} />
              <Pagination page={data.page} pageCount={data.pageCount} onPage={goToPage} />
            </>
          ) : null}
        </main>
      </div>

      <footer className="foot">
        <p>{sourceLine(catalog)}</p>
        <p className="num">
          {catalog ? `${catalog.gameCount.toLocaleString('en')} games indexed. ` : ''}
          {catalog?.importRunning && catalog.pendingCount > 0
            ? `Import running: ${catalog.pendingCount.toLocaleString('en')} more apps waiting to be checked.`
            : `Catalog updated ${formatDate(catalog?.lastUpdated ?? null)}.`}
        </p>
        <p>
          PLAYFRAME is not affiliated with Valve or Steam. Catalog reference: <a href="https://steamdb.info/" target="_blank" rel="noopener noreferrer">SteamDB</a>.
        </p>
      </footer>

      {catalog && (
        <FilterDrawer
          open={drawerOpen}
          catalog={catalog}
          query={query}
          onApply={(state) => update(state)}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}
