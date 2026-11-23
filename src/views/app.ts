// Gesamtdarstellung: Kopf, Navigation und alle Bereiche neu zeichnen.
import { teamLabel } from "../club";
import { isOurs, playerKPI, teamKPI } from "../domain";
import { canTrack, liveOpen } from "../live";
import { curSeason, seasonsList } from "../season";
import { S, ctx, teamUrl } from "../state";
import { $, esc, initials } from "../util";
import { renderGames } from "./games";
import { renderKader } from "./kader";
import { renderOpp } from "./opp";
import { renderSettings } from "./settings";
import { renderNextBar, renderStart, renderUs } from "./start";
import { renderStats } from "./stats";
import { renderClub } from "./club";

const VIEWS = [
  "start",
  "analyse",
  "kader",
  "statistiken",
  "spiele",
  "gegner",
  "verein",
  "einstellungen",
  "live",
] as const;
let liveShown = false;
/** Vereins-Übersicht nur für Admins/Trainer einer Mannschaft mit Verein (mind. 2 Mannschaften). */
const clubView = () => S.admin && S.clubTeams.length > 1;

export function render(): void {
  const meta = S.meta;
  $("title").textContent = meta.club || "Mannschaft";
  const multi = S.clubTeams.length > 1;
  $("teamSel").hidden = !multi;
  if (multi)
    $("teamSel").innerHTML = S.clubTeams
      .map(t => `<option value="${esc(t.id)}" ${t.id === ctx.team ? "selected" : ""}>${esc(teamLabel(t))}</option>`)
      .join("");
  $("subtitle").textContent =
    (multi ? [meta.league] : [meta.team, meta.league]).filter(Boolean).join(" · ") + (multi ? "" : " · Saison");
  $("seasonSel").innerHTML = seasonsList()
    .map(x => `<option ${x === S.season ? "selected" : ""}>${x}</option>`)
    .join("");

  const bar = $("pastBar");
  bar.hidden = S.season === curSeason() && !S.locked;
  if (S.locked)
    bar.innerHTML = `Die Testphase ist abgelaufen – Bearbeiten ist gesperrt. <a href="#einstellungen" style="color:var(--hot)">Abo abschliessen</a>`;
  else bar.textContent = `Du siehst die vergangene Saison ${S.season}.`;

  $("crest").innerHTML = meta.logo ? `<img src="${esc(meta.logo)}" alt="">` : esc(initials(meta.club || "SC"));
  $("navSet").hidden = !S.admin;
  $("navClub").hidden = !clubView();
  $("openLogin").hidden = S.admin;
  $("footClub").textContent = meta.club || "";

  const us = (S.table?.rows || []).find(r => isOurs(r.team));
  $("rankBox").hidden = !us;
  if (us) $("rankN").textContent = us.rank + ".";

  const pk = playerKPI(),
    tk = teamKPI();
  $("recbar").innerHTML =
    `${S.admin ? `<span class="chip" style="border-color:var(--gold)">Admin</span>` : ""}<span class="chip"><b>${tk.pts}</b> Punkte</span><span class="chip"><b>${tk.S}-${tk.U}-${tk.N}</b> S-U-N</span><span class="chip"><b>${tk.gf}:${tk.ga}</b> Tore</span>` +
    (tk.form.length
      ? `<span class="chip">Form ${tk.form.map(r => `<span class="dot ${r}">${r}</span>`).join("")}</span>`
      : "");

  renderStart(pk, tk);
  renderUs(pk, tk);
  renderNextBar();
  $("livePanel").hidden = !canTrack();
  renderKader(pk);
  renderStats(pk, tk);
  renderGames();
  renderOpp();
  if (S.admin) renderSettings();
  route();
}

/** Bereich aus dem Link (#start, #kader …) anzeigen. */
export function route(): void {
  if (ctx.landing) return;
  const v = (location.hash || "#start").slice(1).split("?")[0];
  const allowed = VIEWS.filter(
    x => (x !== "einstellungen" || S.admin) && (x !== "verein" || clubView()),
  ) as readonly string[];
  const view = allowed.includes(v) ? v : "start";
  VIEWS.forEach(x => ($("v-" + x).hidden = x !== view));
  if (view === "live" && !liveShown) {
    liveShown = true;
    liveOpen();
  }
  if (view !== "live") liveShown = false;
  if (view === "verein") void renderClub();
  document.querySelectorAll<HTMLElement>("nav a").forEach(a => {
    if (a.dataset.v === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

export function initApp(): void {
  $("teamSel").onchange = () => {
    location.href = teamUrl($("teamSel").value) + (location.hash || "#start");
  };
  document.querySelectorAll<HTMLElement>("[data-close]").forEach(b => (b.onclick = () => b.closest("dialog")?.close()));
  window.addEventListener("hashchange", route);
}
