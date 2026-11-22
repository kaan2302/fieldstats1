// Datenmodell der App. Alle Dokumente liegen in Supabase in der Tabelle `docs`
// (team_id, coll, id, data). `data` hat je nach `coll` eine dieser Formen.

export type Line = "TOR" | "ABW" | "MIT" | "ANG" | "XXX";
export type Result = "S" | "U" | "N";

export interface Player {
  id: string;
  name: string;
  nr?: number | string;
  pos?: string;
  year?: number | string;
  captain?: boolean;
  photo?: string | null;
  sfvPid?: string;
  [key: string]: unknown;
}

/** Einsatz eines Spielers in einem Spiel. */
export interface StatLine {
  start: boolean;
  sub: boolean;
  min: number;
  y: number;
  r: number;
}

export interface Goal {
  min: string;
  who: string | null;
  ast?: string | null;
  pen?: boolean;
  fk?: boolean;
  og?: boolean;
}

export interface Against {
  min: string;
  who: string;
}

/** Position eines Spielers auf dem Spielfeld in Prozent (y: 0 = gegnerisches Tor). */
export interface LineupSpot {
  x: number;
  y: number;
  pos?: string;
}

export interface Match {
  id: string;
  date: string;
  time?: string;
  opp: string;
  home: boolean;
  comp?: string;
  status: "played" | "planned";
  gf: number;
  ga: number;
  goals?: Goal[];
  against?: Against[];
  stats?: Record<string, StatLine>;
  lineup?: Record<string, LineupSpot>;
  forfait?: boolean;
  live?: boolean;
  fbTg?: string;
  fieldScore?: string;
}

export interface FixtureGoal {
  min: string;
  team: "home" | "away";
  who: string;
}

/** Spiel zweier anderer Teams der Gruppe. */
export interface Fixture {
  id: string;
  date: string;
  time?: string;
  home: string;
  away: string;
  hg?: number | string | null;
  ag?: number | string | null;
  comp?: string;
  goals?: FixtureGoal[];
}

export interface TableRow {
  rank: number;
  team: string;
  sp: number;
  s: number;
  u: number;
  n: number;
  gf: number;
  ga: number;
  pts: number;
  warn?: string;
}

export interface LeagueTable {
  rows: TableRow[];
  updated?: string;
  season?: string;
}

export interface Analysis {
  id: string;
  opp: string;
  text: string;
  at: string;
}

export interface TeamMeta {
  club?: string;
  team?: string;
  league?: string;
  season?: string;
  fbName?: string;
  logo?: string | null;
  promotion?: number;
  relegation?: number;
  relegationMaybe?: number;
  [key: string]: unknown;
}

export type LiveEventType = "goal" | "ag" | "sub" | "y" | "r";

export interface LiveEvent {
  id: string;
  t: LiveEventType;
  min: string;
  who?: string | null;
  ast?: string | null;
  og?: boolean;
  name?: string;
  out?: string;
  inn?: string;
  second?: boolean;
}

export type LivePhase = "setup" | "h1" | "ht" | "h2" | "post" | "end";

/** Stand einer laufenden Live-Erfassung (coll `live`, id = Spiel-ID). */
export interface LiveState {
  id: string;
  opp: string;
  home: boolean;
  date: string;
  time?: string;
  comp?: string;
  isNew?: boolean;
  phase: LivePhase;
  t1?: number;
  t2?: number;
  xi: string[];
  bench: string[];
  xiPos?: Record<string, LineupSpot>;
  events: LiveEvent[];
  updated: number;
  lastXi?: string[];
  lastLayout?: Record<string, LineupSpot>;
}

export interface MyTeam {
  id: string;
  name: string;
  plan: "trial" | "active" | "canceled" | "past_due" | string;
  trial_until: string;
}

export interface SeasonData {
  matches: Match[];
  fixtures: Fixture[];
  table: LeagueTable | null;
  tables: Record<string, LeagueTable>;
}

export interface AppState {
  players: Player[];
  matches: Match[];
  fixtures: Fixture[];
  analyses: Analysis[];
  live: LiveState[];
  meta: TeamMeta;
  table: LeagueTable | null;
  notes: Record<string, string>;
  admin: boolean;
  all: SeasonData;
  season: string;
  email: string | null;
  myTeams: MyTeam[];
  myTeam: MyTeam | null;
  locked: boolean;
}
