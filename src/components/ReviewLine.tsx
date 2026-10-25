import type { ReviewSummary } from '../../shared/types.ts';
import { ThumbIcon } from '../icons.tsx';

/** "97.71%  Overwhelmingly Positive (882,951 reviews)", with a thumb in the label's tone. */
export function ReviewLine({ reviews, size = 'sm' }: { reviews: ReviewSummary | null; size?: 'sm' | 'md' }) {
  if (!reviews) return <p className={`review review--${size} review--none`}>No user reviews yet</p>;
  const count = `${reviews.total.toLocaleString('en')}${reviews.basis === 'english' ? ' English' : ''} ${reviews.total === 1 ? 'review' : 'reviews'}`;
  return (
    <p className={`review review--${size}${reviews.tone ? ` review--${reviews.tone}` : ''}`}>
      <span className="review__score num" title="SteamDB-style rating">{(reviews.rating * 100).toFixed(2)}%</span>
      {reviews.tone && <ThumbIcon size={size === 'md' ? 18 : 16} tone={reviews.tone} />}
      <span className="review__label">{reviews.label ?? count}</span>
      {reviews.label && <span className="review__count num">({count})</span>}
    </p>
  );
}
