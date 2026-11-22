// Gegner: alle Spiele eines Teams (aus den Gruppenresultaten und unseren Spielen) und Kennzahlen.
import { S } from "../state";
import type { Result } from "../types";
import { norm, num } from "../util";
import { buckets, isOurs, played, pointsFor } from "./matches";

export interface OppGame {
  date: string;
  home: boolean;
  opp: string;
  played: boolean;
  gf: number | string | null | undefined;
  ga: number | string | null | undefined;
  forMin: string[];
  agMin: string[];
  scorers: string[];
  vsUs?: boolean;
}

export function oppGames(name: string): OppGame[] {
  const nn = norm(name),
    out: OppGame[] = [];
  for (const f of S.fixtures) {
    const h = norm(f.home) === nn,
      a = norm(f.away) === nn;
    if (!h && !a) continue;
    const gl = f.goals || [],
      mine = h ? "home" : "away",
      theirs = h ? "away" : "home";
    out.push({
      date: f.date,
      home: h,
      opp: h ? f.away : f.home,
      played: f.hg != null && f.hg !== "",
      gf: h ? f.hg : f.ag,
      ga: h ? f.ag : f.hg,
      forMin: gl.filter(g => g.team === mine).map(g => g.min),
      agMin: gl.filter(g => g.team === theirs).map(g => g.min),
      scorers: gl.filter(g => g.team === mine && g.who).map(g => g.who),
    });
  }
  for (const m of S.matches.filter(x => norm(x.opp) === nn && played(x))) {
    out.push({
      date: m.date,
      home: !m.home,
      opp: S.meta.club || "Wir",
      played: true,
      gf: m.ga,
      ga: m.gf,
      forMin: (m.against || []).map(g => g.min),
      agMin: (m.goals || []).map(g => g.min),
      scorers: (m.against || []).filter(g => g.who).map(g => g.who),
      vsUs: true,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface OppStats {
  n: number;
  S: number;
  U: number;
  N: number;
  gf: number;
  ga: number;
  home: { n: number; pts: number };
  away: { n: number; pts: number };
  games: OppGame[];
  form: Result[];
  ppgLast: number | null;
  ppgBefore: number | null;
  forB: number[];
  agB: number[];
  scorers: [string, number][];
  withMinutes: number;
}

export function oppStats(name: string): OppStats {
  const gs = oppGames(name).filter(g => g.played);
  const r = (g: OppGame): Result => (num(g.gf) > num(g.ga) ? "S" : num(g.gf) < num(g.ga) ? "N" : "U");
  const pts = (arr: OppGame[]) => arr.reduce((s, g) => s + pointsFor(r(g)), 0);
  const k: OppStats = {
    n: gs.length,
    S: 0,
    U: 0,
    N: 0,
    gf: 0,
    ga: 0,
    home: { n: 0, pts: 0 },
    away: { n: 0, pts: 0 },
    games: gs,
    form: [],
    ppgLast: null,
    ppgBefore: null,
    forB: [],
    agB: [],
    scorers: [],
    withMinutes: 0,
  };
  for (const g of gs) {
    const x = r(g);
    k[x]++;
    k.gf += num(g.gf);
    k.ga += num(g.ga);
    const h = g.home ? k.home : k.away;
    h.n++;
    h.pts += pointsFor(x);
  }
  k.form = gs.slice(-5).map(r);
  const last = gs.slice(-5),
    before = gs.slice(0, -5);
  k.ppgLast = last.length ? pts(last) / last.length : null;
  k.ppgBefore = before.length ? pts(before) / before.length : null;
  k.forB = buckets(gs.flatMap(g => g.forMin));
  k.agB = buckets(gs.flatMap(g => g.agMin));
  const sc: Record<string, number> = {};
  gs.forEach(g => g.scorers.forEach(w => (sc[w] = (sc[w] || 0) + 1)));
  k.scorers = Object.entries(sc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  k.withMinutes = gs.filter(g => g.forMin.length || g.agMin.length).length;
  return k;
}

/** Alle Gegner (ohne uns), alphabetisch. */
export function oppNames(): string[] {
  const set = new Map<string, string>();
  const add = (n?: string | null) => {
    if (n && !isOurs(n) && !set.has(norm(n))) set.set(norm(n), n);
  };
  S.matches.forEach(m => add(m.opp));
  S.fixtures.forEach(f => {
    add(f.home);
    add(f.away);
  });
  (S.table?.rows || []).forEach(r => add(r.team));
  return [...set.values()].sort((a, b) => a.localeCompare(b));
}
