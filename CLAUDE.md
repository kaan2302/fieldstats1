# SCB Kader-App – Anleitung für Claude

Live-Seite: https://kaan2302.github.io/fieldstats1/ (TypeScript + Vite in `src/`, Daten in Supabase, Aufbau siehe `README.md`).

## Code ändern
- Nach jeder Änderung `npm run check` (Typen, Lint, Format, Tests) und bei Oberflächen-Änderungen `npm run test:e2e`.
- Rechenlogik gehört nach `src/domain/` bzw. `src/live/model.ts` und bekommt einen Test in `tests/unit/`.
- Datenbank-Änderungen als neue Datei `supabase/migrations/00X_….sql`, nie alte Dateien ändern.
- Veröffentlicht wird automatisch per GitHub Actions beim Push auf `main`.
Admin: Kaa (kaanyildiz1402@gmail.com). Antworte auf Deutsch (Schweizer Rechtschreibung, «ss» statt «ß»).

## Daten lesen und schreiben
Immer über `python3 tools/sb.py` (siehe Kopf der Datei). Der Schlüssel `SUPABASE_SECRET_KEY` liegt in `.env`
oder in der Umgebung. Nie ausgeben, nie committen, nie in eine Datei ausser `.env` schreiben.
Datenformat: siehe `README.md` (Tabelle `docs`, Felder `team_id`, `coll`, `id`, `data`). Mehrere Teams: Standard-Team ist `sc-binningen`,
für ein anderes `TEAM=<team-id>` vor den Befehl setzen. Teams stehen in der Tabelle `teams`.

Wichtige Regeln:
- Unser Team = `team/meta.fbName`, sonst `team/meta.club`. Spiele mit unserem Team gehören nach `matches`, alle anderen nach `fixtures`.
- `fixtures`-ID: `slug(datum-heim-auswärts)`, z. B. `2026-11-07-fc-reinach-fc-aesch` (klein, Umlaute ohne Punkte, alles andere `-`).
- `matches`: vorhandenes Spiel über Datum + Gegner suchen und ergänzen, nie doppelt anlegen. Gegebene Felder behalten.
- Torminuten als Text (`"23"`, `"90+2"`). Unsere Tore: `goals:[{min, who:<playerId>, ast:<playerId|null>}]`, Gegentore: `against:[{min, who:"Name"}]`.
- Datenschutz: Personennamen immer nur als «Vorname N.» speichern (z. B. `Remo H.`), nie volle Nachnamen, nie Fotos. Gilt für `players.name`,
  Gegentor-Schützen (`against.who`), Torschützen in `fixtures` und Analysetexte. Bei zwei gleichen Kurznamen im Kader zwei Buchstaben (`Remo Hu.`).
- Spieler über den Kurznamen zuordnen (Name aus dem Spielbericht kürzen und vergleichen), fehlende Spieler mit `players/<uuid>` anlegen
  (`name:"Vorname N."`, `pos:"ZM"`, Rückennummer, falls bekannt). Danach Kaa sagen, welche Positionen er prüfen soll.
- Einsätze: `stats[playerId] = {start, sub, min, y, r}`. Startelf = 90 Min. minus Auswechslung, Eingewechselt = 90 minus Einwechselminute.
  Platzverweis (rot.gif und gelbrot.gif) zählt als `r:1` und beendet den Einsatz in der Minute der Karte (Startelf: Minute der Karte; Eingewechselt: Minute der Karte minus Einwechselminute). Icons mit «Bank» im Namen gehören zu Ersatzbank/Staff und werden ignoriert.
- Tabelle: `team/table` mit `rows` und `updated` (heutiges Datum).
- Vor grossen Schreibaktionen kurz zusammenfassen, was geschrieben wird. Nach dem Schreiben mit `list` stichprobenartig prüfen.

## Abläufe
Erst-Import und wöchentliches Update: siehe `tools/ABLAEUFE.md`. Einrichtung am Computer: `ANLEITUNG.md`.

## Import von football.ch / fvnws.ch (Matchcenter)
1. Seite holen: zuerst direkt (curl/WebFetch). Wenn blockiert: über Claude in Chrome im Browser von Kaa.
2. Gruppen-Spielplan: alle Resultate → `fixtures` / `matches`. Spielberichte: Torminuten, Torschützen, Karten, Aufstellung.
3. Nichts erfinden. Fehlt eine Angabe auf der Seite, Feld weglassen.

## Gegner-Analyse
1. Daten sammeln: `list fixtures`, `list matches`, `get team table`. Für Gegner X alle Spiele, in denen X Heim oder Auswärts ist.
2. Rechnen (nicht schätzen): Bilanz, Tore/Gegentore pro Spiel, Form der letzten 5, Punkte pro Spiel letzte 5 gegen vorher, Heim/Auswärts,
   Tore und Gegentore je 15 Minuten (1–15 … 76–90+), Top-Torschützen, Spiele gegen uns.
3. Text, max. ca. 220 Wörter, Spielernamen nur als «Vorname N.», Zwischentitel in Grossbuchstaben: FORM & TREND, WANN FALLEN IHRE TORE, WER TRIFFT, HEIM/AUSWÄRTS,
   SCHWACHSTELLEN, 3 TIPPS FÜR UNS. Kein Markdown. Dünne Datenlage offen sagen.
4. Speichern: `analyses/<slug(gegner)>` mit `{opp, text, at: ISO-Zeit}`.
