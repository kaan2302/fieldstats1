import { DEFAULT_TEAM } from "./config";
import type { AppState } from "./types";

/** Parameter aus dem Link: ?team=<id>, ?live=<code> (Live-Link für ein Spiel), ?neu / ?login (Startseite). */
export const QS = new URLSearchParams(location.search);

/** Laufzeit-Kontext: welches Team, ob ein Live-Link aktiv ist, ob die Startseite gezeigt wird. */
export const ctx: {
  team: string | null;
  liveKey: string | null;
  liveMatch: string | null;
  landing: boolean;
  liveTokOk: boolean;
} = {
  team: QS.get("team"),
  liveKey: QS.get("live"),
  liveMatch: null,
  landing: QS.has("neu") || QS.has("login"),
  liveTokOk: false,
};

if (!ctx.team && !ctx.liveKey && !ctx.landing) {
  try {
    ctx.team = localStorage.getItem("lastTeam");
  } catch {
    /* Speicher gesperrt */
  }
  ctx.team = ctx.team || DEFAULT_TEAM;
  if (!ctx.team) ctx.landing = true;
}

export const teamUrl = (id: string) => location.origin + location.pathname + "?team=" + encodeURIComponent(id);

/** Alle geladenen Daten des aktuellen Teams (gefiltert auf die gewählte Saison). */
export const S: AppState = {
  players: [],
  matches: [],
  fixtures: [],
  analyses: [],
  live: [],
  meta: {},
  table: null,
  notes: {},
  admin: false,
  all: { matches: [], fixtures: [], table: null, tables: {} },
  season: "",
  email: null,
  myTeams: [],
  myTeam: null,
  locked: false,
};
