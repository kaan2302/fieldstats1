// Tabelle: Situation (Auf-/Abstiegskampf), Einlesen von football.ch, Berechnung aus Resultaten.
import { S } from "../state";
import type { TableRow } from "../types";
import { norm } from "../util";
import { isOurs, official, played } from "./matches";

/** CSS-Klassen für Auf- und Abstiegszonen einer Tabellenzeile. */
export function relCls(r: Pick<TableRow, "rank">): string {
  const rows = S.table?.rows || [],
    N = rows.length;
  const a = +(S.meta.relegation || 0),
    b = +(S.meta.relegationMaybe || a),
    pr = +(S.meta.promotion || 0);
  if (!N) return "";
  const c: string[] = [];
  if (pr && r.rank <= pr) c.push("promo");
  if (pr && r.rank === pr) c.push("cutp");
  if (!a) return c.join(" ");
  if (r.rank > N - a) c.push("rel");
  else if (r.rank > N - b) c.push("relq");
  if (r.rank === N - a + 1) c.push("cut");
  if (b > a && r.rank === N - b + 1) c.push("cutq");
  return c.join(" ");
}

export type SituationMode = "auf" | "ab" | "mitte";
export interface Situation {
  mode: SituationMode;
  title: string;
  rows: TableRow[];
  us: TableRow;
  /** Kennzahl-Wert, -Beschriftung und -Zusatz für die Startseite. */
  kv: string;
  kl: string;
  ks: string;
  pr: number;
  a: number;
  b: number;
  N: number;
  /** Rückstand auf den letzten Aufstiegsplatz. */
  gapUp: number | null;
  /** Vorsprung auf den ersten Abstiegsplatz. */
  gapDown: number | null;
}

/** Aufstiegs-, Abstiegskampf oder Mittelfeld – je nach Platz und Punkteabstand (≤ 4 Punkte). */
export function situation(): Situation | null {
  const rows = S.table?.rows || [],
    N = rows.length,
    us = rows.find(r => isOurs(r.team));
  if (!N || !us) return null;
  const pr = +(S.meta.promotion || 1),
    a = +(S.meta.relegation || 0),
    b = +(S.meta.relegationMaybe || a);
  const at = (k: number) => rows.find(r => r.rank === k);
  const up = at(pr),
    safe = a ? at(N - a) : undefined,
    firstDown = a ? at(N - a + 1) : undefined;
  const gapUp = up ? up.pts - us.pts : null;
  const gapDown = a && firstDown ? us.pts - firstDown.pts : null;

  let mode: SituationMode = "mitte";
  if (a && (us.rank > N - b || (gapDown != null && gapDown <= 4))) mode = "ab";
  else if (us.rank <= pr || (gapUp != null && gapUp <= 4)) mode = "auf";

  const i = rows.indexOf(us),
    start = Math.max(0, Math.min(i - 2, N - 5));
  const win = mode === "ab" ? rows.slice(-6) : mode === "auf" ? rows.slice(0, 6) : rows.slice(start, start + 5);
  const title =
    mode === "ab"
      ? "Abstiegskampf"
      : mode === "auf"
        ? pr === 1
          ? "Titelkampf"
          : "Aufstiegskampf"
        : "Tabellennachbarn";

  let kv: string, kl: string, ks: string;
  if (mode === "ab") {
    const above = us.rank <= N - a;
    kv = above ? `+${gapDown}` : `–${(safe?.pts ?? us.pts) - us.pts}`;
    kl = "Abstand zum Strich";
    ks = above ? `Vorsprung auf Platz ${N - a + 1}` : `Platz ${N - a}: ${safe?.team ?? ""}`;
  } else if (mode === "auf") {
    if (us.rank <= pr) {
      const nx = at(pr + 1);
      kv = `+${us.pts - (nx?.pts ?? us.pts)}`;
      kl = pr === 1 ? "Vorsprung an der Spitze" : "Vorsprung Aufstiegsplatz";
      ks = nx ? `auf Platz ${pr + 1}: ${nx.team}` : "";
    } else {
      kv = `–${gapUp}`;
      kl = pr === 1 ? "Rückstand auf Platz 1" : "Rückstand Aufstiegsplatz";
      ks = `Platz ${pr}: ${up?.team ?? ""}`;
    }
  } else {
    const above = at(us.rank - 1),
      below = at(us.rank + 1);
    kv = `${above ? "–" + (above.pts - us.pts) : "–"} / ${below ? "+" + (us.pts - below.pts) : "–"}`;
    kl = "Abstand nach oben / unten";
    ks = gapUp != null && gapDown != null ? `Aufstieg ${gapUp} Pkt weg, Strich ${gapDown} Pkt hinter uns` : "";
  }
  return { mode, title, rows: win, us, kv, kl, ks, pr, a, b, N, gapUp, gapDown };
}

const TABLE_RE =
  /(\d{1,2})\.?\s+(\S.+?)\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(?:\(\d+\)\s+)?(\d{1,3})\s*:\s*(\d{1,3})\s+(?:([+\-−–]?\d{1,3})\s+)?(\d{1,3})(?=\s|$)/g;

/** Kopierte Tabelle (football.ch, Computer oder Handy) auslesen und auf Plausibilität prüfen. */
export function parseTable(txt: string): TableRow[] {
  const t = String(txt || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s+/g, " ");
  const rows: TableRow[] = [];
  for (const m of t.matchAll(TABLE_RE)) {
    let rank = +m[1],
      team = m[2].trim();
    // Überschrift vor Platz 1 (z. B. «2. LIGA (FAEW) 1. FC Aesch») abschneiden
    const inner = team.match(/^(.*?)\b(\d{1,2})\.\s+(\S.*)$/);
    if (inner) {
      rank = +inner[2];
      team = inner[3].trim();
    }
    const r: TableRow = { rank, team, sp: +m[3], s: +m[4], u: +m[5], n: +m[6], gf: +m[7], ga: +m[8], pts: +m[10] };
    const diff = m[9] != null ? +m[9].replace(/[−–]/, "-") : null,
      warn: string[] = [];
    if (r.s + r.u + r.n !== r.sp) warn.push("S+U+N ≠ Spiele");
    if (r.pts !== 3 * r.s + r.u) warn.push("Punkte ≠ 3×S+U (Abzug?)");
    if (diff != null && diff !== r.gf - r.ga) warn.push("Tordifferenz passt nicht");
    if (warn.length) r.warn = warn.join(", ");
    rows.push(r);
  }
  const seen = new Set<number>();
  return rows.filter(r => !seen.has(r.rank) && seen.add(r.rank)).sort((a, b) => a.rank - b.rank);
}

/** Alle bekannten Teams der Gruppe (für Auswahllisten). */
export function leagueTeams(): string[] {
  const set = new Map<string, string>();
  const add = (n?: string | null) => {
    if (n && !set.has(norm(n))) set.set(norm(n), n);
  };
  (S.table?.rows || []).forEach(r => add(r.team));
  S.fixtures.forEach(f => {
    add(f.home);
    add(f.away);
  });
  S.matches.forEach(m => add(m.opp));
  add(S.meta.fbName || S.meta.club);
  return [...set.values()].sort((a, b) => a.localeCompare(b, "de"));
}

/** Tabelle aus allen erfassten Resultaten berechnen (Punkte, Tordifferenz, Tore). */
export function tableFromResults(): TableRow[] {
  const T = new Map<string, Omit<TableRow, "rank">>();
  const row = (n: string) => {
    const k = norm(n);
    if (!T.has(k)) T.set(k, { team: n, sp: 0, s: 0, u: 0, n: 0, gf: 0, ga: 0, pts: 0 });
    return T.get(k)!;
  };
  const game = (h: string, a: string, hg: number, ag: number) => {
    const H = row(h),
      A = row(a);
    H.sp++;
    A.sp++;
    H.gf += hg;
    H.ga += ag;
    A.gf += ag;
    A.ga += hg;
    if (hg > ag) {
      H.s++;
      A.n++;
      H.pts += 3;
    } else if (hg < ag) {
      A.s++;
      H.n++;
      A.pts += 3;
    } else {
      H.u++;
      A.u++;
      H.pts++;
      A.pts++;
    }
  };
  (S.table?.rows || []).forEach(r => row(r.team));
  S.fixtures.filter(f => f.hg != null && f.hg !== "").forEach(f => game(f.home, f.away, +f.hg!, +f.ag!));
  const us = S.meta.fbName || S.meta.club || "Wir";
  S.matches
    .filter(m => played(m) && official(m))
    .forEach(m => (m.home ? game(us, m.opp, +m.gf, +m.ga) : game(m.opp, us, +m.ga, +m.gf)));
  return [...T.values()]
    .sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.team.localeCompare(b.team))
    .map((r, i) => ({ rank: i + 1, ...r }));
}
