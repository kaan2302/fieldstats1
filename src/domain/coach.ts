// Trainer-Analysen aus den erfassten Daten: Halbzeit-Bilanz, gefährliche Phasen, Gegnerstärke,
// Belastung und Einsatzzeit, Wechsel-Timing. Alles reine Funktionen (getestet in tests/unit/coach.test.ts).
import type { Match, Player, TableRow } from "../types";
import { minKey, minNum, norm, num } from "../util";
import { BL, buckets, ppg, ptsOf, res } from "./matches";

/** Spiele mit vollständig erfasster Torfolge (Minute bei jedem Tor). */
export const fullGoals = (ms: readonly Match[]): Match[] =>
  ms.filter(m => !m.forfait && (m.goals || []).length === m.gf && (m.against || []).length === m.ga);

/** «1 Spiel» / «3 Spiele». */
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

// ---------- 1) Halbzeit-Bilanz ----------

export interface HalfTime {
  n: number;
  /** Halbzeitstand → Endresultat */
  aheadHT: { n: number; won: number; pts: number };
  levelHT: { n: number; won: number; lost: number; pts: number };
  behindHT: { n: number; turned: number; pts: number };
  /** Tore / Gegentore je Halbzeit (Summe) */
  h1: { gf: number; ga: number };
  h2: { gf: number; ga: number };
  /** Punkte, wenn nur die 1. bzw. nur die 2. Halbzeit zählen würde */
  pts1: number;
  pts2: number;
}

const isFirstHalf = (min: string) => minKey(min) < 4600;

export function halfTime(ms: readonly Match[]): HalfTime {
  const o: HalfTime = {
    n: 0,
    aheadHT: { n: 0, won: 0, pts: 0 },
    levelHT: { n: 0, won: 0, lost: 0, pts: 0 },
    behindHT: { n: 0, turned: 0, pts: 0 },
    h1: { gf: 0, ga: 0 },
    h2: { gf: 0, ga: 0 },
    pts1: 0,
    pts2: 0,
  };
  for (const m of fullGoals(ms)) {
    const f1 = (m.goals || []).filter(g => isFirstHalf(g.min)).length;
    const a1 = (m.against || []).filter(g => isFirstHalf(g.min)).length;
    const f2 = m.gf - f1,
      a2 = m.ga - a1,
      p = ptsOf(m),
      r = res(m);
    o.n++;
    o.h1.gf += f1;
    o.h1.ga += a1;
    o.h2.gf += f2;
    o.h2.ga += a2;
    o.pts1 += ptsOf({ gf: f1, ga: a1 });
    o.pts2 += ptsOf({ gf: f2, ga: a2 });
    if (f1 > a1) {
      o.aheadHT.n++;
      o.aheadHT.pts += p;
      if (r === "S") o.aheadHT.won++;
    } else if (f1 < a1) {
      o.behindHT.n++;
      o.behindHT.pts += p;
      if (r !== "N") o.behindHT.turned++;
    } else {
      o.levelHT.n++;
      o.levelHT.pts += p;
      if (r === "S") o.levelHT.won++;
      if (r === "N") o.levelHT.lost++;
    }
  }
  return o;
}

// ---------- 2) Gefährliche Phasen ----------

export interface Phases {
  labels: readonly string[];
  gf: number[];
  ga: number[];
  /** Abschnitt mit den meisten Gegentoren bzw. eigenen Toren (Index, -1 = keine) */
  worst: number;
  best: number;
  /** Anteil der Gegentore ab der 76. Minute */
  lateShare: number | null;
  n: number;
}

export function phases(ms: readonly Match[]): Phases {
  const full = fullGoals(ms);
  const gf = buckets(full.flatMap(m => (m.goals || []).map(g => g.min)));
  const ga = buckets(full.flatMap(m => (m.against || []).map(g => g.min)));
  const totalGa = ga.reduce((s, v) => s + v, 0);
  const idxMax = (a: number[]) => (Math.max(...a) > 0 ? a.indexOf(Math.max(...a)) : -1);
  return {
    labels: BL,
    gf,
    ga,
    worst: idxMax(ga),
    best: idxMax(gf),
    lateShare: totalGa ? ga[5] / totalGa : null,
    n: full.length,
  };
}

// ---------- 5) Bilanz nach Gegnerstärke ----------

export interface StrengthGroup {
  key: "oben" | "mitte" | "unten";
  label: string;
  n: number;
  ppg: number | null;
  gf: number;
  ga: number;
  S: number;
  U: number;
  N: number;
}

/** Gegner nach aktuellem Tabellenplatz in Drittel einteilen (oberes, mittleres, unteres Drittel). */
export function vsStrength(
  ms: readonly Match[],
  rows: readonly TableRow[],
  ours: (team: string) => boolean,
): StrengthGroup[] {
  const others = rows.filter(r => !ours(r.team)).sort((a, b) => a.rank - b.rank);
  if (others.length < 3) return [];
  const third = Math.ceil(others.length / 3);
  const groupOf = (opp: string): StrengthGroup["key"] | null => {
    const i = others.findIndex(
      r => norm(r.team) === norm(opp) || norm(r.team).includes(norm(opp)) || norm(opp).includes(norm(r.team)),
    );
    return i < 0 ? null : i < third ? "oben" : i < 2 * third ? "mitte" : "unten";
  };
  const g: StrengthGroup[] = (
    [
      ["oben", `Gegen Platz ${others[0].rank}–${others[third - 1].rank}`],
      [
        "mitte",
        `Gegen Platz ${others[third]?.rank ?? "–"}–${others[Math.min(2 * third, others.length) - 1]?.rank ?? "–"}`,
      ],
      ["unten", `Gegen Platz ${others[2 * third]?.rank ?? "–"}–${others[others.length - 1].rank}`],
    ] as const
  ).map(([key, label]) => ({ key, label, n: 0, ppg: null, gf: 0, ga: 0, S: 0, U: 0, N: 0 }));
  const lists: Record<string, Match[]> = { oben: [], mitte: [], unten: [] };
  for (const m of ms) {
    const k = groupOf(m.opp);
    if (!k) continue;
    lists[k].push(m);
  }
  for (const x of g) {
    const l = lists[x.key];
    x.n = l.length;
    x.ppg = ppg(l);
    for (const m of l) {
      x.gf += m.gf;
      x.ga += m.ga;
      x[res(m)]++;
    }
  }
  return g;
}

// ---------- 6) Belastung und Einsatzzeit ----------

export interface LoadRow {
  p: Player;
  /** Minuten in den letzten 3 Spielen (max. 270) */
  last3: number;
  /** Spiele in Folge ohne Einsatz (von heute zurück) */
  idle: number;
  /** Einsatzquote der Saison (0–1) */
  quote: number;
  min: number;
}
export interface Load {
  heavy: LoadRow[];
  idle: LoadRow[];
  games: number;
}

/** Wer ist stark belastet (≥ 240 der letzten 270 Minuten), wer kommt kaum zum Einsatz? */
export function load(players: readonly Player[], ms: readonly Match[]): Load {
  const games = [...ms]
    .filter(m => m.status !== "planned" && m.stats && Object.values(m.stats).some(s => s.start))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const rows: LoadRow[] = players.map(p => {
    const st = (m: Match) => m.stats?.[p.id];
    const played = (m: Match) => !!(st(m)?.start || st(m)?.sub);
    let idle = 0;
    for (const m of games) {
      if (played(m)) break;
      idle++;
    }
    const apps = games.filter(played);
    return {
      p,
      last3: games.slice(0, 3).reduce((s, m) => s + (played(m) ? num(st(m)?.min) : 0), 0),
      idle,
      quote: games.length ? apps.length / games.length : 0,
      min: apps.reduce((s, m) => s + num(st(m)?.min), 0),
    };
  });
  return {
    heavy: rows.filter(r => r.last3 >= 240 && r.p.pos !== "TW").sort((a, b) => b.last3 - a.last3),
    idle:
      games.length >= 4
        ? rows.filter(r => r.quote < 0.35 || r.idle >= 3).sort((a, b) => b.idle - a.idle || a.quote - b.quote)
        : [],
    games: games.length,
  };
}

// ---------- 8) Wechsel-Timing ----------

export interface SubTiming {
  /** Spiele mit erfassten Wechseln */
  n: number;
  /** Spiele mit Startelf, aber ohne Wechsel */
  noSub: number;
  /** Durchschnittliche Minute des 1. Wechsels und aller Wechsel */
  firstAvg: number | null;
  allAvg: number | null;
  /** Tordifferenz pro 90 Minuten vor und nach dem 1. Wechsel */
  before: { gf: number; ga: number; per90: number | null };
  after: { gf: number; ga: number; per90: number | null };
  /** Tore und Vorlagen von Eingewechselten */
  subGoals: number;
  subAssists: number;
}

/** Einwechselminute aus den Einsatzminuten (Eingewechselt = 90 − Minuten). */
const entryMin = (min: unknown) => Math.max(1, 90 - num(min));

export function subTiming(ms: readonly Match[]): SubTiming {
  const withXi = ms.filter(m => m.status !== "planned" && m.stats && Object.values(m.stats).some(s => s.start));
  const o: SubTiming = {
    n: 0,
    noSub: 0,
    firstAvg: null,
    allAvg: null,
    before: { gf: 0, ga: 0, per90: null },
    after: { gf: 0, ga: 0, per90: null },
    subGoals: 0,
    subAssists: 0,
  };
  const firsts: number[] = [],
    all: number[] = [];
  let minBefore = 0,
    minAfter = 0;
  for (const m of withXi) {
    const stats = m.stats ?? {};
    for (const g of m.goals || []) {
      if (g.who && stats[g.who]?.sub) o.subGoals++;
      if (g.ast && stats[g.ast]?.sub) o.subAssists++;
    }
    const subs = Object.values(stats)
      .filter(s => s.sub)
      .map(s => entryMin(s.min));
    if (!subs.length) {
      o.noSub++;
      continue;
    }
    o.n++;
    const first = Math.min(...subs);
    firsts.push(first);
    all.push(...subs);
    if (!fullGoals([m]).length) continue;
    minBefore += first;
    minAfter += 90 - first;
    for (const g of m.goals || []) (num(minNum(g.min)) <= first ? o.before : o.after).gf++;
    for (const g of m.against || []) (num(minNum(g.min)) <= first ? o.before : o.after).ga++;
  }
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : null);
  o.firstAvg = avg(firsts);
  o.allAvg = avg(all);
  if (minBefore) o.before.per90 = ((o.before.gf - o.before.ga) / minBefore) * 90;
  if (minAfter) o.after.per90 = ((o.after.gf - o.after.ga) / minAfter) * 90;
  return o;
}
