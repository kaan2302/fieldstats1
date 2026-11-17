# Abläufe für Claude: Erst-Import und Wochen-Update

Gilt zusätzlich zu `CLAUDE.md`. Schreiben nur über `python3 tools/sb.py`.
Zuerst immer prüfen: `python3 tools/sb.py get team meta` (Teamname, `fbName`) und `python3 tools/sb.py list matches`.

## A) Erst-Import (einmalig, alle alten Daten)

1. Im Matchcenter (football.ch oder matchcenter.fvnws.ch) die Gruppe unseres Teams öffnen (`fbName`, Liga aus `team/meta`).
   Zuerst direkt abrufen (curl/WebFetch); wenn blockiert, über Claude in Chrome.
2. **Spielplan der ganzen Gruppe** dieser Saison lesen: alle Spiele mit Datum, Heim, Auswärts, Resultat.
   - Unsere Spiele → `matches` (bestehende über Datum + Gegner ergänzen, nicht doppelt anlegen; offene Spiele `status:"planned"`).
   - Alle anderen → `fixtures` (ID = slug(datum-heim-auswärts)).
3. **Tabelle** lesen → `team/table`.
4. **Jeden gespielten Spielbericht** der Gruppe öffnen (auch die der anderen Teams):
   - Torminute, Team, Torschütze (Penalty = Tor, Eigentor zählt für den Gegner), Karten.
   - Bei unseren Spielen zusätzlich Aufstellung (Startelf, Ersatz, «Kein Einsatz» = nicht eingesetzt), Wechsel mit Minute,
     Rückennummern → `players` anlegen/ergänzen und `stats` füllen.
   - Andere Spiele: `fixtures/<id>.goals = [{min, team:"home"|"away", who}]`.
5. In Blöcken von ca. 10 Spielen schreiben (`put-many`), danach kurz prüfen.
6. Am Schluss Kaa melden: Anzahl Spiele, neue Spieler (Positionen prüfen lassen), Spiele ohne Spielbericht.

## B) Wochen-Update (jeden Montag)

1. Spiele der letzten 8 Tage im Spielplan der Gruppe suchen. **Keine neuen Spiele (z. B. Winterpause): nichts schreiben**, nur kurz melden
   «Keine neuen Spiele, nächstes Spiel: …».
2. Für jedes neue Spiel: Resultat, Spielbericht (wie A4) → `matches` bzw. `fixtures`.
3. Tabelle neu → `team/table`.
4. Verschobene oder neu angesetzte Spiele: Datum/Zeit in `matches` (planned) anpassen.
5. **Nächster Gegner** (frühestes `matches` mit `status:"planned"` ab heute): Gegner-Analyse nach `CLAUDE.md` neu erstellen und speichern.
6. Kurzer Bericht an Kaa: neue Resultate, Tabellenplatz, nächster Gegner, was in der Analyse steht, Auffälligkeiten
   (z. B. Spielbericht fehlte, neuer Spieler angelegt).
