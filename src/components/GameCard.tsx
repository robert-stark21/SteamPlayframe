import { useState } from 'react';
import type { GameCardData } from '../../shared/types.ts';
import { ExternalIcon } from '../icons.tsx';
import { ReviewLine } from './ReviewLine.tsx';

/** A short excerpt cut at a word, so the card never hides overflowing text. */
export function excerpt(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[s,.;:!-]+$/, '')}…`;
}

/** Two initials from the name, skipping a leading article: "The Witcher 3" gives "W3". */
export function monogram(name: string): string {
  const words = name.replace(/['’]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const core = words.length > 1 && /^(the|a|an)$/i.test(words[0]) ? words.slice(1) : words;
  return core.slice(0, 2).map((w) => [...w][0]).join('').toUpperCase();
}

interface Props {
  game: GameCardData;
  /** Artwork in the first rows loads eagerly; the rest waits until scrolled near. */
  eager: boolean;
  /** Store details (description) are being fetched for this page. */
  loadingStore?: boolean;
}

export function GameCard({ game, eager, loadingStore = false }: Props) {
  const [broken, setBroken] = useState(!game.thumbnailUrl);
  const ext = { href: game.steamUrl, target: '_blank', rel: 'noopener noreferrer' } as const;

  return (
    <article className="card">
      {/* The artwork repeats the title link for pointer users; keyboard and screen readers get the title and the action. */}
      <a {...ext} className="card__media" tabIndex={-1} aria-hidden="true">
        {broken ? (
          <span className="card__fallback">
            <span className="card__fallback-mark">{monogram(game.name)}</span>
            <span className="card__fallback-note">Artwork unavailable</span>
          </span>
        ) : (
          <img
            src={game.thumbnailUrl!}
            alt=""
            width={460}
            height={215}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'auto'}
            decoding="async"
            onError={() => setBroken(true)}
          />
        )}
      </a>
      <div className="card__body">
        <h3 className="card__title">
          <a {...ext}>{game.name}</a>
        </h3>
        <ReviewLine reviews={game.reviews} />
        {game.description ? (
          <p className="card__desc" title={game.description}>{excerpt(game.description, 110)}</p>
        ) : !game.storeChecked && loadingStore ? (
          <span className="card__desc sk sk--line" aria-hidden="true" />
        ) : null}
        {game.tags.length > 0 && (
          <ul className="card__tags" aria-label="Tags">
            {game.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <a {...ext} className="card__cta" aria-label={`View ${game.name} on Steam (opens in a new tab)`}>
          View on Steam
          <ExternalIcon size={16} />
        </a>
      </div>
    </article>
  );
}
