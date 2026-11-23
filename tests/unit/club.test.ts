import { describe, expect, it } from "vitest";
import { candidates, effectivePlan, isLocked, teamLevel } from "../../src/domain/club";
import type { Match, MyTeam, Player } from "../../src/types";

describe("Verein", () => {
  it("ordnet Mannschaften nach Stufe", () => {
    const labels = [
      "B-Junioren",
      "2. Mannschaft",
      "Junioren A",
      "1. Mannschaft",
      "Senioren 30+",
      "Frauen",
      "3. Mannschaft",
    ];
    expect([...labels].sort((a, b) => teamLevel(a) - teamLevel(b))).toEqual([
      "1. Mannschaft",
      "2. Mannschaft",
      "3. Mannschaft",
      "Senioren 30+",
      "Junioren A",
      "B-Junioren",
      "Frauen",
    ]);
  });
  it("Vereins-Abo gilt für alle Mannschaften des Vereins", () => {
    const t = {
      id: "x",
      name: "X",
      plan: "trial",
      trial_until: "2026-01-01",
      club_id: "c",
      club_plan: "active",
      club_trial_until: "2026-01-01",
    } as MyTeam;
    expect(effectivePlan(t)?.plan).toBe("active");
    expect(isLocked(t, "2026-11-23")).toBe(false);
    expect(isLocked({ ...t, club_id: null }, "2026-11-23")).toBe(true);
    expect(isLocked({ ...t, club_plan: "trial", club_trial_until: "2026-12-01" }, "2026-11-23")).toBe(false);
  });
  it("findet Kandidaten nur in tieferen Mannschaften", () => {
    const pl = (id: string, pos = "ST"): Player => ({ id, name: id, pos });
    const game = (id: string, stats: Match["stats"], goals: Match["goals"] = []): Match =>
      ({
        id,
        date: "2026-09-01",
        opp: "X",
        home: true,
        comp: "Meisterschaft",
        status: "played",
        gf: goals.length,
        ga: 0,
        goals,
        against: [],
        stats,
      }) as Match;
    const full = { start: true, sub: false, min: 90, y: 0, r: 0 };
    const half = { start: false, sub: true, min: 30, y: 0, r: 0 };
    const first = {
      team: { id: "t1", label: "1. Mannschaft", level: 1 },
      players: [pl("star")],
      matches: [1, 2, 3].map(i => game("a" + i, { star: full }, [{ min: "1", who: "star", ast: null }])),
    };
    const second = {
      team: { id: "t2", label: "2. Mannschaft", level: 2 },
      players: [pl("top"), pl("bank"), pl("tw", "TW")],
      matches: [1, 2, 3, 4].map(i =>
        game("b" + i, { top: full, bank: half, tw: full }, [{ min: "10", who: "top", ast: null }]),
      ),
    };
    const c = candidates([second, first]);
    expect(c.map(x => x.id).sort()).toEqual(["top", "tw"]); // «bank» unter 180 Min., «star» ist schon in der 1.
    const top = c.find(x => x.id === "top")!,
      tw = c.find(x => x.id === "tw")!;
    expect(top).toMatchObject({ teamLabel: "2. Mannschaft", share: 1, per90: 1, ga90: null, score: 92 });
    expect(tw).toMatchObject({ ga90: 0, score: 100 });
  });
});
