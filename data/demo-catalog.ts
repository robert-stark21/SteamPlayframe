/**
 * Demo catalog: used only when the Steam sync has not run (no network to Steam, no key).
 *
 * Every row is a real Steam app: the appid, name and store link are real. Genres,
 * features and user tags were hand-curated from public store listings and may lag
 * the live store; a sync replaces them. Content descriptors are left unknown (null)
 * on purpose: they are only ever filled from source metadata by the sync, never guessed.
 * Release dates are left out for the same reason, so the release sort stays hidden.
 */

const G = {
  A: 'Action', Ad: 'Adventure', R: 'RPG', S: 'Strategy', Si: 'Simulation', C: 'Casual',
  I: 'Indie', Ra: 'Racing', Sp: 'Sports', M: 'Massively Multiplayer', F: 'Free To Play',
} as const;

const F = {
  sp: 'Single-player', mp: 'Multi-player', pvp: 'PvP', opvp: 'Online PvP', sspvp: 'Shared/Split Screen PvP',
  coop: 'Co-op', ocoop: 'Online Co-op', sscoop: 'Shared/Split Screen Co-op', ctrl: 'Full controller support',
  pctrl: 'Partial Controller Support', ws: 'Steam Workshop', ach: 'Steam Achievements',
  rpt: 'Remote Play Together', vr: 'VR Supported', vro: 'VR Only', xp: 'Cross-Platform Multiplayer',
} as const;

type Row = [appid: number, name: string, genres: (keyof typeof G)[], features: (keyof typeof F)[], tags: string[]];

const ROWS: Row[] = [
  [2358720, 'Black Myth: Wukong', ['A', 'Ad', 'R'], ['sp', 'ctrl', 'ach'], ['Mythology', 'Action RPG', 'Souls-like', 'Fantasy', 'Story Rich']],
  [413150, 'Stardew Valley', ['I', 'R', 'Si'], ['sp', 'mp', 'coop', 'ocoop', 'sscoop', 'ctrl', 'ach', 'rpt'], ['Farming Sim', 'Pixel Graphics', 'Relaxing', 'Cozy', 'Life Sim']],
  [1091500, 'Cyberpunk 2077', ['R'], ['sp', 'ctrl', 'ach'], ['Cyberpunk', 'Open World', 'Sci-fi', 'Futuristic', 'Story Rich']],
  [1245620, 'ELDEN RING', ['A', 'R'], ['sp', 'mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ctrl', 'ach'], ['Souls-like', 'Dark Fantasy', 'Open World', 'Difficult']],
  [1086940, "Baldur's Gate 3", ['Ad', 'R', 'S'], ['sp', 'mp', 'coop', 'ocoop', 'sscoop', 'ctrl', 'ach'], ['CRPG', 'Fantasy', 'Story Rich', 'Turn-Based Combat']],
  [292030, 'The Witcher 3: Wild Hunt', ['R'], ['sp', 'ctrl', 'ach'], ['Open World', 'Fantasy', 'Medieval', 'Story Rich', 'Dark Fantasy']],
  [489830, 'The Elder Scrolls V: Skyrim Special Edition', ['R'], ['sp', 'ctrl', 'ach'], ['Open World', 'Fantasy', 'Medieval', 'Exploration']],
  [377160, 'Fallout 4', ['R'], ['sp', 'ctrl', 'ach'], ['Post-apocalyptic', 'Open World', 'Sci-fi', 'Exploration']],
  [22380, 'Fallout: New Vegas', ['A', 'R'], ['sp', 'ach'], ['Post-apocalyptic', 'Open World', 'Western', 'Choices Matter']],
  [730, 'Counter-Strike 2', ['A', 'F'], ['mp', 'pvp', 'opvp', 'ws', 'ach'], ['FPS', 'Shooter', 'Competitive', 'Tactical', 'Military']],
  [570, 'Dota 2', ['A', 'S', 'F'], ['mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ws'], ['MOBA', 'Fantasy', 'Competitive']],
  [440, 'Team Fortress 2', ['A', 'F'], ['mp', 'pvp', 'opvp', 'ws', 'ach'], ['Hero Shooter', 'FPS', 'Comedy', 'Class-Based']],
  [578080, 'PUBG: BATTLEGROUNDS', ['A', 'Ad', 'M', 'F'], ['mp', 'pvp', 'opvp', 'coop', 'ocoop'], ['Battle Royale', 'Survival', 'Shooter', 'Military']],
  [1172470, 'Apex Legends', ['A', 'Ad', 'F'], ['mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ctrl', 'xp'], ['Battle Royale', 'Hero Shooter', 'Sci-fi', 'FPS']],
  [105600, 'Terraria', ['A', 'Ad', 'I', 'R'], ['sp', 'mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ctrl', 'ws', 'ach'], ['Sandbox', 'Survival', 'Pixel Graphics', 'Crafting', 'Fantasy']],
  [252490, 'Rust', ['A', 'Ad', 'I', 'M', 'R'], ['mp', 'pvp', 'opvp', 'coop', 'ocoop'], ['Survival', 'Crafting', 'Open World', 'Multiplayer']],
  [892970, 'Valheim', ['A', 'Ad', 'I'], ['sp', 'mp', 'coop', 'ocoop', 'ctrl', 'ach'], ['Survival', 'Open World', 'Crafting', 'Fantasy', 'Mythology']],
  [367520, 'Hollow Knight', ['A', 'Ad', 'I'], ['sp', 'ctrl', 'ach'], ['Metroidvania', 'Souls-like', 'Atmospheric', '2D', 'Dark Fantasy']],
  [1145360, 'Hades', ['A', 'I', 'R'], ['sp', 'ctrl', 'ach'], ['Roguelike', 'Mythology', 'Hack and Slash', 'Story Rich']],
  [1145350, 'Hades II', ['A', 'I', 'R'], ['sp', 'ctrl', 'ach'], ['Roguelike', 'Mythology', 'Hack and Slash', 'Fantasy']],
  [646570, 'Slay the Spire', ['I', 'S'], ['sp', 'ctrl', 'ach'], ['Roguelike Deckbuilder', 'Card Game', 'Turn-Based', 'Fantasy']],
  [1794680, 'Vampire Survivors', ['A', 'C', 'I', 'R'], ['sp', 'mp', 'coop', 'sscoop', 'ctrl', 'ach', 'rpt'], ['Roguelite', 'Pixel Graphics', 'Bullet Hell', 'Gothic']],
  [504230, 'Celeste', ['A', 'Ad', 'I'], ['sp', 'ctrl', 'ach'], ['Platformer', 'Pixel Graphics', 'Difficult', 'Story Rich']],
  [1868140, 'DAVE THE DIVER', ['Ad', 'C', 'I', 'R', 'Si'], ['sp', 'ctrl', 'ach'], ['Underwater', 'Pixel Graphics', 'Management', 'Fishing']],
  [1426210, 'It Takes Two', ['A', 'Ad'], ['mp', 'coop', 'ocoop', 'sscoop', 'ctrl', 'ach', 'rpt'], ['Co-op', 'Platformer', 'Puzzle', 'Split Screen', 'Comedy']],
  [620, 'Portal 2', ['A', 'Ad'], ['sp', 'mp', 'coop', 'ocoop', 'sscoop', 'ctrl', 'ws', 'ach'], ['Puzzle', 'Sci-fi', 'Comedy', 'First-Person']],
  [400, 'Portal', ['A'], ['sp', 'ach'], ['Puzzle', 'Sci-fi', 'First-Person']],
  [220, 'Half-Life 2', ['A'], ['sp', 'ach'], ['FPS', 'Sci-fi', 'Dystopian', 'Classic']],
  [546560, 'Half-Life: Alyx', ['A', 'Ad'], ['sp', 'vro', 'ws', 'ach'], ['VR', 'Sci-fi', 'FPS', 'Atmospheric']],
  [620980, 'Beat Saber', ['A', 'I'], ['sp', 'mp', 'vro', 'ach'], ['Rhythm', 'VR', 'Music']],
  [381210, 'Dead by Daylight', ['A'], ['mp', 'pvp', 'opvp', 'ctrl', 'ach', 'xp'], ['Horror', 'Survival Horror', 'Multiplayer']],
  [739630, 'Phasmophobia', ['A', 'I'], ['sp', 'mp', 'coop', 'ocoop', 'vr', 'ach'], ['Horror', 'Psychological Horror', 'Co-op', 'Investigation']],
  [1966720, 'Lethal Company', ['A', 'Ad', 'I'], ['mp', 'coop', 'ocoop'], ['Horror', 'Co-op', 'Sci-fi', 'Comedy', 'Survival Horror']],
  [427520, 'Factorio', ['C', 'I', 'Si', 'S'], ['sp', 'mp', 'coop', 'ocoop', 'ach'], ['Automation', 'Base Building', 'Sci-fi', 'Crafting']],
  [526870, 'Satisfactory', ['Ad', 'I', 'Si', 'S'], ['sp', 'mp', 'coop', 'ocoop', 'ach'], ['Automation', 'Base Building', 'Open World', 'Sci-fi']],
  [294100, 'RimWorld', ['I', 'Si', 'S'], ['sp', 'ws', 'ach'], ['Colony Sim', 'Sci-fi', 'Survival', 'Base Building']],
  [975370, 'Dwarf Fortress', ['I', 'Si', 'S'], ['sp', 'ws', 'ach'], ['Colony Sim', 'Fantasy', 'Pixel Graphics', 'Simulation']],
  [1158310, 'Crusader Kings III', ['R', 'Si', 'S'], ['sp', 'mp', 'ach'], ['Grand Strategy', 'Medieval', 'Historical', 'Role-Playing']],
  [281990, 'Stellaris', ['Si', 'S'], ['sp', 'mp', 'ws', 'ach'], ['Grand Strategy', 'Space', 'Sci-fi', '4X']],
  [289070, "Sid Meier's Civilization VI", ['S'], ['sp', 'mp', 'pvp', 'opvp', 'ws', 'ach'], ['Turn-Based Strategy', 'Historical', '4X']],
  [394360, 'Hearts of Iron IV', ['Si', 'S'], ['sp', 'mp', 'ws', 'ach'], ['Grand Strategy', 'World War II', 'Historical', 'Military']],
  [1142710, 'Total War: WARHAMMER III', ['A', 'S'], ['sp', 'mp', 'pvp', 'opvp', 'ws', 'ach'], ['Strategy', 'Fantasy', 'Dark Fantasy', 'RTS']],
  [813780, 'Age of Empires II: Definitive Edition', ['S'], ['sp', 'mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ach'], ['RTS', 'Historical', 'Medieval', 'Strategy']],
  [255710, 'Cities: Skylines', ['Si', 'S'], ['sp', 'ws', 'ach'], ['City Builder', 'Management', 'Sandbox']],
  [1222670, 'The Sims 4', ['C', 'Si', 'F'], ['sp', 'pctrl'], ['Life Sim', 'Relaxing', 'Character Customization']],
  [244210, 'Assetto Corsa', ['I', 'Ra', 'Si', 'Sp'], ['sp', 'mp', 'pvp', 'opvp', 'ctrl', 'ach'], ['Racing', 'Driving', 'Simulation', 'Realistic']],
  [1551360, 'Forza Horizon 5', ['A', 'Ad', 'Ra', 'Si', 'Sp'], ['sp', 'mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ctrl', 'ach', 'xp'], ['Racing', 'Open World', 'Driving']],
  [252950, 'Rocket League', ['A', 'I', 'Ra', 'Sp', 'F'], ['sp', 'mp', 'pvp', 'opvp', 'sspvp', 'ctrl', 'ach', 'xp'], ['Soccer', 'Competitive', 'Vehicular Combat']],
  [1172620, 'Sea of Thieves', ['A', 'Ad'], ['mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ctrl', 'ach', 'xp'], ['Pirates', 'Open World', 'Naval', 'Adventure']],
  [990080, 'Hogwarts Legacy', ['A', 'Ad', 'R'], ['sp', 'ctrl', 'ach'], ['Fantasy', 'Magic', 'Open World']],
  [1593500, 'God of War', ['A', 'Ad'], ['sp', 'ctrl', 'ach'], ['Mythology', 'Action', 'Story Rich', 'Hack and Slash']],
  [1174180, 'Red Dead Redemption 2', ['A', 'Ad'], ['sp', 'mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ctrl', 'ach'], ['Western', 'Open World', 'Story Rich']],
  [2050650, 'Resident Evil 4', ['A', 'Ad'], ['sp', 'ctrl', 'ach'], ['Survival Horror', 'Horror', 'Third-Person Shooter']],
  [418370, 'Resident Evil 7 Biohazard', ['A', 'Ad'], ['sp', 'ctrl', 'ach'], ['Horror', 'Survival Horror', 'Psychological Horror', 'First-Person']],
  [1196590, 'Resident Evil Village', ['A', 'Ad'], ['sp', 'ctrl', 'ach'], ['Survival Horror', 'Horror', 'First-Person']],
  [268910, 'Cuphead', ['A', 'I'], ['sp', 'mp', 'coop', 'sscoop', 'ctrl', 'ach', 'rpt'], ['Difficult', 'Hand-drawn', 'Platformer', 'Bullet Hell']],
  [753640, 'Outer Wilds', ['A', 'Ad'], ['sp', 'ctrl', 'ach'], ['Space', 'Exploration', 'Mystery', 'Sci-fi', 'Atmospheric']],
  [236390, 'War Thunder', ['A', 'M', 'Si', 'F'], ['mp', 'pvp', 'opvp', 'coop', 'ocoop', 'vr', 'ach', 'xp'], ['World War II', 'Military', 'Historical', 'Tanks']],
  [359550, "Tom Clancy's Rainbow Six Siege", ['A'], ['mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ach'], ['Tactical', 'FPS', 'Competitive', 'Military']],
  [945360, 'Among Us', ['C'], ['mp', 'pvp', 'opvp', 'ach', 'xp'], ['Social Deduction', 'Space', 'Multiplayer', 'Cute']],
  [1623730, 'Palworld', ['A', 'Ad', 'I', 'R'], ['sp', 'mp', 'coop', 'ocoop', 'ctrl', 'ach'], ['Survival', 'Open World', 'Crafting', 'Creature Collector']],
  [553850, 'HELLDIVERS 2', ['A'], ['mp', 'coop', 'ocoop', 'ctrl', 'ach', 'xp'], ['Sci-fi', 'Space', 'Co-op', 'Third-Person Shooter']],
  [1888930, 'The Last of Us Part I', ['A', 'Ad'], ['sp', 'ctrl', 'ach'], ['Post-apocalyptic', 'Zombies', 'Story Rich', 'Survival']],
  [435150, 'Divinity: Original Sin 2', ['Ad', 'R', 'S'], ['sp', 'mp', 'coop', 'ocoop', 'sscoop', 'ctrl', 'ws', 'ach'], ['CRPG', 'Fantasy', 'Turn-Based Combat', 'Story Rich']],
  [2379780, 'Balatro', ['C', 'I', 'S'], ['sp', 'ctrl', 'ach'], ['Roguelike Deckbuilder', 'Card Game', 'Poker']],
  [1150690, 'OMORI', ['Ad', 'I', 'R'], ['sp', 'ctrl', 'ach'], ['Psychological Horror', 'Story Rich', 'Pixel Graphics', 'Cute']],
  [391540, 'Undertale', ['I', 'R'], ['sp'], ['Pixel Graphics', 'Story Rich', 'Comedy', 'Choices Matter']],
  [588650, 'Dead Cells', ['A', 'I'], ['sp', 'ctrl', 'ach'], ['Roguelite', 'Metroidvania', 'Pixel Graphics', 'Dark Fantasy']],
  [1057090, 'Ori and the Will of the Wisps', ['A', 'Ad'], ['sp', 'ctrl', 'ach'], ['Metroidvania', 'Platformer', 'Atmospheric', 'Fantasy']],
  [1222140, 'Detroit: Become Human', ['A', 'Ad'], ['sp', 'ctrl', 'ach'], ['Sci-fi', 'Futuristic', 'Story Rich', 'Choices Matter']],
  [1328670, 'Mass Effect Legendary Edition', ['A', 'R'], ['sp', 'ctrl', 'ach'], ['Sci-fi', 'Space', 'Story Rich', 'Third-Person Shooter']],
  [2215430, 'Ghost of Tsushima', ['A', 'Ad'], ['sp', 'mp', 'coop', 'ocoop', 'ctrl', 'ach'], ['Open World', 'Samurai', 'Historical', 'Stealth']],
  [524220, 'NieR:Automata', ['A', 'R'], ['sp', 'ctrl', 'ach'], ['Post-apocalyptic', 'Sci-fi', 'Hack and Slash', 'Story Rich']],
  [976730, 'Halo: The Master Chief Collection', ['A'], ['sp', 'mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ctrl', 'ach'], ['Sci-fi', 'Space', 'FPS']],
  [107410, 'Arma 3', ['A', 'Si', 'S'], ['sp', 'mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ws', 'ach'], ['Military', 'Realistic', 'Open World', 'Tactical']],
  [4000, "Garry's Mod", ['I', 'Si'], ['sp', 'mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ws', 'ach'], ['Sandbox', 'Comedy', 'Physics']],
  [322330, "Don't Starve Together", ['Ad', 'I', 'Si'], ['mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ctrl', 'ws', 'ach'], ['Survival', 'Crafting', 'Gothic', 'Co-op']],
  [1366540, 'Dyson Sphere Program', ['I', 'Si', 'S'], ['sp', 'ach'], ['Automation', 'Space', 'Sci-fi', 'Base Building']],
  [1151640, 'Horizon Zero Dawn Complete Edition', ['A', 'Ad', 'R'], ['sp', 'ctrl', 'ach'], ['Post-apocalyptic', 'Open World', 'Sci-fi', 'Robots']],
  [239140, 'Dying Light', ['A'], ['sp', 'mp', 'coop', 'ocoop', 'ctrl', 'ach'], ['Zombies', 'Parkour', 'Open World', 'Post-apocalyptic', 'Horror']],
  [550, 'Left 4 Dead 2', ['A'], ['sp', 'mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ws', 'ach'], ['Zombies', 'Co-op', 'FPS', 'Horror']],
  [108600, 'Project Zomboid', ['I', 'R', 'Si'], ['sp', 'mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ws', 'ach'], ['Zombies', 'Survival', 'Post-apocalyptic', 'Open World']],
  [238960, 'Path of Exile', ['A', 'Ad', 'I', 'M', 'R', 'F'], ['mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ctrl'], ['Action RPG', 'Dark Fantasy', 'Hack and Slash', 'Loot']],
  [230410, 'Warframe', ['A', 'F'], ['sp', 'mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ctrl', 'ach', 'xp'], ['Looter Shooter', 'Sci-fi', 'Space', 'Third-Person Shooter']],
  [582010, 'Monster Hunter: World', ['A'], ['sp', 'mp', 'coop', 'ocoop', 'ctrl', 'ach'], ['Hunting', 'Fantasy', 'Open World', 'Co-op']],
  [1687950, 'Persona 5 Royal', ['R'], ['sp', 'ctrl', 'ach'], ['JRPG', 'Anime', 'Story Rich', 'Turn-Based Combat']],
  [1135690, 'Unpacking', ['C', 'I', 'Si'], ['sp', 'ctrl', 'ach'], ['Relaxing', 'Cozy', 'Puzzle', 'Pixel Graphics', 'Wholesome']],
  [1055540, 'A Short Hike', ['Ad', 'I'], ['sp', 'ctrl'], ['Relaxing', 'Cozy', 'Exploration', 'Cute']],
  [787480, 'Phoenix Wright: Ace Attorney Trilogy', ['Ad'], ['sp', 'ctrl', 'ach'], ['Detective', 'Mystery', 'Anime', 'Visual Novel', 'Comedy']],
  [632470, 'Disco Elysium', ['R'], ['sp', 'ctrl', 'ach'], ['Detective', 'Mystery', 'Story Rich', 'Choices Matter']],
  [1599340, 'Lost Ark', ['A', 'Ad', 'M', 'R', 'F'], ['mp', 'pvp', 'opvp', 'coop', 'ocoop', 'ach'], ['MMORPG', 'Fantasy', 'Action RPG']],
  [39210, 'FINAL FANTASY XIV Online', ['M', 'R'], ['mp', 'coop', 'ocoop', 'ctrl'], ['MMORPG', 'Fantasy', 'Anime', 'Story Rich']],
  [1774580, 'STAR WARS Jedi: Survivor', ['A', 'Ad'], ['sp', 'ctrl', 'ach'], ['Sci-fi', 'Space', 'Souls-like', 'Story Rich']],
  [70, 'Half-Life', ['A'], ['sp', 'mp', 'pvp', 'opvp'], ['FPS', 'Sci-fi', 'Classic', 'Aliens']],
];

export const DEMO_FETCHED_AT = '2026-10-25T00:00:00.000Z';

export interface DemoGame {
  appid: number;
  name: string;
  genres: string[];
  features: string[];
  tags: string[];
}

export const DEMO_GAMES: DemoGame[] = ROWS.map(([appid, name, genres, features, tags]) => ({
  appid,
  name,
  genres: genres.map((g) => G[g]),
  features: features.map((f) => F[f]),
  tags,
}));
