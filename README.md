# SC Binningen · Kader & Statistiken

Öffentliche Mannschafts-App: Kader im Game-Look, Startelf des letzten Spiels, Statistiken, Resultate, Tabelle und Gegner-Analysen.
Alle können lesen, ohne Konto. Bearbeiten kann nur der Admin nach dem Login.

## Aufbau

| Teil | Wo |
|---|---|
| Webseite | `index.html` (eine Datei, gehostet über GitHub Pages) |
| Daten | Supabase, Tabelle `public.docs` |
| Schreibschutz | Row Level Security in Supabase, nur die Admin-E-Mail darf schreiben |
| Import von football.ch & KI-Analysen | über Claude Code |

## Einmalige Einrichtung

1. **Supabase → SQL Editor:** `supabase/setup.sql` einfügen und ausführen (Tabelle + Regeln).
2. **Supabase → SQL Editor:** `supabase/data.sql` einfügen und ausführen (Daten aus der bisherigen App).
3. **GitHub → Settings → Pages:** Source «Deploy from a branch», Branch `main`, Ordner `/ (root)`, speichern.
4. **Supabase → Authentication → URL Configuration:** «Site URL» auf die Pages-Adresse setzen, z. B. `https://kaan2302.github.io/fieldstats1/`.
5. Seite öffnen, unten «Admin-Login» → «Konto erstellen» mit der Admin-E-Mail, Bestätigungsmail öffnen, dann anmelden.

## Datenformat (`public.docs`)

Jede Zeile: `coll`, `id`, `data` (JSON).

- `team/meta` – Verein, Mannschaft, Liga, Saison, Name auf football.ch, Logo
- `team/table` – Tabelle `{rows:[{rank,team,sp,s,u,n,gf,ga,pts}], updated}`
- `players/<id>` – `{name, nr, pos, year, captain, photo}`
- `matches/<id>` – eigene Spiele `{date, time, opp, home, comp, status: played|planned, gf, ga, goals:[{min,who,ast}], against:[{min,who}], stats:{<playerId>:{start,sub,min,y,r}}}`
- `fixtures/<id>` – andere Spiele der Gruppe `{date, home, away, hg, ag, comp, goals:[{min,team:home|away,who}]}`
- `analyses/<id>` – Gegner-Analysen `{opp, text, at}`
- `ownernotes/<playerId>` – private Notizen, nur für den Admin lesbar
