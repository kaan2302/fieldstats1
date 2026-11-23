// Datenschutz: Es werden nur Vorname und erster Buchstabe des Nachnamens gespeichert, keine Fotos.
// Ältere Daten mit vollen Namen oder Fotos werden beim Laden gekürzt (und vom Admin einmal zurückgeschrieben).
import type { Analysis, Fixture, Match, Player } from "../types";

const ABBR = /^\p{L}{1,3}\.$/u; // «H.», «Hi.»

/** «Remo Huber» → «Remo H.»; bereits kurze Namen bleiben; Einzelnamen bleiben. `n` = Buchstaben des Nachnamens. */
export function shortName(name: string | null | undefined, n = 1): string {
  const w = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (w.length < 2) return w[0] ?? "";
  const last = w[w.length - 1];
  if (ABBR.test(last) && last.length - 1 <= n) return `${w[0]} ${last}`;
  const core = last.replace(/\.$/, "");
  return `${w[0]} ${core.charAt(0).toUpperCase()}${core.slice(1, n).toLowerCase()}.`;
}

/** Kurznamen für den ganzen Kader; bei Gleichheit zwei (oder mehr) Buchstaben, z. B. «Remo Hu.» und «Remo Ha.». */
export function squadShortNames(players: readonly Pick<Player, "id" | "name">[]): Record<string, string> {
  const out: Record<string, string> = {};
  let open = [...players];
  for (let n = 1; n <= 4 && open.length; n++) {
    const cand = open.map(p => [p, shortName(p.name, n)] as const);
    const count = new Map<string, number>();
    cand.forEach(([, s]) => count.set(s, (count.get(s) ?? 0) + 1));
    const taken = new Set(Object.values(out));
    const next: typeof open = [];
    for (const [p, s] of cand) {
      if ((count.get(s) === 1 && !taken.has(s)) || n === 4) out[p.id] = s;
      else next.push(p);
    }
    open = next;
  }
  return out;
}

/** Kurzname für einen neuen oder geänderten Spieler, eindeutig im Kader. */
export function uniqueShortName(name: string, id: string, players: readonly Pick<Player, "id" | "name">[]): string {
  const others = players.filter(p => p.id !== id).map(p => p.name);
  for (let n = 1; n <= 4; n++) {
    const s = shortName(name, n);
    if (!others.includes(s) || n === 4) return s;
  }
  return shortName(name);
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Volle Namen in einem Text durch Kurznamen ersetzen. */
export function shortenText(text: string, names: Map<string, string>): string {
  let t = text;
  for (const [full, short] of [...names].sort((a, b) => b[0].length - a[0].length))
    if (full !== short)
      t = t.replace(
        new RegExp(`(?<![\\p{L}])${escRe(full)}${short.endsWith(".") ? "\\.?" : ""}(?![\\p{L}])`, "gu"),
        short,
      );
  return t;
}

export interface PrivacyInput {
  players: Player[];
  matches: Match[];
  fixtures: Fixture[];
  analyses: Analysis[];
}

/** Kürzt alle Namen und entfernt Fotos (verändert die Objekte). Gibt die geänderten Dokumente zurück. */
export function applyPrivacy(d: PrivacyInput): { coll: keyof PrivacyInput; obj: { id: string } }[] {
  const changed = new Map<string, { coll: keyof PrivacyInput; obj: { id: string } }>();
  const mark = (coll: keyof PrivacyInput, obj: { id: string }) => changed.set(coll + "/" + obj.id, { coll, obj });
  const names = new Map<string, string>();

  const sq = squadShortNames(d.players);
  for (const p of d.players) {
    const rec = p as Player & { photo?: unknown };
    const s = sq[p.id] ?? p.name;
    if (s !== p.name || rec.photo !== undefined) {
      names.set(p.name, s);
      p.name = s;
      delete rec.photo;
      mark("players", p);
    }
  }
  const sh = (n: string | null | undefined) => {
    const s = shortName(n);
    if (n && s !== n) names.set(n, s);
    return s;
  };
  for (const m of d.matches)
    for (const a of m.against ?? [])
      if (a.who && sh(a.who) !== a.who) {
        a.who = sh(a.who);
        mark("matches", m);
      }
  for (const f of d.fixtures)
    for (const g of f.goals ?? [])
      if (g.who && sh(g.who) !== g.who) {
        g.who = sh(g.who);
        mark("fixtures", f);
      }
  for (const a of d.analyses) {
    const t = shortenText(a.text || "", names);
    if (t !== a.text) {
      a.text = t;
      mark("analyses", a);
    }
  }
  return [...changed.values()];
}
