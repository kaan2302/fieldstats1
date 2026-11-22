// Saisons laufen vom 1. Juli bis 30. Juni. Die gewählte Saison filtert Spiele, Resultate und Tabelle.
import { S } from "./state";
import { $, today } from "./util";
import { render } from "./views/app";

/** «2026-11-07» → «2026/27». */
export const seasonOf = (d: string | null | undefined): string | null => {
  const [y, m] = String(d || "")
    .split("-")
    .map(Number);
  if (!y) return null;
  const a = m >= 7 ? y : y - 1;
  return `${a}/${String(a + 1).slice(2)}`;
};

export const curSeason = (): string => S.meta.season || seasonOf(today()) || "";

export function seasonsList(): string[] {
  const set = new Set<string | null>([curSeason()]);
  S.all.matches.forEach(m => set.add(seasonOf(m.date)));
  S.all.fixtures.forEach(f => set.add(seasonOf(f.date)));
  Object.keys(S.all.tables).forEach(k => set.add(k));
  set.delete(null);
  return ([...set] as string[]).sort().reverse();
}

export function applySeason(): void {
  if (!S.season || !seasonsList().includes(S.season)) S.season = curSeason();
  const cur = S.season === curSeason();
  S.matches = S.all.matches.filter(m => seasonOf(m.date) === S.season || (cur && !m.date));
  S.fixtures = S.all.fixtures.filter(f => seasonOf(f.date) === S.season);
  S.table = cur ? S.all.table || S.all.tables[S.season] || null : S.all.tables[S.season] || null;
}

export function initSeason(): void {
  $("seasonSel").onchange = () => {
    S.season = $("seasonSel").value;
    applySeason();
    render();
  };
}
