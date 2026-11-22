import type { Player } from "../types";
import { $, $$, esc, face, fmtD, num, sn } from "../util";
import { render } from "./app";
import { S } from "../state";
import { LINE, POS_ORDER } from "../positions";
import { BL, buckets, byDate, played, playerKPI, res, type PlayerKPI } from "../domain";
import { openPEdit } from "./settings";

export let posFilter = "";
export let kView = (() => {
  try {
    return localStorage.getItem("kView") || "cards";
  } catch (e) {
    return "cards";
  }
})();
export function renderKader(pk: PlayerKPI[]): void {
  const segs = [
    ["", "Alle"],
    ["TOR", "Tor"],
    ["ABW", "Abwehr"],
    ["MIT", "Mittelfeld"],
    ["ANG", "Angriff"],
  ];
  $("posSeg").innerHTML = segs
    .map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${posFilter === k}">${l}</button>`)
    .join("");
  $$("button", $("posSeg")).forEach(
    b =>
      (b.onclick = () => {
        posFilter = b.dataset.f ?? "";
        render();
      }),
  );
  const yr = new Date().getFullYear(),
    ages = S.players.filter(p => p.year);
  $("kcount").textContent =
    `${S.players.length} Spieler · Ø Alter ${ages.length ? (ages.reduce((s, p) => s + (yr - num(p.year)), 0) / ages.length).toFixed(1) : "–"}`;
  const list = pk
    .filter(p => !posFilter || p.line === posFilter)
    .sort(
      (a, b) => (POS_ORDER[a.pos ?? ""] ?? 99) - (POS_ORDER[b.pos ?? ""] ?? 99) || num(a.nr || 99) - num(b.nr || 99),
    );
  $("viewSeg").innerHTML = [
    ["cards", "Karten"],
    ["list", "Liste"],
  ]
    .map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${kView === k}">${l}</button>`)
    .join("");
  $$("button", $("viewSeg")).forEach(
    b =>
      (b.onclick = () => {
        kView = b.dataset.k ?? "cards";
        try {
          localStorage.setItem("kView", kView);
        } catch (e) {}
        render();
      }),
  );
  $("cards").className = kView === "list" ? "list plist" : "cards";
  if (kView === "list" && list.length) {
    $("cards").innerHTML = list
      .map(
        p => `<button type="button" class="li pc-l ${p.line || "XXX"}" data-p="${esc(p.id)}"><span class="face">${face(p)}</span><span class="pos">${esc(p.pos || "–")}</span><div style="min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}${p.captain ? " ©" : ""}</b><span class="small muted">${p.nr ? "#" + p.nr : ""}</span></div>
      <span class="nums"><span>${p.apps}<small>Sp.</small></span><span>${p.min}<small>Min</small></span>${p.pos === "TW" ? `<span>${p.ga}<small>Gegent.</small></span><span>${p.cs}<small>Zu 0</small></span>` : `<span>${p.g}<small>Tore</small></span><span>${p.a}<small>Ass.</small></span>`}</span></button>`,
      )
      .join("");
    $$(".pc-l", $("cards")).forEach(b => (b.onclick = () => openProfile(b.dataset.p ?? "")));
    return;
  }
  $("cards").innerHTML = list.length
    ? list.map(card).join("")
    : `<p class="muted">Noch keine Spieler.${S.admin ? " Lege sie in den Einstellungen an." : ""}</p>`;
  $$(".pc", $("cards")).forEach(b => (b.onclick = () => openProfile(b.dataset.p ?? "")));
}
/** Spielerkarte im Kickbase-Stil. */
export function card(
  p: Player & { apps?: number; g?: number; a?: number; ga?: number; cs?: number; line?: string },
): string {
  return `<button type="button" class="pc ${p.line || LINE[p.pos ?? ""] || "XXX"}" data-p="${esc(p.id)}" aria-label="${esc(p.name)}, ${esc(p.pos || "")}">
    <div class="tp"><div><div class="nr">${p.nr ?? "–"}</div><div class="ps">${esc(p.pos || "–")}</div></div>${p.captain ? `<span class="badge">CAPTAIN</span>` : ""}</div>
    <div class="avatar">${face(p)}</div><div class="name">${esc(sn(p))}</div>
    <div class="st">${p.pos === "TW" ? `<div><b>${p.apps ?? 0}</b><span>Spiele</span></div><div><b>${p.ga ?? 0}</b><span>Gegent.</span></div><div><b>${p.cs ?? 0}</b><span>Zu null</span></div>` : `<div><b>${p.apps ?? 0}</b><span>Spiele</span></div><div><b>${p.g ?? 0}</b><span>Tore</span></div><div><b>${p.a ?? 0}</b><span>Assists</span></div>`}</div></button>`;
}
function profileExtra(p: PlayerKPI): string {
  const ms = S.matches.filter(m => played(m) && m.stats && Object.keys(m.stats).length).sort(byDate);
  if (!ms.length) return "";
  const W = 320,
    H = 80,
    n = ms.length,
    bw = W / n;
  const mins = ms.map(m => {
    const x = m.stats?.[p.id];
    return x && (x.start || x.sub) ? num(x.min) : 0;
  });
  const avg = p.apps ? p.min / p.apps : 0;
  let svg = `<svg viewBox="0 0 ${W} ${H + 14}" width="100%" role="img" aria-label="Einsatzminuten pro Spiel: ${mins.join(", ")}">`;
  ms.forEach((m, i) => {
    const v = mins[i],
      h = (v / 90) * H,
      st = m.stats?.[p.id]?.start;
    const tip = `${m.home ? "vs." : "@"} ${m.opp}: ${v ? v + " Min" : "nicht eingesetzt"}`;
    svg += `<rect data-tip="${esc(tip)}" x="${i * bw + 1}" y="0" width="${bw - 2}" height="${H}" fill="transparent"/><rect pointer-events="none" x="${i * bw + 2}" y="${H - Math.max(h, 2)}" width="${bw - 4}" height="${Math.max(h, 2)}" rx="3" fill="${v ? (st ? "var(--cyan)" : "var(--violet)") : "var(--line)"}"/>`;
  });
  if (avg)
    svg += `<line x1="0" x2="${W}" y1="${H - (avg / 90) * H}" y2="${H - (avg / 90) * H}" stroke="var(--gold)" stroke-dasharray="4 3"/>`;
  svg += `<text x="0" y="${H + 12}">Saisonstart</text><text x="${W}" y="${H + 12}" text-anchor="end">letztes Spiel</text></svg>`;
  const goalMins = S.matches.filter(played).flatMap(m => (m.goals || []).filter(g => g.who === p.id).map(g => g.min)),
    gb = buckets(goalMins);
  const team = playerKPI().filter(x => x.apps > 0),
    tm = team.reduce((s, x) => s + x.min, 0),
    ta = team.reduce((s, x) => s + x.apps, 0);
  const per90 = (v: number, m: number) => (m ? ((v / m) * 90).toFixed(2) : "–");
  const teamG = team.reduce((s, x) => s + x.g, 0),
    teamP = team.reduce((s, x) => s + x.pts, 0);
  const cmp = (l: string, a: string, b: string) =>
    `<tr><td>${l}</td><td><strong>${a}</strong></td><td class="muted">${b}</td></tr>`;
  return `<h3 style="margin-top:14px">Einsatzminuten pro Spiel</h3>${svg}
    <p class="small muted" style="margin:2px 0 0"><span style="color:var(--cyan)">■</span> Startelf · <span style="color:var(--violet)">■</span> eingewechselt</p>
    <div class="two" style="margin-top:10px">
      <div><h3>Vergleich mit dem Team</h3><table><thead><tr><th>Wert</th><th>Er</th><th>Team Ø</th></tr></thead><tbody>
        ${cmp("Minuten pro Einsatz", Math.round(avg) + "'", ta ? Math.round(tm / ta) + "'" : "–")}
        ${cmp("Tore pro 90 Min", per90(p.g, p.min), per90(teamG, tm))}
        ${cmp("Scorer pro 90 Min", per90(p.pts, p.min), per90(teamP, tm))}
        ${cmp("Einsatzquote", Math.round(p.quote * 100) + " %", team.length ? Math.round((team.reduce((s, x) => s + x.quote, 0) / team.length) * 100) + " %" : "–")}
      </tbody></table></div>
      <div><h3>Wann trifft er</h3>${goalMins.length ? `<div class="bars">${gb.map((v, i) => `<div class="bar" data-tip="${BL[i]}: ${v} ${v === 1 ? "Tor" : "Tore"}" style="grid-template-columns:56px 1fr 24px"><span class="t muted">${BL[i]}</span><span class="tr"><span class="fl" style="display:block;width:${(v / Math.max(...gb)) * 100}%;background:var(--win)"></span></span><span class="v">${v}</span></div>`).join("")}</div>` : `<p class="small muted">Noch keine Tore mit Spielminute.</p>`}</div>
    </div>`;
}
export function openProfile(id: string): void {
  const p = playerKPI().find(x => x.id === id);
  if (!p) return;
  const yr = new Date().getFullYear();
  const games = S.matches
    .filter(m => played(m) && m.stats && m.stats[id] && (m.stats[id].start || m.stats[id].sub))
    .sort(byDate)
    .slice(-6)
    .reverse();
  $("pvTitle").textContent = p.name;
  $("pvBody").innerHTML = `<div style="display:grid;grid-template-columns:minmax(0,190px) 1fr;gap:16px" class="pv">
    <div>${card(p)}</div><div>
    <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(96px,1fr))">
      ${(p.pos === "TW"
        ? [
            [p.ga, "Gegentore"],
            [p.min ? ((p.ga / p.min) * 90).toFixed(2) : "–", "Gegentore / 90"],
            [p.cs, "Zu null"],
            [p.starts ? Math.round((p.cs / p.starts) * 100) + "%" : "–", "Zu-null-Quote"],
          ]
        : []
      )
        .concat([
          [p.apps, "Spiele"],
          [p.starts, "Startelf"],
          [p.subs, "Eingewechselt"],
          [p.min, "Minuten"],
          [p.g, "Tore"],
          [p.a, "Assists"],
          [p.minPerPt ?? "–", "Min/Scorer"],
          [Math.round(p.quote * 100) + "%", "Einsatzquote"],
          [`${p.y}/${p.r}`, "Gelb/Rot"],
          [p.year ? yr - num(p.year) : "–", "Alter"],
        ])
        .map(
          ([v, l]) =>
            `<div class="kpi"><div class="v" style="font-size:22px">${v}</div><div class="l">${l}</div></div>`,
        )
        .join("")}
    </div>
    ${profileExtra(p)}
    <h3 style="margin-top:14px">Letzte Einsätze</h3>
    ${
      games.length
        ? `<div class="list">${games
            .map(m => {
              const s = m.stats![id],
                g = (m.goals || []).filter(x => x.who === id).length,
                a = (m.goals || []).filter(x => x.ast === id).length;
              return `<div class="li"><span class="sc ${res(m)}" style="font-size:15px">${m.gf}:${m.ga}</span><div><b>${m.home ? "vs." : "@"} ${esc(m.opp)}</b><div class="small muted">${fmtD(m.date)} · ${s.start ? "Startelf" : "eingewechselt"} · ${num(s.min)}'</div></div><span class="n" style="font-size:15px">${g ? `⚽${g > 1 ? "×" + g : ""}` : ""} ${a ? `🅰${a > 1 ? "×" + a : ""}` : ""} ${num(s.y) ? "🟨" : ""}${num(s.r) ? "🟥" : ""}</span></div>`;
            })
            .join("")}</div>`
        : `<p class="small muted">Noch keine Einsätze.</p>`
    }
    ${S.admin && S.notes[id] ? `<p class="small muted">Notiz (nur du): ${esc(S.notes[id])}</p>` : ""}
    ${S.admin ? `<button class="btn sm" type="button" id="pvEdit" style="margin-top:10px">Bearbeiten</button>` : ""}
  </div></div>`;
  $("pvBody").querySelector(".pc").style.pointerEvents = "none";
  const e = $("pvEdit");
  if (e)
    e.onclick = () => {
      $("pview").close();
      openPEdit(id);
    };
  $("pview").showModal();
}
