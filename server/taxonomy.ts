/**
 * Managed taxonomy: how source metadata becomes the four filter groups.
 *
 * - Genres come straight from Steam's store genres.
 * - Features come from Steam store categories, limited to the play modes and
 *   capabilities below (matched on the source label, so ids never need guessing).
 * - Themes are derived from Steam user tags through THEME_MAP. Bump
 *   THEME_MAP_VERSION whenever the mapping changes, then re-run the sync or
 *   `npm run db:seed-demo` so stored themes follow.
 * - Content descriptors keep Steam's own ids and labels. They are never
 *   inferred from tags, genres, names or artwork.
 */

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Steam store category labels accepted as Features (lowercased). */
export const FEATURE_LABELS = new Set([
  'single-player',
  'multi-player',
  'pvp',
  'online pvp',
  'lan pvp',
  'shared/split screen pvp',
  'co-op',
  'online co-op',
  'lan co-op',
  'shared/split screen co-op',
  'shared/split screen',
  'cross-platform multiplayer',
  'mmo',
  'full controller support',
  'partial controller support',
  'steam workshop',
  'steam achievements',
  'steam cloud',
  'remote play together',
  'vr supported',
  'vr support',
  'vr only',
]);

/** Steam store genre ids used by games (checked against SteamSpy genre names, Oct 2026). */
export const STEAM_GENRES: Record<number, string> = {
  1: 'Action', 2: 'Strategy', 3: 'RPG', 4: 'Casual', 9: 'Racing', 18: 'Sports', 23: 'Indie',
  25: 'Adventure', 28: 'Simulation', 29: 'Massively Multiplayer', 37: 'Free To Play', 70: 'Early Access',
};

/** Steam store category ids → labels, for the categories accepted as Features. */
export const STEAM_CATEGORIES: Record<number, string> = {
  1: 'Multi-player', 2: 'Single-player', 9: 'Co-op', 18: 'Partial Controller Support', 20: 'MMO',
  22: 'Steam Achievements', 23: 'Steam Cloud', 24: 'Shared/Split Screen', 27: 'Cross-Platform Multiplayer',
  28: 'Full controller support', 30: 'Steam Workshop', 36: 'Online PvP', 37: 'Shared/Split Screen PvP',
  38: 'Online Co-op', 39: 'Shared/Split Screen Co-op', 44: 'Remote Play Together', 47: 'LAN PvP',
  48: 'LAN Co-op', 49: 'PvP', 53: 'VR Supported', 54: 'VR Only',
};

export const THEME_MAP_VERSION = 1;

/** Theme slug → label, and the Steam tag names (lowercased) that place a game in it. */
export const THEMES: Record<string, { label: string; tags: string[] }> = {
  fantasy: { label: 'Fantasy', tags: ['fantasy', 'dark fantasy', 'magic'] },
  'sci-fi': { label: 'Sci-fi', tags: ['sci-fi', 'futuristic', 'aliens', 'robots', 'dystopian'] },
  cyberpunk: { label: 'Cyberpunk', tags: ['cyberpunk'] },
  space: { label: 'Space', tags: ['space', 'space sim'] },
  medieval: { label: 'Medieval', tags: ['medieval'] },
  horror: { label: 'Horror', tags: ['horror', 'psychological horror', 'survival horror', 'lovecraftian'] },
  'post-apocalyptic': { label: 'Post-apocalyptic', tags: ['post-apocalyptic'] },
  relaxing: { label: 'Relaxing', tags: ['relaxing', 'cozy', 'wholesome'] },
  mythology: { label: 'Mythology', tags: ['mythology'] },
  historical: { label: 'Historical', tags: ['historical', 'world war ii', 'world war i', 'cold war'] },
  western: { label: 'Western', tags: ['western'] },
  military: { label: 'Military', tags: ['military', 'war'] },
  mystery: { label: 'Mystery', tags: ['mystery', 'detective'] },
  zombies: { label: 'Zombies', tags: ['zombies'] },
  comedy: { label: 'Comedy', tags: ['comedy', 'funny'] },
  anime: { label: 'Anime', tags: ['anime'] },
  pirates: { label: 'Pirates', tags: ['pirates'] },
  underwater: { label: 'Underwater', tags: ['underwater'] },
};

/** Steam tag names, in Steam's own casing, that feed THEMES (for tag-by-name lookups). */
export const THEME_SOURCE_TAGS = [
  'Fantasy', 'Dark Fantasy', 'Magic', 'Sci-fi', 'Futuristic', 'Aliens', 'Robots', 'Dystopian', 'Cyberpunk',
  'Space', 'Space Sim', 'Medieval', 'Horror', 'Psychological Horror', 'Survival Horror', 'Lovecraftian',
  'Post-apocalyptic', 'Relaxing', 'Cozy', 'Wholesome', 'Mythology', 'Historical', 'World War II', 'World War I',
  'Cold War', 'Western', 'Military', 'War', 'Mystery', 'Detective', 'Zombies', 'Comedy', 'Funny', 'Anime',
  'Pirates', 'Underwater',
];

const TAG_TO_THEMES = new Map<string, string[]>();
for (const [slug, def] of Object.entries(THEMES)) {
  for (const tag of def.tags) {
    TAG_TO_THEMES.set(tag, [...(TAG_TO_THEMES.get(tag) ?? []), slug]);
  }
}

export function themesForTags(tagNames: string[]): string[] {
  const out = new Set<string>();
  for (const name of tagNames) {
    for (const slug of TAG_TO_THEMES.get(name.trim().toLowerCase()) ?? []) out.add(slug);
  }
  return [...out];
}

/**
 * Steam content descriptor ids as documented by Valve
 * (partner.steamgames.com/doc/store/age_gate). Labels from the sync win when present.
 */
export const STEAM_CONTENT_DESCRIPTORS: Record<number, string> = {
  1: 'Some Nudity or Sexual Content',
  2: 'Frequent Violence or Gore',
  3: 'Adult Only Sexual Content',
  4: 'Frequent Nudity or Sexual Content',
  5: 'General Mature Content',
};
