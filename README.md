# FieldStats · Kader, Statistik und Live-Erfassung für Amateurteams

Öffentliche Mannschafts-App: Kader im Game-Look, Statistiken, eigene Analyse, Resultate, Tabelle, Gegner-Analysen und Live-Modus.
Alle können lesen, ohne Konto. Bearbeiten kann nur der Admin des Teams nach dem Login (oder wer einen Live-Link für ein Spiel hat).

## Aufbau

| Teil | Wo |
|---|---|
| Webseite | TypeScript + Vite, ohne Framework (`src/`), gehostet über GitHub Pages |
| Daten | Supabase, Tabellen `docs`, `teams`, `clubs`, `team_trainers` (siehe `supabase/README.md`) |
| Schreibschutz | Row Level Security: Vereins-Admin alle Mannschaften, Trainer nur ihre, Live-Links nur ihr Spiel |
| Preise | Mannschaft CHF 129/Saison, Verein CHF 349/Saison bis 6 Mannschaften (`src/domain/club.ts`) |
| Import von football.ch & KI-Analysen | über Claude Code (`tools/sb.py`, `tools/ABLAEUFE.md`) |

### Ordner

```
index.html            Markup (alle Ansichten und Dialoge)
src/main.ts           Start: Module verbinden, Daten laden, Realtime
src/config.ts         Supabase-Adresse, öffentlicher Schlüssel, Standard-Team, Stripe-Links
src/state.ts          Zustand (S) und URL-Parameter (ctx)
src/db.ts             Lesen und Schreiben in Supabase
src/types.ts          Datentypen (Spieler, Spiel, Tabelle …)
src/domain/           reine Rechenlogik: Resultate, Kennzahlen, Gegner, Tabelle, Auto-Texte
src/live/             Live-Modus: model.ts (Logik, getestet) und view.ts (Oberfläche)
src/views/            je Bereich ein Modul: start, kader, stats, games, opp, settings, match-edit, landing, app (Router)
src/charts.ts, pitch.ts, pdf.ts, tooltip.ts, season.ts, auth.ts, ui.ts, util.ts, positions.ts
src/styles.css        Gestaltung
public/               Manifest, Service Worker, Icons
tests/unit/           Vitest: Rechenlogik und Live-Modell
tests/e2e/            Playwright: App starten und alle Bereiche durchklicken
supabase/migrations/  Datenbank-Änderungen, nummeriert
```

## Entwickeln

Node 20 oder neuer.

```bash
npm install
npm run dev          # lokal unter http://localhost:5173/?team=sc-binningen
npm run check        # Typen, Lint, Format, Unit-Tests
npm run test:e2e     # Browser-Test (baut und startet die App)
npm run build        # fertige Seite nach dist/
```

Jeder Push wird von GitHub Actions geprüft (`.github/workflows/deploy.yml`). Ein Push auf `main` veröffentlicht die Seite automatisch,
wenn alle Prüfungen bestehen.

## Einmalige Einrichtung

1. **Supabase → SQL Editor:** die Dateien aus `supabase/migrations/` der Reihe nach ausführen.
2. **GitHub → Settings → Pages:** Source «GitHub Actions».
3. **Supabase → Authentication → URL Configuration:** «Site URL» und Redirect `https://kaan2302.github.io/fieldstats1/**`.
4. Seite mit `?neu` öffnen und ein Team registrieren.

## Datenformat (`public.docs`)

Jede Zeile: `team_id`, `coll`, `id`, `data` (JSON).

- `team/meta` – Verein, Mannschaft, Liga, Saison, Name auf football.ch, Logo
- `team/table` – Tabelle `{rows:[{rank,team,sp,s,u,n,gf,ga,pts}], updated}`
- `players/<id>` – `{name, nr, pos, year, captain}` – `name` nur «Vorname N.», keine Fotos (Datenschutz)
- `matches/<id>` – eigene Spiele `{date, time, opp, home, comp, status: played|planned, gf, ga, goals:[{min,who,ast}], against:[{min,who:"Vorname N."}], stats:{<playerId>:{start,sub,min,y,r}}, lineup}`
- `fixtures/<id>` – andere Spiele der Gruppe `{date, home, away, hg, ag, comp, goals:[{min,team:home|away,who}]}`
- `analyses/<id>` – Gegner-Analysen `{opp, text, at}`
- `ownernotes/<playerId>` – private Notizen, nur für den Admin lesbar
