# Einrichtung am Computer – Schritt für Schritt

Ziel: Claude holt einmal alle alten Spiele von football.ch in die App und danach jeden Montag automatisch die neuen.
Zeitaufwand: ca. 20 Minuten, einmalig.

## Was du brauchst

- Deinen Computer (Mac oder Windows), am Montagmorgen eingeschaltet für das automatische Update
- Die **Claude Desktop-App** (claude.ai/download), angemeldet mit deinem Konto
- **Claude Code** (hast du schon)
- **Google Chrome** mit der Erweiterung **Claude in Chrome**, angemeldet (Notlösung, falls football.ch den direkten Abruf blockiert)
- **Git** und **Python 3** (auf dem Mac meist schon da; unter Windows von git-scm.com und python.org installieren)

## Schritt 1 – Repo auf den Computer holen

Terminal öffnen (Mac: «Terminal», Windows: «PowerShell») und eingeben:

```
cd ~/Documents
git clone https://github.com/kaan2302/fieldstats1.git
cd fieldstats1
```

Der Ordner liegt jetzt unter **Dokumente/fieldstats1**.

## Schritt 2 – Schlüssel ablegen

1. Supabase öffnen → **Settings → API Keys** → **Secret key** erstellen oder kopieren (`sb_secret_…`).
2. Im Ordner `fieldstats1` eine Datei **`.env`** anlegen mit genau einer Zeile:
   ```
   SUPABASE_SECRET_KEY=sb_secret_DEINSCHLUESSEL
   ```
3. Testen:
   ```
   python3 tools/sb.py list players
   ```
   Es erscheinen deine Spieler. Bei «SUPABASE_SECRET_KEY fehlt» stimmt der Dateiname oder die Zeile nicht.

Den Schlüssel nie in einen Chat kopieren und nie auf GitHub hochladen (`.env` ist dafür gesperrt).

## Schritt 3 – Teamname prüfen

Auf der Webseite als Admin → **Einstellungen → Verein**: «Name auf football.ch» genau so eintragen wie im Matchcenter
(z. B. «SC Binningen b», wenn die 2. Mannschaft so heisst). Sonst verwechselt der Import eure Mannschaften.

## Schritt 4 – Erst-Import aller alten Spiele

Im Ordner Claude Code starten:

```
claude
```

und schreiben:

> Führe den Erst-Import aus tools/ABLAEUFE.md (Teil A) aus.

Claude liest den Spielplan, die Tabelle und alle Spielberichte der Gruppe und schreibt sie in die Datenbank.
Bei ca. 90 Spielen dauert das eine Weile. Wenn Claude fragt, ob es Chrome benutzen darf: erlauben.
Am Schluss sagst du, welche Positionen die neu angelegten Spieler haben (oder du passt sie auf der Webseite an).

## Schritt 5 – Wöchentliches Update einrichten

1. Die Claude **Desktop-App** auf dem Computer öffnen und dort einen Chat starten, der mit dem Computer verbunden ist.
2. Schreiben:
   > Richte ein wöchentliches Update ein: jeden Montag Morgen im Ordner Dokumente/fieldstats1 Teil B aus tools/ABLAEUFE.md ausführen.
3. Claude legt eine **geplante Aufgabe** an. Du bestätigst sie einmal (dabei wird der Ordner freigegeben).
   Die Aufgabe läuft dann jeden Montag, solange der Computer an ist und die Desktop-App läuft.
   Während der Winterpause schreibt sie nichts und meldet nur «keine neuen Spiele».

## Fertig

- Webseite: https://kaan2302.github.io/fieldstats1/
- Jederzeit von Hand: Claude Code im Ordner starten und z. B. «Hol die Spiele vom Wochenende» oder
  «Erstelle die Gegner-Analyse für den FC Aesch» schreiben.
- Ohne Computer: Spiele auf der Webseite unter **Einstellungen → Spiele** selbst eintragen.
