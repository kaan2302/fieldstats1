import { describe, expect, it } from "vitest";
import { halfTime, load, phases, plural, subTiming, vsStrength } from "../../src/domain/coach";
import type { Match, Player, TableRow } from "../../src/types";

const m = (
  id: string,
  gf: string[],
  ga: string[],
  stats: Match["stats"] = {},
  opp = "X",
  date = "2026-09-0" + id,
): Match =>
  ({
    id,
    date,
    opp,
    home: true,
    comp: "Meisterschaft",
    status: "played",
    gf: gf.length,
    ga: ga.length,
    goals: gf.map(min => ({ min, who: null, ast: null })),
    against: ga.map(min => ({ min, who: "" })),
    stats,
  }) as Match;

describe("Trainer-Analysen", () => {
  it("Einzahl/Mehrzahl", () => {
    expect(plural(1, "Spiel", "Spiele")).toBe("1 Spiel");
    expect(plural(3, "Spiel", "Spiele")).toBe("3 Spiele");
  });

  it("Halbzeit-Bilanz: gedreht, hergegeben, Punkte je Halbzeit", () => {
    const h = halfTime([
      m("1", ["50", "80"], ["20"]), // 0:1 zur Pause → 2:1 gedreht
      m("2", ["10"], ["60", "90+2"]), // 1:0 zur Pause → 1:2 hergegeben
      m("3", ["45+1"], []), // Tor in der Nachspielzeit der 1. HZ zählt zur 1. HZ
    ]);
    expect(h.n).toBe(3);
    expect(h.behindHT).toEqual({ n: 1, turned: 1, pts: 3 });
    expect(h.aheadHT).toEqual({ n: 2, won: 1, pts: 3 });
    expect(h.h1).toEqual({ gf: 2, ga: 1 });
    expect(h.h2).toEqual({ gf: 2, ga: 2 });
    expect(h.pts1).toBe(0 + 3 + 3);
    expect(h.pts2).toBe(3 + 0 + 1);
  });

  it("Phasen: schlimmste Viertelstunde und späte Gegentore", () => {
    const p = phases([m("1", ["5"], ["80", "85"]), m("2", [], ["90+3", "20"])]);
    expect(p.ga).toEqual([0, 1, 0, 0, 0, 3]);
    expect(p.worst).toBe(5);
    expect(p.best).toBe(0);
    expect(p.lateShare).toBe(0.75);
  });

  it("Bilanz nach Gegnerstärke (Drittel der Tabelle ohne uns)", () => {
    const rows = ["A", "B", "Wir", "C", "D", "E", "F"].map((team, i) => ({ rank: i + 1, team }) as TableRow);
    const g = vsStrength(
      [m("1", ["1"], [], {}, "A"), m("2", [], ["1"], {}, "B"), m("3", ["1", "2"], [], {}, "F")],
      rows,
      t => t === "Wir",
    );
    expect(g.map(x => [x.key, x.n, x.ppg])).toEqual([
      ["oben", 2, 1.5],
      ["mitte", 0, null],
      ["unten", 1, 3],
    ]);
    expect(g[0].label).toBe("Gegen Platz 1–2");
  });

  it("Belastung und wenig Einsatz", () => {
    const pl = (id: string, pos = "ZM"): Player => ({ id, name: id, pos });
    const full = { start: true, sub: false, min: 90, y: 0, r: 0 };
    const games = [1, 2, 3, 4, 5].map(i =>
      m(String(i), [], [], { iron: full, rare: i === 1 ? full : { start: false, sub: false, min: 0, y: 0, r: 0 } }),
    );
    const l = load([pl("iron"), pl("rare")], games);
    expect(l.heavy.map(r => [r.p.id, r.last3])).toEqual([["iron", 270]]);
    expect(l.idle.map(r => [r.p.id, r.idle, r.quote])).toEqual([["rare", 4, 0.2]]);
  });

  it("Wechsel-Timing: Minute und Tordifferenz vor/nach dem 1. Wechsel", () => {
    const st = (subMin: number): Match["stats"] => ({
      a: { start: true, sub: false, min: 90, y: 0, r: 0 },
      b: { start: false, sub: true, min: 90 - subMin, y: 0, r: 0 },
    });
    const s = subTiming([
      m("1", ["70"], ["10"], st(60)),
      m("2", [], [], st(70)),
      m("3", [], [], { a: { start: true, sub: false, min: 90, y: 0, r: 0 } }),
    ]);
    expect(s).toMatchObject({ n: 2, noSub: 1, firstAvg: 65, allAvg: 65 });
    expect(s.before).toMatchObject({ gf: 0, ga: 1 });
    expect(s.after).toMatchObject({ gf: 1, ga: 0 });
    expect(s.before.per90!).toBeCloseTo(-90 / 130, 5);
    expect(s.after.per90!).toBeCloseTo(90 / 50, 5);
  });
});
