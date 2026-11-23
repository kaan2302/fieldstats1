// Kennzahlen für Team und Spieler sowie die vertiefte Analyse.
import { LINE } from "../positions";
import { S } from "../state";
import type { Line, Match, Player, Result, TableRow } from "../types";
import { minKey, minNum, norm, num } from "../util";
import { byDate, isOurs, official, played, ppg, ptsOf, pointsFor, res } from "./matches";
import { situation } from "./table";

export interface TeamKPI {
  n: number;
  S: number;
  U: number;
  N: number;
  pts: number;
  gf: number;
  ga: number;
  cs: number;
  home: { n: number; pts: number };
  away: { n: number; pts: number };
  cum: { pts: number; r: Result; opp: string }[];
  form: Result[];
}

export function teamKPI(): TeamKPI {
  const ms = S.matches.filter(m => played(m) && official(m)).sort(byDate);
  const k: TeamKPI = {
    n: ms.length,
    S: 0,
    U: 0,
    N: 0,
    pts: 0,
    gf: 0,
    ga: 0,
    cs: 0,
    home: { n: 0, pts: 0 },
    away: { n: 0, pts: 0 },
    cum: [],
    form: [],
  };
  for (const m of ms) {
    const r = res(m),
      p = pointsFor(r);
    k[r]++;
    k.pts += p;
    k.gf += m.gf;
    k.ga += m.ga;
    if (m.ga === 0) k.cs++;
    const h = m.home ? k.home : k.away;
    h.n++;
    h.pts += p;
    k.cum.push({ pts: k.pts, r, opp: m.opp });
  }
  k.form = ms.slice(-5).map(res);
  return k;
}

export interface PlayerKPI extends Player {
  apps: number;
  starts: number;
  subs: number;
  min: number;
  g: number;
  a: number;
  y: number;
  r: number;
  /** Gegentore, solange er auf dem Platz stand (für Torhüter). */
  ga: number;
  /** Zu-null-Spiele: von Beginn an, mind. 45 Min., in seiner Zeit kein Gegentor. */
  cs: number;
  pts: number;
  minPerPt: number | null;
  quote: number;
  line: Line;
}

/** Kennzahlen pro Spieler (Standard: geöffnete Mannschaft und Saison). */
export function playerKPI(players: Player[] = S.players, matches: Match[] = S.matches): PlayerKPI[] {
  const ms = matches.filter(played),
    n = ms.length;
  return players.map(p => {
    const k: PlayerKPI = {
      ...p,
      apps: 0,
      starts: 0,
      subs: 0,
      min: 0,
      g: 0,
      a: 0,
      y: 0,
      r: 0,
      ga: 0,
      cs: 0,
      pts: 0,
      minPerPt: null,
      quote: 0,
      line: LINE[p.pos ?? ""] || "XXX",
    };
    for (const m of ms) {
      for (const g of m.goals || []) {
        if (g.who === p.id) k.g++;
        if (g.ast === p.id) k.a++;
      }
      const s = m.stats?.[p.id];
      if (!s || !(s.start || s.sub)) continue;
      k.apps++;
      if (s.start) k.starts++;
      else k.subs++;
      k.min += num(s.min);
      k.y += num(s.y);
      k.r += num(s.r);
      const mn = num(s.min),
        from = s.start ? 0 : 90 - mn,
        to = s.start ? (mn >= 90 ? 999 : mn) : 999;
      const conc = (m.against || []).filter(g => {
        const x = minNum(g.min);
        return x == null ? !!s.start && mn >= 90 : x > from && x <= to;
      }).length;
      k.ga += conc;
      if (s.start && conc === 0 && mn >= 45) k.cs++;
    }
    k.pts = k.g + k.a;
    k.minPerPt = k.pts ? Math.round(k.min / k.pts) : null;
    k.quote = n ? k.apps / n : 0;
    return k;
  });
}

interface Tally {
  n: number;
  pts: number;
}
export interface Impact {
  p: Player;
  n: number;
  m: number;
  on: number;
  off: number;
  gaOn: number;
  gaOff: number;
  d: number;
}
export interface Duo {
  a: Player;
  b: Player;
  n: number;
  v: number;
}
export interface RestRow {
  r: TableRow;
  left: number;
  str: number | null;
  proj: number;
}
export interface DeepAnalysis {
  /** Spiele mit vollständig erfasster Torfolge. */
  full: number;
  all: number;
  st: {
    trail: number;
    trailPts: number;
    trailList: string[];
    lead: number;
    leadLost: number;
    leadList: string[];
    first: Tally;
    firstAg: Tally;
    nil: Tally;
  };
  imp: Impact[];
  defDuo: Duo[];
  offDuo: Duo[];
  subG: string[];
  subA: string[];
  noSub: number;
  withXi: number;
  /** Teamschnitt Tore / Gegentore pro Spiel (Spiele mit Startelf) */
  avgGf: number;
  avgGa: number;
  bottom: RestRow[];
}

const starts = (m: Match, id: string) => !!m.stats?.[id]?.start;

/** Spielstand, erstes Tor, Spieler-Einfluss, Duos, Joker und Restprogramm. */
export function deepUs(): DeepAnalysis {
  const ms = S.matches.filter(m => played(m) && official(m)).sort(byDate);

  // Spielstand und erstes Tor – nur Spiele mit vollständiger Torfolge
  const full = ms.filter(m => !m.forfait && (m.goals || []).length === m.gf && (m.against || []).length === m.ga);
  const st: DeepAnalysis["st"] = {
    trail: 0,
    trailPts: 0,
    trailList: [],
    lead: 0,
    leadLost: 0,
    leadList: [],
    first: { n: 0, pts: 0 },
    firstAg: { n: 0, pts: 0 },
    nil: { n: 0, pts: 0 },
  };
  for (const m of full) {
    const ev = [
      ...(m.goals || []).map(g => ({ k: minKey(g.min), us: true })),
      ...(m.against || []).map(g => ({ k: minKey(g.min), us: false })),
    ].sort((a, b) => a.k - b.k);
    let f = 0,
      a = 0,
      led = false,
      trailed = false;
    for (const e of ev) {
      if (e.us) f++;
      else a++;
      if (f > a) led = true;
      if (f < a) trailed = true;
    }
    const p = ptsOf(m),
      lbl = `${m.home ? "vs." : "@"} ${m.opp} ${m.gf}:${m.ga}`;
    if (trailed) {
      st.trail++;
      st.trailPts += p;
      if (p) st.trailList.push(lbl);
    }
    if (led) {
      st.lead++;
      if (p < 3) {
        st.leadLost += 3 - p;
        st.leadList.push(lbl);
      }
    }
    const o = !ev.length ? st.nil : ev[0].us ? st.first : st.firstAg;
    o.n++;
    o.pts += p;
  }

  // Spieler-Einfluss: Punkte pro Spiel mit und ohne ihn in der Startelf
  const withXi = ms.filter(m => m.stats && Object.values(m.stats).some(x => x.start));
  const gaPerGame = (a: Match[]) => (a.length ? a.reduce((s, m) => s + m.ga, 0) / a.length : 0);
  const imp: Impact[] = S.players
    .map(pl => {
      const on = withXi.filter(m => starts(m, pl.id)),
        off = withXi.filter(m => !starts(m, pl.id));
      return {
        p: pl,
        n: on.length,
        m: off.length,
        on: ppg(on) ?? 0,
        off: ppg(off) ?? 0,
        gaOn: gaPerGame(on),
        gaOff: gaPerGame(off),
        d: 0,
      };
    })
    .filter(x => x.n >= 3 && x.m >= 3)
    .map(x => ({ ...x, d: x.on - x.off }))
    .sort((a, b) => b.d - a.d || a.gaOn - b.gaOn);

  // Duos: Abwehr nach Gegentoren, Offensive nach eigenen Toren (gemeinsam ab 3 Spielen)
  const duo = (filter: (pos: string) => boolean, key: "ga" | "gf", dir: 1 | -1): Duo[] => {
    const ps = S.players.filter(pl => filter(pl.pos ?? "") && withXi.filter(m => starts(m, pl.id)).length >= 3);
    const out: Duo[] = [];
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const g = withXi.filter(m => starts(m, ps[i].id) && starts(m, ps[j].id));
        if (g.length >= 3)
          out.push({ a: ps[i], b: ps[j], n: g.length, v: g.reduce((s, m) => s + m[key], 0) / g.length });
      }
    return out.sort((x, y) => dir * (x.v - y.v) || y.n - x.n).slice(0, 2);
  };
  const defDuo = duo(pos => LINE[pos] === "ABW", "ga", 1);
  const offDuo = duo(pos => LINE[pos] === "ANG" || pos === "ZOM", "gf", -1);

  // Joker: Tore und Vorlagen von Eingewechselten
  const subG: string[] = [],
    subA: string[] = [];
  let noSub = 0;
  for (const m of withXi) {
    const stats = m.stats ?? {};
    if (!Object.values(stats).some(x => x.sub)) noSub++;
    for (const g of m.goals || []) {
      if (g.who && stats[g.who]?.sub) subG.push(g.who);
      if (g.ast && stats[g.ast]?.sub) subA.push(g.ast);
    }
  }

  // Restprogramm der Teams rund um uns
  const rows = S.table?.rows || [];
  const ppgOfTeam = (n: string) => {
    const r = rows.find(x => norm(x.team) === norm(n));
    return r && r.sp ? r.pts / r.sp : null;
  };
  const remainingOpponents = (n: string): string[] =>
    isOurs(n)
      ? S.matches.filter(m => !played(m)).map(m => m.opp)
      : S.fixtures
          .filter(f => (f.hg == null || f.hg === "") && (norm(f.home) === norm(n) || norm(f.away) === norm(n)))
          .map(f => (norm(f.home) === norm(n) ? f.away : f.home))
          .concat(
            S.matches.filter(m => !played(m) && norm(m.opp) === norm(n)).map(() => S.meta.fbName || S.meta.club || ""),
          );
  const sit = situation();
  const win = sit ? (sit.mode === "ab" ? rows.slice(-5) : sit.mode === "auf" ? rows.slice(0, 5) : sit.rows) : [];
  const bottom: RestRow[] = win.map(r => {
    const g = remainingOpponents(r.team);
    const str = g.map(ppgOfTeam).filter((v): v is number => v != null);
    const left = g.length;
    return {
      r,
      left,
      str: str.length ? str.reduce((s, v) => s + v, 0) / str.length : null,
      proj: r.sp ? Math.round(r.pts + (r.pts / r.sp) * left) : r.pts,
    };
  });

  return {
    full: full.length,
    all: ms.length,
    st,
    imp,
    defDuo,
    offDuo,
    subG,
    subA,
    noSub,
    withXi: withXi.length,
    avgGf: withXi.length ? withXi.reduce((t, m) => t + m.gf, 0) / withXi.length : 0,
    avgGa: gaPerGame(withXi),
    bottom,
  };
}
