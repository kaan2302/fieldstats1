import { autoOppText, byDate, nextMatch, oppNames, oppStats, played } from "../domain";
import { $, $$, esc, fmtD, norm } from "../util";
import { del } from "../db";
import { S } from "../state";
import { minuteChart } from "../charts";
import { kpi as kpiBase } from "../ui";

/** Tab «Gegner». */
export function renderOpp(): void {
  renderAnalysesAdmin();
  const names = oppNames(),
    sel = $("oppSel"),
    cur = sel.value,
    nx = nextMatch();
  sel.innerHTML = names.length
    ? names
        .map(
          n =>
            `<option value="${esc(n)}">${esc(n)}${nx && norm(nx.opp) === norm(n) ? " · nächster Gegner" : ""}</option>`,
        )
        .join("")
    : `<option value="">Noch keine Gegner</option>`;
  sel.value = names.includes(cur) ? cur : (nx && names.find(n => norm(n) === norm(nx.opp))) || names[0] || "";
  const name = sel.value;
  if (!name) {
    $("oppBody").innerHTML =
      `<p class="muted">Sobald Spiele oder eine Tabelle erfasst sind, kannst du hier jeden Gegner analysieren.</p>`;
    return;
  }
  const k = oppStats(name),
    row = (S.table?.rows || []).find(r => norm(r.team) === norm(name)),
    an = S.analyses.find(a => norm(a.opp) === norm(name));
  const vs = S.matches.filter(m => norm(m.opp) === norm(name)).sort(byDate);
  const trend =
    k.ppgLast != null && k.ppgBefore != null
      ? k.ppgLast - k.ppgBefore > 0.3
        ? "steigend ▲"
        : k.ppgLast - k.ppgBefore < -0.3
          ? "fallend ▼"
          : "stabil ●"
      : "–";
  const kpi = (v: string | number, l: string, s?: string) => kpiBase(v, l, s, 24);
  $("oppBody").innerHTML = `
    <div class="kpis">${kpi(row ? row.rank + "." : "–", "Tabelle", row ? `${row.pts} Pkt aus ${row.sp} Spielen` : "")}
      ${kpi(k.n ? `${k.S}-${k.U}-${k.N}` : "–", "S-U-N", `${k.n} erfasste Spiele`)}
      ${kpi(k.n ? (k.gf / k.n).toFixed(1) : "–", "Tore / Spiel", k.n ? `Gegentore ${(k.ga / k.n).toFixed(1)}` : "")}
      ${kpi(trend, "Trend", k.ppgLast != null ? `letzte 5: ${k.ppgLast.toFixed(2)} Pkt/Spiel` : "")}
      ${kpi(k.home.n ? (k.home.pts / k.home.n).toFixed(1) : "–", "Pkt/Spiel heim", `auswärts ${k.away.n ? (k.away.pts / k.away.n).toFixed(1) : "–"}`)}</div>
    <div class="h" style="margin:12px 0 6px"><h3 style="margin:0">Form</h3><span>${k.form.map(r => `<span class="dot ${r}">${r}</span>`).join(" ") || "<span class='muted small'>–</span>"}</span></div>
    <div class="two" style="margin-top:6px"><div><h3>Wann fallen ihre Tore?</h3>${minuteChart(k.forB, k.agB, "Tore " + name, "Gegentore " + name)}
      ${k.withMinutes < k.n ? `<p class="small muted">Spielminuten aus ${k.withMinutes} von ${k.n} Spielen. Mehr Spielberichte importieren macht das genauer.</p>` : ""}</div>
      <div><h3>Wer trifft?</h3>${k.scorers.length ? `<div class="list">${k.scorers.map(([w, c]) => `<div class="li"><b>${esc(w)}</b><span class="n">${c}</span></div>`).join("")}</div>` : `<p class="small muted">Noch keine Torschützen erfasst.</p>`}
      ${vs.length ? `<h3 style="margin-top:12px">Gegen uns</h3><div class="list">${vs.map(m => `<div class="li"><span class="small muted">${fmtD(m.date)}</span><b>${m.home ? "Heim" : "Auswärts"}</b><span class="n" style="font-size:16px">${played(m) ? `${m.gf}:${m.ga}` : "geplant"}</span></div>`).join("")}</div>` : ""}</div></div>
    <h3 style="margin-top:14px">Analyse</h3>
    <div class="ai">${esc(autoOppText(name)) || "Noch zu wenige Daten."}</div>
    ${an ? `<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Ausführliche KI-Analyse vom ${fmtD(an.at.slice(0, 10))}</summary><div class="ai" style="margin-top:6px">${esc(an.text)}</div></details>` : ""}`;
}

export function initOpp() {
  $("oppSel").onchange = renderOpp;
}

/** Liste der gespeicherten KI-Analysen (nur Admin, z. B. aus Claude Code für das eigene Team). */
function renderAnalysesAdmin(): void {
  $("aPanel").hidden = !(S.admin && S.analyses.length);
  if ($("aPanel").hidden) return;
  $("aList").innerHTML = S.analyses.length
    ? S.analyses
        .sort((a, b) => b.at.localeCompare(a.at))
        .map(
          a =>
            `<div class="li"><b>${esc(a.opp)}</b><span class="small muted">${fmtD(a.at.slice(0, 10))}</span><button class="btn sm danger" type="button" data-ad="${esc(a.id)}" style="margin-left:auto">Löschen</button></div>`,
        )
        .join("")
    : "";
  $$("[data-ad]", $("aList")).forEach(
    b =>
      (b.onclick = async () => {
        try {
          await del("analyses", b.dataset.ad ?? "");
        } catch (e) {
          b.textContent = "Fehler";
        }
      }),
  );
}
