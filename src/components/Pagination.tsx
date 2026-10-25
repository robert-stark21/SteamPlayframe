import { ArrowLeftIcon, ArrowRightIcon } from '../icons.tsx';

function pages(current: number, count: number): (number | 'gap')[] {
  const set = new Set([1, count, current - 1, current, current + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : 'gap');
    out.push(p);
  });
  return out;
}

interface Props {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pageCount, onPage }: Props) {
  if (pageCount <= 1) return null;
  return (
    <nav className="pager" aria-label="Result pages">
      <button type="button" className="pager__step" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ArrowLeftIcon size={18} />
        <span>Previous</span>
      </button>
      <ol className="pager__list">
        {pages(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} className="pager__gap" aria-hidden="true">…</li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className="pager__num num"
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                onClick={() => p !== page && onPage(p)}
              >
                {p}
              </button>
            </li>
          ),
        )}
      </ol>
      <button type="button" className="pager__step" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        <span>Next</span>
        <ArrowRightIcon size={18} />
      </button>
    </nav>
  );
}
