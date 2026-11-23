import { $, $$, esc, slug } from "../util";
import { QS, S, teamUrl } from "../state";
import { sb } from "../db";
import { PRICE } from "../domain/club";

export function renderLanding() {
  document.querySelectorAll<HTMLElement>(".wrap > section").forEach(x => (x.hidden = x.id !== "v-landing"));
  $("v-landing").hidden = false;
  ["nextBar", "pastBar", "recbar"].forEach(id => ($(id).hidden = true));
  document.querySelector<HTMLElement>("nav")!.hidden = true;
  document.querySelector<HTMLElement>(".top")!.hidden = true;
  $("loading").textContent = "";
  document.querySelector<HTMLElement>("footer")!.hidden = true;
  if (QS.has("login")) lnMode("log");
  if (S.email) showMyTeams();
}
function lnMode(k: "reg" | "log"): void {
  $$("button", $("lnSeg")).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
  $("lnReg").hidden = k !== "reg";
  $("lnLog").hidden = k !== "log";
}
export async function showMyTeams() {
  lnMode("log");
  const ts = S.myTeams || [];
  if (ts.length === 1 && QS.has("login")) {
    location.href = teamUrl(ts[0].id) + "#start";
    return;
  }
  $("liTeams").innerHTML = ts.length
    ? `<p class="small muted" style="margin:6px 0">Angemeldet als ${esc(S.email)} – deine Teams:</p>` +
      ts
        .map(
          t =>
            `<a class="li" href="${esc(teamUrl(t.id))}#start" style="color:inherit;text-decoration:none"><b>${esc(t.name)}</b><span class="small muted">${esc(t.role === "trainer" ? "Trainer" : t.club_name ? "Verein " + t.club_name : t.id)}</span></a>`,
        )
        .join("")
    : `<p class="small muted">Angemeldet als ${esc(S.email)}. Noch kein Team – wechsle zu «Team erstellen».</p>`;
}

let kind: "team" | "club" = "team";
function setKind(k: "team" | "club"): void {
  kind = k;
  $$("button", $("rgKind")).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
  const club = k === "club";
  $("rgNameL").textContent = club ? "Vereinsname" : "Teamname";
  $("rgName").placeholder = club ? "z. B. FC Muster" : "z. B. FC Muster 2. Mannschaft";
  $("rgIdL").textContent = club ? "Vereins-Link" : "Team-Link";
  $("rgLabelW").hidden = !club;
  $("rgKindInfo").textContent = club
    ? `Alle Mannschaften des Vereins (bis ${PRICE.clubTeams}, jede weitere CHF ${PRICE.extraTeam}). Du bist Vereins-Admin und kannst pro Mannschaft einen Trainer eintragen.`
    : "Für eine einzelne Mannschaft. Du kannst sie später einem Vereins-Abo anschliessen.";
  $("rgName").dispatchEvent(new Event("input"));
}
/** Link der ersten Mannschaft im Verein, z. B. «fc-muster-1-mannschaft». */
const firstTeamId = (clubId: string) => `${clubId}-${slug($("rgLabel").value || "1")}`.slice(0, 40).replace(/-+$/, "");
const updUrl = () => {
  const id = $("rgId").value || "…";
  $("rgUrl").textContent = teamUrl(kind === "club" ? firstTeamId(id) : id);
};

export function initLanding() {
  $$("button", $("rgKind")).forEach(b => (b.onclick = () => setKind(b.dataset.k === "club" ? "club" : "team")));
  setKind("team");
  $$("button", $("lnSeg")).forEach(b => (b.onclick = () => lnMode(b.dataset.k === "log" ? "log" : "reg")));
  $("rgName").oninput = () => {
    if (!$("rgId").dataset.touched) $("rgId").value = slug($("rgName").value).slice(0, 40);
    updUrl();
  };
  $("rgLabel").oninput = updUrl;
  $("rgId").oninput = () => {
    $("rgId").dataset.touched = "1";
    $("rgId").value = $("rgId")
      .value.toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");
    updUrl();
  };
  $("lnReg").onsubmit = async (e: Event) => {
    e.preventDefault();
    const id = $("rgId").value.trim(),
      name = $("rgName").value.trim(),
      email = $("rgMail").value.trim(),
      password = $("rgPw").value;
    if (!/^[a-z0-9-]{3,40}$/.test(id)) {
      $("rgMsg").textContent = "Link: 3–40 Zeichen, nur a–z, 0–9 und -";
      return;
    }
    const label = $("rgLabel").value.trim();
    if (kind === "club" && label.length < 2) {
      $("rgMsg").textContent = "Bitte die erste Mannschaft angeben, z. B. «1. Mannschaft».";
      return;
    }
    const teamId = kind === "club" ? firstTeamId(id) : id;
    $("rgGo").disabled = true;
    $("rgMsg").textContent = "";
    const taken =
      kind === "club"
        ? (await sb.from("clubs").select("id").eq("id", id).maybeSingle()).data ||
          (await sb.from("teams").select("id").eq("id", teamId).maybeSingle()).data
        : (await sb.from("teams").select("id").eq("id", id).maybeSingle()).data;
    if (taken) {
      $("rgMsg").textContent = "Dieser Link ist schon vergeben.";
      $("rgGo").disabled = false;
      return;
    }
    const pending = kind === "club" ? { id: teamId, name, club: { id, name }, label } : { id, name };
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { pending_team: pending }, emailRedirectTo: teamUrl(teamId) },
    });
    $("rgGo").disabled = false;
    if (error) {
      $("rgMsg").textContent = /registered|exists/i.test(error.message)
        ? "Diese E-Mail hat schon ein Konto – bitte unter «Admin-Login» anmelden."
        : "Konto konnte nicht erstellt werden: " + error.message;
      return;
    }
    if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) {
      $("rgMsg").textContent =
        "Diese E-Mail hat schon ein Konto – bitte unter «Admin-Login» anmelden und dort ein Team erstellen.";
      return;
    }
    if (data.session) {
      const r =
        kind === "club"
          ? (await sb.rpc("create_club", { p_id: id, p_name: name })).error ||
            (await sb.rpc("create_club_team", { p_club: id, p_id: teamId, p_label: label })).error
          : (await sb.rpc("create_team", { p_id: id, p_name: name })).error;
      if (r) {
        $("rgMsg").textContent = r.message;
        return;
      }
      location.href = teamUrl(teamId) + "#einstellungen";
      return;
    }
    $("rgMsg").textContent =
      "Fast fertig: Wir haben dir eine E-Mail geschickt. Bestätige deine Adresse – danach öffnet sich dein Team.";
  };
  $("lnLog").onsubmit = async (e: Event) => {
    e.preventDefault();
    $("liGo").disabled = true;
    $("liMsg").textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email: $("liMail").value.trim(), password: $("liPw").value });
    $("liGo").disabled = false;
    if (error) {
      $("liMsg").textContent = /confirm/i.test(error.message)
        ? "Bitte zuerst die Bestätigungsmail öffnen."
        : "E-Mail oder Passwort falsch.";
      return;
    }
  };
}
