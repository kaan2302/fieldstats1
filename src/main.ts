// Schriften vom eigenen Server (keine Daten an Google)
import "@fontsource/oxanium/500.css";
import "@fontsource/oxanium/700.css";
import "@fontsource/oxanium/800.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./styles.css";
import { initApp, render } from "./views/app";
import { loadAll, reloadSoon, sb, showErr } from "./db";
import { S, ctx } from "./state";
import { $ } from "./util";
import { applySession, initAuth, refreshAdmin } from "./auth";
import { initLanding, renderLanding } from "./views/landing";
import { initSeason } from "./season";
import { initOpp } from "./views/opp";
import { initSettings } from "./views/settings";
import { initEdit } from "./views/match-edit";
import { initTooltip } from "./tooltip";
import { initLegal } from "./legal";

initSeason();
initOpp();
initSettings();
initEdit();
initApp();
initAuth();
initLanding();
initTooltip();
initLegal();
render();
(async () => {
  if (ctx.liveKey) {
    const { data } = await sb.rpc("live_info", { p_token: ctx.liveKey });
    if (data) {
      ctx.team = data.team_id;
      ctx.liveMatch = data.match_id;
      ctx.liveTokOk = true;
      location.hash = "#live";
    } else {
      ctx.landing = true;
      $("lnInfo").textContent = "Dieser Live-Link ist ungültig oder wurde gelöscht.";
    }
  }
  const {
    data: { session },
  } = await sb.auth.getSession();
  await refreshAdmin(session);
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") applySession(session);
  });
  if (ctx.landing) return renderLanding();
  try {
    localStorage.setItem("lastTeam", ctx.team ?? "");
  } catch (e) {}
  try {
    await loadAll();
  } catch (e) {
    showErr(e);
  }
  if (!S.meta.club && !S.players.length && !S.matches.length) {
    const { data } = await sb.from("teams").select("id").eq("id", ctx.team).maybeSingle();
    if (!data) {
      ctx.landing = true;
      $("lnInfo").textContent = `Kein Team «${ctx.team}» gefunden.`;
      return renderLanding();
    }
  }
  sb.channel("docs-" + ctx.team)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "docs", filter: "team_id=eq." + ctx.team },
      reloadSoon,
    )
    .subscribe();
})();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
