# Datenbank (Supabase)

`migrations/` – in dieser Reihenfolge im Supabase SQL Editor ausführen (alle sind bereits ausgeführt):

| Datei | Inhalt |
|---|---|
| `001_setup.sql` | Tabelle `docs`, Schreibrecht nur für den Admin |
| `002_live_secret.sql` | alter Tracker-Code (abgelöst durch 003, Tabelle `secrets` wird dort entfernt) |
| `003_teams.sql` | mehrere Teams: `teams`, `team_id` in `docs`, RLS, `create_team`, `my_teams`, Live-Links (`live_info`, `live_save`) |
| `004_clubs.sql` | Vereine: `clubs`, `teams.club_id`/`label`, `team_trainers` (Trainer per E-Mail), Rechte für Vereins-Admin und Trainer, `create_club`, `create_club_team`, `attach_team`, `my_clubs` |

`seed/data.sql` – Erst-Import der SC-Binningen-Daten (Stand 17.11.2026), nur für eine leere Datenbank.

Neue Änderungen an der Datenbank immer als neue nummerierte Datei (`004_…sql`) anlegen, nie eine alte ändern.
