import { describe, expect, it } from "vitest";
import { benchNow, liveMin, liveScore, matchFromLive, onField } from "../../src/live/model";
import type { LiveState, Player } from "../../src/types";

const players: Player[] = ["a", "b", "c", "d"].map(id => ({ id, name: id.toUpperCase(), pos: "ZM" }));
const base = (events: LiveState["events"]): LiveState => ({
  id: "m1",
  opp: "FC Aesch",
  home: true,
  date: "2026-11-07",
  phase: "end",
  xi: ["a", "b"],
  bench: ["c", "d"],
  events,
  updated: 0,
});

describe("Live-Modus", () => {
  it("Uhr mit Nachspielzeit", () => {
    const t = 1_000_000;
    expect(liveMin({ phase: "h1", t1: t }, t + 10 * 6e4)).toBe("11");
    expect(liveMin({ phase: "h1", t1: t }, t + 47 * 6e4)).toBe("45+3");
    expect(liveMin({ phase: "h2", t2: t }, t + 46 * 6e4)).toBe("90+2");
    expect(liveMin({ phase: "ht" })).toBe("45");
  });
  it("Spielstand, Platz und Bank nach Wechsel und Roter Karte", () => {
    const l = base([
      { id: "1", t: "goal", min: "23", who: "a", ast: "b" },
      { id: "2", t: "ag", min: "40", name: "Muster" },
      { id: "3", t: "sub", min: "60", out: "b", inn: "c" },
      { id: "4", t: "r", min: "80", who: "c" },
    ]);
    expect(liveScore(l)).toEqual([1, 1]);
    expect(onField(l, players).map(p => p.id)).toEqual(["a"]);
    expect(benchNow(l, players).map(p => p.id)).toEqual(["d"]);
  });
  it("Einsatzminuten nach den Regeln (Rot beendet den Einsatz)", () => {
    const m = matchFromLive(
      base([
        { id: "1", t: "goal", min: "23", who: "a", ast: "b" },
        { id: "2", t: "ag", min: "90+2", name: "Muster" },
        { id: "3", t: "sub", min: "60", out: "b", inn: "c" },
        { id: "4", t: "r", min: "80", who: "c" },
        { id: "5", t: "y", min: "30", who: "a" },
      ]),
      { id: "m1", comp: "Cup" },
    );
    expect(m.stats).toEqual({
      a: { start: true, sub: false, min: 90, y: 1, r: 0 },
      b: { start: true, sub: false, min: 60, y: 0, r: 0 },
      c: { start: false, sub: true, min: 20, y: 0, r: 1 },
    });
    expect(m).toMatchObject({ gf: 1, ga: 1, comp: "Cup", status: "played" });
    expect(m.goals).toEqual([{ min: "23", who: "a", ast: "b" }]);
    expect(m.against).toEqual([{ min: "90+2", who: "Muster" }]);
    expect("id" in m).toBe(false);
  });
});

describe("Live-Modus: Torart", () => {
  it("übernimmt die Torart ins Spiel", () => {
    const m = matchFromLive(
      base([
        { id: "1", t: "goal", min: "10", who: "a", ast: null, kind: "penalty" },
        { id: "2", t: "ag", min: "20", name: "", kind: "konter" },
        { id: "3", t: "goal", min: "30", who: "b", ast: "a" },
      ]),
    );
    expect(m.goals).toEqual([
      { min: "10", who: "a", ast: null, kind: "penalty" },
      { min: "30", who: "b", ast: "a" },
    ]);
    expect(m.against).toEqual([{ min: "20", who: "", kind: "konter" }]);
  });
});
