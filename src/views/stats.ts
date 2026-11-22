import { $, $$, esc, face } from "../util";
import { S } from "../state";
import { buckets, played, type PlayerKPI, type TeamKPI } from "../domain";
import { kpi } from "../ui";
import { minuteChart, ptsChart } from "../charts";
import { openProfile } from "./kader";
import { render } from "./app";

type SortKey = keyof PlayerKPI;
let sortKey: SortKey = "g",
  sortDir = -1;

/** Tab «Stats»: Team-Kennzahlen, Grafiken, Ranglisten, Torhüter und Spielertabelle. */
export function renderStats(pk: PlayerKPI[], k: TeamKPI): void {
  const pp = (x: { n: number; pts: number }) => (x.n ? (x.pts / x.n).toFixed(2) : "–");
  $("kpis").innerHTML =
    kpi(k.pts, "Punkte", `${k.n} Meisterschafts-/Cupspiele`) +
    kpi(k.n ? (k.pts / k.n).toFixed(2) : "–", "Punkte / Spiel", `Heim ${pp(k.home)} · Ausw. ${pp(k.away)}`) +
    kpi(`${k.S}-${k.U}-${k.N}`, "S-U-N", k.n ? `${Math.round((k.S / k.n) * 100)} % Siege` : "") +
    kpi(`${k.gf}:${k.ga}`, "Tore", `Differenz ${k.gf - k.ga >= 0 ? "+" : ""}${k.gf - k.ga}`) +
    kpi(k.n ? (k.gf / k.n).toFixed(1) : "–", "Tore / Spiel", k.n ? `Gegentore ${(k.ga / k.n).toFixed(1)}` : "") +
    kpi(k.cs, "Zu null", k.n ? `${Math.round((k.cs / k.n) * 100)} % der Spiele` : "");
  const ms = S.matches.filter(played);
  $("minChart").innerHTML = minuteChart(
    buckets(ms.flatMap(m => (m.goals || []).map(g => g.min))),
    buckets(ms.flatMap(m => (m.against || []).map(g => g.min))),
    "Unsere Tore",
    "Gegentore",
  );
  $("ptsChart").innerHTML = ptsChart(k.cum);
  const rank = (f: (p: PlayerKPI) => number, unit: string) => {
    const r = pk
      .filter(p => f(p) > 0)
      .sort((a, b) => f(b) - f(a))
      .slice(0, 6);
    return r.length
      ? r
          .map(
            (p, i) =>
              `<div class="li"><span class="muted" style="font:800 14px var(--display);width:18px">${i + 1}</span><span class="face">${face(p)}</span><b>${esc(p.name)}</b><span class="n">${f(p)}</span></div>`,
          )
          .join("")
      : `<p class="small muted">Noch keine ${unit}.</p>`;
  };
  const tw = pk.filter(p => p.pos === "TW" && p.apps).sort((a, b) => b.min - a.min);
  $("keepers").innerHTML = tw.length
    ? tw
        .map(
          p => `<button type="button" class="li" data-p="${esc(p.id)}" style="width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer"><span class="face">${face(p)}</span><div><b>${esc(p.name)}</b><div class="small muted">${p.apps} Spiele · ${p.min}' · ${p.min ? ((p.ga / p.min) * 90).toFixed(2) : "–"} Gegentore pro 90 Min</div></div>
    <span class="nums" style="margin-left:auto;display:flex;gap:14px;font:800 18px var(--display);text-align:center"><span>${p.ga}<div class="small muted" style="font:700 9px var(--body)">GEGENT.</div></span><span>${p.cs}<div class="small muted" style="font:700 9px var(--body)">ZU NULL</div></span></span></button>`,
        )
        .join("")
    : `<p class="small muted">Noch keine Einsätze von Torhütern.</p>`;
  $$("[data-p]", $("keepers")).forEach(b => (b.onclick = () => openProfile(b.dataset.p ?? "")));
  $("scorers").innerHTML = rank(p => p.g, "Tore");
  $("assists").innerHTML = rank(p => p.a, "Vorlagen");
  const COLS: [SortKey, string][] = [
    ["name", "Spieler"],
    ["apps", "Spiele"],
    ["starts", "Startelf"],
    ["subs", "Eingew."],
    ["min", "Minuten"],
    ["g", "Tore"],
    ["a", "Assists"],
    ["pts", "Scorer"],
    ["minPerPt", "Min/Scorer"],
    ["y", "Gelb"],
    ["r", "Rot"],
  ];
  const rows = [...pk].sort((a, b) =>
    sortKey === "name"
      ? sortDir * a.name.localeCompare(b.name)
      : sortKey === "minPerPt"
        ? ((a.minPerPt ?? 1e9) - (b.minPerPt ?? 1e9)) * -sortDir
        : (Number(a[sortKey] ?? -1) - Number(b[sortKey] ?? -1)) * sortDir,
  );
  $("ptable").innerHTML =
    `<thead><tr>${COLS.map(([k, l]) => `<th data-k="${k}" tabindex="0" ${k === sortKey ? `aria-sort="${sortDir > 0 ? "ascending" : "descending"}"` : ""}>${l}${k === sortKey ? (sortDir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(p => `<tr><td><strong>${esc(p.name)}</strong> <span class="muted small">${p.nr ? "#" + p.nr + " " : ""}${esc(p.pos || "")}</span></td><td>${p.apps}</td><td>${p.starts}</td><td>${p.subs}</td><td>${p.min}</td><td>${p.g}</td><td>${p.a}</td><td><strong>${p.pts}</strong></td><td>${p.minPerPt ?? "–"}</td><td>${p.y}</td><td>${p.r}</td></tr>`).join("")}</tbody>`;
  $$("th", $("ptable")).forEach(th => {
    const go = () => {
      const kk = (th.dataset.k ?? "g") as SortKey;
      if (sortKey === kk) sortDir *= -1;
      else {
        sortKey = kk;
        sortDir = kk === "name" ? 1 : -1;
      }
      render();
    };
    th.onclick = go;
    th.onkeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    };
  });
}
