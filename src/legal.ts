// Impressum, Datenschutzerklärung und AGB. Inhalte entsprechen dem tatsächlichen Aufbau der App
// (GitHub Pages, Supabase mit Datenbank in Irland, Stripe geplant). Bei Änderungen am Aufbau hier nachführen.
import { OPERATOR as O } from "./config";
import { sheet } from "./ui";
import { esc } from "./util";

const v = (s: string) => (s ? esc(s) : `<mark>[bitte ergänzen]</mark>`);

/** Fehlende Betreiber-Angaben (für den Hinweis im Admin-Bereich). */
export const legalMissing = (): string[] =>
  (
    [
      ["name", "Name"],
      ["address", "Adresse"],
      ["email", "E-Mail"],
      ["court", "Gerichtsstand"],
    ] as const
  )
    .filter(([k]) => !O[k])
    .map(([, l]) => l);

export function impressumHtml(): string {
  return `<h3 id="lg-impressum">Impressum</h3>
<p><b>Betreiber</b><br>${v(O.name)}<br>${v(O.address)}<br>E-Mail: ${v(O.email)}</p>
<p>${esc(O.vat)}</p>
<p>Für die Inhalte der einzelnen Team-Seiten (Spieler, Resultate, Texte) ist der jeweilige Team-Admin verantwortlich.</p>`;
}

export function datenschutzHtml(): string {
  return `<h3 id="lg-datenschutz">Datenschutzerklärung</h3>
<p class="small muted">Stand ${esc(O.updated)} · nach dem Schweizer Datenschutzgesetz (DSG)</p>
<p><b>Verantwortlich</b><br>${v(O.name)}, ${v(O.address)}, ${v(O.email)}</p>

<p><b>Welche Daten wir bearbeiten</b></p>
<ul>
<li><b>Team-Admins:</b> E-Mail-Adresse und Passwort (nur verschlüsselt gespeichert) für das Login, Name des Teams, Abo-Status.</li>
<li><b>Team-Daten:</b> Vereinsname, Vereinslogo, Spieler nur mit Vorname und erstem Buchstaben des Nachnamens (z. B. «Remo H.»), Rückennummer, Position, Jahrgang, Einsätze, Tore, Vorlagen, Karten, Resultate, Tabellen und Analysetexte. Diese Daten erfasst der Team-Admin. Torschützen anderer Teams werden ebenfalls nur so abgekürzt gespeichert.</li>
<li><b>Keine Nachnamen, keine Fotos:</b> Volle Nachnamen und Fotos von Spielerinnen und Spielern werden nicht gespeichert. Die App zeigt nur Initialen.</li>
<li><b>Private Notizen</b> zu Spielern sind nur für den Team-Admin sichtbar.</li>
<li><b>Beim Aufruf der Seite</b> verarbeiten unsere Anbieter technisch notwendige Daten wie IP-Adresse, Zeitpunkt und Browser (Server-Protokolle).</li>
</ul>

<p><b>Wer die Daten sehen kann</b><br>Team-Seiten sind öffentlich: Wer den Link kennt, kann Kader, Statistiken und Resultate ohne Login ansehen. Bearbeiten kann nur der Team-Admin. Ein Live-Link erlaubt nur das Erfassen des einen Spiels, für das er erstellt wurde.</p>

<p><b>Anbieter, die wir einsetzen</b></p>
<ul>
<li><b>Supabase</b> (Supabase Inc., USA): Datenbank (inkl. Vereinslogo) und Login. Die Daten liegen in einem Rechenzentrum von Amazon Web Services in <b>Irland (EU)</b>.</li>
<li><b>GitHub Pages</b> (GitHub Inc., USA): Auslieferung der Webseite. Dabei fallen Server-Protokolle mit IP-Adresse an.</li>
<li><b>Stripe</b> (Stripe Payments Europe Ltd., Irland): Zahlung des Abos, sobald die Bezahlung freigeschaltet ist. Kartendaten gibt man direkt bei Stripe ein, wir sehen sie nie.</li>
</ul>
<p>Supabase und GitHub haben ihren Sitz in den USA. Ein Zugriff von dort ist möglich. Die Übermittlung stützt sich auf die Datenschutzverträge dieser Anbieter (Standardvertragsklauseln bzw. das Swiss-U.S. Data Privacy Framework, soweit der Anbieter dort zertifiziert ist).</p>

<p><b>Cookies und Speicher im Browser</b><br>Keine Werbung, kein Tracking, keine Analyse-Tools. Im Speicher des Browsers (localStorage) liegen nur die Login-Sitzung, das zuletzt geöffnete Team und die gewählte Ansicht. Schriften werden von unserem eigenen Server geladen.</p>

<p><b>Wie lange wir Daten aufbewahren</b><br>Solange das Team besteht. Auf Wunsch löschen wir ein Team mit allen Daten. Rechnungsdaten bewahren wir so lange auf, wie es das Gesetz verlangt (in der Regel 10 Jahre).</p>

<p><b>Spielerinnen und Spieler</b><br>Wer als Spieler auf einer Team-Seite erscheint und das nicht möchte, wendet sich an den Team-Admin oder an uns. Wir sorgen dafür, dass die Daten berichtigt oder gelöscht werden.</p>

<p><b>Ihre Rechte</b><br>Sie können Auskunft über Ihre Daten verlangen, falsche Daten berichtigen und Daten löschen lassen. Schreiben Sie an ${v(O.email)}. Sie können sich auch beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) beschweren.</p>`;
}

export function agbHtml(): string {
  return `<h3 id="lg-agb">Allgemeine Geschäftsbedingungen (AGB)</h3>
<p class="small muted">Stand ${esc(O.updated)}</p>
<p><b>1. Leistung</b><br>Die Web-App bietet Teams Kader, Statistiken, Analysen, Resultate, Tabelle, Live-Erfassung und Aufgebot als PDF. Sie wird laufend weiterentwickelt; einzelne Funktionen können sich ändern.</p>
<p><b>2. Registrierung</b><br>Wer ein Team erstellt, wird dessen Admin und muss mindestens 18 Jahre alt sein oder im Auftrag des Vereins handeln. Die Angaben müssen stimmen. Zugangsdaten sind geheim zu halten.</p>
<p><b>3. Testphase und Abo</b><br>Die ersten ${O.trialDays} Tage sind gratis und verpflichten zu nichts. Danach kostet das Abo ${esc(O.price)} pro Monat und Team, im Voraus bezahlt über Stripe. ${esc(O.vat)}</p>
<p><b>4. Kündigung</b><br>Das Abo ist jederzeit auf Ende des laufenden Monats kündbar. Bereits bezahlte Monate werden nicht zurückerstattet. Nach dem Ende der Testphase oder des Abos bleiben die Daten lesbar, Bearbeiten ist erst mit aktivem Abo wieder möglich. Auf Wunsch löschen wir das Team mit allen Daten.</p>
<p><b>5. Pflichten des Team-Admins</b><br>Der Admin ist für die erfassten Inhalte verantwortlich. Spielerinnen und Spieler werden nur mit Vorname und erstem Buchstaben des Nachnamens erfasst; Fotos von Personen sind nicht vorgesehen. In Notizen und Texten erfasst der Admin keine weiteren persönlichen Angaben. Er informiert die Spieler darüber, dass die Team-Seite öffentlich ist. Bei Minderjährigen braucht es das Einverständnis der Eltern. Live-Links gibt er nur an vertrauenswürdige Personen weiter.</p>
<p><b>6. Verfügbarkeit</b><br>Wir bemühen uns um einen störungsfreien Betrieb, garantieren aber keine ständige Verfügbarkeit. Wartungen und Ausfälle von Anbietern sind möglich. Wichtige Daten sollte der Admin zusätzlich selbst festhalten.</p>
<p><b>7. Haftung</b><br>Wir haften nur für Schäden, die wir vorsätzlich oder grobfahrlässig verursachen. Für Inhalte der Teams und für Datenverlust durch Ausfälle von Anbietern haften wir im gesetzlich zulässigen Rahmen nicht.</p>
<p><b>8. Sperrung</b><br>Bei Verstössen gegen diese AGB oder gegen das Gesetz können wir ein Team sperren oder löschen.</p>
<p><b>9. Änderungen</b><br>Wir können die AGB und den Preis anpassen. Änderungen teilen wir mindestens 30 Tage im Voraus per E-Mail mit; wer nicht einverstanden ist, kann auf den Zeitpunkt der Änderung kündigen.</p>
<p><b>10. Recht und Gerichtsstand</b><br>Es gilt Schweizer Recht. Gerichtsstand ist ${v(O.court)}.</p>`;
}

/** Alle drei Texte untereinander. */
export const legalHtml = (): string => `<div class="legal">${impressumHtml()}${datenschutzHtml()}${agbHtml()}</div>`;

/** Links mit data-legal="impressum|datenschutz|agb" öffnen die Texte für alle (auch ohne Login). */
export function initLegal(): void {
  document.addEventListener("click", e => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("[data-legal]");
    if (!a) return;
    e.preventDefault();
    sheet("AGB, Datenschutz & Impressum", legalHtml(), body => {
      setTimeout(() => body.querySelector(`#lg-${a.dataset.legal}`)?.scrollIntoView(), 50);
    });
  });
}
