// Spielerpositionen und ihre Lage auf dem Spielfeld.
import type { Line } from "./types";

/** [Code, Name, Mannschaftsteil, x %, y %] – y: 0 = gegnerisches Tor oben. */
export type PosDef = readonly [code: string, name: string, line: Line, x: number, y: number];

export const POS: readonly PosDef[] = [
  ["TW", "Torhüter", "TOR", 50, 90],
  ["LAV", "Linker Aussenverteidiger", "ABW", 12, 70],
  ["LV", "Linker Verteidiger", "ABW", 32, 74],
  ["IV", "Innenverteidiger", "ABW", 50, 75],
  ["RV", "Rechter Verteidiger", "ABW", 68, 74],
  ["RAV", "Rechter Aussenverteidiger", "ABW", 88, 70],
  ["ZDM", "Defensives Mittelfeld", "MIT", 50, 60],
  ["LM", "Linkes Mittelfeld", "MIT", 12, 45],
  ["ZM", "Zentrales Mittelfeld", "MIT", 50, 48],
  ["RM", "Rechtes Mittelfeld", "MIT", 88, 45],
  ["ZOM", "Offensives Mittelfeld", "MIT", 50, 35],
  ["LF", "Linker Flügel", "ANG", 12, 22],
  ["LS", "Linker Stürmer", "ANG", 32, 16],
  ["ST", "Stürmer", "ANG", 50, 22],
  ["MS", "Mittelstürmer", "ANG", 50, 11],
  ["RS", "Rechter Stürmer", "ANG", 68, 16],
  ["RF", "Rechter Flügel", "ANG", 88, 22],
];

/** Codes aus dem ersten Import werden beim Laden auf die neuen umgestellt. */
const LEGACY: Record<string, string> = { AV: "RAV", DM: "ZDM", OM: "ZOM", FL: "RF" };

/** Positionscode auf die aktuelle Liste bringen (alte Codes → neue, unbekannt bleibt unverändert). */
export const normPos = (code: string | undefined): string | undefined => (code && LEGACY[code]) || code;

/** Sortierreihenfolge (Torhüter zuerst, Angriff zuletzt). */
export const POS_ORDER: Record<string, number> = Object.fromEntries(POS.map((p, i) => [p[0], i]));

export const LINE: Record<string, Line> = Object.fromEntries(POS.map(p => [p[0], p[2]]));

export const SLOT: Record<string, { x: number; y: number }> = Object.fromEntries(
  POS.map(p => [p[0], { x: p[3], y: p[4] }]),
);

/** Nächstgelegene Position zu einem Punkt auf dem Feld (Prozent). */
export const nearestPos = (x: number, y: number): string =>
  POS.reduce(
    (best, p) => {
      const d = (p[3] - x) ** 2 + ((p[4] - y) * 1.3) ** 2;
      return d < best.d ? { d, c: p[0] } : best;
    },
    { d: Infinity, c: "ZM" },
  ).c;
