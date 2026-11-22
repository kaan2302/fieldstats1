// Automatische Analyse-Texte aus den Zahlen – ganz ohne KI.
import { S } from "../state";
import { norm, sn } from "../util";
import { deepUs, playerKPI, type PlayerKPI } from "./kpi";
import {
  argMax,
  BL,
  buckets,
  byDate,
  isOurs,
  official,
  officialPlayed,
  played,
  ppg,
  ptsOf,
  res,
  sum,
  trendWord,
} from "./matches";
import { oppStats } from "./opponents";
import { situation } from "./table";

const capFirst = (w: string) => w[0].toUpperCase() + w.slice(1);
const fmt2 = (v: number | null) => (v != null ? v.toFixed(2) : "–");
const numbered = (tips: string[], fallback: string) =>
  tips
    .slice(0, 3)
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n") || fallback;

/** Die drei wichtigsten Erkenntnisse für die Startseite. */
export function insights(pk: PlayerKPI[]): string[] {
  const d = deepUs(),
    ms = S.matches.filter(m => played(m) && official(m)),
    out: string[] = [];
  if (d.full && d.st.firstAg.n)
    out.push(
      `In ${d.st.firstAg.n} von ${d.full} Spielen trifft der Gegner zuerst. Danach holen wir nur ${(d.st.firstAg.pts / d.st.firstAg.n).toFixed(2)} Punkte pro Spiel.`,
    );
  const ag = buckets(ms.flatMap(m => (m.against || []).map(g => g.min)));
  const gf = buckets(ms.flatMap(m => (m.goals || []).map(g => g.min)));
  const ia = argMax(ag),
    ig = argMax(gf);
  if (Math.max(...ag))
    out.push(
      ia === ig
        ? `Die Schlussphase entscheidet: In den Minuten ${BL[ia]} schiessen wir die meisten Tore (${gf[ig]}), kassieren dort aber auch die meisten (${ag[ia]}).`
        : `Die meisten Gegentore kassieren wir in den Minuten ${BL[ia]} (${ag[ia]}), die meisten eigenen Tore schiessen wir in den Minuten ${BL[ig]} (${gf[ig]}).`,
    );
  const tot = pk.reduce((s, p) => s + p.g, 0),
    top = [...pk].sort((a, b) => b.g - a.g)[0];
  if (top && top.g)
    out.push(
      `${sn(top)} schiesst ${top.g} von ${tot} Toren (${Math.round((top.g / tot) * 100)} %). Fällt er aus, fehlt die Torgefahr.`,
    );
  return out.slice(0, 3);
}

/** Einschätzung der eigenen Mannschaft. */
export function autoUsText(): string {
  const ms = officialPlayed();
  if (!ms.length) return "";
  const l5 = ms.slice(-5),
    bf = ms.slice(0, -5);
  const us = (S.table?.rows || []).find(r => isOurs(r.team));
  const nS = ms.filter(m => res(m) === "S").length,
    nU = ms.filter(m => res(m) === "U").length;
  const gf = ms.reduce((s, m) => s + +m.gf, 0),
    ga = ms.reduce((s, m) => s + +m.ga, 0);
  const tw = trendWord(ppg(l5), ppg(bf));
  const sit = situation();
  const sitText = !sit
    ? ""
    : sit.mode === "ab"
      ? ` Abstiegskampf: ${sit.kl} ${sit.kv} Punkte.`
      : sit.mode === "auf"
        ? ` ${sit.title}: ${sit.kl} ${sit.kv} Punkte.`
        : ` Gesichertes Mittelfeld: ${sit.ks}.`;
  const out: string[] = [];
  out.push(
    `FORM & TREND\n${us ? `Platz ${us.rank} mit ${us.pts} Punkten aus ${us.sp} Spielen. ` : ""}${nS} Siege, ${nU} Remis, ${ms.length - nS - nU} Niederlagen, ${gf}:${ga} Tore. Letzte 5 Spiele: ${fmt2(ppg(l5))} Punkte pro Spiel${bf.length ? `, vorher ${fmt2(ppg(bf))} – Trend ${tw}` : ""}.${sitText}`,
  );

  const gfB = buckets(ms.flatMap(m => (m.goals || []).map(g => g.min)));
  const gaB = buckets(ms.flatMap(m => (m.against || []).map(g => g.min)));
  const first = gaB[0] + gaB[1],
    late = gfB[5];
  const weakStart = first >= sum(gaB) * 0.35,
    strongEnd = late >= sum(gfB) * 0.3;
  out.push(
    `WANN FALLEN UNSERE TORE\nDie meisten eigenen Tore in den Minuten ${BL[argMax(gfB)]} (${gfB[argMax(gfB)]}), die meisten Gegentore in den Minuten ${BL[argMax(gaB)]} (${gaB[argMax(gaB)]}).${weakStart ? ` Schwacher Start: ${first} Gegentore bis zur 30. Minute.` : ""}${strongEnd ? ` Starke Schlussphase: ${late} Tore ab der 76. Minute.` : ""}`,
  );

  const pk = playerKPI()
      .filter(p => p.g > 0)
      .sort((a, b) => b.g - a.g),
    tot = pk.reduce((s, p) => s + p.g, 0);
  const dependent = pk.length > 0 && pk[0].g / tot >= 0.4;
  if (pk.length)
    out.push(
      `WER TRIFFT\n${pk
        .slice(0, 3)
        .map(p => `${p.name} ${p.g}`)
        .join(
          ", ",
        )}.${dependent ? ` ${sn(pk[0])} erzielt ${Math.round((pk[0].g / tot) * 100)} % der Tore – die Abhängigkeit ist gross.` : ""}`,
    );

  const H = ms.filter(m => m.home),
    A = ms.filter(m => !m.home),
    hp = ppg(H),
    ap = ppg(A);
  const homeAway =
    hp != null && ap != null && Math.abs(hp - ap) > 0.4
      ? hp > ap
        ? " Klar heimstärker."
        : " Klar auswärtsstärker."
      : "";
  out.push(
    `HEIM/AUSWÄRTS\nZuhause ${H.reduce((s, m) => s + ptsOf(m), 0)} Punkte aus ${H.length} Spielen (${fmt2(hp)} pro Spiel), auswärts ${A.reduce((s, m) => s + ptsOf(m), 0)} aus ${A.length} (${fmt2(ap)}).${homeAway}`,
  );

  const d = deepUs(),
    weak: string[] = [];
  const oftenBehind = d.full > 0 && d.st.firstAg.n / d.full >= 0.6,
    leaky = ga / ms.length >= 2;
  if (leaky) weak.push(`${(ga / ms.length).toFixed(1)} Gegentore pro Spiel`);
  if (oftenBehind) weak.push(`in ${d.st.firstAg.n} von ${d.full} Spielen trifft der Gegner zuerst`);
  if (d.st.leadLost >= 3) weak.push(`${d.st.leadLost} Punkte nach Führung verspielt`);
  const close = ms.filter(m => +m.ga - +m.gf === 1).length;
  if (close >= 3) weak.push(`${close} Niederlagen mit einem Tor Unterschied`);
  out.push(
    `SCHWACHSTELLEN\n${weak.length ? weak.map(capFirst).join(". ") + "." : "Keine auffälligen Schwachstellen in den Zahlen."}`,
  );

  const tips: string[] = [];
  if (weakStart) tips.push("Die ersten 30 Minuten kompakt spielen und die Startphase im Training gezielt üben.");
  if (oftenBehind) tips.push("Das erste Tor ist der Schlüssel: Wir laufen fast immer einem Rückstand hinterher.");
  if (leaky) tips.push("Defensiv stabilisieren: Abstände in der Kette, Zweikämpfe im Zentrum.");
  if (dependent) tips.push("Eine zweite Torquelle aufbauen, z. B. über Standards und Abschlüsse aus dem Mittelfeld.");
  if (strongEnd) tips.push("Die Schlussphase nutzen: spät wechseln, Druck hochhalten.");
  out.push(`3 TIPPS FÜR UNS\n${numbered(tips, "1. Weiter so – die Zahlen zeigen keine klare Baustelle.")}`);
  return out.join("\n\n");
}

/** Analyse eines Gegners. */
export function autoOppText(name: string): string {
  const k = oppStats(name);
  if (!k.n) return "";
  const row = (S.table?.rows || []).find(r => norm(r.team) === norm(name)),
    out: string[] = [];
  const tw = trendWord(k.ppgLast, k.ppgBefore);
  out.push(
    `FORM & TREND\n${row ? `Platz ${row.rank}, ${row.pts} Punkte. ` : ""}${k.S}-${k.U}-${k.N} aus ${k.n} erfassten Spielen, ${k.gf}:${k.ga} Tore. Form: ${k.form.join("-") || "–"}${tw ? `, Trend ${tw}` : ""}.`,
  );
  if (sum(k.forB) + sum(k.agB))
    out.push(
      `WANN FALLEN IHRE TORE\nEigene Tore am häufigsten in den Minuten ${BL[argMax(k.forB)]} (${k.forB[argMax(k.forB)]}), Gegentore in den Minuten ${BL[argMax(k.agB)]} (${k.agB[argMax(k.agB)]}).`,
    );
  if (k.scorers.length)
    out.push(
      `WER TRIFFT\n${k.scorers
        .slice(0, 3)
        .map(([w, c]) => `${w} ${c}`)
        .join(", ")}.`,
    );
  const hp = k.home.n ? k.home.pts / k.home.n : null,
    ap = k.away.n ? k.away.pts / k.away.n : null;
  out.push(`HEIM/AUSWÄRTS\nZuhause ${fmt2(hp)}, auswärts ${fmt2(ap)} Punkte pro Spiel.`);

  const agTot = sum(k.agB),
    lateLeaks = agTot > 0 && k.agB[5] / agTot >= 0.3,
    earlyLeaks = agTot > 0 && (k.agB[0] + k.agB[1]) / agTot >= 0.4;
  const weakAway = ap != null && hp != null && ap < hp - 0.5,
    leaky = k.ga / k.n >= 2;
  const weak: string[] = [];
  if (leaky) weak.push(`${(k.ga / k.n).toFixed(1)} Gegentore pro Spiel`);
  if (weakAway) weak.push("auswärts deutlich schwächer");
  if (lateLeaks) weak.push("kassieren viel in der Schlussphase");
  if (earlyLeaks) weak.push("anfällig in der Startphase");
  if (tw === "fallend") weak.push("aktuell im Formtief");
  out.push(
    `SCHWACHSTELLEN\n${weak.length ? weak.map(capFirst).join(". ") + "." : "Keine klaren Schwachstellen in den Zahlen."}`,
  );

  const tips: string[] = [];
  if (earlyLeaks) tips.push("Früh Druck machen – sie kassieren oft in der Startphase.");
  if (lateLeaks) tips.push("Bis zum Schluss dranbleiben – hinten raus werden sie anfällig.");
  if (k.scorers.length && k.scorers[0][1] / Math.max(1, k.gf) >= 0.3)
    tips.push(`${k.scorers[0][0]} eng decken – er trifft am meisten.`);
  if (sum(k.forB) && k.forB[argMax(k.forB)] / sum(k.forB) >= 0.3)
    tips.push(`Besonders wach in den Minuten ${BL[argMax(k.forB)]} – dann treffen sie am häufigsten.`);
  const nx = S.matches.filter(m => !played(m) && norm(m.opp) === norm(name)).sort(byDate)[0];
  if (nx && !nx.home && hp != null && hp >= 1.8)
    tips.push("Bei ihnen zuhause kompakt stehen – dort holen sie viele Punkte.");
  if (nx && nx.home && weakAway) tips.push("Im Heimspiel mutig auftreten – auswärts sind sie klar schwächer.");
  if (tw === "fallend") tips.push("Sie stecken im Formtief: früh Druck machen und ihr Selbstvertrauen angreifen.");
  if (leaky) tips.push("Torchancen sind da – sie kassieren viel, also mutig abschliessen.");
  out.push(
    `3 TIPPS FÜR UNS\n${numbered(tips, "1. Eigenes Spiel durchziehen – die Zahlen zeigen keine klare Schwäche.")}`,
  );
  if (k.n < 4) out.push("Hinweis: Wenige erfasste Spiele, Aussagen mit Vorsicht.");
  return out.join("\n\n");
}
