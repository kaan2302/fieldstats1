import { KINDS } from "../domain/coach";
import type { GoalKind } from "../types";
import { shortName } from "../domain/privacy";
// Live-Erfassung am Spielfeldrand: Aufstellung ziehen, Tore/Wechsel/Karten antippen, Abpfiff speichern.
import { dbUpsert, loadAll, sb } from "../db";
import { byDate, pById, played } from "../domain";
import { aufgebotSheet } from "../pdf";
import { dragify, drawPitch, pitchPct } from "../pitch";
import { POS_ORDER, nearestPos } from "../positions";
import { S, ctx, teamUrl } from "../state";
import type { LiveEvent, LivePhase, LiveState, Match, Player } from "../types";
import { closeSheet, sheet } from "../ui";
import { $, $$, confirmBtn, esc, face, fmtD, minKey, sn, today, uid } from "../util";
import { benchNow, currentLayout, liveMin, liveScore, matchFromLive, onField } from "./model";

/** Laufende Erfassung (null, wenn keine aktiv ist). */
let L: LiveState | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;

const cur = (): LiveState => {
  if (!L) throw new Error("Keine Live-Erfassung aktiv");
  return L;
};
const storeKey = (id: string) => "live:" + id;
const pName = (id?: string | null) => pById(id)?.name || "?";
const short = (id?: string | null) => sn(pById(id) || { id: "", name: "?" });
const touch = () => (cur().updated = Date.now());

/** Darf man hier erfassen? Admin oder gültiger Live-Link. */
export const canTrack = (): boolean => S.admin || ctx.liveTokOk;

/** Speichern: Admin schreibt direkt, mit Live-Link über die geschützte Datenbank-Funktion. */
async function liveWrite(live: LiveState | null, match: Omit<Match, "id"> | null) {
  const id = cur().id;
  if (S.admin) {
    if (match) {
      const { error } = await dbUpsert({ coll: "matches", id, data: match });
      if (error) return { error };
    }
    return live
      ? dbUpsert({ coll: "live", id, data: live })
      : sb.from("docs").delete().match({ team_id: ctx.team, coll: "live", id });
  }
  return sb.rpc("live_save", { p_token: ctx.liveKey, p_live: live, p_match_data: match });
}

/** Lokal sichern und (kurz verzögert) in die Datenbank schreiben. */
function liveSave(now = false): void {
  const l = cur();
  try {
    localStorage.setItem(storeKey(l.id), JSON.stringify(l));
  } catch {
    /* voller Speicher */
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(
    async () => {
      const { error } = await liveWrite(l, null);
      const st = $("lvSync");
      if (st) st.textContent = error ? "Nicht gespeichert – Verbindung prüfen" : "Gespeichert";
    },
    now ? 0 : 500,
  );
}

/** Neuere lokale Kopie bevorzugen (z. B. nach Verbindungsabbruch). */
function resume(saved: LiveState): LiveState {
  try {
    const loc = JSON.parse(localStorage.getItem(storeKey(saved.id)) || "null") as LiveState | null;
    if (loc && (loc.updated || 0) > (saved.updated || 0)) return loc;
  } catch {
    /* ungültig */
  }
  return saved;
}

const fromMatch = (m: Match) => ({
  id: m.id,
  opp: m.opp,
  home: !!m.home,
  date: m.date,
  time: m.time || "",
  comp: m.comp || "Meisterschaft",
});

/** Einstieg in den Tab «Live». */
export function liveOpen(): void {
  const box = $("liveBody");
  if (!canTrack()) {
    box.innerHTML = `<h2>Live erfassen</h2><p class="muted">Dafür brauchst du einen Live-Link vom Admin oder musst als Admin angemeldet sein.</p>`;
    return;
  }
  // Mit Live-Link: direkt das eine Spiel
  if (!S.admin && ctx.liveMatch) {
    const m = S.all.matches.find(x => x.id === ctx.liveMatch);
    const lv = S.live.find(x => x.id === ctx.liveMatch);
    if (!L && lv) L = resume(lv);
    if (L) return liveRender();
    if (!m) {
      box.innerHTML = `<h2>Live erfassen</h2><p class="muted">Dieses Spiel gibt es nicht mehr.</p>`;
      return;
    }
    if (played(m) && !m.live) {
      box.innerHTML = `<h2>${m.home ? "vs." : "@"} ${esc(m.opp)}</h2><p class="muted">Dieses Spiel ist schon erfasst (${m.gf}:${m.ga}).</p>`;
      return;
    }
    return liveStart(fromMatch(m));
  }
  // Admin: laufende Erfassung fortsetzen oder Spiel wählen
  const running = S.live.find(x => x.phase !== "end");
  if (running && !L) L = resume(running);
  if (L) return liveRender();
  const t = today();
  const cand = S.matches
    .filter(m => !played(m))
    .sort(byDate)
    .slice(0, 4);
  box.innerHTML = `<div class="h"><h2>Live erfassen</h2><a class="btn sm" href="#spiele">Zurück</a></div>
    <h3>Welches Spiel?</h3><div class="list">${
      cand
        .map(
          m =>
            `<button type="button" class="li" data-m="${esc(m.id)}" style="width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer"><b>${m.home ? "vs." : "@"} ${esc(m.opp)}</b><span class="small muted">${fmtD(m.date)}${m.time ? " · " + esc(m.time) : ""}</span><span class="n" style="font-size:14px">${m.date <= t ? "Heute / vorbei" : ""}</span></button>`,
        )
        .join("") || `<p class="small muted">Keine geplanten Spiele.</p>`
    }</div>
    <h3 style="margin-top:14px">Oder neues Spiel</h3>
    <div class="grid"><label for="lvOpp">Gegner<input id="lvOpp" placeholder="FC Muster"></label><label for="lvHome">Ort<select id="lvHome"><option value="1">Heim</option><option value="0">Auswärts</option></select></label><label for="lvDate">Datum<input id="lvDate" type="date" value="${t}"></label></div>
    <div class="h" style="margin-top:10px"><span></span><button class="btn hot" type="button" id="lvNew">Weiter zur Aufstellung</button></div>`;
  (box as HTMLElement).querySelectorAll<HTMLElement>("[data-m]").forEach(b => {
    b.onclick = () => {
      const m = S.matches.find(x => x.id === b.dataset.m);
      if (m) liveStart(fromMatch(m));
    };
  });
  $("lvNew").onclick = () => {
    const o = $("lvOpp").value.trim();
    if (!o) return $("lvOpp").focus();
    liveStart({
      id: uid(),
      opp: o,
      home: $("lvHome").value === "1",
      date: $("lvDate").value || t,
      time: "",
      comp: "Meisterschaft",
      isNew: true,
    });
  };
}

function liveStart(m: Pick<LiveState, "id" | "opp" | "home" | "date" | "time" | "comp" | "isNew">): void {
  const last = S.matches
    .filter(x => played(x) && x.stats && Object.values(x.stats).some(s => s.start))
    .sort(byDate)
    .pop();
  L = {
    ...m,
    phase: "setup",
    xi: [],
    bench: [],
    events: [],
    updated: Date.now(),
    xiPos: {},
    lastXi: last ? S.players.filter(p => last.stats?.[p.id]?.start).map(p => p.id) : [],
    lastLayout: last?.lineup || {},
  };
  liveRender();
}

const chip = (p: Player) =>
  `<button type="button" class="chip-p" data-p="${esc(p.id)}"><span class="face">${face(p)}</span>${esc(sn(p))}<span class="ps">${esc(p.pos || "")}</span></button>`;

const PHASE_BUTTON: Partial<Record<LivePhase, [string, LivePhase]>> = {
  h1: ["Halbzeit", "ht"],
  ht: ["2. Halbzeit starten", "h2"],
  h2: ["Abpfiff", "end"],
  post: ["Fertig – speichern", "end"],
};

function liveRender(): void {
  clearInterval(clockTimer);
  const l = cur(),
    box = $("liveBody"),
    [gf, ga] = liveScore(l);
  const clock = l.phase === "ht" ? "Pause" : l.phase === "post" ? "" : l.phase === "end" ? "Ende" : liveMin(l) + "'";
  const head = `<div class="lv-top"><div><h2>${l.home ? "vs." : "@"} ${esc(l.opp)}</h2><span class="small muted">${fmtD(l.date)} · <span id="lvSync">${l.phase === "setup" ? "Aufstellung" : "Gespeichert"}</span></span></div>
    ${l.phase !== "setup" ? `<div class="lv-score"><div>${gf}<small>Wir</small></div><div>:</div><div>${ga}<small>Gegner</small></div></div><div class="lv-clock" id="lvClock">${clock}</div>` : ""}</div>`;
  if (l.phase === "setup") return liveSetup(box, head);

  const field = onField(l, S.players),
    bench = benchNow(l, S.players),
    next = PHASE_BUTTON[l.phase];
  box.innerHTML =
    head +
    `
    <div class="lv-act" style="margin:12px 0">
      <button type="button" class="g" data-a="goal"><span>⚽</span>Tor</button><button type="button" class="a" data-a="ag"><span>🥅</span>Gegentor</button>
      <button type="button" class="s" data-a="sub"><span>🔁</span>Wechsel</button><button type="button" class="c" data-a="card"><span>🟨</span>Karte</button>
    </div>
    <div class="two"><div><h3>Auf dem Platz <span style="text-transform:none;letter-spacing:0">· antippen für Aktion</span></h3><div class="pitch" id="lvPitch" style="max-height:440px"><div class="lines"></div><div class="mid"></div><div class="circle"></div><span class="tag" id="lvTag">–</span></div>
      <h3 style="margin-top:10px">Bank <span style="text-transform:none;letter-spacing:0">· antippen zum Einwechseln</span></h3><div class="zone" id="lvBench">${bench.map(chip).join("") || `<span class="small muted">Niemand mehr auf der Bank</span>`}</div></div>
    <div><h3>Ereignisse</h3><div class="list" id="lvEvents">${evList(l)}</div>
      <div class="h" style="margin-top:14px"><button class="btn sm danger" type="button" id="lvCancel">Erfassung verwerfen</button>${next ? `<button class="btn hot" type="button" id="lvPhase">${next[0]}</button>` : ""}</div></div></div>`;

  drawPitch($("lvPitch"), $("lvTag"), field, id => playerSheet(id), currentLayout(l, S.players));
  $$(".chip-p", $("lvBench")).forEach((c: HTMLElement) => (c.onclick = () => subSheet(null, c.dataset.p)));
  const actions: Record<string, () => void> = {
    goal: () => goalSheet(),
    ag: agSheet,
    sub: () => subSheet(),
    card: () => cardSheet(),
  };
  (box as HTMLElement)
    .querySelectorAll<HTMLElement>("[data-a]")
    .forEach(b => (b.onclick = () => actions[b.dataset.a ?? ""]?.()));
  (box as HTMLElement).querySelectorAll<HTMLElement>("[data-del]").forEach(b => {
    b.onclick = () => {
      l.events = l.events.filter(e => e.id !== b.dataset.del);
      touch();
      liveSave();
      liveRender();
    };
  });
  if (next)
    $("lvPhase").onclick = () => {
      if (next[1] === "end") {
        if (confirmBtn($("lvPhase"))) void liveFinish();
        return;
      }
      if (next[1] === "h2") l.t2 = Date.now();
      l.phase = next[1];
      touch();
      liveSave(true);
      liveRender();
    };
  $("lvCancel").onclick = async () => {
    if (!confirmBtn($("lvCancel"))) return;
    await liveWrite(null, null);
    try {
      localStorage.removeItem(storeKey(l.id));
    } catch {
      /* egal */
    }
    L = null;
    liveOpen();
  };
  if (l.phase === "h1" || l.phase === "h2")
    clockTimer = setInterval(() => {
      const c = $("lvClock");
      if (c && L) c.textContent = liveMin(L) + "'";
      else clearInterval(clockTimer);
    }, 10000);
}

function evList(l: LiveState): string {
  const ev = [...l.events].sort((a, b) => minKey(b.min) - minKey(a.min));
  if (!ev.length) return `<p class="small muted">Noch nichts erfasst.</p>`;
  const txt = (e: LiveEvent) =>
    e.t === "goal"
      ? `⚽ <b>${esc(e.og ? "Eigentor Gegner" : pName(e.who))}</b>${e.ast ? ` <span class="muted small">Vorlage ${esc(short(e.ast))}</span>` : ""}${kindTag(e.kind)}`
      : e.t === "ag"
        ? `🥅 Gegentor${e.name ? " · " + esc(e.name) : ""}${kindTag(e.kind)}`
        : e.t === "sub"
          ? `🔁 <b>${esc(short(e.inn))}</b> für ${esc(short(e.out))}`
          : `${e.t === "y" ? "🟨" : "🟥"} ${esc(pName(e.who))}`;
  return ev
    .map(
      e =>
        `<div class="ev"><span class="m">${esc(e.min)}'</span><span>${txt(e)}</span><button class="btn sm" type="button" data-del="${esc(e.id)}" aria-label="Löschen">✕</button></div>`,
    )
    .join("");
}

/** Aufstellung: Spieler aufs Feld ziehen (bleiben, wo abgelegt) oder antippen. */
function liveSetup(box: HTMLElement, head: string): void {
  const l = cur();
  l.xiPos ||= {};
  const inXi = new Set(l.xi),
    inB = new Set(l.bench);
  const rest = S.players
    .filter(p => !inXi.has(p.id) && !inB.has(p.id))
    .sort((a, b) => (POS_ORDER[a.pos ?? ""] ?? 99) - (POS_ORDER[b.pos ?? ""] ?? 99));
  box.innerHTML =
    head +
    `<p class="small muted">Spieler aufs Feld ziehen – sie bleiben, wo du sie ablegst, die Position passt sich an. Oder antippen: Kader → Startelf → Bank → Kader.</p>
    <div class="two"><div><h3>Startelf <span id="lvXiN" style="text-transform:none">${l.xi.length}/11</span></h3><div class="pitch" id="lvPitch" data-zone="xi" style="max-height:440px"><div class="lines"></div><div class="mid"></div><div class="circle"></div><span class="tag" id="lvTag">–</span></div>
      ${l.lastXi?.length && !l.xi.length ? `<button class="btn sm" type="button" id="lvLast" style="margin-top:8px">Startelf vom letzten Spiel übernehmen</button>` : ""}</div>
    <div><h3>Bank</h3><div class="zone" data-zone="bench" id="lvB">${S.players
      .filter(p => inB.has(p.id))
      .map(chip)
      .join("")}</div>
      <h3 style="margin-top:10px">Kader</h3><div class="zone" data-zone="rest" id="lvR">${rest.map(chip).join("")}</div></div></div>
    <p class="warn" id="lvWarn"></p>
    <div class="h" style="margin-top:10px"><button class="btn sm" type="button" id="lvPdf">Aufgebot als PDF</button><button class="btn sm" type="button" id="lvPost">Nachträglich erfassen (ohne Uhr)</button><button class="btn hot" type="button" id="lvKick">Anpfiff ▶</button></div>`;
  drawPitch(
    $("lvPitch"),
    $("lvTag"),
    S.players.filter(p => inXi.has(p.id)),
    null,
    l.xiPos,
  );

  const move = (id: string, zone: string, cx?: number, cy?: number) => {
    const pos = l.xiPos!,
      wasXi = l.xi.includes(id);
    l.xi = l.xi.filter(x => x !== id);
    l.bench = l.bench.filter(x => x !== id);
    if (zone === "xi") {
      if (!wasXi && l.xi.length >= 11) {
        l.bench.push(id);
        delete pos[id];
      } else {
        l.xi.push(id);
        if (cx != null && cy != null) {
          const q = pitchPct($("lvPitch"), cx, cy);
          pos[id] = { ...q, pos: nearestPos(q.x, q.y) };
        }
      }
    } else {
      delete pos[id];
      if (zone === "bench") l.bench.push(id);
    }
    touch();
    liveRender();
  };
  const cycle = (id: string) =>
    move(id, l.xi.includes(id) ? "bench" : l.bench.includes(id) ? "rest" : l.xi.length < 11 ? "xi" : "bench");
  (box as HTMLElement).querySelectorAll<HTMLElement>("[data-p]").forEach(el => dragify(el, cycle, move));

  const lb = $("lvLast");
  if (lb)
    lb.onclick = () => {
      l.xi = (l.lastXi || []).filter(id => pById(id)).slice(0, 11);
      l.xiPos = structuredClone(l.lastLayout || {});
      touch();
      liveRender();
    };
  const needXi = () => {
    if (l.xi.length) return true;
    $("lvWarn").textContent = "Zuerst die Startelf wählen.";
    return false;
  };
  const go = (phase: LivePhase) => {
    if (!needXi()) return;
    l.phase = phase;
    if (phase === "h1") l.t1 = Date.now();
    touch();
    liveSave(true);
    liveRender();
  };
  $("lvPdf").onclick = () =>
    needXi() &&
    aufgebotSheet({ opp: l.opp, home: l.home, date: l.date, time: l.time, xi: l.xi, bench: l.bench, layout: l.xiPos });
  $("lvKick").onclick = () => go("h1");
  $("lvPost").onclick = () => go("post");
}

// ---- Auswahl-Fenster für Ereignisse

const nowMin = () => (cur().phase === "post" ? "" : liveMin(cur()));
const minField = (value = nowMin()) =>
  `<label for="lsMin" style="max-width:160px;margin-bottom:10px">Minute<input id="lsMin" inputmode="numeric" value="${esc(value)}" placeholder="z. B. 23 oder 90+2"></label>`;
/** Torart (optional): ein Klick, nochmals klicken hebt die Auswahl auf. */
let kindSel: GoalKind | null = null;
const kindField = () =>
  `<div class="small muted" style="font-weight:700;margin:0 0 6px">Torart</div><div class="seg" id="lsKind" role="group" aria-label="Torart" style="margin-bottom:12px;flex-wrap:wrap">${KINDS.map(
    x => `<button type="button" data-kind="${x.k}" aria-pressed="${kindSel === x.k}">${x.label}</button>`,
  ).join("")}</div>`;
const bindKind = (body: HTMLElement) =>
  body.querySelectorAll<HTMLElement>("[data-kind]").forEach(
    b =>
      (b.onclick = () => {
        kindSel = kindSel === b.dataset.kind ? null : (b.dataset.kind as GoalKind);
        body
          .querySelectorAll<HTMLElement>("[data-kind]")
          .forEach(x => x.setAttribute("aria-pressed", String(x.dataset.kind === kindSel)));
      }),
  );
const kindTag = (k?: GoalKind) =>
  k ? ` <span class="muted small">· ${KINDS.find(x => x.k === k)?.label ?? ""}</span>` : "";
const withKind = () => (kindSel ? { kind: kindSel } : {});
const pickList = (ps: Player[], extra = "") =>
  `<div class="pick">${ps.map(p => `<button type="button" data-p="${esc(p.id)}">${esc(sn(p))}<small>${p.nr ? "#" + p.nr + " · " : ""}${esc(p.pos || "")}</small></button>`).join("")}${extra}</div>`;
const onPick = (body: HTMLElement, fn: (id: string) => void) =>
  body.querySelectorAll<HTMLElement>("[data-p]").forEach(x => (x.onclick = () => fn(x.dataset.p ?? "")));

/** Ereignis mit der Minute aus dem Feld hinzufügen. */
function addEv(e: Omit<LiveEvent, "id" | "min">): boolean {
  const min = String($("lsMin")?.value || "")
    .trim()
    .replace(/'/g, "");
  if (!min) {
    $("lsMin").focus();
    $("lsMin").placeholder = "Minute fehlt";
    return false;
  }
  cur().events.push({ id: uid(), min, ...e });
  touch();
  liveSave(true);
  closeSheet();
  liveRender();
  return true;
}

function goalSheet(scorer?: { who: string; min: string }): void {
  const field = onField(cur(), S.players);
  if (!scorer) {
    kindSel = null;
    return sheet(
      "Tor – wer hat getroffen?",
      minField() +
        kindField() +
        pickList(field, `<button type="button" data-p="og">Eigentor Gegner<small>ohne Torschütze</small></button>`),
      b => {
        bindKind(b);
        onPick(b, id =>
          id === "og"
            ? void addEv({ t: "goal", who: null, og: true })
            : kindSel === "penalty"
              ? void addEv({ t: "goal", who: id, ast: null, kind: "penalty" })
              : goalSheet({ who: id, min: $("lsMin").value }),
        );
      },
    );
  }
  sheet(
    "Vorlage von?",
    minField(scorer.min) +
      kindField() +
      pickList(
        field.filter(p => p.id !== scorer.who),
        `<button type="button" data-p="">Keine Vorlage</button>`,
      ),
    b => {
      bindKind(b);
      onPick(b, id => void addEv({ t: "goal", who: scorer.who, ast: id || null, ...withKind() }));
    },
  );
}

function agSheet(): void {
  kindSel = null;
  sheet(
    "Gegentor",
    minField() +
      kindField() +
      `<label for="lsName">Torschütze Gegner (optional)<input id="lsName" placeholder="Vorname N. oder leer lassen"></label><div class="h" style="margin-top:10px"><span></span><button class="btn hot" type="button" id="lsOk">Gegentor speichern</button></div>`,
    b => {
      bindKind(b);
      $("lsOk").onclick = () => addEv({ t: "ag", name: shortName($("lsName").value), ...withKind() });
    },
  );
}

function subSheet(out?: { id: string; min: string } | null, inn?: string): void {
  const field = onField(cur(), S.players),
    bench = benchNow(cur(), S.players);
  if (!out && !inn)
    return sheet("Wechsel – wer geht raus?", minField() + pickList(field), b =>
      onPick(b, id => subSheet({ id, min: $("lsMin").value })),
    );
  if (!out && inn)
    return sheet(`${short(inn)} kommt rein – für wen?`, minField() + pickList(field), b =>
      onPick(b, id => void addEv({ t: "sub", out: id, inn })),
    );
  if (!out) return;
  sheet(
    `${short(out.id)} geht raus – wer kommt rein?`,
    minField(out.min) + (bench.length ? pickList(bench) : `<p class="muted">Niemand auf der Bank.</p>`),
    b => onPick(b, id => void addEv({ t: "sub", out: out.id, inn: id })),
  );
}

function cardSheet(who?: string): void {
  const card = (id: string) =>
    sheet(
      `Karte für ${short(id)}`,
      minField() +
        `<div class="lv-act"><button type="button" class="c" id="lsY"><span>🟨</span>Gelb</button><button type="button" class="a" id="lsR"><span>🟥</span>Rot</button></div>`,
      () => {
        $("lsY").onclick = () => {
          const l = cur(),
            second = l.events.some(e => e.t === "y" && e.who === id);
          if (addEv({ t: "y", who: id }) && second) {
            // Zweite Gelbe = Platzverweis in derselben Minute
            l.events.push({ id: uid(), t: "r", who: id, min: l.events[l.events.length - 1].min, second: true });
            liveSave(true);
            liveRender();
          }
        };
        $("lsR").onclick = () => addEv({ t: "r", who: id });
      },
    );
  if (who) return card(who);
  sheet("Karte – für wen?", pickList(onField(cur(), S.players)), b => onPick(b, card));
}

function playerSheet(id: string): void {
  sheet(
    pName(id),
    `<div class="lv-act">
    <button type="button" class="g" id="psG"><span>⚽</span>Tor</button><button type="button" class="s" id="psS"><span>🔁</span>Auswechseln</button>
    <button type="button" class="c" id="psC"><span>🟨</span>Karte</button><button type="button" class="a" id="psX" style="background:var(--panel2);color:var(--ink)"><span>✕</span>Abbrechen</button></div>`,
    () => {
      $("psG").onclick = () => goalSheet({ who: id, min: nowMin() });
      $("psS").onclick = () => subSheet({ id, min: nowMin() });
      $("psC").onclick = () => cardSheet(id);
      $("psX").onclick = closeSheet;
    },
  );
}

/** Abpfiff: fertiges Spiel speichern und Erfassung schliessen. */
async function liveFinish(): Promise<void> {
  clearInterval(clockTimer);
  const l = cur();
  const data = matchFromLive(
    l,
    S.all.matches.find(m => m.id === l.id),
  );
  const { error } = await liveWrite(null, data);
  if (error) {
    $("lvSync").textContent = "Speichern fehlgeschlagen – nochmals versuchen";
    return;
  }
  try {
    localStorage.removeItem(storeKey(l.id));
  } catch {
    /* egal */
  }
  L = null;
  await loadAll();
  const subs = l.events.filter(e => e.t === "sub").length;
  $("liveBody").innerHTML =
    `<h2>Gespeichert ✓</h2><p>${l.home ? "vs." : "@"} ${esc(l.opp)} · <b>${data.gf}:${data.ga}</b> · ${Object.keys(data.stats || {}).length} Spieler eingesetzt · ${subs} Wechsel.</p>
    <p class="small muted">Fehlt etwas? Der Admin kann das Spiel jederzeit unter Spiele → Bearbeiten ergänzen.</p><a class="btn hot" href="${esc(teamUrl(ctx.team ?? ""))}#spiele">Zu den Spielen</a>`;
}
