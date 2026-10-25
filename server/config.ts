import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : d;
};

export const config = {
  databasePath: process.env.DATABASE_PATH || './data/playframe.db',
  apiPort: num(process.env.API_PORT, 8787),
  steamApiKey: process.env.STEAM_API_KEY || '',
  seedAppids: (process.env.SYNC_SEED_APPIDS || '')
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0),
  syncLimit: num(process.env.SYNC_LIMIT, 500),
  country: process.env.STEAM_COUNTRY || 'US',
  language: process.env.STEAM_LANGUAGE || 'english',
  detailsDelayMs: Math.max(1000, num(process.env.STEAM_DETAILS_DELAY_MS, 1600)),
};
