import type { Facet, FacetGroup, GamesQuery } from '../shared/types.ts';

export type GroupKey = 'genre' | 'feature' | 'theme' | 'cd';

export const GROUPS: { group: FacetGroup; key: GroupKey; title: string; chip: string; search: string }[] = [
  { group: 'genre', key: 'genre', title: 'Genres', chip: 'Genre', search: 'Search genres' },
  { group: 'feature', key: 'feature', title: 'Features', chip: 'Feature', search: 'Search features' },
  { group: 'theme', key: 'theme', title: 'Theme', chip: 'Theme', search: 'Search themes' },
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

export type FilterState = Pick<GamesQuery, GroupKey | 'cdMode' | 'label' | 'reviews'>;
