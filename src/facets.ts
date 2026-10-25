import type { Facet, FacetGroup, GamesQuery } from '../shared/types.ts';

export type GroupKey = 'genre' | 'feature' | 'theme' | 'cd';
export type ExcludeKey = 'xgenre' | 'xfeature' | 'xtheme';

export const GROUPS: { group: FacetGroup; key: GroupKey; exclude?: ExcludeKey; title: string; chip: string; search: string; noun?: string }[] = [
  { group: 'genre', key: 'genre', exclude: 'xgenre', title: 'Genres', chip: 'Genre', search: 'Search genres', noun: 'genre' },
  { group: 'feature', key: 'feature', exclude: 'xfeature', title: 'Features', chip: 'Feature', search: 'Search features', noun: 'feature' },
  { group: 'theme', key: 'theme', exclude: 'xtheme', title: 'Theme', chip: 'Theme', search: 'Search themes', noun: 'theme' },
  { group: 'content_descriptor', key: 'cd', title: 'Content descriptor', chip: 'Descriptor', search: 'Search descriptors' },
];

export function facetsByGroup(facets: Facet[]): Record<FacetGroup, Facet[]> {
  const out: Record<FacetGroup, Facet[]> = { genre: [], feature: [], theme: [], content_descriptor: [] };
  for (const f of facets) out[f.group].push(f);
  return out;
}

export function toggle(list: string[], slug: string): string[] {
  return list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
}

export type FilterState = Pick<
  GamesQuery,
  GroupKey | 'cdMode' | 'label' | 'reviews' | 'tag' | 'xtag' | 'xgenre' | 'xfeature' | 'xtheme'
>;

export const EMPTY_FILTERS: FilterState = {
  genre: [], feature: [], theme: [], cd: [], cdMode: 'include', label: [], reviews: null,
  tag: [], xtag: [], xgenre: [], xfeature: [], xtheme: [],
};

export function pickFilters(q: GamesQuery): FilterState {
  return {
    genre: q.genre, feature: q.feature, theme: q.theme, cd: q.cd, cdMode: q.cdMode, label: q.label, reviews: q.reviews,
    tag: q.tag, xtag: q.xtag, xgenre: q.xgenre, xfeature: q.xfeature, xtheme: q.xtheme,
  };
}

/**
 * Include and exclude are exclusive per option: including removes it from the excluded
 * list and the other way round.
 */
export function setInclude(include: string[], exclude: string[], slug: string): { include: string[]; exclude: string[] } {
  return { include: toggle(include, slug), exclude: exclude.filter((s) => s !== slug) };
}
export function setExclude(include: string[], exclude: string[], slug: string): { include: string[]; exclude: string[] } {
  return { include: include.filter((s) => s !== slug), exclude: toggle(exclude, slug) };
}
