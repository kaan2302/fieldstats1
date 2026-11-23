import { S } from "../state";
import {
  KINDS,
  goalKinds,
  halfTime,
  load,
  phases,
  plural,
  subTiming,
  vsStrength,
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
const sub = (t: string) => `<span style="text-transform:none;letter-spacing:0">· ${t}</span>`;
const row = (label: string, info: string, val: string, tip = "") =>
  `<div class="li"${tip ? ` data-tip="${esc(tip)}"` : ""}><b>${label}</b><span class="small muted">${info}</span><span class="n">${val}</span></div>`;
const unit = (t: string) => `<small class="muted" style="font:700 11px var(--body)"> ${t}</small>`;
const note = (t: string) => `<p class="small muted" style="margin:6px 2px 0">${t}</p>`;
const f2 = (v: number | null | undefined) => (v == null ? "–" : v.toFixed(2));
const sign = (v: number) => (v > 0 ? "+" : "") + v.toFixed(2);

function renderDeep(): string {
  const d = deepUs(),
    st = d.st,
    ms = S.matches.filter(m => played(m) && official(m)),
    ht = halfTime(ms),
    ph = phases(ms),
    vs = vsStrength(ms, S.table?.rows || [], isOurs),
    ld = load(S.players, S.matches),
    sb = subTiming(ms),
    maxD = Math.max(0.01, ...d.imp.slice(0, 5).map(x => Math.abs(x.d)));
  const SP = (n: number) => plural(n, "Spiel", "Spiele");
  const cards: string[] = [];

  // 1) Halbzeit-Bilanz
  cards.push(
    `<h3>Halbzeit-Bilanz ${sub(`${SP(ht.n)} mit Torminuten`)}</h3>${
      ht.n
        ? `<div class="list">
      ${row("Zur Pause geführt", SP(ht.aheadHT.n), ht.aheadHT.n ? `${ht.aheadHT.won} gewonnen` : "–", "Wie oft wir eine Pausenführung ins Ziel gebracht haben")}
      ${row("Zur Pause unentschieden", SP(ht.levelHT.n), ht.levelHT.n ? `${ht.levelHT.won} S · ${ht.levelHT.lost} N` : "–")}
      ${row("Zur Pause zurück", SP(ht.behindHT.n), ht.behindHT.n ? `${ht.behindHT.turned} gedreht` : "–", "Gedreht = nach Pausenrückstand noch Punkte geholt")}
      ${row("1. Halbzeit", `Tore ${ht.h1.gf}:${ht.h1.ga}`, `${ht.pts1}${unit("Pkt")}`, "Punkte, wenn nur die 1. Halbzeit zählen würde")}
      ${row("2. Halbzeit", `Tore ${ht.h2.gf}:${ht.h2.ga}`, `${ht.pts2}${unit("Pkt")}`, "Punkte, wenn nur die 2. Halbzeit zählen würde")}
    </div>${note(
      ht.pts2 > ht.pts1 + 2
        ? "Nach der Pause sind wir stärker – der Start ins Spiel ist das Thema."
        : ht.pts1 > ht.pts2 + 2
          ? "Vor der Pause sind wir stärker – nach der Pause bricht etwas weg (Fitness, Wechsel, Konzentration)."
          : "Beide Halbzeiten etwa gleich stark.",
    )}`
        : note("Braucht Spiele mit Torminuten.")
    }`,
  );

  // 2) Gefährliche Phasen
  cards.push(
    `<h3>Gefährliche Phasen ${sub("Tore je 15 Minuten")}</h3>${
      ph.n
        ? `${minuteChart(ph.gf, ph.ga, "Unsere Tore", "Gegentore")}${note(
            [
              ph.worst >= 0
                ? `Die meisten Gegentore fallen in den Minuten ${ph.labels[ph.worst]} (${ph.ga[ph.worst]}).`
                : "",
              ph.lateShare != null && ph.lateShare >= 0.3
                ? `${Math.round(ph.lateShare * 100)} % der Gegentore fallen ab der 76. Minute – Fitness und Wechsel prüfen.`
                : "",
              ph.best >= 0
                ? `Die meisten eigenen Tore fallen in den Minuten ${ph.labels[ph.best]} (${ph.gf[ph.best]}).`
                : "",
            ]
              .filter(Boolean)
              .join(" "),
          )}`
        : note("Braucht Spiele mit Torminuten.")
    }`,
  );

  // 10) Torarten
  const gk = goalKinds(ms);
  const known = (c: typeof gk.ours) => c.standard + c.penalty + c.konter + c.spiel;
  const cell = (c: typeof gk.ours, k: (typeof KINDS)[number]["k"], color: string) => {
    const tot = known(c),
      n = c[k],
      pct = tot ? Math.round((n / tot) * 100) : 0;
    return `<td><div style="display:flex;align-items:center;gap:8px;justify-content:flex-end"><span class="small muted">${n ? pct + " %" : ""}</span><strong>${n}</strong><span style="display:inline-block;width:60px;height:6px;border-radius:3px;background:var(--panel2);overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:var(--${color})"></i></span></div></td>`;
  };
  cards.push(
    `<h3>Torarten ${sub("Standard, Penalty, Konter, aus dem Spiel")}</h3>${
      known(gk.ours) + known(gk.theirs)
        ? `<div class="scroll"><table><thead><tr><th class="l">Torart</th><th>Unsere Tore</th><th>Gegentore</th></tr></thead><tbody>${KINDS.map(x => `<tr><td class="l">${x.label}</td>${cell(gk.ours, x.k, "win")}${cell(gk.theirs, x.k, "loss")}</tr>`).join("")}</tbody></table></div>${note(
            [
              (() => {
                const k = known(gk.theirs),
                  set = gk.theirs.standard + gk.theirs.penalty;
                return k >= 5 && set / k >= 0.35
                  ? `${Math.round((set / k) * 100)} % der Gegentore nach Standards oder Penalty – Standards trainieren.`
                  : "";
              })(),
              (() => {
                const k = known(gk.theirs);
                return k >= 5 && gk.theirs.konter / k >= 0.3
                  ? "Viele Gegentore nach Kontern – Absicherung bei eigenem Ballbesitz prüfen."
                  : "";
              })(),
              `Erfasst bei ${known(gk.ours)} von ${gk.ours.total - gk.ours.og} Toren und ${known(gk.theirs)} von ${gk.theirs.total} Gegentoren. Im Live-Modus oder unter «Spiel bearbeiten» nachtragen.`,
            ]
              .filter(Boolean)
              .join(" "),
          )}`
        : note(
            "Noch keine Torarten erfasst. Im Live-Modus beim Tor oder Gegentor die Torart antippen, oder unter «Spiel bearbeiten» nachtragen.",
          )
    }`,
  );

  // Spielstand & erstes Tor
  const pp = (t: { n: number; pts: number }) => (t.n ? (t.pts / t.n).toFixed(2) : "–");
  cards.push(`<h3>Spielstand &amp; erstes Tor ${sub(SP(d.full))}</h3><div class="list">
      ${row("Nach Rückstand geholt", SP(st.trail), `${st.trailPts}${unit("Pkt")}`)}
      ${row("Führung verspielt", SP(st.lead), `${st.leadLost}${unit("Pkt")}`, "Punkte, die nach einer Führung verloren gingen")}
      ${row("Wir treffen zuerst", SP(st.first.n), `${pp(st.first)}${unit("Pkt/Sp.")}`)}
      ${row("Gegner trifft zuerst", SP(st.firstAg.n), `${pp(st.firstAg)}${unit("Pkt/Sp.")}`)}
    </div>`);

  // 5) Gegnerstärke
  cards.push(
    `<h3>Bilanz nach Gegnerstärke ${sub("aktueller Tabellenplatz")}</h3>${
      vs.length
        ? `<div class="list">${vs
            .map(g =>
              row(
                g.label,
                g.n ? `${SP(g.n)} · ${g.S}-${g.U}-${g.N} · Tore ${g.gf}:${g.ga}` : "noch keine Spiele",
                `${f2(g.ppg)}${unit("Pkt/Sp.")}`,
              ),
            )
            .join("")}</div>${(() => {
            const best = [...vs].filter(g => g.n >= 2).sort((a, b) => (b.ppg ?? 0) - (a.ppg ?? 0))[0];
            const low = vs.find(g => g.key === "unten");
            return low && low.n >= 2 && low.ppg != null && low.ppg < 1.5
              ? note("Gegen die unteren Teams fehlen Punkte – das sind die Spiele, die man holen muss.")
              : best
                ? note(`Die meisten Punkte pro Spiel holen wir ${best.label.replace("Gegen", "gegen")}.`)
                : "";
          })()}`
        : note("Braucht eine Tabelle.")
    }`,
  );

  // Wer macht den Unterschied
  cards.push(
    `<h3>Wer macht den Unterschied ${sub("Pkt/Spiel mit ihm in der Startelf minus ohne ihn")}</h3>${
      d.imp.length
        ? `<div class="list">${d.imp
            .slice(0, 5)
            .map(
              x =>
                `<div class="li"><span class="face">${face(x.p)}</span><div><b>${esc(x.p.name)}</b><div class="small muted">mit ${f2(x.on)} (${SP(x.n)}) · ohne ${f2(x.off)} (${SP(x.m)})${x.m < 5 || x.n < 5 ? " · wenig Daten" : ""}</div></div><span class="n" style="font-size:15px;color:var(--${x.d >= 0 ? "win" : "loss"})">${sign(x.d)}</span></div><div class="div" style="margin:-2px 10px 4px"><i style="${x.d >= 0 ? `left:50%;width:${Math.min(50, (x.d / maxD) * 50)}%` : `right:50%;width:${Math.min(50, (-x.d / maxD) * 50)}%`};background:var(--${x.d >= 0 ? "win" : "loss"})"></i></div>`,
            )
            .join(
              "",
            )}</div>${note("Nur Spieler mit mindestens 3 Spielen mit und 3 ohne ihn. Unter 5 Spielen ist der Wert ein Hinweis, kein Beweis.")}`
        : note("Zu wenig Spiele mit erfasster Startelf.")
    }`,
  );

  // Duos
  const duoList = (xs: typeof d.defDuo, avg: number, better: "low" | "high") =>
    xs
      .map(x => {
        const good = better === "low" ? x.v < avg : x.v > avg;
        return `<div class="li"><b>${esc(sn(x.a))} + ${esc(sn(x.b))}</b><span class="small muted">${SP(x.n)}</span><span class="n" style="color:var(--${good ? "win" : "loss"})">${x.v.toFixed(1)}</span></div>`;
      })
      .join("");
  if (d.defDuo.length || d.offDuo.length)
    cards.push(`${d.defDuo.length ? `<h3>Abwehr-Duos ${sub(`Gegentore/Spiel · Team-Schnitt ${d.avgGa.toFixed(1)}`)}</h3><div class="list">${duoList(d.defDuo, d.avgGa, "low")}</div>` : ""}
      ${d.offDuo.length ? `<h3 style="margin-top:10px">Offensiv-Duos ${sub(`Tore/Spiel · Team-Schnitt ${d.avgGf.toFixed(1)}`)}</h3><div class="list">${duoList(d.offDuo, d.avgGf, "high")}</div>` : ""}
      ${note("Gemeinsam in der Startelf, ab 3 Spielen. Grün = besser als der Team-Schnitt.")}`);

  // 6) Belastung & Einsatzzeit
  const lr = (r: (typeof ld.heavy)[number], info: string, val: string) =>
    `<div class="li"><span class="face">${face(r.p)}</span><b>${esc(r.p.name)}</b><span class="small muted">${info}</span><span class="n" style="font-size:15px">${val}</span></div>`;
  cards.push(`<h3>Belastung &amp; Einsatzzeit ${sub(`${SP(ld.games)} mit Startelf`)}</h3>
    <div class="small muted" style="margin:2px 2px 6px;font-weight:700">Stark belastet · Minuten der letzten 3 Spiele</div>
    ${
      ld.heavy.length
        ? `<div class="list">${ld.heavy
            .slice(0, 6)
            .map(r => lr(r, esc(r.p.pos || ""), `${r.last3}${unit("/ 270")}`))
            .join("")}</div>`
        : note("Niemand mit über 240 Minuten in den letzten 3 Spielen.")
    }
    <div class="small muted" style="margin:12px 2px 6px;font-weight:700">Wenig Einsatz · Spielpraxis oder Gespräch</div>
    ${(() => {
      const none = ld.idle.filter(r => r.min === 0);
      return none.length ? note(`Noch ohne Einsatz in dieser Saison: ${none.map(r => esc(r.p.name)).join(", ")}.`) : "";
    })()}
    ${
      ld.idle.some(r => r.min > 0)
        ? `<div class="list">${ld.idle
            .filter(r => r.min > 0)
            .slice(0, 6)
            .map(r =>
              lr(
                r,
                r.idle >= 3 ? `seit ${SP(r.idle)} ohne Einsatz` : `${r.min} Min. in der Saison`,
                `${Math.round(r.quote * 100)}${unit("% Einsätze")}`,
              ),
            )
            .join("")}</div>`
        : ld.idle.length
          ? ""
          : note(ld.games < 4 ? "Ab 4 Spielen mit Startelf." : "Alle kommen regelmässig zum Einsatz.")
    }`);

  // 8) Wechsel
  cards.push(
    `<h3>Wechsel &amp; Joker ${sub(`${SP(sb.n)} mit Wechseln`)}</h3>${
      sb.n
        ? `<div class="list">
      ${row("1. Wechsel im Schnitt", "", `${sb.firstAvg}.${unit("Min.")}`)}
      ${row("Alle Wechsel im Schnitt", "", `${sb.allAvg}.${unit("Min.")}`)}
      ${row("Tordifferenz vor dem 1. Wechsel", `Tore ${sb.before.gf}:${sb.before.ga}`, `${sb.before.per90 == null ? "–" : sign(sb.before.per90)}${unit("/90")}`, "Tordifferenz hochgerechnet auf 90 Minuten")}
      ${row("Tordifferenz nach dem 1. Wechsel", `Tore ${sb.after.gf}:${sb.after.ga}`, `${sb.after.per90 == null ? "–" : sign(sb.after.per90)}${unit("/90")}`, "Tordifferenz hochgerechnet auf 90 Minuten")}
      ${row("Tore / Vorlagen von Eingewechselten", "", `${sb.subGoals} / ${sb.subAssists}`)}
    </div>${note(
      [
        sb.before.per90 != null && sb.after.per90 != null
          ? sb.after.per90 > sb.before.per90 + 0.3
            ? "Nach den Wechseln wird es besser – die Bank bringt etwas."
            : sb.after.per90 < sb.before.per90 - 0.3
              ? "Nach den Wechseln wird es schlechter – Zeitpunkt oder Wahl der Wechsel prüfen."
              : "Die Wechsel verändern das Spiel kaum."
          : "",
        sb.noSub ? `${SP(sb.noSub)} ohne erfasste Wechsel.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    )}`
        : note("Noch keine Spiele mit erfassten Wechseln.")
    }`,
  );

  // Restprogramm
  const mode = situation()?.mode;
  cards.push(
    `<h3>Restprogramm ${mode === "ab" ? "&amp; Ligaerhalt" : mode === "auf" ? "&amp; Aufstieg" : "&amp; Tabellennachbarn"}</h3>${
      d.bottom.length
        ? `<div class="scroll"><table><thead><tr><th class="l">Team</th><th>Pkt</th><th>Übrig</th><th data-tip="Punkte pro Spiel der restlichen Gegner">Gegner</th><th data-tip="Punkte am Saisonende bei gleichem Schnitt">Prognose</th></tr></thead><tbody>${d.bottom.map(x => `<tr class="${isOurs(x.r.team) ? "us" : ""} ${relCls(x.r)}"><td class="l">${x.r.rank}. ${esc(x.r.team)}</td><td><strong>${x.r.pts}</strong></td><td>${x.left}</td><td>${f2(x.str)}</td><td>${x.proj}</td></tr>`).join("")}</tbody></table></div>${relGap()}`
        : note("Braucht eine Tabelle.")
    }`,
  );

  return `<div class="acards" style="margin-top:14px">${cards.map(c => `<div class="acard">${c}</div>`).join("")}</div>`;
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
