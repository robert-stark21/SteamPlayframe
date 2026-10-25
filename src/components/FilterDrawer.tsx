import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogResponse, GamesQuery } from '../../shared/types.ts';
import { activeFilterCount } from '../../shared/query.ts';
import { EMPTY_FILTERS, pickFilters, type FilterState } from '../facets.ts';
import { CloseIcon } from '../icons.tsx';
import { useDraftCount } from '../useGames.ts';
import { FilterPanel } from './FilterPanel.tsx';

interface Props {
  open: boolean;
  catalog: CatalogResponse;
  query: GamesQuery;
  onApply: (state: FilterState) => void;
  onClose: () => void;
}

const pick = pickFilters;
const EMPTY: FilterState = EMPTY_FILTERS;

/**
 * Mobile filters as a bottom sheet. Choices here are a draft: only
 * "Show results" applies them; closing or Escape keeps the filters in force.
 * The native modal dialog makes the page behind inert (the focus trap) and
 * returns focus to the opener; the page scroll is locked while it is open.
 */
export function FilterDrawer({ open, catalog, query, onApply, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState<FilterState>(() => pick(query));
  const count = useDraftCount(open ? { ...query, ...draft } : null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      opener.current = document.activeElement as HTMLElement | null;
      setDraft(pick(query));
      dlg.showModal();
      document.documentElement.style.overflowY = 'hidden';
    } else if (!open && dlg.open) {
      dlg.close();
      document.documentElement.style.overflowY = '';
    }
    // Opening reads the applied query once; later query changes do not reset the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // One way out, whatever closes the sheet (button, Escape, Apply). It does not
  // depend on the dialog's async close event, so cleanup always runs once.
  const finish = useCallback(() => {
    const dlg = ref.current;
    if (dlg?.open) dlg.close();
    document.documentElement.style.overflowY = '';
    opener.current?.focus();
    onClose();
  }, [onClose]);

  // Unmounting with the sheet open (resize to desktop) must not leave the page locked.
  useEffect(() => () => { document.documentElement.style.overflowY = ''; }, []);

  const n = activeFilterCount({ ...query, ...draft });
  const label = count === null ? 'Show results' : count === 1 ? 'Show 1 game' : `Show ${count} games`;

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby="drawer-title"
      onCancel={(e) => {
        e.preventDefault();
        finish();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          finish();
        }
      }}
    >
      <div className="drawer__head">
        <h2 id="drawer-title" className="drawer__title">Filters</h2>
        {n > 0 && <span className="drawer__n">{n} selected</span>}
        <button type="button" className="iconbtn" aria-label="Close filters without applying" onClick={finish}>
          <CloseIcon size={20} />
        </button>
      </div>
      <div className="drawer__body">
        {open && <FilterPanel catalog={catalog} state={draft} counts={null} reviewCounts={null} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />}
      </div>
      <div className="drawer__foot">
        <button type="button" className="btn btn--quiet" disabled={n === 0} onClick={() => setDraft(EMPTY)}>
          Clear all
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            onApply(draft);
            finish();
          }}
        >
          {label}
        </button>
      </div>
    </dialog>
  );
}
