import { S } from "../state";
import {
  KINDS,
  autoUsText,
  oppStats,
  vsStrength,
  res,
  goalKinds,
  load,
  phases,
  plural,
  byDate,
  deepUs,
  insights,
  isOurs,
  nextMatch,
  official,
  played,
  ppg,
  relCls,
  situation,
  type PlayerKPI,
  type TeamKPI,
} from "../domain";
import { $, esc, face, fmtD, norm, today } from "../util";
import type { Match } from "../types";
import { formChart, minuteChart, relBars, relGap } from "../charts";
import { canTrack, liveMin, liveScore } from "../live";
import { renderOpp } from "./opp";
import { kpi as kpiBase } from "../ui";

/** Tab «Analyse»: Kennzahlen, Torminuten, Einschätzung und Vertiefung. */
/** Auf-/zugeklappt merken (bleibt bei neuem Rendern und Neuladen erhalten). */
const OPEN_KEY = "analyseOpen";
const openState: Record<string, boolean> = (() => {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) || "{}");
  } catch {
    return {};
  }
})();
const fold = (key: string, title: string, info: string, body: string, small = false) =>
  `<details class="afold${small ? " sm" : ""}" data-fold="${key}" ${openState[key] ? "open" : ""}><summary><span class="t">${title}</span><span class="small muted">${info}</span></summary><div class="afold-b">${body}</div></details>`;

export function renderUs(pk: PlayerKPI[], tk: TeamKPI): void {
  const ms = S.matches.filter(m => played(m) && official(m)).sort(byDate);
  if (!ms.length) {
    $("usInfo").textContent = "";
    $("usBody").innerHTML = `<p class="muted">Erscheint nach dem ersten gespielten Spiel.</p>`;
    return;
  }
  const row = (S.table?.rows || []).find(r => isOurs(r.team));
  $("usInfo").textContent = row ? `${row.rank}. Platz · ${row.pts} Punkte` : "";
  const an = S.analyses.find(a => isOurs(a.opp));
  const text =
    `<div style="white-space:pre-wrap;line-height:1.5">${esc(autoUsText())}</div>` +
    (an
      ? `<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Ausführliche KI-Analyse vom ${fmtD(String(an.at).slice(0, 10))}</summary><div style="white-space:pre-wrap;line-height:1.5;margin-top:6px">${esc(an.text)}</div></details>`
      : "");
  $("usBody").innerHTML =
    renderTiles(pk, tk, ms) +
    fold("text", "Text-Analyse", "Einschätzung in Worten", text, true) +
    fold("simple", "Einfache Analyse", "Resultate · Restprogramm · Torschützen · Gegnerstärke", renderSimple(pk, ms)) +
    fold("detail", "Detaillierte Analyse", "Torart · Phasen · Einsätze · wer macht den Unterschied", renderDetail(ms));
  ($("usBody") as HTMLElement).querySelectorAll<HTMLDetailsElement>("details[data-fold]").forEach(
    d =>
      (d.ontoggle = () => {
        openState[d.dataset.fold ?? ""] = d.open;
        try {
          localStorage.setItem(OPEN_KEY, JSON.stringify(openState));
        } catch {}
      }),
  );
}

/** Kacheln oben (immer sichtbar). */
function renderTiles(pk: PlayerKPI[], tk: TeamKPI, ms: Match[]): string {
  const pl = ppg(ms.slice(-5)),
    pb = ppg(ms.slice(0, -5)),
    trend = pl != null && pb != null ? (pl - pb > 0.3 ? "steigend ▲" : pl - pb < -0.3 ? "fallend ▼" : "stabil ●") : "–";
  const pp = (x: { n: number; pts: number }) => (x.n ? (x.pts / x.n).toFixed(2) : "–");
  const nx = nextMatch(),
    no = nx ? oppStats(nx.opp) : null;
  const top = pk
    .filter(p => p.g > 0)
    .sort((a, b) => b.g - a.g)
    .slice(0, 3);
  const kpi = (v: string, l: string, x?: string) => kpiBase(v, l, x, 24);
  return `<div class="kpis">
      ${kpi(tk.form.map(r => `<span class="dot ${r}">${r}</span>`).join(""), "Form letzte 5", `${pl != null ? pl.toFixed(2) : "–"} Pkt/Spiel · vorher ${pb != null ? pb.toFixed(2) : "–"}`)}
      ${kpi(trend, "Trend", SP(tk.n))}
      ${kpi(`${pp(tk.home)} / ${pp(tk.away)}`, "Pkt. pro Spiel<br>Heim / Ausw.", `${tk.home.pts} Pkt Heim · ${tk.away.pts} Pkt Ausw.`)}
      ${kpi(`${(tk.gf / tk.n).toFixed(1)} : ${(tk.ga / tk.n).toFixed(1)}`, "Tore / Gegentore pro Spiel", `${tk.cs} × zu null`)}
      ${kpi(
        top.length ? esc(top[0].name) + " " + top[0].g : "–",
        "Bester Torschütze",
        top
          .slice(1)
          .map(p => esc(p.name) + " " + p.g)
          .join(" · "),
      )}
      ${nx && no ? kpi(esc(nx.opp), "Nächster Gegner", `${fmtD(nx.date)} · Form ${no.form.join("") || "–"}`) : ""}
    </div>`;
}
const sub = (t: string) => `<span style="text-transform:none;letter-spacing:0">· ${t}</span>`;
const unit = (t: string) => `<small class="muted" style="font:700 11px var(--body)"> ${t}</small>`;
const note = (t: string) => `<p class="small muted" style="margin:6px 2px 0">${t}</p>`;
const f2 = (v: number | null | undefined) => (v == null ? "–" : v.toFixed(2));
const sign = (v: number) => (v > 0 ? "+" : "") + v.toFixed(2);

const SP = (n: number) => plural(n, "Spiel", "Spiele");
const grid = (cards: string[]) =>
  `<div class="acards">${cards
    .filter(Boolean)
    .map(c => `<div class="acard">${c}</div>`)
    .join("")}</div>`;

/** Einfache Analyse: reicht mit Resultaten, Torschützen und Vorlagen. */
function renderSimple(pk: PlayerKPI[], ms: Match[]): string {
  // Resultate
  const last = [...ms].reverse().slice(0, 8);
  const results = `<h3>Resultate ${sub("die letzten Spiele")}</h3><div class="list">${last
    .map(m => {
      const r = res(m);
      return `<div class="li"><span class="dot ${r}">${r}</span><b>${m.home ? "" : "@ "}${esc(m.opp)}</b><span class="small muted">${fmtD(m.date)}</span><span class="n">${m.gf}:${m.ga}</span></div>`;
    })
    .join("")}</div>`;

  // Torschützen & Vorlagen
  const sc = pk
    .filter(p => p.pts > 0)
    .sort((a, b) => b.pts - a.pts || b.g - a.g)
    .slice(0, 8);
  const scorers = `<h3>Torschützen &amp; Vorlagen</h3>${
    sc.length
      ? `<div class="scroll"><table><thead><tr><th class="l">Spieler</th><th>Tore</th><th>Vorl.</th><th>Scorer</th></tr></thead><tbody>${sc
          .map(
            p =>
              `<tr><td class="l">${esc(p.name)}</td><td>${p.g}</td><td>${p.a}</td><td><strong>${p.pts}</strong></td></tr>`,
          )
          .join("")}</tbody></table></div>`
      : note("Noch keine Torschützen erfasst.")
  }`;

  // Restprogramm
  const d = deepUs();
  const mode = situation()?.mode;
  const rest = `<h3>Restprogramm ${mode === "ab" ? "&amp; Ligaerhalt" : mode === "auf" ? "&amp; Aufstieg" : "&amp; Tabellennachbarn"}</h3>${
    d.bottom.length
      ? `<div class="scroll"><table><thead><tr><th class="l">Team</th><th>Pkt</th><th>Übrig</th><th data-tip="Punkte pro Spiel der restlichen Gegner">Gegner</th><th data-tip="Punkte am Saisonende bei gleichem Schnitt">Prognose</th></tr></thead><tbody>${d.bottom.map(x => `<tr class="${isOurs(x.r.team) ? "us" : ""} ${relCls(x.r)}"><td class="l">${x.r.rank}. ${esc(x.r.team)}</td><td><strong>${x.r.pts}</strong></td><td>${x.left}</td><td>${f2(x.str)}</td><td>${x.proj}</td></tr>`).join("")}</tbody></table></div>${relGap()}`
      : note("Braucht eine Tabelle (Einstellungen → Tabelle &amp; Resultate).")
  }`;

  // Bilanz nach Gegnerstärke
  const vs = vsStrength(ms, S.table?.rows || [], isOurs);
  const low = vs.find(g => g.key === "unten");
  const strength = `<h3>Bilanz nach Gegnerstärke ${sub("aktueller Tabellenplatz")}</h3>${
    vs.length
      ? `<div class="list">${vs
          .map(
            g =>
              `<div class="li"><b>${g.label}</b><span class="small muted">${g.n ? `${SP(g.n)} · ${g.S}-${g.U}-${g.N} · Tore ${g.gf}:${g.ga}` : "noch keine Spiele"}</span><span class="n">${f2(g.ppg)}${unit("Pkt/Sp.")}</span></div>`,
          )
          .join("")}</div>${
          low && low.n >= 2 && low.ppg != null && low.ppg < 1.5
            ? note("Gegen die unteren Teams fehlen Punkte – das sind die Spiele, die man holen muss.")
            : ""
        }`
      : note("Braucht eine Tabelle.")
  }`;

  return grid([results, rest, scorers, strength]);
}

/** Detaillierte Analyse: braucht Torminuten, Torart und Einsätze (Live-Modus oder «Spiel bearbeiten»). */
function renderDetail(ms: Match[]): string {
  const ph = phases(ms),
    ld = load(S.players, S.matches),
    gk = goalKinds(ms),
    d = deepUs(),
    maxD = Math.max(0.01, ...d.imp.slice(0, 5).map(x => Math.abs(x.d)));

  // Torart und Gegentor-Art
  const known = (c: typeof gk.ours) => c.standard + c.penalty + c.konter + c.spiel;
  const cell = (c: typeof gk.ours, k: (typeof KINDS)[number]["k"], color: string) => {
    const tot = known(c),
      n = c[k],
      pct = tot ? Math.round((n / tot) * 100) : 0;
    return `<td><div style="display:flex;align-items:center;gap:8px;justify-content:flex-end"><span class="small muted">${n ? pct + " %" : ""}</span><strong>${n}</strong><span style="display:inline-block;width:60px;height:6px;border-radius:3px;background:var(--panel2);overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:var(--${color})"></i></span></div></td>`;
  };
  const setShare = known(gk.theirs) >= 5 ? (gk.theirs.standard + gk.theirs.penalty) / known(gk.theirs) : 0;
  const kinds = `<h3>Tor- und Gegentor-Art</h3>${
    known(gk.ours) + known(gk.theirs)
      ? `<div class="scroll"><table><thead><tr><th class="l">Torart</th><th>Unsere Tore</th><th>Gegentore</th></tr></thead><tbody>${KINDS.map(x => `<tr><td class="l">${x.label}</td>${cell(gk.ours, x.k, "win")}${cell(gk.theirs, x.k, "loss")}</tr>`).join("")}</tbody></table></div>${note(
          [
            setShare >= 0.35
              ? `${Math.round(setShare * 100)} % der Gegentore nach Standards oder Penalty – Standards trainieren.`
              : "",
            known(gk.theirs) >= 5 && gk.theirs.konter / known(gk.theirs) >= 0.3
              ? "Viele Gegentore nach Kontern – Absicherung prüfen."
              : "",
            `Erfasst bei ${known(gk.ours)} von ${gk.ours.total - gk.ours.og} Toren und ${known(gk.theirs)} von ${gk.theirs.total} Gegentoren.`,
          ]
            .filter(Boolean)
            .join(" "),
        )}`
      : note(
          "Noch keine Torarten erfasst. Im Live-Modus beim Tor die Torart antippen oder unter «Spiel bearbeiten» nachtragen.",
        )
  }`;

  // Gefährlichste Phasen
  const phase = `<h3>Gefährlichste Phasen ${sub("Tore je 15 Minuten")}</h3>${
    ph.n
      ? `${minuteChart(ph.gf, ph.ga, "Unsere Tore", "Gegentore")}${note(
          [
            ph.worst >= 0
              ? `Die meisten Gegentore fallen in den Minuten ${ph.labels[ph.worst]} (${ph.ga[ph.worst]}).`
              : "",
            ph.lateShare != null && ph.lateShare >= 0.3
              ? `${Math.round(ph.lateShare * 100)} % der Gegentore ab der 76. Minute – Fitness und Wechsel prüfen.`
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        )}`
      : note("Braucht Torminuten.")
  }`;

  // Viel und wenig Einsatz
  const lr = (r: (typeof ld.heavy)[number], info: string, val: string) =>
    `<div class="li"><span class="face">${face(r.p)}</span><b>${esc(r.p.name)}</b><span class="small muted">${info}</span><span class="n" style="font-size:15px">${val}</span></div>`;
  const heavy = `<h3>Viel Einsatz ${sub("Minuten der letzten 3 Spiele")}</h3>${
    ld.heavy.length
      ? `<div class="list">${ld.heavy
          .slice(0, 6)
          .map(r => lr(r, esc(r.p.pos || ""), `${r.last3}${unit("/ 270")}`))
          .join("")}</div>${note("Über 240 von 270 Minuten – an Pause oder Wechsel denken.")}`
      : note(ld.games < 3 ? "Braucht erfasste Einsätze." : "Niemand mit über 240 Minuten in den letzten 3 Spielen.")
  }`;
  const none = ld.idle.filter(r => r.min === 0),
    few = ld.idle.filter(r => r.min > 0);
  const idle = `<h3>Wenig Einsatz ${sub("Spielpraxis oder Gespräch")}</h3>${
    few.length
      ? `<div class="list">${few
          .slice(0, 6)
          .map(r =>
            lr(
              r,
              r.idle >= 3 ? `seit ${SP(r.idle)} ohne Einsatz` : `${r.min} Min.`,
              `${Math.round(r.quote * 100)}${unit("%")}`,
            ),
          )
          .join("")}</div>`
      : ""
  }${none.length ? note(`Noch ohne Einsatz: ${none.map(r => esc(r.p.name)).join(", ")}.`) : ""}${
    ld.idle.length
      ? ""
      : note(ld.games < 4 ? "Braucht erfasste Einsätze (ab 4 Spielen)." : "Alle kommen regelmässig zum Einsatz.")
  }`;

  // Wer macht den Unterschied
  const diff = `<h3>Wer macht den Unterschied ${sub("Pkt/Spiel mit ihm in der Startelf minus ohne ihn")}</h3>${
    d.imp.length
      ? `<div class="list">${d.imp
          .slice(0, 5)
          .map(
            x =>
              `<div class="li"><span class="face">${face(x.p)}</span><div><b>${esc(x.p.name)}</b><div class="small muted">mit ${f2(x.on)} (${SP(x.n)}) · ohne ${f2(x.off)} (${SP(x.m)})</div></div><span class="n" style="font-size:15px;color:var(--${x.d >= 0 ? "win" : "loss"})">${sign(x.d)}</span></div><div class="div" style="margin:-2px 10px 4px"><i style="${x.d >= 0 ? `left:50%;width:${Math.min(50, (x.d / maxD) * 50)}%` : `right:50%;width:${Math.min(50, (-x.d / maxD) * 50)}%`};background:var(--${x.d >= 0 ? "win" : "loss"})"></i></div>`,
          )
          .join("")}</div>${note("Ab 3 Spielen mit und 3 ohne ihn. Unter 5 Spielen ein Hinweis, kein Beweis.")}`
      : note("Braucht die Startelf in mindestens 6 Spielen.")
  }`;

  return (
    note("Braucht Torminuten, Torart und Einsätze – im Live-Modus oder unter «Spiel bearbeiten» erfassen.") +
    // oben: Torart + Phasen links, «wer macht den Unterschied» rechts; unten: viel und wenig Einsatz nebeneinander
    `<div class="arow"><div>${kinds}${phase}</div><div>${diff}</div></div>` +
    `<div class="arow"><div>${heavy}</div><div>${idle}</div></div>`
  );
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
