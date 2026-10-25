/** Loads Steam's tag list into the database (also done at the start of every import). */
import { config } from '../server/config.ts';
import { openDb, transaction } from '../server/db.ts';
import { saveSteamTags } from '../server/ingest.ts';
import { steamTagList } from '../server/providers/steamstore.ts';

const db = openDb(config.databasePath);
const tags = await steamTagList();
console.log(`[tags] ${transaction(db, () => saveSteamTags(db, tags))} Steam tags saved`);
db.close();
