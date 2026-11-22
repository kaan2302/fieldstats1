import type { LineupSpot } from "../types";
import { S } from "../state";
import { $, $$, errMsg, esc, fmtD, num, uid } from "../util";
import { played } from "../domain";
import { POS_ORDER, nearestPos } from "../positions";
import { del, put } from "../db";
import type { Against, Goal, Match, StatLine } from "../types";
import { dragify, drawPitch, pitchPct } from "../pitch";
import { aufgebotSheet } from "../pdf";

let editM: string | null = null;
const plOpts = (sel: string | null | undefined, empty: string) =>
  `<option value="">${empty}</option>` +
  [...S.players]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => `<option value="${esc(p.id)}" ${p.id === sel ? "selected" : ""}>${esc(p.name)}</option>`)
    .join("");
function goalRow(g: Partial<Goal> = {}): void {
  const d = document.createElement("div");
  d.className = "goalrow";
  d.innerHTML = `<input placeholder="Min" aria-label="Minute" value="${esc(g.min ?? "")}"><select aria-label="Torschütze">${plOpts(g.who, "Torschütze")}</select><select aria-label="Vorlage">${plOpts(g.ast, "keine Vorlage")}</select><button class="btn sm" type="button" aria-label="Tor entfernen">×</button>`;
  d.querySelector("button")!.onclick = () => d.remove();
  $("goalRows").appendChild(d);
}
function agRow(g: Partial<Against> = {}): void {
  const d = document.createElement("div");
  d.className = "goalrow ag";
  d.innerHTML = `<input placeholder="Min" aria-label="Minute" value="${esc(g.min ?? "")}"><input placeholder="Torschütze Gegner (optional)" aria-label="Torschütze Gegner" value="${esc(g.who ?? "")}"><button class="btn sm" type="button" aria-label="Gegentor entfernen">×</button>`;
  d.querySelector("button")!.onclick = () => d.remove();
  $("agRows").appendChild(d);
}
export function openMEdit(m: Match | null): void {
  editM = m ? m.id : null;
  $("meTitle").textContent = m ? "Spiel bearbeiten" : "Neues Spiel";
  $("fDate").value = m ? m.date : new Date().toISOString().slice(0, 10);
  $("fTime").value = m && m.time ? m.time : "";
  $("fOpp").value = m ? m.opp : "";
  $("fHome").value = m ? (m.home ? "1" : "0") : "1";
  $("fComp").value = m ? m.comp || "Meisterschaft" : "Meisterschaft";
  $("fStatus").value = m ? (played(m) ? "played" : "planned") : "played";
  $("fGF").value = m && played(m) ? m.gf : "";
  $("fGA").value = m && played(m) ? m.ga : "";
  $("goalRows").innerHTML = "";
  $("agRows").innerHTML = "";
  (m?.goals || []).forEach(goalRow);
  (m?.against || []).forEach(agRow);
  $("fDel").hidden = !m;
  $("fWarn").textContent = "";
  const ps = [...S.players].sort(
    (a, b) => (POS_ORDER[a.pos ?? ""] ?? 99) - (POS_ORDER[b.pos ?? ""] ?? 99) || a.name.localeCompare(b.name),
  );
  $("ftable").innerHTML =
    `<thead><tr><th>Spieler</th><th>Startelf</th><th>Eingew.</th><th>Min</th><th>Gelb</th><th>Rot</th></tr></thead><tbody>${
      ps
        .map(p => {
          const s: Partial<StatLine> = m?.stats?.[p.id] || {};
          return `<tr data-p="${esc(p.id)}"><td>${p.nr ? "#" + p.nr + " " : ""}${esc(p.name)} <span class="muted small">${esc(p.pos || "")}</span></td>
      <td><input type="checkbox" aria-label="${esc(p.name)} Startelf" ${s.start ? "checked" : ""}></td><td><input type="checkbox" aria-label="${esc(p.name)} eingewechselt" ${s.sub ? "checked" : ""}></td>
      <td><input type="number" min="0" max="130" inputmode="numeric" aria-label="Minuten" value="${s.min ?? ""}"></td>
      <td><input class="w" type="number" min="0" max="2" inputmode="numeric" aria-label="Gelbe Karten" value="${s.y ?? ""}"></td><td><input class="w" type="number" min="0" max="1" inputmode="numeric" aria-label="Rote Karte" value="${s.r ?? ""}"></td></tr>`;
        })
        .join("") || `<tr><td colspan="6" class="muted">Zuerst Spieler anlegen.</td></tr>`
    }</tbody>`;
  $$("tbody tr[data-p]", $("ftable")).forEach(tr => {
    const [st, sb, mi] = tr.querySelectorAll("input");
    st.onchange = () => {
      if (st.checked) {
        sb.checked = false;
        if (!mi.value) mi.value = "90";
      }
      meXi();
    };
    sb.onchange = () => {
      if (sb.checked) st.checked = false;
      meXi();
    };
  });
  meLayout = JSON.parse(JSON.stringify((m && m.lineup) || {}));
  $("meXiInfo").textContent =
    m && played(m) ? `${fmtD(m.date)} ${m.home ? "vs." : "@"} ${m.opp} · ${m.gf}:${m.ga}` : "";
  meXi();
  $("medit").showModal();
}
export let meLayout: Record<string, LineupSpot> = {};
export function meXi() {
  const ids = [...$$("tbody tr[data-p]", $("ftable"))]
    .filter(tr => tr.querySelector("input")!.checked)
    .map(tr => tr.dataset.p ?? "");
  drawPitch(
    $("mePitch"),
    $("meTag"),
    S.players.filter(p => ids.includes(p.id)),
    null,
    meLayout,
  );
  $$(".slot", $("mePitch")).forEach(el =>
    dragify(
      el,
      () => {},
      (id, zone, cx, cy) => {
        if (zone !== "xi") return;
        const q = pitchPct($("mePitch"), cx, cy);
        meLayout[id] = { ...q, pos: nearestPos(q.x, q.y) };
        meXi();
      },
    ),
  );
}

export function initEdit() {
  $("addGoal").onclick = () => goalRow();
  $("addAg").onclick = () => agRow();
  $("mePdf").onclick = () => {
    const rows = [...$$("tbody tr[data-p]", $("ftable"))],
      xi = rows.filter(tr => tr.querySelectorAll("input")[0].checked).map(tr => tr.dataset.p ?? ""),
      bench = rows.filter(tr => tr.querySelectorAll("input")[1].checked).map(tr => tr.dataset.p ?? "");
    if (!xi.length) {
      $("fWarn").textContent = "Zuerst die Startelf anhaken.";
      return;
    }
    aufgebotSheet({
      opp: $("fOpp").value.trim() || "Gegner",
      home: $("fHome").value === "1",
      date: $("fDate").value,
      time: $("fTime").value,
      xi,
      bench,
      layout: meLayout,
    });
  };
  $("addMatch").onclick = () => openMEdit(null);
  $("meForm").onsubmit = async (e: Event) => {
    e.preventDefault();
    const status = $("fStatus").value,
      stats: Record<string, StatLine> = {};
    $$("tbody tr[data-p]", $("ftable")).forEach(tr => {
      const i = tr.querySelectorAll("input");
      if (!i[0].checked && !i[1].checked) return;
      stats[tr.dataset.p ?? ""] = {
        start: i[0].checked,
        sub: i[1].checked,
        min: num(i[2].value),
        y: num(i[3].value),
        r: num(i[4].value),
      };
    });
    const goals = [...$("goalRows").children]
      .map(d => {
        const [mi, w, a] = d.querySelectorAll("input,select");
        return { min: mi.value.trim(), who: w.value || null, ast: a.value || null };
      })
      .filter(g => g.min || g.who);
    const against = [...$("agRows").children]
      .map(d => {
        const [mi, w] = d.querySelectorAll("input");
        return { min: mi.value.trim(), who: w.value.trim() };
      })
      .filter(g => g.min || g.who);
    let gf = num($("fGF").value),
      ga = num($("fGA").value);
    if (status === "played") {
      if ($("fGF").value === "") gf = goals.length;
      if ($("fGA").value === "") ga = against.length;
      if (goals.length > gf || against.length > ga) {
        $("fWarn").textContent =
          `Erfasste Tore (${goals.length}:${against.length}) passen nicht zum Resultat ${gf}:${ga}.`;
        return;
      }
    }
    if (!$("fOpp").value.trim()) {
      $("fWarn").textContent = "Bitte den Gegner eintragen.";
      return;
    }
    const old = editM ? S.matches.find(m => m.id === editM) : null;
    const m = {
      ...(old || {}),
      id: editM || uid(),
      date: $("fDate").value,
      time: $("fTime").value,
      opp: $("fOpp").value.trim(),
      home: $("fHome").value === "1",
      comp: $("fComp").value,
      status,
      gf,
      ga,
      goals,
      against,
      stats,
      lineup: Object.fromEntries(Object.entries(meLayout).filter(([id]) => stats[id]?.start)),
    };
    $("fSave").disabled = true;
    try {
      await put("matches", m);
      $("medit").close();
    } catch (err) {
      $("fWarn").textContent = errMsg(err);
    } finally {
      $("fSave").disabled = false;
    }
  };
  $("fDel").onclick = async () => {
    const b = $("fDel");
    if (b.dataset.armed !== "1") {
      b.dataset.armed = "1";
      b.textContent = "Wirklich löschen?";
      setTimeout(() => {
        b.dataset.armed = "";
        b.textContent = "Spiel löschen";
      }, 3000);
      return;
    }
    try {
      if (editM) await del("matches", editM);
      $("medit").close();
    } catch (err) {
      $("fWarn").textContent = errMsg(err);
    }
  };
}
