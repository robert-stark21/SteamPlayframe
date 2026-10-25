import type { DescriptorMode, GamesQuery, SortKey } from './types.ts';
import { LABEL_BY_SLUG, REVIEW_COUNT_STEPS } from './reviews.ts';

export const PAGE_SIZE = 24;
export const MAX_QUERY_LENGTH = 100;
export const SORTS: SortKey[] = ['rating_desc', 'rating_asc', 'reviews_desc', 'release_desc', 'name_asc', 'name_desc'];

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const DEFAULT_QUERY: GamesQuery = {
  q: '',
  genre: [],
  feature: [],
  theme: [],
  cd: [],
  cdMode: 'include',
  label: [],
  reviews: null,
  sort: 'rating_desc',
  page: 1,
  view: 'grid',
};

function list(params: URLSearchParams, key: string): string[] {
  const raw = params.getAll(key).flatMap((v) => v.split(','));
  const out: string[] = [];
  for (const v of raw) {
    const s = v.trim().toLowerCase();
    if (SLUG.test(s) && !out.includes(s)) out.push(s);
    if (out.length >= 50) break;
  }
  return out;
}

/** Parse and validate a query string. Unknown or malformed values fall back to defaults. */
export function parseQuery(search: string | URLSearchParams): GamesQuery {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search;
  const sortRaw = p.get('sort') as SortKey | null;
  const pageRaw = Number.parseInt(p.get('page') ?? '1', 10);
  const modeRaw = p.get('cdx');
  const reviewsRaw = Number(p.get('reviews'));
  return {
    q: (p.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH),
    genre: list(p, 'genre'),
    feature: list(p, 'feature'),
    theme: list(p, 'theme'),
    cd: list(p, 'cd'),
    cdMode: (modeRaw === 'exclude' ? 'exclude' : 'include') as DescriptorMode,
    label: list(p, 'label').filter((s) => LABEL_BY_SLUG.has(s)),
    reviews: (REVIEW_COUNT_STEPS as readonly number[]).includes(reviewsRaw) ? reviewsRaw : null,
    sort: sortRaw && SORTS.includes(sortRaw) ? sortRaw : DEFAULT_QUERY.sort,
    page: Number.isFinite(pageRaw) && pageRaw >= 1 && pageRaw <= 10000 ? pageRaw : 1,
    view: p.get('view') === 'list' ? 'list' : 'grid',
  };
}

/** Serialize to a query string, leaving defaults out so shared links stay short. Slugs keep readable commas. */
export function serializeQuery(q: GamesQuery): string {
  const parts: string[] = [];
  const add = (k: string, v: string) => parts.push(`${k}=${v}`);
  if (q.q.trim()) add('q', encodeURIComponent(q.q.trim()));
  for (const k of ['genre', 'feature', 'theme', 'cd'] as const) {
    if (q[k].length) add(k, q[k].map(encodeURIComponent).join(','));
  }
  if (q.cdMode === 'exclude') add('cdx', 'exclude');
  if (q.label.length) add('label', q.label.join(','));
  if (q.reviews !== null) add('reviews', String(q.reviews));
  if (q.sort !== DEFAULT_QUERY.sort) add('sort', q.sort);
  if (q.page > 1) add('page', String(q.page));
  if (q.view === 'list') add('view', 'list');
  return parts.join('&');
}

export function activeFilterCount(q: GamesQuery): number {
  return q.genre.length + q.feature.length + q.theme.length + q.cd.length + q.label.length + (q.reviews !== null ? 1 : 0);
}
