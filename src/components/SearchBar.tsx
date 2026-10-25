import { CloseIcon, SearchIcon } from '../icons.tsx';
import { MAX_QUERY_LENGTH } from '../../shared/query.ts';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="game-search" className="visually-hidden">
        Search games by name
      </label>
      <span className="search__icon">
        <SearchIcon size={20} />
      </span>
      <input
        id="game-search"
        className="search__input"
        type="search"
        name="q"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Search games by name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className="search__clear" aria-label="Clear search" onClick={() => onChange('')}>
          <CloseIcon size={18} />
        </button>
      )}
    </form>
  );
}
