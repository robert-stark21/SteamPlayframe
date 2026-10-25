import type { CatalogResponse } from '../../shared/types.ts';
import { GROUPS, facetsByGroup, setExclude, setInclude, toggle, type FilterState } from '../facets.ts';
import { FilterGroup, type Option } from './FilterGroup.tsx';
import { ReviewFilter } from './ReviewFilter.tsx';

interface Props {
  catalog: CatalogResponse;
  state: FilterState;
  counts: Record<string, number> | null;
  reviewCounts: Record<string, number> | null;
  onChange: (patch: Partial<FilterState>) => void;
}

export function FilterPanel({ catalog, state, counts, reviewCounts, onChange }: Props) {
  const byGroup = facetsByGroup(catalog.facets);
  const unknown = catalog.gameCount - catalog.descriptorsKnown;
  const descriptorNote =
    catalog.descriptorsKnown === 0
      ? 'No descriptor data in this catalog yet. An import fills it; until then a descriptor filter finds no games.'
      : unknown > 0
        ? `${unknown.toLocaleString('en')} games have no descriptor data yet and are left out whenever a descriptor is selected.`
        : undefined;
  const noReviews = catalog.gameCount - catalog.reviewsKnown;
  const reviewNote =
    catalog.reviewsKnown === 0
      ? 'No review data in this catalog yet. An import fills it.'
      : noReviews > 0
        ? `${noReviews.toLocaleString('en')} games have no reviews yet and are left out when a review filter is set.`
        : undefined;
  const tags: Option[] = (catalog.tags ?? []).map((t) => ({ id: `tag:${t.slug}`, slug: t.slug, label: t.label, total: t.total }));
  const noTags = catalog.gameCount - (catalog.tagsKnown ?? 0);

  return (
    <div className="fpanel">
      <ReviewFilter
        label={state.label}
        reviews={state.reviews}
        counts={reviewCounts}
        onChange={(patch) => onChange(patch)}
        note={reviewNote}
      />
      {GROUPS.map(({ group, key, exclude, title, search, noun }) => (
        <div key={group} className="fpanel__slot">
          <FilterGroup
            title={title}
            noun={noun}
            matchAll={group !== 'content_descriptor'}
            searchLabel={search}
            facets={byGroup[group]}
            selected={state[key]}
            counts={counts}
            onToggle={(slug) => {
              if (!exclude) return onChange({ [key]: toggle(state[key], slug) });
              const r = setInclude(state[key], state[exclude], slug);
              onChange({ [key]: r.include, [exclude]: r.exclude });
            }}
            {...(exclude
              ? {
                  excluded: state[exclude],
                  onExclude: (slug: string) => {
                    const r = setExclude(state[key], state[exclude], slug);
                    onChange({ [key]: r.include, [exclude]: r.exclude });
                  },
                }
              : {})}
            defaultOpen={group !== 'content_descriptor' || state.cd.length > 0}
            {...(group === 'content_descriptor'
              ? { mode: state.cdMode, onModeChange: (cdMode) => onChange({ cdMode }), note: descriptorNote }
              : {})}
          />
          {group === 'theme' && tags.length > 0 && (
            <FilterGroup
              title="Steam tags"
              noun="tag"
              matchAll
              searchLabel="Search tags, e.g. Visual Novel"
              facets={tags}
              selected={state.tag}
              counts={null}
              onToggle={(slug) => {
                const r = setInclude(state.tag, state.xtag, slug);
                onChange({ tag: r.include, xtag: r.exclude });
              }}
              excluded={state.xtag}
              onExclude={(slug) => {
                const r = setExclude(state.tag, state.xtag, slug);
                onChange({ tag: r.include, xtag: r.exclude });
              }}
              defaultOpen={state.tag.length + state.xtag.length > 0}
              note={noTags > 0 ? `${noTags.toLocaleString('en')} games have no Steam tags loaded yet and are left out while a tag filter is set.` : undefined}
            />
          )}
        </div>
      ))}
    </div>
  );
}
