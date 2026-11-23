// Kleine, allgemeine Helfer ohne Fachlogik.
import type { Player } from "./types";

/** Element per ID. Bewusst locker typisiert, weil alle Elemente aus index.html stammen. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const $ = (id: string): any => document.getElementById(id);

/** Alle passenden Elemente als Array (optional innerhalb von root). */
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] => [
  ...root.querySelectorAll<T>(sel),
];

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Text sicher für HTML machen. */
export const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"']/g, c => ESC[c]);

export const uid = (): string =>
  crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

/** Zahl oder 0. */
export const num = (v: unknown): number => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

const MIN_RE = /(\d+)\s*(?:\+\s*(\d+))?/;
/** Spielminute als Zahl ohne Nachspielzeit ("90+3" → 90), null wenn leer. */
export const minNum = (v: unknown): number | null => {
  const m = String(v ?? "").match(MIN_RE);
  return m ? +m[1] : null;
};
/** Sortierschlüssel für Minuten inkl. Nachspielzeit ("45+2" → 4502). */
export const minKey = (v: unknown): number => {
  const m = String(v ?? "").match(MIN_RE);
  return m ? +m[1] * 100 + +(m[2] || 0) : 9999;
};

/** Für Vergleiche: klein, ohne Akzente, nur a–z und 0–9. */
export const norm = (s: unknown): string =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const slug = (s: unknown): string => norm(s).replace(/ /g, "-").slice(0, 80) || uid();

export const initials = (n: unknown): string =>
  String(n || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Anzeigename. Namen werden bereits als «Vorname N.» gespeichert (siehe domain/privacy.ts). */
export const sn = (p: Pick<Player, "id" | "name"> | null | undefined): string => p?.name?.trim() || "?";

/** Initialen als HTML (Fotos gibt es aus Datenschutzgründen nicht). */
export const face = (p: Pick<Player, "name"> | null | undefined): string => esc(initials(p ? p.name : "?"));

export const fmtD = (d: string, o?: Intl.DateTimeFormatOptions): string =>
  new Date(d + "T12:00").toLocaleDateString("de-CH", o || { day: "2-digit", month: "2-digit", year: "2-digit" });

export const today = (): string => new Date().toISOString().slice(0, 10);

/** Verständliche Fehlermeldung für Schreibfehler. */
export const errMsg = (err: unknown): string => {
  const e = (err ?? {}) as { code?: string; message?: string };
  return e.code === "42501" || /row-level security|permission/i.test(e.message || "")
    ? "Speichern abgelehnt: Du bist nicht als Admin angemeldet."
    : "Speichern hat nicht geklappt – bitte nochmals versuchen.";
};

/** Bild quadratisch zuschneiden und verkleinern (für Fotos und Logo). */
export function shrink(file: File, size: number, cb: (dataUrl: string | null) => void): void {
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const s = Math.min(img.width, img.height);
      c.width = c.height = size;
      c.getContext("2d")?.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      cb(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => cb(null);
    img.src = String(r.result);
  };
  r.readAsDataURL(file);
}

/** Zweistufige Bestätigung auf einem Knopf: erst «Sicher?», beim zweiten Tippen true. */
export function confirmBtn(b: HTMLElement): boolean {
  if (b.dataset.armed === "1") return true;
  const t = b.textContent;
  b.dataset.armed = "1";
  b.textContent = "Sicher? Nochmals tippen";
  setTimeout(() => {
    b.dataset.armed = "";
    b.textContent = t;
  }, 3000);
  return false;
}
