// Kleine SVG-Grafiken und Tabellen-Bausteine.
import { BL, isOurs, ptsOf, relCls, res, situation, type TeamKPI } from "./domain";
import { S } from "./state";
import type { Match, Result } from "./types";
import { esc } from "./util";

const resColor = (r: Result) => (r === "S" ? "win" : r === "U" ? "draw" : "loss");
const dot = (cls: string) => `<span class="dot ${cls}" style="width:10px;height:10px"></span>`;

/** Abstand zu Aufstiegsplatz bzw. Strich als kurze Liste. */
export function relGap(): string {
  const rows = S.table?.rows || [],
    N = rows.length,
    us = rows.find(r => isOurs(r.team)),
    sit = situation();
  const a = +(S.meta.relegation || 0),
    b = +(S.meta.relegationMaybe || a);
  if (sit && sit.mode !== "ab") {
    const up =
      sit.gapUp != null
        ? `<div class="li">${dot("S")}<b>${sit.pr === 1 ? "Platz 1" : "Aufstiegsplatz " + sit.pr}</b><span class="small muted" style="margin-left:auto">${sit.us.rank <= sit.pr ? "wir sind drauf" : sit.gapUp + " Pkt Rückstand"}</span></div>`
        : "";
    const down =
      sit.gapDown != null
        ? `<div class="li">${dot("N")}<b>Strich</b><span class="small muted" style="margin-left:auto">${sit.gapDown} Pkt Vorsprung</span></div>`
        : "";
    return `<div class="list" style="margin:8px 0">${up}${down}</div>`;
  }
  if (!N || !a || !us) return "";
  const line = (k: number) => {
    const t = rows.find(r => r.rank === k);
    return us.rank <= k ? "über dem Strich" : `${t ? t.pts - us.pts : "–"} Pkt Rückstand auf Platz ${k}`;
  };
  return `<div class="list" style="margin:8px 0"><div class="li">${dot("N")}<b>Strich (${a} Absteiger)</b><span class="small muted" style="margin-left:auto">${line(N - a)}</span></div>
    ${b > a ? `<div class="li">${dot("U")}<b>Bei ${b} Absteigern</b><span class="small muted" style="margin-left:auto">${line(N - b)}</span></div>` : ""}</div>`;
}

/** Formkurve: Punkte pro Spiel im Schnitt der letzten 3 Spiele. */
export function formChart(ms: Match[]): string {
  if (!ms.length) return "";
  const W = 320,
    H = 80,
    pt = 10,
    pb = 10,
    n = ms.length;
  const X = (i: number) => (n === 1 ? W / 2 : 10 + ((W - 20) * i) / (n - 1));
  const Y = (v: number) => pt + (H - pt - pb) * (1 - v / 3);
  const roll = ms.map((_, i) => {
    const w = ms.slice(Math.max(0, i - 2), i + 1);
    return w.reduce((s, x) => s + ptsOf(x), 0) / w.length;
  });
  const line = roll.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Formkurve, Punkte pro Spiel im Schnitt der letzten 3 Spiele">
    ${[0, 1, 3].map(v => `<line x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-dasharray="${v === 1 ? "3 4" : ""}"/>`).join("")}
    <polygon points="${X(0)},${Y(0)} ${line} ${X(n - 1)},${Y(0)}" fill="rgba(255,90,54,.15)"/>
    <polyline points="${line}" fill="none" stroke="var(--hot)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${ms.map((m, i) => `<circle data-tip="${esc(`${m.home ? "vs." : "@"} ${m.opp} ${m.gf}:${m.ga}`)}" cx="${X(i)}" cy="${Y(roll[i])}" r="5" fill="var(--${resColor(res(m))})" stroke="#080c18" stroke-width="2"/>`).join("")}</svg>`;
}

/** Tabellenausschnitt (je nach Situation) als Balken. */
export function relBars(): string {
  const rows = situation()?.rows ?? [];
  if (!rows.length) return "";
  const max = Math.max(...rows.map(r => r.pts), 1);
  return `<div class="bars">${rows
    .map(r => {
      const c = relCls(r);
      const color = /\bpromo\b/.test(c)
        ? "win"
        : /\brel\b/.test(c)
          ? "loss"
          : /relq/.test(c)
            ? "draw"
            : isOurs(r.team)
              ? "hot"
              : "muted";
      return `<div class="bar ${isOurs(r.team) ? "us" : ""}"><span class="t">${r.rank}. ${esc(r.team)}</span><span class="tr"><span class="fl" style="display:block;width:${(r.pts / max) * 100}%;background:var(--${color})"></span></span><span class="v">${r.pts}</span></div>`;
    })
    .join("")}</div>`;
}

/** Tore (a) und Gegentore (b) je 15 Minuten als Doppelbalken. */
export function minuteChart(a: number[], b: number[], la: string, lb: string): string {
  const tot = a.reduce((s, x) => s + x, 0) + b.reduce((s, x) => s + x, 0);
  if (!tot) return `<p class="small muted">Erscheint, sobald Tore mit Spielminute erfasst sind.</p>`;
  const W = 520,
    H = 190,
    pl = 26,
    pb = 24,
    pt = 14,
    max = Math.max(1, ...a, ...b),
    bw = (W - pl - 10) / 6;
  const Y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${la}: ${a.join(", ")}; ${lb}: ${b.join(", ")} je 15 Minuten">`;
  [0, max].forEach(
    v =>
      (s += `<line x1="${pl}" x2="${W - 6}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`),
  );
  a.forEach((v, i) => {
    const x = pl + i * bw + 6,
      w = (bw - 16) / 2;
    s += `<rect data-tip="${esc(`${BL[i]}: ${v} : ${b[i]}`)}" x="${x - 4}" y="${pt}" width="${bw - 4}" height="${H - pt - pb}" fill="transparent"/><rect pointer-events="none" x="${x}" y="${Y(v)}" width="${w}" height="${Y(0) - Y(v)}" rx="4" fill="var(--win)"/><rect pointer-events="none" x="${x + w + 4}" y="${Y(b[i])}" width="${w}" height="${Y(0) - Y(b[i])}" rx="4" fill="var(--loss)"/>`;
    if (v)
      s += `<text x="${x + w / 2}" y="${Y(v) - 4}" text-anchor="middle" style="fill:var(--ink);font-weight:800">${v}</text>`;
    if (b[i])
      s += `<text x="${x + w * 1.5 + 4}" y="${Y(b[i]) - 4}" text-anchor="middle" style="fill:var(--ink);font-weight:800">${b[i]}</text>`;
    s += `<text x="${x + w + 2}" y="${H - 6}" text-anchor="middle">${BL[i]}</text>`;
  });
  return (
    s +
    `</svg><div class="small" style="display:flex;gap:14px;margin-top:4px"><span><span class="dot S" style="width:12px;height:12px;vertical-align:-2px"></span> ${la}</span><span><span class="dot N" style="width:12px;height:12px;vertical-align:-2px"></span> ${lb}</span></div>`
  );
}

/** Punkteverlauf über die Saison, gestrichelt das Tempo von 2 Punkten pro Spiel. */
export function ptsChart(cum: TeamKPI["cum"]): string {
  if (cum.length < 2) return `<p class="small muted">Ab zwei Spielen erscheint hier die Kurve.</p>`;
  const W = 520,
    H = 190,
    pl = 30,
    pr = 14,
    pt = 16,
    pb = 22,
    n = cum.length,
    maxP = Math.max(3, cum[n - 1].pts, n * 2);
  const X = (i: number) => pl + (W - pl - pr) * (i / (n - 1));
  const Y = (v: number) => pt + (H - pt - pb) * (1 - v / maxP);
  const line = cum.map((c, i) => `${X(i)},${Y(c.pts)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Punkte kumuliert, aktuell ${cum[n - 1].pts} nach ${n} Spielen">
    <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a36" stop-opacity=".45"/><stop offset="1" stop-color="#ff5a36" stop-opacity="0"/></linearGradient></defs>
    ${[0, Math.round(maxP / 2), maxP].map(v => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join("")}
    <polygon points="${X(0)},${Y(0)} ${line} ${X(n - 1)},${Y(0)}" fill="url(#ga)"/>
    <polyline points="${cum.map((_, i) => `${X(i)},${Y((i + 1) * 2)}`).join(" ")}" fill="none" stroke="var(--muted)" stroke-dasharray="4 4"/>
    <polyline points="${line}" fill="none" stroke="var(--hot)" stroke-width="3" stroke-linejoin="round"/>
    ${cum.map((c, i) => `<circle data-tip="${esc(`${c.opp}: ${c.pts} Pkt`)}" cx="${X(i)}" cy="${Y(c.pts)}" r="${i === n - 1 ? 7 : 6}" fill="var(--${resColor(c.r)})" stroke="#080c18" stroke-width="2"></circle>`).join("")}
    <text x="${X(n - 1) - 8}" y="${Y(cum[n - 1].pts) - 10}" text-anchor="end" style="fill:var(--ink);font-weight:800">${cum[n - 1].pts} Pkt</text></svg>`;
}
