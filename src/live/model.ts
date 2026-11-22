// Live-Erfassung ohne Oberfläche: Uhr, Spielstand, wer auf dem Platz steht, Spiel aus den Ereignissen.
import type { Against, Goal, LineupSpot, LiveState, Match, Player, StatLine } from "../types";
import { minKey, minNum } from "../util";
import { SLOT } from "../positions";

/** Aktuelle Spielminute aus der Uhr («23», «45+2», «90+3»). */
export function liveMin(l: Pick<LiveState, "phase" | "t1" | "t2">, now = Date.now()): string {
  if (l.phase === "h1" && l.t1) {
    const m = Math.floor((now - l.t1) / 6e4) + 1;
    return m > 45 ? `45+${m - 45}` : String(m);
  }
  if (l.phase === "h2" && l.t2) {
    const m = 45 + Math.floor((now - l.t2) / 6e4) + 1;
    return m > 90 ? `90+${m - 90}` : String(m);
  }
  return l.phase === "ht" ? "45" : "";
}

/** [Tore, Gegentore]. */
export const liveScore = (l: Pick<LiveState, "events">): [number, number] => [
  (l.events || []).filter(e => e.t === "goal").length,
  (l.events || []).filter(e => e.t === "ag").length,
];

const chronological = (l: Pick<LiveState, "events">) =>
  [...(l.events || [])].sort((a, b) => minKey(a.min) - minKey(b.min));

/** Spieler, die gerade auf dem Platz stehen (Startelf ± Wechsel, ohne Platzverweise). */
export function onField(l: Pick<LiveState, "xi" | "events">, players: Player[]): Player[] {
  const set = new Set(l.xi || []);
  for (const e of chronological(l)) {
    if (e.t === "sub" && e.out && e.inn) {
      set.delete(e.out);
      set.add(e.inn);
    }
    if (e.t === "r" && e.who) set.delete(e.who);
  }
  return players.filter(p => set.has(p.id));
}

/** Ersatzspieler, die noch nicht eingewechselt wurden. */
export function benchNow(l: Pick<LiveState, "bench" | "events">, players: Player[]): Player[] {
  const used = new Set((l.events || []).filter(e => e.t === "sub").map(e => e.inn));
  return players.filter(p => (l.bench || []).includes(p.id) && !used.has(p.id));
}

/** Aufstellung inkl. Wechsel: Eingewechselte übernehmen den Platz des Ausgewechselten. */
export function currentLayout(l: Pick<LiveState, "xiPos" | "events">, players: Player[]): Record<string, LineupSpot> {
  const lay: Record<string, LineupSpot> = { ...(l.xiPos || {}) };
  for (const e of chronological(l)) {
    if (e.t !== "sub" || !e.out || !e.inn) continue;
    const outPos = players.find(p => p.id === e.out)?.pos ?? "";
    const spot = lay[e.out] || (SLOT[outPos] ? { ...SLOT[outPos], pos: outPos } : null);
    if (spot) lay[e.inn] = spot;
  }
  return lay;
}

/**
 * Fertiges Spiel aus der Live-Erfassung: Tore, Gegentore, Karten und Einsatzminuten.
 * Startelf spielt bis zur Auswechslung oder Roten Karte (sonst 90), Eingewechselte ab ihrer Minute.
 */
export function matchFromLive(l: LiveState, old?: Partial<Match>): Omit<Match, "id"> {
  const ev = chronological(l);
  const stats: Record<string, StatLine> = {};
  const endOf = (id: string) => {
    const o = ev.find(e => (e.t === "sub" && e.out === id) || (e.t === "r" && e.who === id));
    return o ? Math.min(90, minNum(o.min) ?? 90) : 90;
  };
  for (const id of l.xi) stats[id] = { start: true, sub: false, min: endOf(id), y: 0, r: 0 };
  for (const e of ev) {
    if (e.t !== "sub" || !e.inn) continue;
    const from = Math.min(90, minNum(e.min) ?? 90);
    stats[e.inn] = { start: false, sub: true, min: Math.max(0, endOf(e.inn) - from), y: 0, r: 0 };
  }
  for (const e of ev) {
    if (!e.who || !stats[e.who]) continue;
    if (e.t === "y") stats[e.who].y++;
    if (e.t === "r") stats[e.who].r = 1;
  }
  const goals: Goal[] = ev
    .filter(e => e.t === "goal")
    .map(e => ({ min: e.min, who: e.who || null, ast: e.ast || null, ...(e.og ? { og: true } : {}) }));
  const against: Against[] = ev.filter(e => e.t === "ag").map(e => ({ min: e.min, who: e.name || "" }));
  const oldData: Partial<Match> = { ...(old || {}) };
  delete oldData.id;
  return {
    ...oldData,
    date: l.date,
    opp: l.opp,
    home: l.home,
    comp: l.comp || oldData.comp || "Meisterschaft",
    time: l.time || oldData.time || "",
    status: "played",
    gf: goals.length,
    ga: against.length,
    goals,
    against,
    stats,
    lineup: l.xiPos || {},
    live: true,
  };
}
