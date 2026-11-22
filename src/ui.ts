// Gemeinsame Oberflächen-Bausteine.
import { $ } from "./util";

/** Auswahl-Fenster (Dialog #lsheet) mit Titel und Inhalt öffnen. */
export function sheet(title: string, html: string, bind: (body: HTMLElement) => void): void {
  $("lsTitle").textContent = title;
  $("lsBody").innerHTML = html;
  bind($("lsBody"));
  if (!$("lsheet").open) $("lsheet").showModal();
}

export const closeSheet = (): void => $("lsheet").close();

/** Kennzahl-Kachel. */
export const kpi = (v: string | number, l: string, s?: string, size?: number): string =>
  `<div class="kpi"><div class="v"${size ? ` style="font-size:${size}px"` : ""}>${v}</div><div class="l">${l}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
