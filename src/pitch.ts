// Spielfeld: Spieler platzieren, zeichnen und per Finger/Maus verschieben.
import { LINE, SLOT, nearestPos } from "./positions";
import type { LineupSpot, Player } from "./types";
import { $$, esc, face, sn } from "./util";

export type Layout = Record<string, LineupSpot>;
export interface Placed {
  p: Player;
  x: number;
  y: number;
  pos: string;
  auto?: boolean;
}

/** Kleine Spielerkarte auf dem Feld. */
export function mini(p: Player): string {
  return `<div class="mini ${LINE[p.pos ?? ""] || "XXX"}"><div class="face">${face(p)}</div><div class="nm">${esc(sn(p))}</div><div class="nr">${p.nr ? "#" + p.nr + " · " : ""}${esc(p.pos || "")}</div></div>`;
}

/** Positionen bestimmen: gespeicherte Lage, sonst Standardposition des Spielers. */
export function placeXi(xi: Player[], layout?: Layout | null): Placed[] {
  const lay = layout || {};
  const placed: Placed[] = xi.map(p => {
    const l = lay[p.id];
    if (l && l.x != null) return { p, x: l.x, y: l.y, pos: l.pos || nearestPos(l.x, l.y) };
    const sl = SLOT[p.pos ?? ""] || { x: 50, y: 48 };
    return { p, x: sl.x, y: sl.y, pos: p.pos || "ZM", auto: true };
  });
  // Automatisch platzierte Spieler mit gleicher Position nebeneinander schieben
  const groups: Record<string, Placed[]> = {};
  placed.filter(q => q.auto).forEach(q => (groups[q.x + "|" + q.y] ||= []).push(q));
  for (const g of Object.values(groups)) {
    if (g.length < 2) continue;
    if (g.length === 2 && g[0].x !== 50) {
      g[1].x = 100 - g[0].x;
      continue;
    }
    g.forEach((q, i) => (q.x = Math.max(10, Math.min(90, q.x + (i - (g.length - 1) / 2) * 24))));
  }
  return placed;
}

/** Formation als Text, z. B. «4-4-2». */
export const formation = (placed: Placed[]): string =>
  (["ABW", "MIT", "ANG"] as const)
    .map(l => placed.filter(q => LINE[q.pos] === l).length)
    .filter(Boolean)
    .join("-") || "–";

export function drawPitch(
  pitch: HTMLElement,
  tag: HTMLElement,
  xi: Player[],
  onClick?: ((id: string) => void) | null,
  layout?: Layout | null,
): void {
  $$(".slot,.empty", pitch).forEach(e => e.remove());
  if (!xi.length) {
    tag.textContent = "–";
    pitch.insertAdjacentHTML("beforeend", `<div class="empty">Keine Startelf erfasst.</div>`);
    return;
  }
  const placed = placeXi(xi, layout);
  tag.textContent = formation(placed);
  for (const q of placed) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot";
    b.style.left = q.x + "%";
    b.style.top = q.y + "%";
    b.setAttribute("aria-label", `${q.p.name}, ${q.pos}`);
    b.innerHTML = mini({ ...q.p, pos: q.pos });
    b.dataset.p = q.p.id;
    b.dataset.pos = q.pos;
    if (onClick) b.onclick = () => onClick(q.p.id);
    pitch.appendChild(b);
  }
}

/** Bildschirmpunkt → Prozent auf dem Feld. */
export function pitchPct(pitch: HTMLElement, cx: number, cy: number): { x: number; y: number } {
  const r = pitch.getBoundingClientRect();
  const clamp = (v: number) => Math.round(Math.max(6, Math.min(94, v)));
  return { x: clamp(((cx - r.left) / r.width) * 100), y: clamp(((cy - r.top) / r.height) * 100) };
}

/**
 * Element ziehbar machen (Maus und Finger). Kurzes Tippen ruft onTap auf,
 * Ziehen auf ein Element mit data-zone ruft onDrop mit Zone und Bildschirmpunkt auf.
 */
export function dragify(
  el: HTMLElement,
  onTap: (id: string) => void,
  onDrop: (id: string, zone: string, x: number, y: number) => void,
): void {
  el.style.touchAction = "none";
  el.addEventListener("pointerdown", e => {
    e.preventDefault();
    const sx = e.clientX,
      sy = e.clientY,
      id = el.dataset.p ?? "";
    let ghost: HTMLElement | null = null,
      over: HTMLElement | null = null;
    const zoneAt = (x: number, y: number): HTMLElement | null => {
      if (ghost) ghost.style.display = "none";
      const z = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-zone]") ?? null;
      if (ghost) ghost.style.display = "";
      return z;
    };
    const move = (ev: PointerEvent) => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        ghost = el.cloneNode(true) as HTMLElement;
        ghost.classList.add("ghost");
        if (ghost.classList.contains("slot")) {
          ghost.style.width = el.offsetWidth + "px";
          ghost.style.position = "fixed";
        }
        (el.closest("dialog") || document.body).appendChild(ghost);
      }
      if (!ghost) return;
      ghost.style.left = ev.clientX + "px";
      ghost.style.top = ev.clientY + "px";
      const z = zoneAt(ev.clientX, ev.clientY);
      if (z !== over) {
        over?.classList.remove("over");
        over = z;
        over?.classList.add("over");
      }
    };
    const up = (ev: PointerEvent) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      over?.classList.remove("over");
      if (ghost) {
        ghost.remove();
        const z = zoneAt(ev.clientX, ev.clientY);
        if (z?.dataset.zone) onDrop(id, z.dataset.zone, ev.clientX, ev.clientY);
      } else onTap(id);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  });
}
