// Anmeldung: wer ist Admin des aktuellen Teams, Login-Dialog, Abmelden.
import type { Session } from "@supabase/supabase-js";
import { loadAll, sb, showErr } from "./db";
import { S, ctx } from "./state";
import type { MyTeam } from "./types";
import { $, today } from "./util";
import { render } from "./views/app";
import { renderLanding } from "./views/landing";

/** Eigene Teams laden; nach der Registrierung das vorgemerkte Team anlegen. */
export async function refreshAdmin(session: Session | null): Promise<void> {
  S.email = session?.user?.email || null;
  S.myTeams = [];
  if (session) {
    const { data } = await sb.rpc("my_teams");
    S.myTeams = (data as MyTeam[]) || [];
    const pend = session.user.user_metadata?.pending_team as { id: string; name: string } | null | undefined;
    if (pend && !S.myTeams.some(t => t.id === pend.id)) {
      const { error } = await sb.rpc("create_team", { p_id: pend.id, p_name: pend.name });
      await sb.auth.updateUser({ data: { pending_team: null } });
      if (!error) S.myTeams = ((await sb.rpc("my_teams")).data as MyTeam[]) || [];
    }
  }
  S.myTeam = S.myTeams.find(t => t.id === ctx.team) || null;
  S.admin = !!S.myTeam;
  S.locked = !!S.myTeam && S.myTeam.plan !== "active" && S.myTeam.trial_until < today();
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
