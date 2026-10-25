/** One small line-icon set, 1.75px strokes on a 24 grid. Always decorative: the control carries the label. */
type P = { size?: number };
const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  focusable: false,
});

export const SearchIcon = ({ size }: P) => (
  <svg aria-hidden="true" {...base(size)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
);
export const CloseIcon = ({ size }: P) => (
  <svg aria-hidden="true" {...base(size)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const ChevronIcon = ({ size }: P) => (
  <svg aria-hidden="true" {...base(size)}><path d="m6 9 6 6 6-6" /></svg>
);
export const ExternalIcon = ({ size }: P) => (
  <svg aria-hidden="true" {...base(size)}><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg>
);
export const SlidersIcon = ({ size }: P) => (
  <svg aria-hidden="true" {...base(size)}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
);
export const CheckIcon = ({ size }: P) => (
  <svg aria-hidden="true" {...base(size)} strokeWidth={2.5}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const ArrowLeftIcon = ({ size }: P) => (
  <svg aria-hidden="true" {...base(size)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const ArrowRightIcon = ({ size }: P) => (
  <svg aria-hidden="true" {...base(size)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const FrameMark = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="3" y="3" width="18" height="18" rx="6" fill="none" stroke="currentColor" strokeWidth="3.5" />
  </svg>
);

/** Thumb, turned by tone: up for positive, sideways for mixed, down for negative. */
export const ThumbIcon = ({ size = 16, tone }: P & { tone: 'positive' | 'mixed' | 'negative' }) => (
  <svg
    aria-hidden="true"
    {...base(size)}
    style={{ transform: tone === 'negative' ? 'rotate(180deg)' : tone === 'mixed' ? 'rotate(-90deg)' : undefined }}
  >
    <path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Zm0 0 3.6-6.3A1.6 1.6 0 0 1 13.6 5l-.8 5H19a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17.8 20H7" />
  </svg>
);
export const GridIcon = ({ size }: P) => (
  <svg aria-hidden="true" {...base(size)}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
);
export const ListIcon = ({ size }: P) => (
  <svg aria-hidden="true" {...base(size)}><rect x="4" y="4" width="16" height="7" rx="1.5" /><rect x="4" y="13" width="16" height="7" rx="1.5" /></svg>
);
