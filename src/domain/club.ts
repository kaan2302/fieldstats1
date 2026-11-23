// Verein: Reihenfolge der Mannschaften, Preise und Kandidaten zum Hochziehen.
import type { Match, MyTeam, Player } from "../types";
import { playerKPI, type PlayerKPI } from "./kpi";

/** Preise (CHF pro Saison). */
export const PRICE = { team: 129, club: 349, clubTeams: 6, extraTeam: 49 } as const;

/**
 * Stufe einer Mannschaft aus ihrer Bezeichnung: kleiner = höher.
 * «1. Mannschaft» 1, «2. Mannschaft» 2 … Senioren 20, Junioren A 31, B 32, C 33 …, Frauen 40, sonst 50.
 */
export function teamLevel(label: string | null | undefined): number {
  const l = String(label || "").toLowerCase();
  const n = l.match(/^\s*(\d)\s*\.?\s*(mannschaft|team|liga)?/);
  if (n && !/junior|senior|frau|damen/.test(l)) return +n[1];
  if (/senior|veteran/.test(l)) return 20;
  const j = l.match(/(?:junior\w*|jun\.?|u-?\d+)\s*([a-g])\b|\b([a-g])\s*-?\s*junior/);
  if (j) return 30 + "abcdefg".indexOf(j[1] || j[2]) + 1;
  if (/frau|damen|women/.test(l)) return 40;
  return 50;
}

/** Plan, der für eine Mannschaft gilt (im Verein: Vereins-Abo). */
export function effectivePlan(t: MyTeam | null | undefined): { plan: string; until: string } | null {
  if (!t) return null;
  if (t.club_id && t.club_plan) return { plan: t.club_plan, until: t.club_trial_until || t.trial_until };
  return { plan: t.plan, until: t.trial_until };
}

/** Bearbeiten gesperrt? (kein Abo und Testphase vorbei) */
export function isLocked(t: MyTeam | null | undefined, today: string): boolean {
  const p = effectivePlan(t);
  return !!p && p.plan !== "active" && p.until < today;
}

export interface ClubSquad {
  team: { id: string; label: string; level: number };
  players: Player[];
  matches: Match[];
}

export interface Candidate extends PlayerKPI {
  teamId: string;
  teamLabel: string;
  level: number;
  /** Anteil an den möglichen Minuten (0–1). */
  share: number;
  /** Tore + Vorlagen pro 90 Minuten. */
  per90: number;
  /** Gegentore pro 90 Minuten (Torhüter). */
  ga90: number | null;
  /** Leistungswert 0–100 für die Rangliste. */
  score: number;
}

/**
 * Kandidaten zum Hochziehen: Spieler aus tieferen Mannschaften mit mindestens 3 Einsätzen und 180 Minuten.
 * Leistungswert: 50 % Scorerpunkte pro 90 (Feld) bzw. wenig Gegentore pro 90 (Torhüter), 50 % Einsatzanteil.
 */
export function candidates(squads: ClubSquad[]): Candidate[] {
  if (!squads.length) return [];
  const top = Math.min(...squads.map(s => s.team.level));
  const out: Candidate[] = [];
  for (const s of squads) {
    if (s.team.level === top) continue;
    const games = s.matches.filter(m => m.status !== "planned").length;
    for (const k of playerKPI(s.players, s.matches)) {
      if (k.apps < 3 || k.min < 180) continue;
      const share = games ? Math.min(1, k.min / (games * 90)) : 0;
      const per90 = (k.pts / k.min) * 90;
      const ga90 = k.pos === "TW" ? (k.ga / k.min) * 90 : null;
      const perf = ga90 != null ? Math.max(0, 1 - ga90 / 3) : Math.min(1, per90 / 1.2);
      out.push({
        ...k,
        teamId: s.team.id,
        teamLabel: s.team.label,
        level: s.team.level,
        share,
        per90,
        ga90,
        score: Math.round((perf * 0.5 + share * 0.5) * 100),
      });
    }
  }
  return out.sort((a, b) => b.score - a.score || b.min - a.min);
}
