import type { CatalogResponse } from '../../shared/types.ts';
import { GROUPS, facetsByGroup, toggle, type FilterState } from '../facets.ts';
import { FilterGroup } from './FilterGroup.tsx';
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

  return (
    <div className="fpanel">
      <ReviewFilter
        label={state.label}
        reviews={state.reviews}
        counts={reviewCounts}
        onChange={(patch) => onChange(patch)}
        note={reviewNote}
      />
      {GROUPS.map(({ group, key, title, search }) => (
        <FilterGroup
          key={group}
          title={title}
          searchLabel={search}
          facets={byGroup[group]}
          selected={state[key]}
          counts={counts}
          onToggle={(slug) => onChange({ [key]: toggle(state[key], slug) })}
          defaultOpen={group !== 'content_descriptor' || state.cd.length > 0}
          {...(group === 'content_descriptor'
            ? { mode: state.cdMode, onModeChange: (cdMode) => onChange({ cdMode }), note: descriptorNote }
            : {})}
        />
      ))}
    </div>
  );
}
