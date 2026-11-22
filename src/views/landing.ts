import { $, $$, esc, slug } from "../util";
import { QS, S, teamUrl } from "../state";
import { sb } from "../db";

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
            `<a class="li" href="${esc(teamUrl(t.id))}#start" style="color:inherit;text-decoration:none"><b>${esc(t.name)}</b><span class="small muted">${esc(t.id)}</span></a>`,
        )
        .join("")
    : `<p class="small muted">Angemeldet als ${esc(S.email)}. Noch kein Team – wechsle zu «Team erstellen».</p>`;
}

export function initLanding() {
  $$("button", $("lnSeg")).forEach(b => (b.onclick = () => lnMode(b.dataset.k === "log" ? "log" : "reg")));
  $("rgName").oninput = () => {
    if (!$("rgId").dataset.touched) $("rgId").value = slug($("rgName").value).slice(0, 40);
    $("rgUrl").textContent = teamUrl($("rgId").value || "…");
  };
  $("rgId").oninput = () => {
    $("rgId").dataset.touched = "1";
    $("rgId").value = $("rgId")
      .value.toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");
    $("rgUrl").textContent = teamUrl($("rgId").value || "…");
  };
  $("lnReg").onsubmit = async (e: Event) => {
    e.preventDefault();
    const id = $("rgId").value.trim(),
      name = $("rgName").value.trim(),
      email = $("rgMail").value.trim(),
      password = $("rgPw").value;
    if (!/^[a-z0-9-]{3,40}$/.test(id)) {
      $("rgMsg").textContent = "Team-Link: 3–40 Zeichen, nur a–z, 0–9 und -";
      return;
    }
    $("rgGo").disabled = true;
    $("rgMsg").textContent = "";
    const { data: ex } = await sb.from("teams").select("id").eq("id", id).maybeSingle();
    if (ex) {
      $("rgMsg").textContent = "Dieser Team-Link ist schon vergeben.";
      $("rgGo").disabled = false;
      return;
    }
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { pending_team: { id, name } }, emailRedirectTo: teamUrl(id) },
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
      const r = await sb.rpc("create_team", { p_id: id, p_name: name });
      if (r.error) {
        $("rgMsg").textContent = r.error.message;
        return;
      }
      location.href = teamUrl(id) + "#einstellungen";
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
