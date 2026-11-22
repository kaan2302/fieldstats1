// Grundlagen rund um Spiele: Resultat, Punkte, Sortierung, Minuten-Abschnitte.
import { S } from "../state";
import type { Match, Player, Result } from "../types";
import { minNum, norm, today } from "../util";

/** Gehört dieser Teamname zu uns? (Name auf football.ch, sonst Vereinsname) */
export const isOurs = (name: string | null | undefined): boolean => {
  const a = norm(S.meta.fbName || S.meta.club);
  return !!a && norm(name).includes(a);
};

export const played = (m: Pick<Match, "status">): boolean => m.status !== "planned";
export const official = (m: Pick<Match, "comp">): boolean => m.comp !== "Testspiel";
export const res = (m: Pick<Match, "gf" | "ga">): Result => (m.gf > m.ga ? "S" : m.gf < m.ga ? "N" : "U");
export const pointsFor = (r: Result): number => (r === "S" ? 3 : r === "U" ? 1 : 0);
export const ptsOf = (m: Pick<Match, "gf" | "ga">): number => pointsFor(res(m));

export const byDate = (a: { date: string; time?: string }, b: { date: string; time?: string }): number =>
  (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""));

export const pById = (id: string | null | undefined): Player | undefined => S.players.find(p => p.id === id);

/** Gespielte Pflichtspiele der gewählten Saison, chronologisch. */
export const officialPlayed = (): Match[] => S.matches.filter(m => played(m) && official(m)).sort(byDate);

export const nextMatch = (): Match | undefined =>
  S.matches.filter(m => !played(m) && m.date >= today()).sort(byDate)[0];

/** Beschriftung der sechs 15-Minuten-Abschnitte. */
export const BL = ["1–15", "16–30", "31–45", "46–60", "61–75", "76–90+"] as const;

/** Tore pro 15-Minuten-Abschnitt zählen. */
export function buckets(minutes: readonly unknown[]): number[] {
  const b = [0, 0, 0, 0, 0, 0];
  for (const m of minutes) {
    const x = minNum(m);
    if (x != null) b[Math.min(5, Math.floor((Math.max(1, x) - 1) / 15))]++;
  }
  return b;
}

/** Index des grössten Werts. */
export const argMax = (a: readonly number[]): number => a.indexOf(Math.max(...a));
export const sum = (a: readonly number[]): number => a.reduce((s, v) => s + v, 0);

/** Punkte pro Spiel einer Liste, null wenn leer. */
export const ppg = (ms: readonly Pick<Match, "gf" | "ga">[]): number | null =>
  ms.length ? ms.reduce((s, m) => s + ptsOf(m), 0) / ms.length : null;

export type Trend = "steigend" | "fallend" | "stabil";
export function trendWord(last: number | null, before: number | null): Trend | null {
  if (last == null || before == null) return null;
  return last - before > 0.3 ? "steigend" : last - before < -0.3 ? "fallend" : "stabil";
}
