import type { Facet, GamesQuery } from '../../shared/types.ts';
import { GROUPS, type ExcludeKey, type GroupKey } from '../facets.ts';
import { CloseIcon } from '../icons.tsx';
import { reviewsLabel } from './ReviewFilter.tsx';
import { LABEL_BY_SLUG } from '../../shared/reviews.ts';

interface Props {
  query: GamesQuery;
  facets: Facet[];
  tags?: { slug: string; label: string }[];
  onRemove: (key: GroupKey | ExcludeKey | 'tag' | 'xtag', slug: string) => void;
  onClearSearch: () => void;
  onRemoveLabel: (slug: string) => void;
  onClearReviewCount: () => void;
  onClearAll: () => void;
}

export function ActiveFilters({ query, facets, tags = [], onRemove, onClearSearch, onRemoveLabel, onClearReviewCount, onClearAll }: Props) {
  const label = (group: string, slug: string) => facets.find((f) => f.id === `${group}:${slug}`)?.label ?? slug;
  const chips: { id: string; text: string; onRemove: () => void }[] = [];

  if (query.q) chips.push({ id: 'q', text: `Search: “${query.q}”`, onRemove: onClearSearch });
  for (const slug of query.label) chips.push({ id: `label:${slug}`, text: `Reviews: ${LABEL_BY_SLUG.get(slug)?.label ?? slug}`, onRemove: () => onRemoveLabel(slug) });
  if (query.reviews !== null) chips.push({ id: 'reviews', text: `Review count: ${reviewsLabel(query.reviews)}`, onRemove: onClearReviewCount });
  for (const { group, key, exclude, chip } of GROUPS) {
    for (const slug of query[key]) {
      const prefix = key === 'cd' ? (query.cdMode === 'exclude' ? 'Exclude' : 'Descriptor') : `Has ${chip.toLowerCase()}`;
      chips.push({ id: `${key}:${slug}`, text: `${prefix}: ${label(group, slug)}`, onRemove: () => onRemove(key, slug) });
    }
    for (const slug of exclude ? query[exclude] : []) {
      chips.push({ id: `${exclude}:${slug}`, text: `Not ${chip.toLowerCase()}: ${label(group, slug)}`, onRemove: () => onRemove(exclude!, slug) });
    }
  }
  const tagLabel = (slug: string) => tags.find((t) => t.slug === slug)?.label ?? slug;
  for (const slug of query.tag) chips.push({ id: `tag:${slug}`, text: `Has tag: ${tagLabel(slug)}`, onRemove: () => onRemove('tag', slug) });
  for (const slug of query.xtag) chips.push({ id: `xtag:${slug}`, text: `Not tag: ${tagLabel(slug)}`, onRemove: () => onRemove('xtag', slug) });
  if (!chips.length) return null;

  return (
    <div className="active">
      <ul className="chips" aria-label="Active filters">
        {chips.map((c) => (
          <li key={c.id}>
            <button type="button" className="chip" onClick={c.onRemove} aria-label={`Remove ${c.text}`}>
              <span>{c.text}</span>
              <CloseIcon size={14} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="textbtn" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}
