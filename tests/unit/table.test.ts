import { beforeEach, describe, expect, it } from "vitest";
import { S } from "../../src/state";
import { parseTable, tableFromResults } from "../../src/domain";

describe("Tabelle", () => {
  it("liest eine kopierte football.ch-Tabelle", () => {
    const txt = `2. LIGA (FAEW) 1. FC Aesch 12 9 2 1 30:10 +20 29
2. SC Binningen 12 6 3 3 25 : 18 7 21`;
    const rows = parseTable(txt);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rank: 1, team: "FC Aesch", sp: 12, s: 9, gf: 30, ga: 10, pts: 29 });
    expect(rows[0].warn).toBeUndefined();
    expect(rows[1]).toMatchObject({ rank: 2, team: "SC Binningen", pts: 21 });
  });
  it("warnt bei unplausiblen Zahlen", () => {
    const [r] = parseTable("1. FC X 10 5 2 2 10:5 +5 17");
    expect(r.warn).toContain("S+U+N");
  });
  describe("aus Resultaten", () => {
    beforeEach(() => {
      S.meta = { club: "SC Binningen" };
      S.matches = [
        {
          id: "m1",
          date: "2026-08-10",
          opp: "FC Aesch",
          home: true,
          comp: "Meisterschaft",
          status: "played",
          gf: 2,
          ga: 1,
        },
      ] as typeof S.matches;
      S.fixtures = [
        { id: "f1", date: "2026-08-10", home: "FC Riehen", away: "FC Aesch", hg: 1, ag: 1 },
      ] as typeof S.fixtures;
    });
    it("rechnet Punkte und Rang", () => {
      const t = tableFromResults();
      expect(t[0]).toMatchObject({ rank: 1, team: "SC Binningen", pts: 3, gf: 2, ga: 1 });
      const aesch = t.find(r => r.team === "FC Aesch")!;
      expect(aesch).toMatchObject({ sp: 2, pts: 1, gf: 2, ga: 3 });
    });
  });
});
