import { describe, expect, it } from "vitest";
import { applyPrivacy, shortName, squadShortNames, uniqueShortName } from "../../src/domain/privacy";
import type { Fixture, Match, Player } from "../../src/types";

describe("Datenschutz: nur Vorname N.", () => {
  it("kürzt Nachnamen, lässt Kurz- und Einzelnamen", () => {
    expect(shortName("Remo Huber")).toBe("Remo H.");
    expect(shortName("  joey   patane ")).toBe("joey P.");
    expect(shortName("Remo H.")).toBe("Remo H.");
    expect(shortName("Elson")).toBe("Elson");
    expect(shortName("Hans van der Berg")).toBe("Hans B.");
    expect(shortName("Ömer Özkan")).toBe("Ömer Ö.");
  });
  it("macht gleiche Kurznamen im Kader eindeutig", () => {
    const sq = squadShortNames([
      { id: "1", name: "Remo Huber" },
      { id: "2", name: "Remo Hasler" },
      { id: "3", name: "Luca Meier" },
    ]);
    expect(sq).toEqual({ 1: "Remo Hu.", 2: "Remo Ha.", 3: "Luca M." });
    expect(uniqueShortName("Remo Hofer", "9", [{ id: "1", name: "Remo H." }])).toBe("Remo Ho.");
  });
  it("kürzt alte Daten, entfernt Fotos und meldet geänderte Dokumente", () => {
    const players = [
      { id: "p1", name: "Remo Huber", photo: "data:image/png;base64,xx" },
      { id: "p2", name: "Luca M." },
    ] as unknown as Player[];
    const matches = [
      { id: "m1", against: [{ min: "10", who: "Max Muster" }], goals: [] },
      { id: "m2", against: [{ min: "5", who: "Tim B." }] },
    ] as unknown as Match[];
    const fixtures = [{ id: "f1", goals: [{ min: "3", team: "home", who: "Peter Keller" }] }] as unknown as Fixture[];
    const analyses = [{ id: "a1", opp: "FC X", text: "Gefährlich: Max Muster. Bei uns trifft Remo Huber.", at: "" }];
    const dirty = applyPrivacy({ players, matches, fixtures, analyses });
    expect(players[0]).toEqual({ id: "p1", name: "Remo H." });
    expect(matches[0].against![0].who).toBe("Max M.");
    expect(fixtures[0].goals![0].who).toBe("Peter K.");
    expect(analyses[0].text).toBe("Gefährlich: Max M. Bei uns trifft Remo H.");
    expect(dirty.map(d => d.coll + "/" + d.obj.id).sort()).toEqual([
      "analyses/a1",
      "fixtures/f1",
      "matches/m1",
      "players/p1",
    ]);
    expect(applyPrivacy({ players, matches, fixtures, analyses })).toEqual([]); // zweimal = nichts mehr zu tun
  });
});
