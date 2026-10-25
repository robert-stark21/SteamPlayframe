/**
 * Filter logic against a synthetic test fixture. These records are not Steam
 * games and never enter the catalog: they exist only in this in-memory database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.ts';
import { ensureDescriptorFacets } from '../server/descriptors.ts';
import { applyDetails, saveSteamTags, upsertGame, upsertListed, type NormalizedGame } from '../server/ingest.ts';
import { learnAndApply } from '../server/tags.ts';
import { catalog, queryGames } from '../server/queries.ts';
import { parseQuery, serializeQuery, DEFAULT_QUERY } from '../shared/query.ts';
import { steamDbRating, steamReviewLabel } from '../shared/reviews.ts';

function fixture(): ReturnType<typeof openDb> {
  const db = openDb(':memory:');
  const base = { appType: 'game', thumbnailUrl: null, releaseDate: null, source: 'demo_fixture' as const, sourceUrl: 'x', fetchedAt: 't' };
  const g = (
    appid: number,
    name: string,
    genres: string[],
    categories: string[],
    tags: string[],
    cd: number[] | null,
    appType = 'game',
    reviews: [number, number] | null = null,
  ): NormalizedGame => ({
    ...base,
    appType,
    appid,
    name,
    genres: genres.map((label) => ({ label, sourceId: null })),
    categories: categories.map((label) => ({ label, sourceId: null })),
    tags: tags.map((name) => ({ id: null, name })),
    contentDescriptors: cd?.map((id) => ({ id })) ?? null,
    reviews: reviews ? { positive: reviews[0], negative: reviews[1], source: 'steamspy', fetchedAt: 't' } : null,
  });
  [
    g(1, 'Alpha Blade', ['Action'], ['Single-player'], ['Fantasy'], [2], 'game', [867120, 134163]), // violent, known
    g(2, 'Beta Farm', ['Simulation', 'RPG'], ['Single-player', 'Online Co-op'], ['Relaxing'], [], 'game', [872384, 13811]), // verified empty
    g(3, 'Gamma Void', ['Action', 'RPG'], ['Online Co-op'], ['Space', 'Sci-fi'], null), // unknown descriptors
    g(4, 'Delta Dread', ['Adventure'], ['Single-player'], ['Horror'], [2, 5], 'game', [95, 5]),
    g(5, 'Epsilon Demo', ['Action'], ['Single-player'], ['Fantasy'], [], 'demo'), // not a game: never listed
    g(6, '100% Orange_Juice', ['Casual'], ['Online PvP'], ['Comedy'], []),
  ].forEach((row) => upsertGame(db, row));
  ensureDescriptorFacets(db);
  return db;
}

const names = (db: ReturnType<typeof openDb>, qs: string) => queryGames(db, parseQuery(qs)).items.map((i) => i.name).sort();

test('no filters lists only games, sorted by name', () => {
  const db = fixture();
  const r = queryGames(db, parseQuery('sort=name_asc'));
  assert.equal(r.total, 5);
  assert.deepEqual(r.items.map((i) => i.appid), [6, 1, 2, 4, 3]);
  assert.ok(!r.items.some((i) => i.appid === 5), 'demo apps are excluded');
});

test('OR inside a group', () => {
  assert.deepEqual(names(fixture(), 'genre=simulation,adventure'), ['Beta Farm', 'Delta Dread']);
});

test('AND across groups', () => {
  assert.deepEqual(names(fixture(), 'genre=rpg&feature=online-co-op'), ['Beta Farm', 'Gamma Void']);
  assert.deepEqual(names(fixture(), 'genre=rpg&feature=online-co-op&theme=space'), ['Gamma Void']);
  assert.deepEqual(names(fixture(), 'genre=action&theme=relaxing'), []);
});

test('themes come from the tag mapping', () => {
  assert.deepEqual(names(fixture(), 'theme=sci-fi'), ['Gamma Void']);
  assert.deepEqual(names(fixture(), 'theme=fantasy'), ['Alpha Blade']);
});

test('descriptor include: at least one selected, unknown never matches', () => {
  assert.deepEqual(names(fixture(), 'cd=frequent-violence-or-gore'), ['Alpha Blade', 'Delta Dread']);
  assert.deepEqual(names(fixture(), 'cd=general-mature-content,some-nudity-or-sexual-content'), ['Delta Dread']);
});

test('descriptor exclude: none of the selected, unknown never matches', () => {
  // Gamma Void (unknown) must not count as "has no violence".
  assert.deepEqual(names(fixture(), 'cd=frequent-violence-or-gore&cdx=exclude'), ['100% Orange_Juice', 'Beta Farm']);
});

test('search is trimmed, case-insensitive and treats % and _ literally', () => {
  const db = fixture();
  assert.deepEqual(names(db, 'q=%20%20alpha%20'), ['Alpha Blade']);
  assert.deepEqual(names(db, 'q=ORANGE_'), ['100% Orange_Juice']);
  assert.deepEqual(names(db, 'q=%25'), ['100% Orange_Juice']);
  assert.deepEqual(names(db, 'q=a&genre=rpg'), ['Beta Farm', 'Gamma Void']);
  upsertGame(db, { appid: 9, name: 'EA SPORTS FC™ 26', appType: 'game', thumbnailUrl: null, releaseDate: null, genres: [], categories: [], tags: [], contentDescriptors: null, source: 'demo_fixture', sourceUrl: 'x', fetchedAt: 't' });
  assert.deepEqual(names(db, 'q=fc%2026'), ['EA SPORTS FC™ 26'], 'the ™ does not block the match');
});

test('filters apply before pagination; totals match', () => {
  const db = fixture();
  const p1 = queryGames(db, parseQuery('genre=action,rpg,simulation,adventure'), 2);
  assert.equal(p1.total, 4);
  assert.equal(p1.pageCount, 2);
  const p2 = queryGames(db, parseQuery('genre=action,rpg,simulation,adventure&page=2'), 2);
  const all = [...p1.items, ...p2.items].map((i) => i.appid);
  assert.equal(new Set(all).size, 4);
  const past = queryGames(db, parseQuery('genre=action&page=99'), 2);
  assert.equal(past.page, past.pageCount, 'a page past the end clamps to the last page');
});

test('Z to A sort', () => {
  const r = queryGames(fixture(), parseQuery('sort=name_desc'));
  assert.deepEqual(r.items.map((i) => i.appid), [3, 4, 2, 1, 6]);
});

test('contextual counts leave out their own group', () => {
  const db = fixture();
  const r = queryGames(db, parseQuery('genre=rpg'));
  assert.equal(r.counts['genre:action'], 2, 'genre counts ignore the genre selection');
  assert.equal(r.counts['feature:online-co-op'], 2);
  assert.equal(r.counts['feature:single-player'], 1);
});

test('catalog reports descriptors known and hides the release sort without dates', () => {
  const c = catalog(fixture());
  assert.equal(c.gameCount, 5);
  assert.equal(c.descriptorsKnown, 4);
  assert.equal(c.reviewsKnown, 3);
  assert.deepEqual(c.sorts, ['rating_desc', 'rating_asc', 'reviews_desc', 'name_asc', 'name_desc']);
  assert.equal(c.facets.filter((f) => f.group === 'content_descriptor').length, 5);
});

test('URL state round-trips and drops junk', () => {
  const q = { ...DEFAULT_QUERY, q: 'hades', label: ['very-positive', 'mixed'], reviews: 1000, view: 'list' as const, genre: ['rpg', 'action'], cd: ['general-mature-content'], cdMode: 'exclude' as const, sort: 'name_desc' as const, page: 3 };
  assert.deepEqual(parseQuery(serializeQuery(q)), q);
  const junk = parseQuery('genre=RPG,%3Cscript%3E,rpg&sort=popular&page=-4&cdx=maybe');
  assert.deepEqual(junk.genre, ['rpg']);
  assert.equal(junk.sort, 'rating_desc');
  assert.equal(junk.page, 1);
  assert.equal(junk.cdMode, 'include');
  assert.equal(serializeQuery(DEFAULT_QUERY), '');
});

test('SteamDB rating matches the published example', () => {
  assert.equal((steamDbRating(867120, 134163)! * 100).toFixed(2), '86.03');
  assert.equal(steamDbRating(0, 0), null);
  assert.equal(steamReviewLabel(872384, 13811), 'Overwhelmingly Positive');
  assert.equal(steamReviewLabel(40, 5), 'Positive');
  assert.equal(steamReviewLabel(60, 40), 'Mixed');
  assert.equal(steamReviewLabel(5, 1), null);
});

test('review filters: Steam labels (OR) and minimum count, unknown never matches', () => {
  const db = fixture();
  // Alpha 86.6% of 1M = Very Positive; Beta 98.4% of 886k = Overwhelmingly Positive; Delta 95% of 100 = Very Positive.
  assert.deepEqual(names(db, 'label=overwhelmingly-positive'), ['Beta Farm']);
  assert.deepEqual(names(db, 'label=very-positive'), ['Alpha Blade', 'Delta Dread']);
  assert.deepEqual(names(db, 'label=overwhelmingly-positive,very-positive&reviews=1000'), ['Alpha Blade', 'Beta Farm']);
  assert.deepEqual(names(db, 'label=mixed'), []);
  assert.deepEqual(names(db, 'label=very-positive&theme=sci-fi'), [], 'Gamma Void has no reviews');
});

test('worst-first sort', () => {
  const r = queryGames(fixture(), parseQuery('sort=rating_asc'));
  assert.deepEqual(r.items.map((i) => i.appid).slice(0, 3), [4, 1, 2]);
  assert.equal(r.items[0].reviews?.tone, 'positive');
});

test('rating sort puts the best first and games without reviews last', () => {
  const r = queryGames(fixture(), parseQuery('sort=rating_desc'));
  // Delta Dread's 95% from 100 reviews rates 83.8%, below Alpha Blade's 86.0% from a million.
  assert.deepEqual(r.items.map((i) => i.appid).slice(0, 3), [2, 1, 4]);
  assert.equal(r.items[0].reviews?.label, 'Overwhelmingly Positive');
  assert.equal(r.items.at(-1)?.reviews, null);
});

test('review option counts follow the other filters', () => {
  const r = queryGames(fixture(), parseQuery('genre=action'));
  assert.equal(r.reviewCounts['label:very-positive'], 1);
  assert.equal(r.reviewCounts['reviews:100'], 1);
  assert.equal(r.reviewCounts['label:overwhelmingly-positive'], undefined);
});

test('tag ids are learned from noisy SteamSpy lists; themes follow each game\'s own top tags', () => {
  const db = openDb(':memory:');
  const base = { appType: 'game', thumbnailUrl: null, releaseDate: null, genres: [], categories: [], tags: [], contentDescriptors: [] as { id: number }[], source: 'steamcmd' as const, sourceUrl: 'x', fetchedAt: 't' };
  for (let id = 1; id <= 20; id++) {
    upsertListed(db, id, `Game ${id}`, null, 'x');
    // 1 to 10 carry Horror (id 1667) and Psychological Horror (id 1721 on 1 to 4); all carry Indie (492).
    const tags = [...(id <= 10 ? [1667] : []), ...(id <= 4 ? [1721] : []), 492];
    applyDetails(db, { ...base, appid: id, name: `Game ${id}`, storeTagIds: tags });
  }
  const spy = db.prepare('INSERT INTO spy_tag (tag_name, appid) VALUES (?, ?)');
  // SteamSpy lists 1 to 10 under Horror, plus 15, which has only a few Horror votes.
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15]) spy.run('Horror', id);
  for (const id of [1, 2, 3, 4, 5, 6]) spy.run('Psychological Horror', id);
  const learned = learnAndApply(db, ['Horror', 'Psychological Horror']);
  assert.equal(learned.find((l) => l.name === 'Horror')?.tagId, 1667, 'not Indie, not Psychological Horror');
  assert.equal(learned.find((l) => l.name === 'Psychological Horror')?.tagId, null, 'only 4 carriers: under the support floor');
  const horror = (db.prepare(`SELECT appid FROM game_facet WHERE facet_id = 'theme:horror' ORDER BY appid`).all() as { appid: number }[]).map((r) => r.appid);
  assert.deepEqual(horror, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'game 15 is not Horror');
});

test('review sources: all-language counts win; the English search summary only fills gaps', () => {
  const db = openDb(':memory:');
  const at = 't';
  const row = (id: number) => db.prepare('SELECT review_positive p, review_negative n, reviews_source s, review_label l FROM game WHERE appid = ?').get(id) as { p: number; n: number; s: string; l: string };
  // A new release SteamSpy has as 0/0 (FC 26): the search summary fills it, and a later 0/0 does not wipe it.
  upsertListed(db, 3405690, 'EA SPORTS FC 26', { positive: 15567, negative: 14956, source: 'steam_search', fetchedAt: at }, 'x', 'steam_search');
  upsertListed(db, 3405690, 'EA SPORTS FC 26', { positive: 0, negative: 0, source: 'steamspy', fetchedAt: at }, 'x');
  assert.deepEqual({ ...row(3405690) }, { p: 15567, n: 14956, s: 'steam_search', l: 'mixed' });
  // Real all-language counts replace the search summary...
  upsertListed(db, 3405690, 'EA SPORTS FC 26', { positive: 40000, negative: 38000, source: 'steamspy', fetchedAt: at }, 'x');
  assert.equal(row(3405690).s, 'steamspy');
  // ...and the search summary never replaces them.
  upsertListed(db, 3405690, 'EA SPORTS FC 26', { positive: 10, negative: 0, source: 'steam_search', fetchedAt: at }, 'x', 'steam_search');
  assert.deepEqual({ ...row(3405690) }, { p: 40000, n: 38000, s: 'steamspy', l: 'mixed' });
});

test('Steam tags: include any, exclude none, unknown tags never match', () => {
  const db = openDb(':memory:');
  saveSteamTags(db, [{ tagid: 4085, name: 'Anime' }, { tagid: 3799, name: 'Visual Novel' }, { tagid: 1667, name: 'Horror' }]);
  const base = { appType: 'game', thumbnailUrl: null, releaseDate: null, genres: [{ label: 'Adventure', sourceId: null }], categories: [], tags: [], contentDescriptors: [] as { id: number }[], source: 'steamcmd' as const, sourceUrl: 'x', fetchedAt: 't' };
  const add = (appid: number, name: string, tags: number[] | undefined) => {
    upsertListed(db, appid, name, null, 'x');
    applyDetails(db, { ...base, appid, name, storeTagIds: tags });
  };
  add(1, 'Anime Novel', [4085, 3799]);
  add(2, 'Anime Action', [4085]);
  add(3, 'Plain Novel', [3799]);
  add(4, 'Horror Novel', [1667, 3799]);
  add(5, 'No Tags Yet', undefined); // details known, Steam tags not loaded
  const names = (qs: string) => queryGames(db, parseQuery(qs)).items.map((i) => i.name).sort();
  assert.deepEqual(names('tag=anime&xtag=visual-novel'), ['Anime Action'], 'anime games that are not visual novels');
  assert.deepEqual(names('tag=anime,horror'), ['Anime Action', 'Anime Novel', 'Horror Novel']);
  assert.deepEqual(names('xtag=visual-novel'), ['Anime Action'], 'a game with unknown tags is not assumed to lack the tag');
  assert.deepEqual(names('xgenre=adventure'), [], 'genre exclusion');
  assert.deepEqual(queryGames(db, parseQuery('')).items[0].tags.length > 0, true);
  const card = queryGames(db, parseQuery('q=anime%20novel')).items[0];
  assert.deepEqual(card.tags, ['Anime', 'Visual Novel'], 'cards show Steam tags in Steam order');
  const c = catalog(db);
  assert.equal(c.tagsKnown, 4);
  assert.deepEqual(c.tags.map((t) => `${t.slug}=${t.total}`), ['visual-novel=3', 'anime=2', 'horror=1']);
});

test('URL keeps exclusions', () => {
  const q = parseQuery('tag=anime&xtag=visual-novel&xgenre=casual&xtheme=horror&xfeature=pvp');
  assert.deepEqual([q.tag, q.xtag, q.xgenre, q.xtheme, q.xfeature], [['anime'], ['visual-novel'], ['casual'], ['horror'], ['pvp']]);
  assert.equal(serializeQuery(q), 'xgenre=casual&xfeature=pvp&xtheme=horror&tag=anime&xtag=visual-novel');
});
