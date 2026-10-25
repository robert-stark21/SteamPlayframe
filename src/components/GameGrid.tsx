import type { GameCardData, ViewMode } from '../../shared/types.ts';
import { GameCard } from './GameCard.tsx';
import { GameRow } from './GameRow.tsx';

interface Props {
  games: GameCardData[];
  busy: boolean;
  view: ViewMode;
  loadingStore: boolean;
}

export function GameGrid({ games, busy, view, loadingStore }: Props) {
  return (
    <ul className={`${view === 'list' ? 'rows' : 'grid'}${busy ? ' grid--busy' : ''}`} aria-busy={busy}>
      {games.map((g, i) => (
        <li key={g.appid}>
          {view === 'list' ? (
            <GameRow game={g} eager={i < 3} loadingStore={loadingStore} />
          ) : (
            <GameCard game={g} eager={i < 8} loadingStore={loadingStore} />
          )}
        </li>
      ))}
    </ul>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ul className="grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="card card--skeleton">
            <span className="sk sk--media" />
            <span className="card__body">
              <span className="sk sk--line" />
              <span className="sk sk--line sk--short" />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
