// Vereins-Übersicht «Hochziehen»: Kandidaten aus den tieferen Mannschaften (nur Admins und Trainer).
import { teamLabel } from "../club";
import { sb } from "../db";
import { candidates, teamLevel, type ClubSquad } from "../domain/club";
import { seasonOf } from "../season";
import { S } from "../state";
import type { Match, Player } from "../types";
import { $, esc, face } from "../util";

let cache: { key: string; squads: ClubSquad[] } | null = null;

async function loadSquads(): Promise<ClubSquad[]> {
  const key = S.clubTeams.map(t => t.id).join(",") + "|" + S.season;
  if (cache?.key === key) return cache.squads;
  const ids = S.clubTeams.map(t => t.id);
  const { data, error } = await sb
    .from("docs")
    .select("team_id,coll,id,data")
    .in("team_id", ids)
    .in("coll", ["players", "matches"]);
  if (error) throw error;
  const squads: ClubSquad[] = S.clubTeams.map(t => ({
    team: { id: t.id, label: teamLabel(t), level: teamLevel(t.label) },
    players: [],
    matches: [],
  }));
  for (const r of data || []) {
    const sq = squads.find(s => s.team.id === r.team_id);
    if (!sq) continue;
    if (r.coll === "players") sq.players.push({ id: r.id, ...r.data } as Player);
    else if (seasonOf(r.data?.date) === S.season) sq.matches.push({ id: r.id, ...r.data } as Match);
  }
  cache = { key, squads };
  return squads;
}

export async function renderClub(): Promise<void> {
  const body = $("clubBody");
  if (S.clubTeams.length < 2) {
    body.innerHTML = `<p class="muted">Diese Übersicht gibt es mit einem Vereins-Abo und mindestens zwei Mannschaften.</p>`;
    return;
  }
  let squads: ClubSquad[];
  try {
    squads = await loadSquads();
  } catch {
    body.innerHTML = `<p class="muted">Daten konnten nicht geladen werden.</p>`;
    return;
  }
  const all = candidates(squads);
  const lower = [...new Set(all.map(c => c.teamId))];
  const sel = $("clubFilter"),
    cur = sel.value;
  sel.innerHTML =
    `<option value="">Alle tieferen Mannschaften</option>` +
    lower.map(id => `<option value="${esc(id)}">${esc(all.find(c => c.teamId === id)!.teamLabel)}</option>`).join("");
  sel.value = lower.includes(cur) ? cur : "";
  sel.onchange = () => void renderClub();
  const rows = all.filter(c => !sel.value || c.teamId === sel.value);
  body.innerHTML = rows.length
    ? `<table><thead><tr><th>#</th><th>Spieler</th><th>Mannschaft</th><th>Pos</th><th>Spiele</th><th>Min</th><th>Einsatz</th><th>Tore</th><th>Assists</th><th>Pro 90</th><th>Wert</th></tr></thead><tbody>${rows
        .map(
          (c, i) =>
            `<tr><td>${i + 1}</td><td><span class="face" style="display:inline-grid;margin-right:6px">${face(c)}</span><strong>${esc(c.name)}</strong></td><td>${esc(c.teamLabel)}</td><td>${esc(c.pos || "")}</td><td>${c.apps}</td><td>${c.min}</td><td>${Math.round(c.share * 100)} %</td><td>${c.g}</td><td>${c.a}</td><td>${c.ga90 != null ? `${c.ga90.toFixed(2)} GT` : c.per90.toFixed(2)}</td><td><strong>${c.score}</strong></td></tr>`,
        )
        .join("")}</tbody></table>`
    : `<p class="muted">Noch keine Kandidaten: In den tieferen Mannschaften braucht es erfasste Spiele mit Einsätzen (ab 3 Spielen und 180 Minuten).</p>`;
}

/** Nach einer Datenänderung neu laden. */
export const resetClubCache = (): void => {
  cache = null;
};
