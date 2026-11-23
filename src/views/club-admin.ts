// Einstellungen → Mannschaft: Verein verwalten (Mannschaften, Trainer) oder ein Vereins-Abo starten.
import { refreshAdmin } from "../auth";
import { loadClub, teamLabel } from "../club";
import { sb } from "../db";
import { PRICE } from "../domain/club";
import { S, ctx, teamUrl } from "../state";
import { $, $$, esc, slug } from "../util";
import { render } from "./app";

let trainers: { team_id: string; email: string }[] = [];

async function refresh(): Promise<void> {
  const {
    data: { session },
  } = await sb.auth.getSession();
  await refreshAdmin(session);
  await loadClub();
  await loadTrainers();
  render();
}

async function loadTrainers(): Promise<void> {
  const ids = S.clubTeams.length ? S.clubTeams.map(t => t.id) : [ctx.team ?? ""];
  const { data } = await sb.from("team_trainers").select("team_id,email").in("team_id", ids);
  trainers = data || [];
}

const msg = (t: string) => ($("clubMsg").textContent = t);

/** Inhalt je nach Rolle: Vereins-Admin, Besitzer einer Einzel-Mannschaft oder Trainer. */
export function renderClubAdmin(): void {
  const me = S.myTeam;
  const box = $("clubBox");
  if (!me) return void (box.innerHTML = "");
  if (me.role === "trainer") {
    box.innerHTML = `<div class="h" style="margin-top:18px"><h2>Verein</h2></div><p class="small muted">Du bist als Trainer dieser Mannschaft eingetragen. Abo und Vereinsverwaltung macht der Vereins-Admin.</p>`;
    return;
  }
  if (me.role === "club" && S.club) return renderClub(box);
  const clubs = S.myClubs;
  box.innerHTML = `<div class="h" style="margin-top:18px"><h2>Vereins-Abo</h2></div>
    <p class="small muted" style="margin-top:0">Mehrere Mannschaften eines Vereins in einem Abo: CHF ${PRICE.club} pro Saison für bis zu ${PRICE.clubTeams} Mannschaften.
    Oben erscheint dann eine Auswahl der Mannschaften, pro Mannschaft kann ein Trainer bearbeiten, und du siehst, wen man hochziehen kann.</p>
    ${
      clubs.length
        ? `<div class="row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label for="cbPick" style="flex:1">Verein<select id="cbPick">${clubs
            .map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
            .join(
              "",
            )}</select></label><button class="btn hot" type="button" id="cbAttach">Diese Mannschaft anschliessen</button></div>`
        : `<div class="grid"><label for="cbName">Vereinsname<input id="cbName" value="${esc(S.meta.club || "")}"></label>
           <label for="cbLabel">Diese Mannschaft heisst<input id="cbLabel" value="${esc(S.meta.team || "1. Mannschaft")}"></label></div>
           <button class="btn hot" type="button" id="cbCreate">Verein erstellen und diese Mannschaft anschliessen</button>`
    }
    <p class="status" id="clubMsg" role="status"></p>`;
  if (clubs.length)
    $("cbAttach").onclick = async () => {
      const { error } = await sb.rpc("attach_team", {
        p_team: ctx.team,
        p_club: $("cbPick").value,
        p_label: S.meta.team || "1. Mannschaft",
      });
      if (error) return msg(error.message);
      await refresh();
    };
  else
    $("cbCreate").onclick = async () => {
      const name = $("cbName").value.trim(),
        id = slug(name).slice(0, 40);
      $("cbCreate").disabled = true;
      const e1 = (await sb.rpc("create_club", { p_id: id, p_name: name })).error;
      const e2 =
        e1 || (await sb.rpc("attach_team", { p_team: ctx.team, p_club: id, p_label: $("cbLabel").value })).error;
      $("cbCreate").disabled = false;
      if (e2) return msg(e2.message);
      await refresh();
    };
}

function renderClub(box: HTMLElement): void {
  const club = S.club!;
  const n = S.clubTeams.length;
  box.innerHTML = `<div class="h" style="margin-top:18px"><h2>Verein ${esc(club.name)}</h2><span class="small muted">${n} von ${PRICE.clubTeams} Mannschaften im Abo</span></div>
    <div class="list">${S.clubTeams
      .map(t => {
        const tr = trainers.filter(x => x.team_id === t.id);
        return `<div class="li" style="flex-wrap:wrap;gap:8px">
          <a href="${esc(teamUrl(t.id))}#einstellungen" style="color:inherit"><b>${esc(teamLabel(t))}</b></a>
          <span class="small muted">${t.id === ctx.team ? "geöffnet" : ""}</span>
          <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${tr.map(x => `<span class="chip">${esc(x.email)} <button type="button" class="btn sm" data-rmt="${esc(t.id)}|${esc(x.email)}" aria-label="Trainer entfernen" style="padding:0 6px">✕</button></span>`).join("")}
            <input type="email" placeholder="Trainer-E-Mail" data-addt="${esc(t.id)}" style="width:190px;padding:6px 8px">
          </span></div>`;
      })
      .join("")}</div>
    <p class="small muted">Trainer melden sich mit dieser E-Mail an (Konto über «Admin-Login» → Passwort festlegen) und können nur ihre Mannschaft bearbeiten. Mit Enter speichern.</p>
    <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:8px">
      <label for="cbNew" style="flex:1">Mannschaft hinzufügen<input id="cbNew" placeholder="z. B. B-Junioren"></label>
      <button class="btn hot" type="button" id="cbAdd">Hinzufügen</button>
    </div>
    ${n >= PRICE.clubTeams ? `<p class="small muted">Ab der ${PRICE.clubTeams + 1}. Mannschaft kostet jede weitere CHF ${PRICE.extraTeam} pro Saison.</p>` : ""}
    <p class="status" id="clubMsg" role="status"></p>`;
  $("cbAdd").onclick = async () => {
    const label = $("cbNew").value.trim();
    if (label.length < 2) return msg("Bitte die Mannschaft angeben, z. B. «B-Junioren».");
    const id = `${club.id}-${slug(label)}`.slice(0, 40).replace(/-+$/, "");
    const { error } = await sb.rpc("create_club_team", { p_club: club.id, p_id: id, p_label: label });
    if (error) return msg(error.message);
    await refresh();
    msg(`«${label}» angelegt.`);
  };
  $$<HTMLInputElement>("[data-addt]", box).forEach(
    inp =>
      (inp.onkeydown = async (e: KeyboardEvent) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const email = inp.value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg("Bitte eine gültige E-Mail eingeben.");
        const { error } = await sb.from("team_trainers").insert({ team_id: inp.dataset.addt, email });
        if (error) return msg(/duplicate/i.test(error.message) ? "Diese E-Mail ist schon eingetragen." : error.message);
        await loadTrainers();
        renderClubAdmin();
      }),
  );
  $$("[data-rmt]", box).forEach(
    b =>
      (b.onclick = async () => {
        const [team_id, email] = (b.dataset.rmt ?? "").split("|");
        const { error } = await sb.from("team_trainers").delete().eq("team_id", team_id).eq("email", email);
        if (error) return msg(error.message);
        await loadTrainers();
        renderClubAdmin();
      }),
  );
}

/** Beim ersten Öffnen der Einstellungen die Trainer laden. */
export async function initClubAdmin(): Promise<void> {
  if (S.myTeam && S.myTeam.role !== "trainer") await loadTrainers();
  renderClubAdmin();
}
