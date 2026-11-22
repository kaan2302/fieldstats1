import { S } from "../state";
import {
  autoUsText,
  buckets,
  byDate,
  deepUs,
  insights,
  isOurs,
  nextMatch,
  official,
  oppStats,
  played,
  ppg,
  relCls,
  situation,
  type PlayerKPI,
  type TeamKPI,
} from "../domain";
import { $, esc, face, fmtD, norm, sn, today } from "../util";
import { formChart, minuteChart, relBars, relGap } from "../charts";
import { canTrack, liveMin, liveScore } from "../live";
import { renderOpp } from "./opp";
import { kpi as kpiBase } from "../ui";

/** Tab «Analyse»: Kennzahlen, Torminuten, Einschätzung und Vertiefung. */
export function renderUs(pk: PlayerKPI[], tk: TeamKPI): void {
  const ms = S.matches.filter(m => played(m) && official(m)).sort(byDate);
  if (!ms.length) {
    $("usInfo").textContent = "";
    $("usBody").innerHTML = `<p class="muted">Erscheint nach dem ersten gespielten Spiel.</p>`;
    return;
  }
  const pl = ppg(ms.slice(-5)),
    pb = ppg(ms.slice(0, -5)),
    trend = pl != null && pb != null ? (pl - pb > 0.3 ? "steigend ▲" : pl - pb < -0.3 ? "fallend ▼" : "stabil ●") : "–";
  const pp = (x: { n: number; pts: number }) => (x.n ? (x.pts / x.n).toFixed(2) : "–");
  const row = (S.table?.rows || []).find(r => isOurs(r.team));
  const nx = nextMatch(),
    no = nx ? oppStats(nx.opp) : null;
  const top = pk
    .filter(p => p.g > 0)
    .sort((a, b) => b.g - a.g)
    .slice(0, 3);
  const kpi = (v: string, l: string, s?: string) => kpiBase(v, l, s, 24);
  const an = S.analyses.find(a => isOurs(a.opp));
  $("usInfo").textContent = row ? `${row.rank}. Platz · ${row.pts} Punkte` : "";
  $("usBody").innerHTML = `<div class="kpis">
      ${kpi(tk.form.map(r => `<span class="dot ${r}">${r}</span>`).join(""), "Form letzte 5", `${pl != null ? pl.toFixed(2) : "–"} Pkt/Spiel · vorher ${pb != null ? pb.toFixed(2) : "–"}`)}
      ${kpi(trend, "Trend", `${tk.n} Spiele`)}
      ${kpi(`${pp(tk.home)} / ${pp(tk.away)}`, "Pkt/Spiel Heim / Ausw.", `${tk.home.pts} Pkt Heim · ${tk.away.pts} Pkt Ausw.`)}
      ${kpi(`${(tk.gf / tk.n).toFixed(1)} : ${(tk.ga / tk.n).toFixed(1)}`, "Tore / Gegentore pro Spiel", `${tk.cs} × zu null`)}
      ${kpi(
        top.length ? esc(sn(top[0])) + " " + top[0].g : "–",
        "Bester Torschütze",
        top
          .slice(1)
          .map(p => esc(sn(p)) + " " + p.g)
          .join(" · "),
      )}
      ${nx && no ? kpi(esc(nx.opp), "Nächster Gegner", `${fmtD(nx.date)} · Form ${no.form.join("") || "–"}`) : ""}
    </div>
    <div class="two" style="margin-top:12px">
      <div><h3>Wann fallen unsere Tore</h3>${minuteChart(buckets(ms.flatMap(m => (m.goals || []).map(g => g.min))), buckets(ms.flatMap(m => (m.against || []).map(g => g.min))), "Unsere Tore", "Gegentore")}</div>
      <div><h3>Einschätzung</h3><div style="white-space:pre-wrap;line-height:1.5">${esc(autoUsText())}</div>${an ? `<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Ausführliche KI-Analyse vom ${fmtD(String(an.at).slice(0, 10))}</summary><div style="white-space:pre-wrap;line-height:1.5;margin-top:6px">${esc(an.text)}</div></details>` : ""}</div>
    </div>${renderDeep()}`;
}
/** Spielstand, Spieler-Einfluss, Duos, Joker und Restprogramm. */
function renderDeep(): string {
  const d = deepUs(),
    st = d.st,
    maxD = Math.max(0.01, ...d.imp.slice(0, 5).map(x => Math.abs(x.d)));
  const f2 = (v: number | null) => (v == null ? "–" : v.toFixed(2));
  return `<div class="two" style="margin-top:14px">
    <div><h3>Spielstand &amp; erstes Tor</h3><div class="list">
      <div class="li"><b>Nach Rückstand</b><span class="small muted">${st.trail} Spiele</span><span class="n">${st.trailPts} Pkt</span></div>
      
      <div class="li"><b>Führung verspielt</b><span class="small muted">${st.lead} Spiele</span><span class="n">${st.leadLost} Pkt</span></div>
      
      <div class="li"><b>Wir treffen zuerst</b><span class="small muted">${st.first.n} Spiele</span><span class="n">${st.first.n ? (st.first.pts / st.first.n).toFixed(2) : "–"}<small class="muted" style="font:700 11px var(--body)"> Pkt/Sp.</small></span></div>
      <div class="li"><b>Gegner trifft zuerst</b><span class="small muted">${st.firstAg.n} Spiele</span><span class="n">${st.firstAg.n ? (st.firstAg.pts / st.firstAg.n).toFixed(2) : "–"}<small class="muted" style="font:700 11px var(--body)"> Pkt/Sp.</small></span></div>
    </div></div>
    <div><h3>Wer macht den Unterschied <span style="text-transform:none;letter-spacing:0">· Pkt/Spiel mit ihm minus ohne ihn</span></h3>${
      d.imp.length
        ? `<div class="list">${d.imp
            .slice(0, 5)
            .map(
              x =>
                `<div class="li"><span class="face">${face(x.p)}</span><div><b>${esc(x.p.name)}</b><div class="small muted">mit ${f2(x.on)} · ohne ${f2(x.off)} Pkt/Spiel</div></div><span class="n" style="font-size:15px;color:var(--${x.d >= 0 ? "win" : "loss"})">${x.d >= 0 ? "+" : ""}${x.d.toFixed(2)}</span></div><div class="div" style="margin:-2px 10px 4px" title="Unterschied Punkte pro Spiel"><i style="${x.d >= 0 ? `left:50%;width:${Math.min(50, (x.d / maxD) * 50)}%` : `right:50%;width:${Math.min(50, (-x.d / maxD) * 50)}%`};background:var(--${x.d >= 0 ? "win" : "loss"})"></i></div>`,
            )
            .join("")}</div>`
        : `<p class="small muted">Zu wenig Spiele mit Startelf.</p>`
    }
      ${d.defDuo.length ? `<h3 style="margin-top:10px">Bestes Abwehr-Duo <span style="text-transform:none;letter-spacing:0">· Gegentore/Spiel</span></h3><div class="list">${d.defDuo.map(x => `<div class="li"><b>${esc(sn(x.a))} + ${esc(sn(x.b))}</b><span class="small muted">${x.n} Spiele</span><span class="n">${x.v.toFixed(1)}</span></div>`).join("")}</div>` : ""}
      ${d.offDuo.length ? `<h3 style="margin-top:10px">Bestes Offensiv-Duo <span style="text-transform:none;letter-spacing:0">· Tore/Spiel</span></h3><div class="list">${d.offDuo.map(x => `<div class="li"><b>${esc(sn(x.a))} + ${esc(sn(x.b))}</b><span class="small muted">${x.n} Spiele</span><span class="n">${x.v.toFixed(1)}</span></div>`).join("")}</div>` : ""}
      </div>
  </div>
  <div class="two" style="margin-top:14px">
    <div><h3>Joker · Impact von der Bank</h3><div class="list"><div class="li"><b>Tore von Eingewechselten</b><span class="n">${d.subG.length}</span></div>
      <div class="li"><b>Vorlagen von Eingewechselten</b><span class="n">${d.subA.length}</span></div></div>
      ${d.noSub ? `<p class="small muted" style="margin-top:6px">${d.noSub} Spiele ohne erfasste Wechsel</p>` : ""}</div>
    <div><h3>Restprogramm ${(() => {
      const m = situation()?.mode;
      return m === "ab" ? "&amp; Ligaerhalt" : m === "auf" ? "&amp; Aufstieg" : "&amp; Tabellennachbarn";
    })()}</h3>${
      d.bottom.length
        ? `<div class="scroll"><table><thead><tr><th class="l">Team</th><th>Pkt</th><th>Übrig</th><th>Gegnerstärke</th><th>Prognose</th></tr></thead><tbody>${d.bottom.map(x => `<tr class="${isOurs(x.r.team) ? "us" : ""} ${relCls(x.r)}"><td class="l">${x.r.rank}. ${esc(x.r.team)}</td><td><strong>${x.r.pts}</strong></td><td>${x.left}</td><td>${f2(x.str)}</td><td>${x.proj}</td></tr>`).join("")}</tbody></table></div>
      ${relGap()}
      `
        : `<p class="small muted">Braucht eine Tabelle.</p>`
    }</div>
  </div>`;
}
/** Tab «Start»: kompakte Übersicht. */
export function renderStart(pk: PlayerKPI[], tk: TeamKPI): void {
  const row = (S.table?.rows || []).find(r => isOurs(r.team)),
    ms = S.matches.filter(m => played(m) && official(m)).sort(byDate);
  const sit = situation();
  const kpi = (v: string, l: string, s?: string) => kpiBase(v, l, s, 26);
  $("stInfo").textContent = "Saison " + S.season;
  if (!ms.length) {
    $("startBody").innerHTML = `<p class="muted">Erscheint nach dem ersten gespielten Spiel.</p>`;
    return;
  }
  $("startBody").innerHTML = `<div class="kpis">
      ${kpi(row ? row.rank + "." : "–", "Tabellenplatz", row ? `${row.pts} Punkte aus ${row.sp} Spielen` : "")}
      ${sit ? kpi(sit.kv + " Pkt", sit.kl, esc(sit.ks)) : ""}
      ${kpi(`<span style="display:inline-flex;gap:3px">${tk.form.map(r => `<span class="dot ${r}">${r}</span>`).join("")}</span>`, "Form letzte 5", `${tk.S}-${tk.U}-${tk.N} gesamt`)}
    </div>
    <div class="two" style="margin-top:12px">
      <div><h3>Formkurve</h3>${formChart(ms)}</div>
      ${sit && relBars() ? `<div><h3>${sit.title}</h3>${relBars()}</div>` : ""}
    </div>
    ${insights(pk).length ? `<h3 style="margin-top:14px">Das Wichtigste</h3>` : ""}
    <div class="list">${insights(pk)
      .map((t, i) => `<div class="insight"><span class="i">${i + 1}</span><span>${esc(t)}</span></div>`)
      .join("")}</div>`;
}
/** Leiste oben: laufendes Live-Spiel oder nächstes Spiel mit Countdown. */
export function renderNextBar(): void {
  const b = $("nextBar"),
    lv = S.live.find(x => ["h1", "ht", "h2"].includes(x.phase));
  b.classList.toggle("livebar", !!lv);
  if (lv) {
    b.hidden = false;
    const sc = liveScore(lv);
    b.innerHTML = `<div><div class="lb"><span class="dotlive"></span>Live · ${lv.home ? "Heim" : "Auswärts"}</div><b>${lv.home ? "vs." : "@"} ${esc(lv.opp)}</b></div><div class="cd"><b style="color:var(--ink)">${sc[0]}:${sc[1]}</b><div class="lb">${lv.phase === "ht" ? "Pause" : liveMin(lv) + "'"}</div></div>`;
    b.onclick = () => {
      location.hash = canTrack() ? "#live" : "#spiele";
    };
    return;
  }
  const nx = nextMatch();
  b.hidden = !nx;
  if (!nx) return;
  const days = Math.round((new Date(nx.date + "T12:00").getTime() - new Date(today() + "T12:00").getTime()) / 864e5);
  const cd = days <= 0 ? "Heute" : days === 1 ? "Morgen" : `${days}`;
  b.innerHTML = `<div><div class="lb">Nächstes Spiel · ${fmtD(nx.date)}${nx.time ? " · " + esc(nx.time) : ""} · ${nx.home ? "Heim" : "Auswärts"}</div><b>${nx.home ? "vs." : "@"} ${esc(nx.opp)}</b></div>
    <div class="cd">${days > 1 ? `<div class="lb">in</div><b>${cd}</b><div class="lb">Tagen</div>` : `<b>${cd}</b>`}</div>`;
  b.setAttribute("aria-label", `Nächstes Spiel ${nx.opp}, Gegner-Analyse öffnen`);
  b.onclick = () => {
    location.hash = "#gegner";
    const sel = $("oppSel") as HTMLSelectElement,
      o = [...sel.options].find(x => norm(x.value) === norm(nx.opp));
    if (o) {
      sel.value = o.value;
      renderOpp();
    }
  };
}
