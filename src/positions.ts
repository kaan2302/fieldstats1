// Spielerpositionen und ihre Lage auf dem Spielfeld.
import type { Line } from "./types";

/** [Code, Name, Mannschaftsteil, x %, y %] – y: 0 = gegnerisches Tor oben. */
export type PosDef = readonly [code: string, name: string, line: Line, x: number, y: number];

export const POS: readonly PosDef[] = [
  ["TW", "Torhüter", "TOR", 50, 90],
  ["LV", "Linker Verteidiger", "ABW", 15, 77],
  ["LIV", "Linker Innenverteidiger", "ABW", 31, 79],
  ["IV", "Innenverteidiger", "ABW", 50, 80],
  ["RIV", "Rechter Innenverteidiger", "ABW", 69, 79],
  ["RV", "Rechter Verteidiger", "ABW", 85, 77],
  ["LAV", "Linker Aussenverteidiger", "ABW", 10, 66],
  ["RAV", "Rechter Aussenverteidiger", "ABW", 90, 66],
  ["ZDM", "Defensives Mittelfeld", "MIT", 50, 64],
  ["LM", "Linkes Mittelfeld", "MIT", 12, 47],
  ["ZM", "Zentrales Mittelfeld", "MIT", 50, 48],
  ["RM", "Rechtes Mittelfeld", "MIT", 88, 47],
  ["ZOM", "Offensives Mittelfeld", "MIT", 50, 30],
  ["LF", "Linker Flügel", "ANG", 14, 24],
  ["LS", "Linker Stürmer", "ANG", 25, 15],
  ["MS", "Mittelstürmer", "ANG", 50, 20],
  ["RS", "Rechter Stürmer", "ANG", 75, 15],
  ["RF", "Rechter Flügel", "ANG", 86, 24],
  ["ST", "Stürmer", "ANG", 50, 10],
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
