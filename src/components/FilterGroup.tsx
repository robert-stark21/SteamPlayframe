import { useId, useMemo, useState } from 'react';
import type { DescriptorMode } from '../../shared/types.ts';
import { CheckIcon, ChevronIcon, ExcludeIcon } from '../icons.tsx';

const VISIBLE = 8;

/** Anything the group lists: a facet or a Steam tag. */
export interface Option {
  id: string;
  slug: string;
  label: string;
  total: number;
}

interface Props {
  title: string;
  searchLabel: string;
  facets: Option[];
  selected: string[];
  counts: Record<string, number> | null;
  onToggle: (slug: string) => void;
  /** Options to leave out of the results; when given, every row gets an exclude button. */
  excluded?: string[];
  onExclude?: (slug: string) => void;
  /** What one option is called in the hint, e.g. "tag". */
  noun?: string;
  defaultOpen?: boolean;
  /** Content descriptor only. */
  mode?: DescriptorMode;
  onModeChange?: (mode: DescriptorMode) => void;
  note?: string;
}

export function FilterGroup({ title, searchLabel, facets, selected, counts, onToggle, excluded = [], onExclude, noun = 'option', defaultOpen = true, mode, onModeChange, note }: Props) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [term, setTerm] = useState('');
  const [all, setAll] = useState(false);

  const matches = useMemo(() => {
    const t = term.trim().toLowerCase();
    return t ? facets.filter((f) => f.label.toLowerCase().includes(t)) : facets;
  }, [facets, term]);

  // Chosen options (in or out) always stay in view, even when collapsed to the first eight.
  const chosen = (slug: string) => selected.includes(slug) || excluded.includes(slug);
  const shown = all || term ? matches : matches.filter((f, i) => i < VISIBLE || chosen(f.slug));
  const hiddenCount = matches.length - shown.length;
  const summary = [selected.length ? `${selected.length} selected` : '', excluded.length ? `${excluded.length} excluded` : ''].filter(Boolean).join(', ');

  return (
    <section className="fgroup" aria-labelledby={`${id}-h`}>
      <h3 className="fgroup__head" id={`${id}-h`}>
        <button type="button" className="fgroup__toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen((o) => !o)}>
          <span className="fgroup__title">{title}</span>
          {summary && <span className="fgroup__count">{summary}</span>}
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

        {onExclude && <p className="fgroup__hint">Tick to include. Use <ExcludeIcon size={14} /> to leave a {noun} out.</p>}

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
              const out = excluded.includes(f.slug);
              const n = counts ? counts[f.id] ?? 0 : f.total;
              return (
                <li key={f.id} className={`optrow${out ? ' optrow--out' : ''}`}>
                  <label className={`opt${!checked && !out && n === 0 ? ' opt--empty' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => onToggle(f.slug)} />
                    <span className="opt__box" aria-hidden="true"><CheckIcon size={14} /></span>
                    <span className="opt__label">{f.label}</span>
                    <span className="opt__n num" aria-label={`${n} games`}>{n.toLocaleString('en')}</span>
                  </label>
                  {onExclude && (
                    <button
                      type="button"
                      className="opt__x"
                      aria-pressed={out}
                      aria-label={out ? `Stop excluding ${f.label}` : `Exclude ${f.label}`}
                      title={out ? `Excluded: ${f.label}` : `Exclude ${f.label}`}
                      onClick={() => onExclude(f.slug)}
                    >
                      <ExcludeIcon size={16} />
                    </button>
                  )}
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
