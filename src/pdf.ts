// Aufgebot als PDF im Design der App (jsPDF wird erst beim ersten Gebrauch geladen).
import type { jsPDF as JsPDF } from "jspdf";
import { placeXi, formation, type Layout } from "./pitch";
import { LINE, POS_ORDER } from "./positions";
import { S } from "./state";
import type { Player } from "./types";
import { closeSheet, sheet } from "./ui";
import { $, sn } from "./util";

export interface AufgebotInfo {
  opp: string;
  home: boolean;
  date: string;
  time?: string;
  xi: string[];
  bench?: string[];
  layout?: Layout | null;
  meet?: string;
  place?: string;
  note?: string;
}

/** Fenster mit Besammlung, Treffpunkt und Bemerkung, danach PDF erstellen. */
export function aufgebotSheet(info: AufgebotInfo): void {
  sheet(
    "Aufgebot als PDF",
    `<div class="grid"><label for="agMeet">Besammlung<input id="agMeet" placeholder="z. B. 15:45"></label><label for="agPlace">Treffpunkt<input id="agPlace" placeholder="z. B. Garderobe Spiegelfeld"></label></div>
    <label for="agNote" style="margin-top:8px">Bemerkung<input id="agNote" placeholder="z. B. Schienbeinschoner, schwarzes Dress"></label>
    <div class="h" style="margin-top:12px"><span class="status" id="agMsg"></span><button class="btn hot" type="button" id="agGo">PDF erstellen</button></div>`,
    () => {
      $("agGo").onclick = async () => {
        $("agGo").disabled = true;
        $("agMsg").textContent = "Wird erstellt …";
        try {
          await aufgebotPDF({
            ...info,
            meet: $("agMeet").value.trim(),
            place: $("agPlace").value.trim(),
            note: $("agNote").value.trim(),
          });
          closeSheet();
        } catch (e) {
          $("agMsg").textContent = e instanceof Error ? e.message : "PDF konnte nicht erstellt werden.";
        } finally {
          $("agGo").disabled = false;
        }
      };
    },
  );
}

type RGB = [number, number, number];
const C: Record<string, RGB> = {
  bg: [8, 12, 24],
  panel: [18, 26, 46],
  ink: [238, 242, 255],
  muted: [140, 152, 186],
  hot: [255, 90, 54],
  hot2: [226, 62, 120],
  TOR: [227, 204, 142],
  ABW: [61, 220, 200],
  MIT: [167, 139, 250],
  ANG: [255, 142, 110],
  XXX: [140, 152, 186],
};

export async function aufgebotPDF(o: AufgebotInfo): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc: JsPDF = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210,
    H = 297,
    club = S.meta.club || "Team",
    team = S.meta.team || "";
  const fill = (c: RGB) => doc.setFillColor(...c);
  const stroke = (c: RGB) => doc.setDrawColor(...c);
  const ink = (c: RGB) => doc.setTextColor(...c);
  const font = (w: "bold" | "normal", sz: number) => {
    doc.setFont("helvetica", w);
    doc.setFontSize(sz);
  };

  // Hintergrund und Farbverlauf oben
  fill(C.bg);
  doc.rect(0, 0, W, H, "F");
  for (let i = 0; i < 40; i++) {
    const t = i / 39;
    fill(C.hot.map((v, k) => Math.round(v + (C.hot2[k] - v) * t)) as RGB);
    doc.rect((i * W) / 40, 0, W / 40 + 0.3, 3, "F");
  }

  // Kopf mit Wappen
  let tx = 14;
  if (S.meta.logo) {
    try {
      fill(C.panel);
      doc.roundedRect(12, 10, 24, 24, 4, 4, "F");
      doc.addImage(S.meta.logo, S.meta.logo.includes("png") ? "PNG" : "JPEG", 13.5, 11.5, 21, 21);
      tx = 42;
    } catch {
      /* Logo nicht lesbar – ohne weiter */
    }
  }
  ink(C.hot);
  font("bold", 10);
  doc.text("AUFGEBOT", tx, 17);
  ink(C.ink);
  font("bold", 20);
  doc.text(club.toUpperCase(), tx, 26);
  ink(C.muted);
  font("normal", 10);
  doc.text([team, S.meta.league].filter(Boolean).join(" · "), tx, 32);

  // Spielkarte
  fill(C.panel);
  doc.roundedRect(12, 40, W - 24, 30, 4, 4, "F");
  ink(C.muted);
  font("bold", 8);
  doc.text(o.home ? "HEIMSPIEL" : "AUSWÄRTSSPIEL", 18, 48);
  ink(C.ink);
  font("bold", 16);
  doc.text(`${o.home ? "vs." : "@"} ${String(o.opp).toUpperCase()}`, 18, 57);
  const d = new Date(o.date + "T12:00").toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  ink(C.muted);
  font("normal", 10);
  doc.text(d + (o.time ? " · Anpfiff " + o.time : ""), 18, 64);
  if (o.meet || o.place) {
    ink(C.muted);
    font("bold", 8);
    doc.text("BESAMMLUNG", W - 18, 48, { align: "right" });
    ink(C.hot);
    font("bold", 16);
    doc.text(o.meet || "–", W - 18, 57, { align: "right" });
    ink(C.muted);
    font("normal", 10);
    doc.text(o.place || "", W - 18, 64, { align: "right" });
  }
  let top = 76;
  if (o.note) {
    ink(C.ink);
    font("normal", 10);
    const ln = doc.splitTextToSize("Hinweis: " + o.note, W - 28) as string[];
    doc.text(ln, 14, top + 2);
    top += ln.length * 5 + 3;
  }

  // Spielfeld
  const px = 12,
    py = top,
    pw = 122,
    ph = 172;
  fill([20, 61, 44]);
  doc.roundedRect(px, py, pw, ph, 4, 4, "F");
  for (let i = 1; i < 8; i += 2) {
    fill([24, 70, 51]);
    doc.rect(px + 3, py + 3 + (i * (ph - 6)) / 8, pw - 6, (ph - 6) / 8, "F");
  }
  stroke([96, 150, 122]);
  doc.setLineWidth(0.4);
  doc.rect(px + 4, py + 4, pw - 8, ph - 8);
  doc.line(px + 4, py + ph / 2, px + pw - 4, py + ph / 2);
  doc.circle(px + pw / 2, py + ph / 2, 13);
  doc.rect(px + pw / 2 - 25, py + 4, 50, 20);
  doc.rect(px + pw / 2 - 25, py + ph - 24, 50, 20);

  const xi = S.players.filter(p => o.xi.includes(p.id));
  const placed = placeXi(xi, o.layout);
  for (const q of placed) {
    const cx = Math.max(px + 13, Math.min(px + pw - 13, px + (q.x / 100) * pw));
    const cy = Math.max(py + 10, Math.min(py + ph - 9, py + (q.y / 100) * ph));
    fill(C[LINE[q.pos] || "XXX"]);
    doc.roundedRect(cx - 11, cy - 8, 22, 15, 3, 3, "F");
    ink([12, 16, 30]);
    font("bold", 11);
    doc.text(String(q.p.nr || "–"), cx, cy - 2.2, { align: "center" });
    font("bold", 7);
    doc.text(sn(q.p), cx, cy + 2, { align: "center" });
    font("normal", 6);
    doc.text(q.pos, cx, cy + 5.2, { align: "center" });
  }
  ink(C.ink);
  font("bold", 9);
  fill(C.bg);
  doc.roundedRect(px + 4, py + 4, 18, 7, 2, 2, "F");
  doc.text(formation(placed), px + 13, py + 9, { align: "center" });

  // Listen rechts
  const rx = 140,
    rw = W - rx - 12;
  let y = top;
  const block = (title: string, ps: Player[]) => {
    const h = 12 + Math.max(1, ps.length) * 6.2;
    fill(C.panel);
    doc.roundedRect(rx, y, rw, h, 4, 4, "F");
    ink(C.hot);
    font("bold", 8);
    doc.text(title.toUpperCase(), rx + 5, y + 7);
    let yy = y + 13.5;
    if (!ps.length) {
      ink(C.muted);
      font("normal", 9);
      doc.text("–", rx + 5, yy);
    }
    for (const p of ps) {
      ink(C.muted);
      font("bold", 9);
      doc.text(String(p.nr || ""), rx + 9, yy, { align: "right" });
      ink(C.ink);
      font("normal", 9);
      doc.text((doc.splitTextToSize(p.name, rw - 16) as string[])[0], rx + 12, yy);
      yy += 6.2;
    }
    y += h + 5;
  };
  block(
    "Startelf",
    placed.map(q => q.p).sort((a, b) => (POS_ORDER[a.pos ?? ""] ?? 99) - (POS_ORDER[b.pos ?? ""] ?? 99)),
  );
  block(
    "Ersatz",
    S.players.filter(p => (o.bench || []).includes(p.id)),
  );
  ink(C.muted);
  font("normal", 7);
  doc.text(`Erstellt am ${new Date().toLocaleDateString("de-CH")}`, 12, H - 8);
  doc.save(`Aufgebot ${o.date} ${o.opp}.pdf`.replace(/[\\/:*?"<>|]/g, "-"));
}
