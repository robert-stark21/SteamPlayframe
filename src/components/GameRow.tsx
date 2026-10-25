import { useState } from 'react';
import type { GameCardData } from '../../shared/types.ts';
import { ExternalIcon } from '../icons.tsx';
import { monogram } from './GameCard.tsx';
import { ReviewLine } from './ReviewLine.tsx';

interface Props {
  game: GameCardData;
  eager: boolean;
  loadingStore: boolean;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** An image that falls back once (capsule → header), then to a monogram panel. */
function Art({ sources, alt, eager, className, label }: { sources: (string | null)[]; alt: string; eager: boolean; className: string; label: string }) {
  const list = sources.filter((s): s is string => !!s);
  const [i, setI] = useState(0);
  if (i >= list.length) {
    return (
      <span className={`${className} art-fallback`}>
        <span className="card__fallback-mark">{monogram(label)}</span>
        <span className="card__fallback-note">Artwork unavailable</span>
      </span>
    );
  }
  return <img className={className} src={list[i]} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setI((n) => n + 1)} />;
}

/** One game as a wide row: capsule, facts, and screenshots from the Steam store. */
export function GameRow({ game, eager, loadingStore }: Props) {
  const ext = { href: game.steamUrl, target: '_blank', rel: 'noopener noreferrer' } as const;
  const [failed, setFailed] = useState<string[]>([]);
  const shots = (game.screenshots ?? []).filter((s) => !failed.includes(s.thumb));
  const [active, setActive] = useState(0);
  const main = shots[Math.min(active, shots.length - 1)];
  const released = formatDate(game.releaseDate);

  return (
    <article className="row">
      <a {...ext} className="row__capsule" tabIndex={-1} aria-hidden="true">
        <Art sources={[game.capsuleUrl, game.thumbnailUrl]} alt="" eager={eager} className="row__capsule-img" label={game.name} />
      </a>

      <div className="row__info">
        <h3 className="row__title">
          <a {...ext}>{game.name}</a>
        </h3>
        {game.description ? (
          <p className="row__desc">{game.description}</p>
        ) : !game.storeChecked && loadingStore ? (
          <span className="row__desc-sk" aria-hidden="true">
            <span className="sk sk--line" />
            <span className="sk sk--line" />
            <span className="sk sk--line sk--short" />
          </span>
        ) : (
          <p className="row__desc row__desc--none">No store description loaded.</p>
        )}
        {game.tags.length > 0 && (
          <ul className="card__tags" aria-label="Tags">
            {game.tags.map((t) => <li key={t}>{t}</li>)}
          </ul>
        )}
        <dl className="row__facts">
          {released && (<><dt>Release date</dt><dd className="num">{released}</dd></>)}
          {game.developer && (<><dt>Developer</dt><dd>{game.developer}</dd></>)}
          {game.publisher && (<><dt>Publisher</dt><dd>{game.publisher}</dd></>)}
        </dl>
        <div className="row__foot">
          <ReviewLine reviews={game.reviews} size="md" />
          <a {...ext} className="card__cta" aria-label={`View ${game.name} on Steam (opens in a new tab)`}>
            View on Steam
            <ExternalIcon size={16} />
          </a>
        </div>
      </div>

      <div className="row__media">
        {main ? (
          <a {...ext} className="row__shot" tabIndex={-1} aria-hidden="true">
            <Art key={main.full} sources={[main.full.replace('.1920x1080', '.600x338'), game.thumbnailUrl]} alt="" eager={eager} className="row__shot-img" label={game.name} />
          </a>
        ) : !game.storeChecked && loadingStore ? (
          <span className="row__shot sk" aria-hidden="true" />
        ) : (
          <a {...ext} className="row__shot" tabIndex={-1} aria-hidden="true">
            <Art sources={[game.thumbnailUrl]} alt="" eager={eager} className="row__shot-img" label={game.name} />
          </a>
        )}
        {shots.length > 1 && (
          <ul className="row__thumbs" aria-label={`${game.name} screenshots`}>
            {shots.slice(0, 4).map((s, i) =>
              s === main ? null : (
                <li key={s.thumb}>
                  <button type="button" className="row__thumb" onClick={() => setActive(i)} aria-label={`Show screenshot ${i + 1}`}>
                    <img
                      src={s.thumb}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={600}
                      height={338}
                      onError={() => setFailed((f) => [...f, s.thumb])}
                    />
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </article>
  );
}
