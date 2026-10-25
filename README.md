# PLAYFRAME

Find Steam games with four combined filters (Genres, Features, Theme, Content descriptor) and open them on Steam.

Stack: React + TypeScript (Vite) front end, a small Node API (`node:http`), SQLite through Node's built-in `node:sqlite`. Requires **Node 22.13+**. No native modules.

## Run locally

```bash
npm install
cp .env.example .env          # optional; defaults work
npm run db:seed-demo          # loads the demo catalog (94 real Steam games)
npm run dev                   # API on :8787, site on http://localhost:5173
```

Production on one port: `npm run build && npm start` → http://127.0.0.1:8787.

Checks: `npm test` (filter logic on a synthetic fixture), `npm run typecheck`, `npm run build`.

## Data

| Mode | Where it comes from | Label in the UI |
| --- | --- | --- |
| Demo | `data/demo-catalog.ts`: real appids, names and store links; genres, features and tags curated by hand. Content descriptors, release dates and reviews left unknown. | "Demo catalog" badge |
| Mirror (default) | `npm run import`: the full Steam game list through public mirrors, for networks where Steam itself is blocked | footer source line; "Import running" badge while it runs |
| Steam | `npm run sync`: Steam Web API + storefront directly | footer source line |

### Full catalog import (`npm run import`)

1. **List**, from two sources at once:
   - SteamSpy `request=all`, 1,000 apps a page, one page a minute (its limit): appid, name, and all-language positive and negative review counts. SteamSpy lags on new releases (EA SPORTS FC 26 shows 0 reviews there and is missing from its list).
   - Steam's own store search (games only, newest first, 100 a page, every 2 seconds; needs `STEAM_DNS` where the system resolver cannot reach Steam): every game the store lists, about 125,000. Where SteamSpy has no reviews, Steam's summary from the search results fills in; it covers English reviews only, and the card says "English reviews".
2. **Details**: steamcmd.net, a public mirror of Steam's own app data, 4 apps at a time, most-reviewed first. Gives type (only `game` is listed; DLC, demos, tools and software are hidden), genres, categories (features), content descriptors, release date and artwork. About 10 apps a second.
3. **Themes**: SteamSpy `request=tag` for each theme tag by name, once after the first 10 list pages and again when the list is complete.

Stop it with Ctrl+C and run it again to continue: the list page and each app's details are checkpointed in the database. `-- --refresh-list` re-reads the list (new games, fresh review counts); re-running also picks up anything that failed.

### User reviews

Rating = SteamDB's published formula over Steam's review counts: `score - (score - 0.5) * 2^(-log10(total + 1))`, where `score = positive / total`. 867,120 positive and 134,163 negative give 86.03%. The label (Very Positive and so on) uses Steam's published thresholds. Filters: minimum rating (95, 90, 80, 70, 50%) and minimum number of reviews (100 to 100,000); games without reviews never match them. Sorts: rating (default) and most reviewed.

### Turn on real Steam data

1. Run on a network that can reach `api.steampowered.com` and `store.steampowered.com`.
2. Optional: set `STEAM_API_KEY` in `.env` to walk the full app list (`IStoreService/GetAppList`). Without a key the sync starts from `ISteamChartsService/GetMostPlayedGames` plus `SYNC_SEED_APPIDS`.
3. `npm run sync`, and run it again to continue (it checkpoints). `-- --limit 200` caps a run; `-- --restart` builds a fresh candidate list.

What the sync does (`server/providers/steam.ts`, `scripts/sync-steam.ts`):

- `IStoreBrowseService/GetItems` gives tag ids per app; `IStoreService/GetTagList` gives their names.
- Storefront `appdetails` gives app type, genres, categories, content descriptors, artwork and release date. It has no published contract, so parsing is isolated and defensive, and it is throttled (`STEAM_DETAILS_DELAY_MS`, default 1600 ms).
- Only `type = game` is listed. Demos, DLC, soundtracks and software are stored but hidden.
- Upserts by appid, one transaction per batch, with retries and backoff on 429 and 5xx. A failed run leaves the existing catalog alone. Demo rows are removed only after at least one Steam game has been stored.
- The release-date sort appears automatically once 90% or more of games have a date.

SteamDB is a reference only: it offers no public API and does not allow scraping. A licensed SteamDB export would plug in as another provider that emits `NormalizedGame` (`server/ingest.ts`) with `source: 'authorized_steamdb'`.

## Taxonomy (`server/taxonomy.ts`)

- **Genres**: Steam store genres.
- **Features**: Steam store categories, limited to an allowlist of play modes and capabilities (matched on label).
- **Theme**: derived from Steam user tags through a versioned map (`THEME_MAP_VERSION`). Raw tags are kept in `game_tag`, so `rebuildThemes()` can re-derive themes after a map change.
- **Content descriptor**: Steam's descriptor ids and labels, never inferred. `descriptors_known = 0` means unknown. Unknown games never satisfy a descriptor filter, in Include or Exclude mode.

Filter logic: OR inside a group, AND across groups, search (case-insensitive, trimmed) AND everything. Filtering, counting and sorting run in SQL over the whole catalog before a page of 24 is taken.

## Deploy

One Node process plus one SQLite file. Point `DATABASE_PATH` at a persistent disk and run the sync on a schedule (cron). Serverless or ephemeral disks need a durable database instead: keep `server/queries.ts` and swap `server/db.ts`.

PLAYFRAME is not affiliated with Valve or Steam.
