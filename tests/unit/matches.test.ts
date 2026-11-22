import { beforeEach, describe, expect, it } from "vitest";
import { S } from "../../src/state";
import { buckets, isOurs, ppg, ptsOf, res, trendWord } from "../../src/domain";

describe("Spiele", () => {
  beforeEach(() => {
    S.meta = { club: "SC Binningen" };
  });
  it("Resultat und Punkte", () => {
    expect(res({ gf: 2, ga: 1 })).toBe("S");
    expect(res({ gf: 1, ga: 1 })).toBe("U");
    expect(ptsOf({ gf: 0, ga: 3 })).toBe(0);
    expect(ptsOf({ gf: 3, ga: 0 })).toBe(3);
  });
  it("erkennt unser Team", () => {
    expect(isOurs("SC Binningen a")).toBe(true);
    expect(isOurs("FC Aesch")).toBe(false);
  });
  it("teilt Minuten in 15-Minuten-Abschnitte, Nachspielzeit zum letzten", () => {
    expect(buckets(["1", "15", "16", "45+2", "46", "90+4", "x"])).toEqual([2, 1, 1, 1, 0, 1]);
  });
  it("Punkte pro Spiel und Trend", () => {
    expect(
      ppg([
        { gf: 1, ga: 0 },
        { gf: 0, ga: 0 },
      ]),
    ).toBe(2);
    expect(ppg([])).toBeNull();
    expect(trendWord(2, 1)).toBe("steigend");
    expect(trendWord(1, 1.1)).toBe("stabil");
  });
});
