import type { Match } from "../types";
import { sb } from "../db";
import { S, ctx } from "../state";
import { byDate, isOurs, pById, played, relCls, res } from "../domain";
import { $, confirmBtn, errMsg, esc, fmtD, minNum } from "../util";
import { POS_ORDER } from "../positions";
import { openMEdit } from "./match-edit";

export function renderGames() {
  const up = S.matches.filter(m => !played(m)).sort(byDate);
  $("nextPanel").hidden = !up.length;
  $("upcoming").innerHTML = up.map(m => matchRow(m)).join("");
  const ms = S.matches.filter(played).sort(byDate).reverse();
  $("mcount").textContent = `${ms.length} gespielt`;
  $("mlist").innerHTML = ms.length ? ms.map(m => matchRow(m)).join("") : `<p class="muted">Noch keine Resultate.</p>`;
  document
    .querySelectorAll<HTMLElement>("#upcoming .match, #mlist .match")
    .forEach(b => (b.onclick = () => openMatchView(b.dataset.m ?? "")));
  const t = S.table;
  $("tblInfo").textContent = t && t.updated ? `Stand ${fmtD(t.updated)}` : "";
  $("table").innerHTML =
    t && t.rows && t.rows.length
      ? `<table><thead><tr><th>#</th><th class="l">Team</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th><th>Diff</th><th>Pkt</th></tr></thead><tbody>
    ${t.rows.map(r => `<tr class="${isOurs(r.team) ? "us" : ""} ${relCls(r)}"><td>${r.rank}</td><td class="l">${esc(r.team)}</td><td>${r.sp}</td><td>${r.s}</td><td>${r.u}</td><td>${r.n}</td><td>${r.gf}:${r.ga}</td><td>${r.gf - r.ga > 0 ? "+" : ""}${r.gf - r.ga}</td><td><strong>${r.pts}</strong></td></tr>`).join("")}</tbody></table>`
      : `<p class="muted">Noch keine Tabelle.${S.admin ? " Unter Admin → Tabelle &amp; Resultate einfügen." : ""}</p>`;
}
function matchRow(m: Match): string {
  const d = new Date(m.date + "T12:00"),
    pl = played(m);
  const sc = (m.goals || [])
    .filter(g => g.who)
    .map(g => esc(pById(g.who)?.name || "?"))
    .join(", ");
  return `<button type="button" class="match" data-m="${esc(m.id)}"><div class="d"><b>${d.getDate()}</b>${d.toLocaleDateString("de-CH", { month: "short" })}</div>
    <div><strong>${m.home ? "vs." : "@"} ${esc(m.opp)}</strong><div class="small muted">${esc(m.comp || "")}${m.time ? ` · ${esc(m.time)}` : ""}${pl && sc ? ` · ⚽ ${sc}` : ""}</div></div>
    <span class="sc ${pl ? res(m) : "F"}">${pl ? `${m.gf}:${m.ga}` : m.home ? "Heim" : "Ausw."}</span></button>`;
}
export function openMatchView(id: string): void {
  const m = S.matches.find(x => x.id === id);
  if (!m) return;
  $("mvTitle").textContent = `${m.home ? "vs." : "@"} ${m.opp}`;
  const ev: { min: string; who: string | null; ast?: string | null; us: boolean }[] = [
    ...(m.goals || []).map(g => ({ ...g, us: true })),
    ...(m.against || []).map(g => ({ ...g, us: false })),
  ].sort((a, b) => (minNum(a.min) ?? 0) - (minNum(b.min) ?? 0));
  const xi = S.players
    .filter(p => m.stats && m.stats[p.id] && m.stats[p.id].start)
    .sort((a, b) => (POS_ORDER[a.pos ?? ""] ?? 99) - (POS_ORDER[b.pos ?? ""] ?? 99));
  const subs = S.players.filter(p => m.stats && m.stats[p.id] && m.stats[p.id].sub);
  $("mvBody").innerHTML =
    `<div class="h"><span class="muted">${fmtD(m.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${m.time ? " · " + esc(m.time) : ""} · ${esc(m.comp || "")}</span>${played(m) ? `<span class="sc ${res(m)}">${m.gf}:${m.ga}</span>` : ""}</div>
    ${
      played(m)
        ? `<div class="two"><div><h3>Tore</h3>${ev.length ? `<div class="tl">${ev.map(g => `<div><span class="m">${esc(g.min ?? "")}'</span><span class="${g.us ? "us" : "them"}">${g.us ? `⚽ ${esc(pById(g.who)?.name || "Tor")}${g.ast ? ` <span class="muted small">(Vorlage ${esc(pById(g.ast)?.name || "")})</span>` : ""}` : `Gegentor${g.who ? " · " + esc(g.who) : ""}`}</span></div>`).join("")}</div>` : `<p class="small muted">Keine Tore erfasst.</p>`}</div>
      <div><h3>Startelf</h3><p style="margin:0 0 8px">${xi.map(p => esc(p.name)).join(", ") || "<span class='muted small'>nicht erfasst</span>"}</p><h3>Eingewechselt</h3><p style="margin:0">${subs.map(p => esc(p.name)).join(", ") || "<span class='muted small'>–</span>"}</p></div></div>`
        : `<p class="muted">Dieses Spiel ist noch nicht gespielt. Infos zum Gegner im Tab «Gegner».</p>`
    }
    ${S.admin ? `<div class="h" style="margin-top:12px"><button class="btn sm" type="button" id="mvEdit">Bearbeiten</button>${!played(m) || m.live ? `<button class="btn sm hot" type="button" id="mvLive">Live-Link erstellen</button>` : ""}</div><div id="mvLiveBox"></div>` : ""}`;
  const e = $("mvEdit");
  if (e)
    e.onclick = () => {
      $("mview").close();
      openMEdit(m);
    };
  const lb = $("mvLive");
  if (lb) lb.onclick = () => liveLinkBox(m);
  $("mview").showModal();
}
async function liveLinkBox(m: Match): Promise<void> {
  const box = $("mvLiveBox");
  box.innerHTML = `<p class="small muted">Wird erstellt …</p>`;
  let { data } = await sb.from("live_links").select("token").eq("team_id", ctx.team).eq("match_id", m.id).maybeSingle();
  if (!data) {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(12)), x => x.toString(16).padStart(2, "0")).join("");
    const r = await sb.from("live_links").insert({ token, team_id: ctx.team, match_id: m.id });
    if (r.error) {
      box.innerHTML = `<p class="warn">${esc(errMsg(r.error))}</p>`;
      return;
    }
    data = { token };
  }
  const url = location.origin + location.pathname + "?live=" + data.token;
  box.innerHTML = `<p style="margin:10px 0 6px">Mit diesem Link kann jemand <b>nur dieses Spiel</b> live erfassen – ohne Login.</p>
    <div class="h" style="margin:0"><input id="llUrl" readonly value="${esc(url)}" style="flex:1;min-width:180px"><button class="btn sm" type="button" id="llCopy">Kopieren</button>${"share" in navigator ? `<button class="btn sm hot" type="button" id="llShare">Teilen</button>` : ""}</div>
    <div class="h" style="margin-top:6px"><span class="status" id="llMsg"></span><button class="btn sm danger" type="button" id="llDel">Link löschen</button></div>`;
  $("llCopy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      $("llMsg").textContent = "Kopiert ✓";
    } catch (e) {
      $("llUrl").select();
    }
  };
  const sh = $("llShare");
  if (sh)
    sh.onclick = () =>
      navigator
        .share({
          title: `Live erfassen: ${m.home ? "vs." : "@"} ${m.opp}`,
          text: `Bitte das Spiel ${m.home ? "gegen" : "bei"} ${m.opp} live erfassen:`,
          url,
        })
        .catch(() => {});
  $("llDel").onclick = async () => {
    if (!confirmBtn($("llDel"))) return;
    await sb.from("live_links").delete().eq("token", data.token);
    box.innerHTML = `<p class="small muted">Link gelöscht – er funktioniert nicht mehr.</p>`;
  };
}
