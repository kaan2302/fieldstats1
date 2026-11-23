import { normPos } from "./positions";
import { applyPrivacy } from "./domain/privacy";
import { createClient } from "@supabase/supabase-js";
import { SB_KEY, SB_URL } from "./config";
import { S, ctx } from "./state";
import type { AppState, LeagueTable } from "./types";
import { applySeason } from "./season";
import { $ } from "./util";
import { render } from "./views/app";

/** Supabase-Client. Der öffentliche Schlüssel darf im Code stehen – Schreiben ist per RLS geschützt. */
export const sb = createClient(SB_URL, SB_KEY);

export interface DocRow {
  coll: string;
  id: string;
  data: unknown;
}

/** Schreibt Dokumente des aktuellen Teams. */
export function dbUpsert(rows: DocRow | DocRow[]) {
  return sb.from("docs").upsert((Array.isArray(rows) ? rows : [rows]).map(r => ({ team_id: ctx.team, ...r })));
}
export const COLLS = ["players", "matches", "fixtures", "analyses", "live"] as const;
type Coll = (typeof COLLS)[number];
export async function loadAll() {
  const { data, error } = await sb.from("docs").select("coll,id,data").eq("team_id", ctx.team);
  if (error) throw error;
  const next: Pick<AppState, Coll | "meta" | "table" | "notes"> & { tables: Record<string, LeagueTable> } = {
    players: [],
    matches: [],
    fixtures: [],
    analyses: [],
    live: [],
    meta: {},
    table: null,
    tables: {},
    notes: {},
  };
  for (const r of data) {
    if ((COLLS as readonly string[]).includes(r.coll))
      (next[r.coll as Coll] as unknown[]).push({ id: r.id, ...r.data });
    else if (r.coll === "team" && r.id === "meta") next.meta = r.data || {};
    else if (r.coll === "team" && r.id === "table") next.table = r.data;
    else if (r.coll === "team" && r.id.startsWith("table-")) next.tables[r.id.slice(6).replace("-", "/")] = r.data;
    else if (r.coll === "ownernotes") next.notes[r.id] = (r.data || {}).note || "";
  }
  // Alte Positionscodes (AV, DM, OM, FL) auf die neuen umstellen
  for (const p of next.players) p.pos = normPos(p.pos);
  for (const m of next.matches) for (const l of Object.values(m.lineup || {})) if (l.pos) l.pos = normPos(l.pos);
  // Datenschutz: nur «Vorname N.», keine Fotos. Alte Daten kürzen und als Admin einmal zurückschreiben.
  const dirty = applyPrivacy(next);
  if (dirty.length && S.admin && !S.locked)
    dbUpsert(dirty.map(({ coll, obj: { id, ...data } }) => ({ coll, id, data }))).then(({ error }) => {
      if (error) console.warn("Datenschutz-Umstellung nicht gespeichert", error);
    });
  S.all = { matches: next.matches, fixtures: next.fixtures, table: next.table, tables: next.tables };
  Object.assign(S, next);
  applySeason();
  $("bErr").hidden = true;
  $("loading").textContent = "";
  render();
}
let reloadT: ReturnType<typeof setTimeout> | undefined;
export const reloadSoon = () => {
  clearTimeout(reloadT);
  reloadT = setTimeout(() => loadAll().catch(showErr), 300);
};
export function showErr(e: unknown): void {
  $("bErr").hidden = false;
  $("bErrT").textContent = "Daten konnten nicht geladen werden. Bitte Seite neu laden.";
  $("loading").textContent = "";
  console.error(e);
}
export async function up(coll: string, id: string, data: unknown) {
  const { error } = await dbUpsert({ coll, id, data });
  if (error) throw error;
  await loadAll();
}
export async function rm(coll: string, id: string) {
  const { error } = await sb.from("docs").delete().match({ team_id: ctx.team, coll, id });
  if (error) throw error;
  await loadAll();
}
export async function put(coll: string, obj: { id: string; [k: string]: unknown }) {
  const { id, ...body } = obj;
  await up(coll, id, body);
}
export async function del(coll: string, id: string) {
  await rm(coll, id);
}
/** Dokument «coll/id» speichern oder (obj = null) löschen. */
export async function putDoc(path: string, _key: string, obj: unknown) {
  const [c, id] = path.split("/");
  if (obj) await up(c, id, obj);
  else await rm(c, id);
}
export async function saveNote(id: string, note: string) {
  if ((S.notes[id] || "") === note) return;
  if (note) await up("ownernotes", id, { note });
  else await rm("ownernotes", id);
}
