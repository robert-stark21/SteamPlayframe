export type FacetGroup = 'genre' | 'feature' | 'theme' | 'content_descriptor';

export const FACET_GROUPS: FacetGroup[] = ['genre', 'feature', 'theme', 'content_descriptor'];

export type SortKey = 'rating_desc' | 'rating_asc' | 'reviews_desc' | 'release_desc' | 'name_asc' | 'name_desc';
export type ViewMode = 'grid' | 'list';
export type DescriptorMode = 'include' | 'exclude';

export interface Facet {
  /** Namespaced id, e.g. "genre:action". */
  id: string;
  /** The part used in URLs, e.g. "action". */
  slug: string;
  label: string;
  group: FacetGroup;
  /** Id in the source system, namespaced, e.g. "steam_genre:1". */
  sourceId: string | null;
  /** Games in the whole indexed catalog carrying this facet. */
  total: number;
}

export interface GameCardData {
  appid: number;
  name: string;
  thumbnailUrl: string | null;
  steamUrl: string;
  /** Up to three short labels with real data behind them. */
  tags: string[];
  /** null = no review data for this game yet. */
  reviews: ReviewSummary | null;
  releaseDate: string | null;
  developer: string | null;
  publisher: string | null;
  /** Steam store short description; null until store details are fetched. */
  description: string | null;
  /** Store screenshots (first few); null until fetched, [] when the store has none. */
  screenshots: Screenshot[] | null;
  /** Vertical library capsule; may 404 for older apps, the card falls back to the header. */
  capsuleUrl: string;
  /** Store details have been attempted for this game. */
  storeChecked: boolean;
}

export interface Screenshot {
  thumb: string;
  full: string;
}

export interface ReviewSummary {
  positive: number;
  negative: number;
  total: number;
  /** SteamDB-formula rating, 0..1. */
  rating: number;
  /** Steam's summary label, e.g. "Very Positive"; null under ten reviews. */
  label: string | null;
  tone: 'positive' | 'mixed' | 'negative' | null;
  /** all: every language (SteamSpy, Steam); english: Steam search summary, used where no all-language count exists. */
  basis: 'all' | 'english';
}

export interface GamesQuery {
  q: string;
  genre: string[];
  feature: string[];
  theme: string[];
  cd: string[];
  cdMode: DescriptorMode;
  /** Steam review label slugs (OR), e.g. ['very-positive']. */
  label: string[];
  /** Minimum number of reviews, or null for any. */
  reviews: number | null;
  sort: SortKey;
  page: number;
  /** Client-only: how results are laid out. */
  view: ViewMode;
}

export interface GamesResponse {
  items: GameCardData[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Contextual counts: games matching every active filter except the facet's own group. */
  counts: Record<string, number>;
  /** Contextual counts per review option, keyed 'label:very-positive' or 'reviews:1000'. */
  reviewCounts: Record<string, number>;
}

export interface CatalogResponse {
  /** demo: hand-curated sample; mirror: SteamSpy + steamcmd.net import; steam: direct Steam sync. */
  mode: 'demo' | 'mirror' | 'steam';
  /** Apps listed but not yet checked (their type, genres and features are loading). */
  pendingCount: number;
  /** True while an import has reported progress in the last few minutes. */
  importRunning: boolean;
  gameCount: number;
  lastUpdated: string | null;
  sorts: SortKey[];
  /** Games whose content descriptors are known (verified empty or listed). */
  descriptorsKnown: number;
  /** Games with review counts. */
  reviewsKnown: number;
  reviewsSource: 'steam' | 'steamspy' | 'mixed' | null;
  reviewsUpdated: string | null;
  facets: Facet[];
}
