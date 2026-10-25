/**
 * User review rating, as SteamDB publishes it:
 *   score  = positive / total
 *   rating = score - (score - 0.5) * 2 ^ (-log10(total + 1))
 * Few reviews pull the rating toward 50%; many reviews let it approach the raw score.
 * 867,120 positive and 134,163 negative give 86.03%.
 */
export function steamDbRating(positive: number, negative: number): number | null {
  const total = positive + negative;
  if (total <= 0) return null;
  const score = positive / total;
  return score - (score - 0.5) * 2 ** -Math.log10(total + 1);
}

export type Tone = 'positive' | 'mixed' | 'negative';

/** Steam's summary labels, best to worst, with the URL slug and the tone they signal. */
export const REVIEW_LABELS: { slug: string; label: string; tone: Tone }[] = [
  { slug: 'overwhelmingly-positive', label: 'Overwhelmingly Positive', tone: 'positive' },
  { slug: 'very-positive', label: 'Very Positive', tone: 'positive' },
  { slug: 'positive', label: 'Positive', tone: 'positive' },
  { slug: 'mostly-positive', label: 'Mostly Positive', tone: 'positive' },
  { slug: 'mixed', label: 'Mixed', tone: 'mixed' },
  { slug: 'mostly-negative', label: 'Mostly Negative', tone: 'negative' },
  { slug: 'negative', label: 'Negative', tone: 'negative' },
  { slug: 'very-negative', label: 'Very Negative', tone: 'negative' },
  { slug: 'overwhelmingly-negative', label: 'Overwhelmingly Negative', tone: 'negative' },
];
export const LABEL_BY_SLUG = new Map(REVIEW_LABELS.map((l) => [l.slug, l]));

/**
 * Steam's summary label slug, from its published thresholds on the raw positive share.
 * Keep in step with the SQL CASE in migration 3. Under ten reviews Steam shows only the count.
 */
export function steamReviewSlug(positive: number, negative: number): string | null {
  const total = positive + negative;
  if (total < 10) return null;
  const pct = (positive / total) * 100;
  if (pct >= 80) {
    if (total >= 500 && pct >= 95) return 'overwhelmingly-positive';
    if (total >= 50) return 'very-positive';
    return 'positive';
  }
  if (pct >= 70) return 'mostly-positive';
  if (pct >= 40) return 'mixed';
  if (pct >= 20) return 'mostly-negative';
  if (total >= 500) return 'overwhelmingly-negative';
  if (total >= 50) return 'very-negative';
  return 'negative';
}

export function steamReviewLabel(positive: number, negative: number): string | null {
  const slug = steamReviewSlug(positive, negative);
  return slug ? LABEL_BY_SLUG.get(slug)!.label : null;
}

/** Minimum review count options. */
export const REVIEW_COUNT_STEPS = [100, 1000, 10000, 100000] as const;
