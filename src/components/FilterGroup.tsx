import { useId, useMemo, useState } from 'react';
import type { DescriptorMode, Facet } from '../../shared/types.ts';
import { CheckIcon, ChevronIcon } from '../icons.tsx';

const VISIBLE = 8;

interface Props {
  title: string;
  searchLabel: string;
  facets: Facet[];
  selected: string[];
  counts: Record<string, number> | null;
  onToggle: (slug: string) => void;
  defaultOpen?: boolean;
  /** Content descriptor only. */
  mode?: DescriptorMode;
  onModeChange?: (mode: DescriptorMode) => void;
  note?: string;
}

export function FilterGroup({ title, searchLabel, facets, selected, counts, onToggle, defaultOpen = true, mode, onModeChange, note }: Props) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [term, setTerm] = useState('');
  const [all, setAll] = useState(false);

  const matches = useMemo(() => {
    const t = term.trim().toLowerCase();
    return t ? facets.filter((f) => f.label.toLowerCase().includes(t)) : facets;
  }, [facets, term]);

  // Selected options always stay in view, even when collapsed to the first eight.
  const shown = all || term ? matches : matches.filter((f, i) => i < VISIBLE || selected.includes(f.slug));
  const hiddenCount = matches.length - shown.length;

  return (
    <section className="fgroup" aria-labelledby={`${id}-h`}>
      <h3 className="fgroup__head" id={`${id}-h`}>
        <button type="button" className="fgroup__toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen((o) => !o)}>
          <span className="fgroup__title">{title}</span>
          {selected.length > 0 && <span className="fgroup__count">{selected.length} selected</span>}
          <span className="fgroup__chevron"><ChevronIcon size={18} /></span>
        </button>
      </h3>

      <div className="fgroup__body" id={`${id}-body`} hidden={!open}>
        {mode && onModeChange && (
          <fieldset className="seg">
            <legend className="visually-hidden">How selected descriptors filter</legend>
            {(['include', 'exclude'] as const).map((m) => (
              <span className="seg__item" key={m}>
                <input type="radio" id={`${id}-${m}`} name={`${id}-mode`} value={m} checked={mode === m} onChange={() => onModeChange(m)} />
                <label htmlFor={`${id}-${m}`}>{m === 'include' ? 'Include selected' : 'Exclude selected'}</label>
              </span>
            ))}
          </fieldset>
        )}

        {facets.length > VISIBLE && (
          <>
            <label htmlFor={`${id}-search`} className="visually-hidden">{searchLabel}</label>
            <input
              id={`${id}-search`}
              className="fgroup__search"
              type="search"
              autoComplete="off"
              placeholder={searchLabel}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </>
        )}

        {shown.length > 0 ? (
          <ul className="opts">
            {shown.map((f) => {
              const checked = selected.includes(f.slug);
              const n = counts ? counts[f.id] ?? 0 : f.total;
              return (
                <li key={f.id}>
                  <label className={`opt${!checked && n === 0 ? ' opt--empty' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => onToggle(f.slug)} />
                    <span className="opt__box" aria-hidden="true"><CheckIcon size={14} /></span>
                    <span className="opt__label">{f.label}</span>
                    <span className="opt__n num" aria-label={`${n} games`}>{n}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="fgroup__none">Nothing matches “{term.trim()}”.</p>
        )}

        {!term && matches.length > VISIBLE && (
          <button type="button" className="textbtn" aria-expanded={all} onClick={() => setAll((a) => !a)}>
            {all ? 'Show fewer' : `Show ${hiddenCount} more`}
          </button>
        )}

        {note && <p className="fgroup__note">{note}</p>}
      </div>
    </section>
  );
}
