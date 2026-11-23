// Verein der geöffneten Mannschaft laden: Name und alle Mannschaften (für die Auswahl oben und die Vereins-Übersicht).
import { sb } from "./db";
import { teamLevel } from "./domain/club";
import { S, ctx } from "./state";
import type { ClubTeam } from "./types";

export async function loadClub(): Promise<void> {
  S.club = null;
  S.clubTeams = [];
  const { data: me, error } = await sb.from("teams").select("id,name,label,club_id").eq("id", ctx.team).maybeSingle();
  if (error || !me?.club_id) return;
  const [{ data: club }, { data: teams }] = await Promise.all([
    sb.from("clubs").select("id,name").eq("id", me.club_id).maybeSingle(),
    sb.from("teams").select("id,name,label,club_id").eq("club_id", me.club_id),
  ]);
  if (!club) return;
  S.club = club;
  S.clubTeams = ((teams as ClubTeam[]) || []).sort(
    (a, b) => teamLevel(a.label) - teamLevel(b.label) || (a.label || a.name).localeCompare(b.label || b.name, "de"),
  );
}

/** Anzeigename einer Vereinsmannschaft. */
export const teamLabel = (t: Pick<ClubTeam, "label" | "name">): string => t.label || t.name;
