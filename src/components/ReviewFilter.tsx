import { useId, useState } from 'react';
import { REVIEW_COUNT_STEPS, REVIEW_LABELS } from '../../shared/reviews.ts';
import { CheckIcon, ChevronIcon, ThumbIcon } from '../icons.tsx';

interface Props {
  label: string[];
  reviews: number | null;
  /** Contextual counts keyed 'label:very-positive' / 'reviews:1000'; null shows none. */
  counts: Record<string, number> | null;
  onChange: (patch: { label?: string[]; reviews?: number | null }) => void;
  note?: string;
}

export const reviewsLabel = (n: number) => `${n.toLocaleString('en')} or more`;

/**
 * The user-review group: Steam's own summary labels, best to worst (pick any, OR-ed),
 * and a minimum number of reviews. AND-ed with every other filter.
 */
export function ReviewFilter({ label, reviews, counts, onChange, note }: Props) {
  const id = useId();
  const [open, setOpen] = useState(true);
  const active = label.length + (reviews !== null ? 1 : 0);
  const toggle = (slug: string) => onChange({ label: label.includes(slug) ? label.filter((s) => s !== slug) : [...label, slug] });

  return (
    <section className="fgroup fgroup--reviews" aria-labelledby={`${id}-h`}>
      <h3 className="fgroup__head" id={`${id}-h`}>
        <button type="button" className="fgroup__toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen((o) => !o)}>
          <span className="fgroup__title">User reviews</span>
          {active > 0 && <span className="fgroup__count">{active} selected</span>}
          <span className="fgroup__chevron"><ChevronIcon size={18} /></span>
        </button>
      </h3>
      <div className="fgroup__body" id={`${id}-body`} hidden={!open}>
        <fieldset className="radiogroup">
          <legend className="radiogroup__legend">Steam rating, best to worst</legend>
          <ul className="opts">
            {REVIEW_LABELS.map((l) => {
              const checked = label.includes(l.slug);
              const n = counts?.[`label:${l.slug}`] ?? 0;
              return (
                <li key={l.slug}>
                  <label className={`opt opt--tone-${l.tone}${!checked && counts && n === 0 ? ' opt--empty' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(l.slug)} />
                    <span className="opt__box" aria-hidden="true"><CheckIcon size={14} /></span>
                    <span className="opt__label opt__label--icon">
                      <ThumbIcon size={15} tone={l.tone} />
                      {l.label}
                    </span>
                    {counts && <span className="opt__n num" aria-label={`${n} games`}>{n.toLocaleString('en')}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
        <fieldset className="radiogroup">
          <legend className="radiogroup__legend">Number of reviews</legend>
          <ul className="opts">
            {[null, ...REVIEW_COUNT_STEPS].map((s) => {
              const checked = reviews === s;
              const n = s === null ? undefined : counts?.[`reviews:${s}`];
              return (
                <li key={s ?? 'any'}>
                  <label className={`opt${!checked && n === 0 ? ' opt--empty' : ''}`}>
                    <input type="radio" name={`${id}-reviews`} checked={checked} onChange={() => onChange({ reviews: s })} />
                    <span className="opt__box opt__box--radio" aria-hidden="true" />
                    <span className="opt__label">{s === null ? 'Any number' : reviewsLabel(s)}</span>
                    {n !== undefined && <span className="opt__n num" aria-label={`${n} games`}>{n.toLocaleString('en')}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
        {note && <p className="fgroup__note">{note}</p>}
      </div>
    </section>
  );
}
