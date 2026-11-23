import { POS, normPos } from "../../src/positions";
import { describe, expect, it } from "vitest";
import { minKey, minNum, norm, slug } from "../../src/util";

describe("util", () => {
  it("slug folgt der Regel aus CLAUDE.md", () => {
    expect(slug("2026-11-07-FC Reinach-FC Aesch")).toBe("2026-11-07-fc-reinach-fc-aesch");
    expect(slug("FC Münchenstein")).toBe("fc-munchenstein");
  });
  it("norm ignoriert Gross/Klein und Umlaut-Punkte", () => {
    expect(norm("SC Binningen")).toBe(norm("sc binningen"));
    expect(norm("Möhlin")).toBe(norm("Mohlin"));
  });
  it("Nachspielzeit wird richtig gelesen und sortiert", () => {
    expect(minNum("90+2")).toBe(90);
    expect(minNum("23")).toBe(23);
    expect(minKey("45+2")).toBeLessThan(minKey("46"));
    expect(minKey("90+4")).toBeGreaterThan(minKey("90+2"));
  });
});

describe("Positionen", () => {
  it("nur noch die neuen Codes", () => {
    expect(POS.map(p => p[0])).toEqual([
      "TW",
      "LV",
      "LIV",
      "IV",
      "RIV",
      "RV",
      "LAV",
      "RAV",
      "ZDM",
      "LM",
      "ZM",
      "RM",
      "ZOM",
      "LF",
      "LS",
      "MS",
      "RS",
      "RF",
      "ST",
    ]);
    expect(POS.find(p => p[0] === "LV")?.[1]).toBe("Linker Verteidiger");
    expect(POS.find(p => p[0] === "LAV")?.[1]).toBe("Linker Aussenverteidiger");
    expect(POS.find(p => p[0] === "LIV")?.[1]).toBe("Linker Innenverteidiger");
    const y = (c: string) => POS.find(p => p[0] === c)![4];
    expect(y("ST")).toBeLessThan(y("MS")); // Stürmer ganz vorne, Mittelstürmer dahinter
    expect(y("LAV")).toBeLessThan(y("LV")); // Aussenverteidiger höher als Verteidiger
  });
  it("alte Codes werden umgestellt", () => {
    expect(normPos("AV")).toBe("RAV");
    expect(normPos("DM")).toBe("ZDM");
    expect(normPos("ST")).toBe("ST");
  });
});
