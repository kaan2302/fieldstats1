import { S, ctx, teamUrl } from "../state";
import { $, $$, errMsg, esc, face, fmtD, initials, norm, num, shrink, slug, uid } from "../util";
import { LINE, POS_ALL, POS_ORDER } from "../positions";
import { byDate, isOurs, leagueTeams, pById, parseTable, played, playerKPI, res, tableFromResults } from "../domain";
import { openMEdit } from "./match-edit";
import { dbUpsert, del, loadAll, put, putDoc, saveNote, up } from "../db";
import { card } from "./kader";
import { STRIPE_CHECKOUT, STRIPE_PORTAL } from "../config";
import { curSeason } from "../season";
import type { TableRow } from "../types";

export let setView = "verein";
let editP: string | null = null;
let pendingPhoto: string | null | undefined;
let pendingLogo: string | null | undefined;
export function renderSettings() {
  document
    .querySelectorAll<HTMLElement>(".side button")
    .forEach(b => b.setAttribute("aria-current", String(b.dataset.s === setView)));
  document.querySelectorAll<HTMLElement>("[data-sp]").forEach(p => (p.hidden = p.dataset.sp !== setView));
  const meta = S.meta,
    act = document.activeElement?.id ?? "";
  if (!["mClub", "mTeam", "mLeague", "mSeason", "mFbName", "mPromo", "mRel", "mRelQ"].includes(act)) {
    $("mPromo").value = meta.promotion ?? "";
    $("mRel").value = meta.relegation ?? "";
    $("mRelQ").value = meta.relegationMaybe ?? "";
    $("mClub").value = meta.club || "";
    $("mTeam").value = meta.team || "";
    $("mLeague").value = meta.league || "";
    $("mSeason").value = meta.season || "";
    $("mFbName").value = meta.fbName || "";
  }
  $("logoPrev").innerHTML = (pendingLogo !== undefined ? pendingLogo : meta.logo)
    ? `<img src="${esc(pendingLogo !== undefined ? pendingLogo : meta.logo)}" alt="">`
    : esc(initials(meta.club || "SC"));
  const ps = [...S.players].sort(
    (a, b) => (POS_ORDER[a.pos ?? ""] ?? 99) - (POS_ORDER[b.pos ?? ""] ?? 99) || num(a.nr || 99) - num(b.nr || 99),
  );
  $("sPlCount").textContent = `${ps.length}`;
  $("sPlayers").innerHTML = ps.length
    ? ps
        .map(
          p =>
            `<div class="prow"><span class="face">${face(p)}</span><div class="grow"><b>${p.nr ? "#" + p.nr + " " : ""}${esc(p.name)}${p.captain ? " ©" : ""}</b><span class="small muted">${esc(POS_ALL.find(x => x[0] === p.pos)?.[1] || p.pos || "–")}${p.year ? " · " + p.year : ""}${S.notes[p.id] ? " · 📝" : ""}</span></div><button class="btn sm" type="button" data-pe="${esc(p.id)}">Bearbeiten</button></div>`,
        )
        .join("")
    : `<p class="muted">Noch keine Spieler.</p>`;
  $$("[data-pe]", $("sPlayers")).forEach(b => (b.onclick = () => openPEdit(b.dataset.pe ?? null)));
  if (setView === "liga" && !document.activeElement?.closest?.("#tEdit,#rRows")) {
    tEditRender();
    rRender();
  }
  const ms = [...S.matches].sort(byDate).reverse();
  $("sMatches").innerHTML = ms.length
    ? ms
        .map(
          m =>
            `<div class="prow"><span class="sc ${played(m) ? res(m) : "F"}" style="font-size:15px">${played(m) ? `${m.gf}:${m.ga}` : "–"}</span><div class="grow"><b>${m.home ? "vs." : "@"} ${esc(m.opp)}</b><span class="small muted">${fmtD(m.date)} · ${esc(m.comp || "")}${played(m) ? "" : " · geplant"}</span></div><button class="btn sm" type="button" data-me="${esc(m.id)}">Bearbeiten</button></div>`,
        )
        .join("")
    : `<p class="muted">Noch keine Spiele.</p>`;
  $$("[data-me]", $("sMatches")).forEach(
    b => (b.onclick = () => openMEdit(S.matches.find(m => m.id === b.dataset.me) ?? null)),
  );
  $("adminMail").textContent = S.email || "";
  $("adminMail2").textContent = S.email || "";
  $("pubLink").value = teamUrl(ctx.team ?? "");
  renderAbo();
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
export function previewP() {
  const p = {
    id: editP ?? "",
    name: $("peName").value || "Name",
    nr: $("peNr").value || "–",
    pos: $("pePos").value,
    captain: $("peCap").checked,
    photo: pendingPhoto !== undefined ? pendingPhoto : editP && pById(editP)?.photo,
  };
  const k = playerKPI().find(x => x.id === editP);
  const el = $("pePrev");
  el.className = "pc " + (LINE[p.pos] || "XXX");
  el.innerHTML = card({ ...p, apps: k?.apps ?? 0, g: k?.g ?? 0, a: k?.a ?? 0 }).replace(
    /^<button[^>]*>|<\/button>$/g,
    "",
  );
}
export function openPEdit(id: string | null): void {
  editP = id;
  pendingPhoto = undefined;
  const p = id ? pById(id) : null;
  $("peTitle").textContent = p ? "Spieler bearbeiten" : "Neuer Spieler";
  $("peName").value = p ? p.name : "";
  $("peNr").value = p && p.nr ? p.nr : "";
  $("pePos").value = p ? p.pos || "ZM" : "ZM";
  $("peYear").value = p && p.year ? p.year : "";
  $("peNote").value = p ? S.notes[p.id] || "" : "";
  $("peCap").checked = !!(p && p.captain);
  $("pePhoto").value = "";
  $("peDel").hidden = !p;
  $("peWarn").textContent = "";
  previewP();
  $("pedit").showModal();
}
export function renderAbo() {
  const t = S.myTeam;
  if (!t) {
    $("aboBody").innerHTML = "";
    return;
  }
  const today = new Date().toISOString().slice(0, 10),
    trial = t.plan === "trial",
    left = Math.ceil((new Date(t.trial_until).getTime() - new Date(today).getTime()) / 864e5);
  const status =
    t.plan === "active"
      ? `<span style="color:var(--win)">Aktiv</span>`
      : trial
        ? left >= 0
          ? `Testphase – noch ${left} ${left === 1 ? "Tag" : "Tage"}`
          : `<span style="color:var(--loss)">Testphase abgelaufen</span>`
        : t.plan === "past_due"
          ? `<span style="color:var(--loss)">Zahlung offen</span>`
          : "Gekündigt";
  const pay = STRIPE_CHECKOUT
    ? `${STRIPE_CHECKOUT}?client_reference_id=${encodeURIComponent(ctx.team ?? "")}&prefilled_email=${encodeURIComponent(S.email || "")}`
    : "";
  $("aboBody").innerHTML =
    `<div class="kpis"><div class="kpi"><div class="v" style="font-size:22px">${status}</div><div class="l">Status</div></div>
      <div class="kpi"><div class="v" style="font-size:22px">CHF 19.90</div><div class="l">pro Monat</div><div class="s">jederzeit kündbar</div></div></div>
    <ul style="margin:12px 0;padding-left:18px;line-height:1.7"><li>Unbegrenzt Spieler, Spiele und Saisons</li><li>Live-Modus mit Live-Links pro Spiel</li><li>Analysen, Gegner, Tabelle, Aufgebot als PDF</li><li>Link für alle ohne Login</li></ul>
    ${
      t.plan === "active"
        ? STRIPE_PORTAL
          ? `<a class="btn" href="${STRIPE_PORTAL}" target="_blank" rel="noopener">Abo verwalten / kündigen</a>`
          : `<p class="small muted">Kündigen: Link folgt mit der Stripe-Anbindung.</p>`
        : pay
          ? `<a class="btn hot" href="${pay}" target="_blank" rel="noopener">Abo abschliessen – CHF 19.90/Monat</a>`
          : `<button class="btn hot" type="button" disabled>Abo abschliessen – CHF 19.90/Monat</button><p class="small muted" style="margin-top:6px">Die Zahlung über Stripe wird gerade eingerichtet.</p>`
    }
    <p class="small muted" style="margin-top:10px">Nach der Testphase ohne Abo bleibt alles lesbar, Bearbeiten ist dann gesperrt.</p>`;
}
let tDraft: TableRow[] | null = null;
export function tEditRender(): void {
  if (!tDraft) tDraft = structuredClone(S.table?.rows || []);
  const draft = tDraft;
  const F = [
    ["rank", "#", 3],
    ["team", "Team", 18],
    ["sp", "Sp", 3],
    ["s", "S", 3],
    ["u", "U", 3],
    ["n", "N", 3],
    ["gf", "T+", 3],
    ["ga", "T−", 3],
    ["pts", "Pkt", 3],
  ];
  $("tEdit").innerHTML =
    `<thead><tr>${F.map(f => `<th>${f[1]}</th>`).join("")}<th></th></tr></thead><tbody>${draft.map((r, i) => `<tr${r.warn ? ' style="outline:2px solid var(--loss)" title="' + esc(r.warn) + '"' : ""}>${F.map(([k, , w]) => `<td><input data-i="${i}" data-k="${k}" value="${esc((r as unknown as Record<string, unknown>)[k] ?? "")}" ${k === "team" ? "" : 'inputmode="numeric"'} style="width:${w === 18 ? 11 : 2.6}em;padding:6px 4px;text-align:${k === "team" ? "left" : "center"}"></td>`).join("")}<td><button class="btn sm" type="button" data-del="${i}" aria-label="Zeile löschen">✕</button></td></tr>`).join("")}</tbody>`;
  $$<HTMLInputElement>("input", $("tEdit")).forEach(
    inp =>
      (inp.oninput = () => {
        const r = draft[+(inp.dataset.i ?? 0)] as unknown as Record<string, unknown>;
        r[inp.dataset.k ?? ""] = inp.dataset.k === "team" ? inp.value : inp.value === "" ? "" : +inp.value;
        delete r.warn;
      }),
  );
  $$("[data-del]", $("tEdit")).forEach(
    b =>
      (b.onclick = () => {
        draft.splice(+(b.dataset.del ?? -1), 1);
        tEditRender();
      }),
  );
}
let rDraft: { h: string; a: string; hg: string; ag: string }[] = [];
export function rRender() {
  if (!rDraft.length) rDraft = [{ h: "", a: "", hg: "", ag: "" }];
  const opts = (sel: string) =>
    `<option value="">– Team –</option>` +
    leagueTeams()
      .map(t => `<option ${norm(t) === norm(sel) ? "selected" : ""}>${esc(t)}</option>`)
      .join("");
  $("rRows").innerHTML = rDraft
    .map(
      (r, i) =>
        `<div class="h" style="gap:6px;margin:6px 0;flex-wrap:nowrap"><select data-i="${i}" data-k="h" style="flex:1;min-width:0">${opts(r.h)}</select><input data-i="${i}" data-k="hg" inputmode="numeric" value="${esc(r.hg)}" style="width:3em;text-align:center" aria-label="Tore Heim"><span>:</span><input data-i="${i}" data-k="ag" inputmode="numeric" value="${esc(r.ag)}" style="width:3em;text-align:center" aria-label="Tore Gast"><select data-i="${i}" data-k="a" style="flex:1;min-width:0">${opts(r.a)}</select></div>`,
    )
    .join("");
  $$("select,input", $("rRows")).forEach(
    el =>
      (el.oninput = el.onchange =
        () => {
          (rDraft[+(el.dataset.i ?? 0)] as Record<string, string>)[el.dataset.k ?? ""] = (el as HTMLInputElement).value;
        }),
  );
  const played = S.fixtures.filter(f => f.hg != null && f.hg !== "").length;
  $("rInfo").textContent = `${played} Resultate anderer Teams gespeichert`;
}

export function initSettings() {
  document.querySelectorAll<HTMLElement>(".side button").forEach(
    b =>
      (b.onclick = () => {
        setView = b.dataset.s ?? "verein";
        renderSettings();
      }),
  );
  $("logoIn").onchange = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f)
      shrink(f, 200, d => {
        pendingLogo = d;
        renderSettings();
      });
  };
  $("saveMeta").onclick = async () => {
    const meta = {
      ...S.meta,
      club: $("mClub").value.trim(),
      team: $("mTeam").value.trim(),
      league: $("mLeague").value.trim(),
      season: $("mSeason").value.trim(),
      fbName: $("mFbName").value.trim(),
      promotion: num($("mPromo").value),
      relegation: num($("mRel").value),
      relegationMaybe: num($("mRelQ").value) || num($("mRel").value),
    };
    if (pendingLogo !== undefined) meta.logo = pendingLogo;
    try {
      await putDoc("team/meta", "meta", meta);
      pendingLogo = undefined;
      $("metaMsg").textContent = "Gespeichert.";
    } catch (e) {
      $("metaMsg").textContent = errMsg(e);
    }
  };
  $("pePos").innerHTML = POS_ALL.map(([k, l]) => `<option value="${k}">${l} (${k})</option>`).join("");
  ["peName", "peNr", "pePos", "peCap"].forEach(id => $(id).addEventListener("input", previewP));
  $("pePhoto").onchange = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f)
      shrink(f, 220, d => {
        if (d) {
          pendingPhoto = d;
          previewP();
        } else $("peWarn").textContent = "Bild konnte nicht gelesen werden.";
      });
  };
  $("peNoPhoto").onclick = () => {
    pendingPhoto = null;
    previewP();
  };
  $("addPlayer").onclick = () => openPEdit(null);
  $("peForm").onsubmit = async (e: Event) => {
    e.preventDefault();
    const name = $("peName").value.trim();
    if (!name) {
      $("peWarn").textContent = "Bitte einen Namen eintragen.";
      return;
    }
    const old = editP ? pById(editP) : null;
    const p = {
      ...(old || {}),
      id: editP || uid(),
      name,
      nr: num($("peNr").value) || null,
      pos: $("pePos").value,
      year: num($("peYear").value) || null,
      captain: $("peCap").checked,
    };
    if (pendingPhoto !== undefined) {
      if (pendingPhoto) p.photo = pendingPhoto;
      else delete p.photo;
    }
    $("peSave").disabled = true;
    try {
      await put("players", p);
      await saveNote(p.id, $("peNote").value.trim());
      $("pedit").close();
    } catch (err) {
      $("peWarn").textContent = errMsg(err);
    } finally {
      $("peSave").disabled = false;
    }
  };
  $("peDel").onclick = async () => {
    const b = $("peDel");
    if (b.dataset.armed !== "1") {
      b.dataset.armed = "1";
      b.textContent = "Wirklich entfernen?";
      setTimeout(() => {
        b.dataset.armed = "";
        b.textContent = "Spieler entfernen";
      }, 3000);
      return;
    }
    try {
      await del("players", editP!);
      await saveNote(editP!, "");
      $("pedit").close();
    } catch (err) {
      $("peWarn").textContent = errMsg(err);
    }
  };
  $("pubCopy").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("pubLink").value);
      $("pubCopy").textContent = "Kopiert ✓";
    } catch (e) {
      $("pubLink").select();
    }
  };
  $("tRead").onclick = () => {
    const rows = parseTable($("tPaste").value);
    if (!rows.length) {
      $("tPasteInfo").textContent =
        "Keine Tabelle erkannt. Bitte die ganze Tabelle inkl. Platz, Team und Zahlen kopieren.";
      $("tPrev").innerHTML = "";
      return;
    }
    tDraft = rows;
    tEditRender();
    const w = rows.filter(r => r.warn).length;
    $("tPasteInfo").textContent =
      `${rows.length} Teams erkannt${w ? ` · ${w} Zeile(n) rot markiert, bitte prüfen` : " · alles plausibel"}. Unten prüfen und speichern.`;
  };
  $("tAddRow").onclick = () => {
    if (!tDraft) tEditRender();
    tDraft!.push({ rank: tDraft!.length + 1, team: "", sp: 0, s: 0, u: 0, n: 0, gf: 0, ga: 0, pts: 0 });
    tEditRender();
  };
  $("tSave").onclick = async () => {
    const rows = (tDraft || [])
      .filter(r => String(r.team).trim())
      .map(r => ({
        rank: +r.rank,
        team: String(r.team).trim(),
        sp: +r.sp || 0,
        s: +r.s || 0,
        u: +r.u || 0,
        n: +r.n || 0,
        gf: +r.gf || 0,
        ga: +r.ga || 0,
        pts: +r.pts || 0,
      }))
      .sort((a, b) => a.rank - b.rank);
    const tdoc = { rows, updated: new Date().toISOString().slice(0, 10), season: S.season };
    try {
      if (S.season === curSeason()) await dbUpsert({ coll: "team", id: "table", data: tdoc });
      await up("team", "table-" + S.season.replace("/", "-"), tdoc);
      tDraft = null;
      $("tMsg").textContent = `Gespeichert: ${rows.length} Teams.`;
      $("tPaste").value = "";
      $("tPasteInfo").textContent = "";
      tEditRender();
    } catch (e) {
      $("tMsg").textContent = errMsg(e);
    }
  };
  $("rAdd").onclick = () => {
    rDraft.push({ h: "", a: "", hg: "", ag: "" });
    rRender();
  };
  $("rSave").onclick = async () => {
    const date = $("rDate").value;
    if (!date) {
      $("rMsg").textContent = "Bitte ein Datum wählen.";
      return;
    }
    const ok = rDraft.filter(r => r.h && r.a && r.hg !== "" && r.ag !== "" && norm(r.h) !== norm(r.a));
    const ours = ok.filter(r => isOurs(r.h) || isOurs(r.a));
    const docs = ok
      .filter(r => !isOurs(r.h) && !isOurs(r.a))
      .map(r => {
        const ex = S.fixtures.find(f => f.date === date && norm(f.home) === norm(r.h) && norm(f.away) === norm(r.a));
        return {
          coll: "fixtures",
          id: ex ? ex.id : slug(`${date}-${r.h}-${r.a}`),
          data: {
            ...(ex ? (({ id: _id, ...x }) => x)(ex) : {}),
            date,
            home: r.h,
            away: r.a,
            hg: +r.hg,
            ag: +r.ag,
            comp: ex?.comp || "Meisterschaft",
          },
        };
      });
    if (!docs.length) {
      $("rMsg").textContent = ours.length
        ? "Eigene Spiele bitte über «Live erfassen» oder Spiele → Bearbeiten eintragen."
        : "Keine vollständige Partie (Heim, Gast, beide Tore).";
      return;
    }
    const { error } = await dbUpsert(docs);
    if (error) {
      $("rMsg").textContent = errMsg(error);
      return;
    }
    rDraft = [];
    $("rMsg").textContent =
      `${docs.length} Resultat(e) gespeichert.${ours.length ? " Eigene Spiele wurden übersprungen." : ""}`;
    await loadAll();
    rRender();
  };
  $("rCalc").onclick = () => {
    tDraft = tableFromResults();
    tEditRender();
    const sp = tDraft.map(r => r.sp),
      mn = Math.min(...sp),
      mx = Math.max(...sp);
    $("tMsg").textContent =
      `Berechnet aus ${S.fixtures.filter(f => f.hg != null && f.hg !== "").length + S.matches.filter(played).length} Spielen${mn !== mx ? ` · Achtung: Teams haben ${mn}–${mx} Spiele, es fehlen Resultate` : ""}. Prüfen und «Tabelle speichern».`;
  };
}
