// Anmeldung: wer ist Admin des aktuellen Teams, Login-Dialog, Abmelden.
import type { Session } from "@supabase/supabase-js";
import { loadAll, sb, showErr } from "./db";
import { S, ctx } from "./state";
import type { MyClub, MyTeam } from "./types";
import { isLocked } from "./domain/club";
import { $, today } from "./util";
import { render } from "./views/app";
import { renderLanding } from "./views/landing";

/** Nach der Registrierung vorgemerkt: Einzel-Mannschaft oder Verein mit erster Mannschaft. */
interface Pending {
  id: string;
  name: string;
  club?: { id: string; name: string };
  label?: string;
}

const fetchMine = async () => {
  S.myTeams = ((await sb.rpc("my_teams")).data as MyTeam[]) || [];
  S.myClubs = ((await sb.rpc("my_clubs")).data as MyClub[]) || [];
};

/** Eigene Mannschaften und Vereine laden; nach der Registrierung das Vorgemerkte anlegen. */
export async function refreshAdmin(session: Session | null): Promise<void> {
  S.email = session?.user?.email || null;
  S.myTeams = [];
  S.myClubs = [];
  if (session) {
    await fetchMine();
    const pend = session.user.user_metadata?.pending_team as Pending | null | undefined;
    if (pend && !S.myTeams.some(t => t.id === pend.id)) {
      const r = pend.club
        ? (await sb.rpc("create_club", { p_id: pend.club.id, p_name: pend.club.name })).error ||
          (await sb.rpc("create_club_team", { p_club: pend.club.id, p_id: pend.id, p_label: pend.label ?? "" })).error
        : (await sb.rpc("create_team", { p_id: pend.id, p_name: pend.name })).error;
      await sb.auth.updateUser({ data: { pending_team: null } });
      if (!r) await fetchMine();
    }
  }
  S.myTeam = S.myTeams.find(t => t.id === ctx.team) || null;
  S.admin = !!S.myTeam;
  S.locked = isLocked(S.myTeam, today());
}

export async function applySession(session: Session | null): Promise<void> {
  const was = S.admin;
  await refreshAdmin(session);
  if (ctx.landing) return renderLanding();
  if (was !== S.admin) loadAll().catch(showErr);
  else render();
}

export function initAuth(): void {
  $("openLogin").onclick = () => {
    $("lgMsg").textContent = "";
    $("login").showModal();
  };
  $("lgForm").onsubmit = async (e: Event) => {
    e.preventDefault();
    $("lgGo").disabled = true;
    $("lgMsg").textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email: $("lgMail").value.trim(), password: $("lgPw").value });
    $("lgGo").disabled = false;
    if (error) {
      $("lgMsg").textContent = /confirm/i.test(error.message)
        ? "Bitte zuerst die Bestätigungsmail öffnen."
        : "E-Mail oder Passwort falsch.";
      return;
    }
    const {
      data: { session },
    } = await sb.auth.getSession();
    await refreshAdmin(session);
    if (!S.admin) {
      $("lgMsg").textContent = "Angemeldet, aber dieses Konto ist nicht Admin von diesem Team.";
      return;
    }
    $("login").close();
  };
  $("logout").onclick = async () => {
    await sb.auth.signOut();
    location.hash = "#start";
  };
}
