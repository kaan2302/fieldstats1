"""Builds supabase/data.sql from the data that was entered in the claude.ai artifact (snapshot 17.11.2026)."""
import json, re, unicodedata

def slug(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:80]

meta = {"club": "SC Binningen", "team": "2. Mannschaft", "league": "", "season": "2026/27", "fbName": ""}

table_rows = [
    (1, "FC Aesch", 13, 11, 1, 1, 57, 18, 34), (2, "FC Breitenbach", 13, 7, 3, 3, 37, 28, 24),
    (3, "FC Amicitia Riehen", 13, 6, 3, 4, 30, 20, 21), (4, "AS Timau Basel", 13, 7, 0, 6, 27, 27, 21),
    (5, "FC Reinach", 13, 6, 2, 5, 27, 26, 20), (6, "FC Möhlin-Riburg/ACLI", 13, 6, 1, 6, 21, 20, 19),
    (7, "FC Pratteln", 13, 6, 0, 7, 28, 31, 18), (8, "SV Muttenz", 13, 5, 2, 6, 27, 27, 17),
    (9, "FC Gelterkinden", 13, 5, 2, 6, 27, 30, 17), (10, "FC Bubendorf", 13, 5, 2, 6, 25, 32, 17),
    (11, "BSC Old Boys", 13, 5, 1, 7, 28, 31, 16), (12, "FC Wallbach-Zeiningen", 13, 4, 2, 7, 22, 26, 14),
    (13, "FC Zwingen", 13, 3, 3, 7, 19, 40, 12), (14, "SC Binningen", 13, 3, 2, 8, 23, 42, 11),
]
table = {"league": "", "updated": "2026-11-17",
         "rows": [dict(rank=r, team=t, sp=sp, s=s, u=u, n=n, gf=gf, ga=ga, pts=p) for r, t, sp, s, u, n, gf, ga, p in table_rows]}

players = [
    ("2a8fe14a-052a-4ea7-b966-73573243eea7", "Benjamin Wirth"),
    ("bb65582c-2530-48c9-908e-ca6d06f9a7c4", "Remo Hirschi"),
    ("ecadd3ad-756b-4af3-887e-cd98740a434f", "Benjamin Kaufmann"),
]

# own matches: id, date, time, opp, home, status, gf, ga
own = [
    ("0a9cfca2-77b0-4efd-a1c6-454f377b4f90", "2027-06-05", "16:00", "FC Breitenbach", True, "planned", 0, 0),
    ("0abb6ae3-a152-4bc0-a9bf-b7793710f35e", "2026-10-24", "", "FC Bubendorf", False, "played", 2, 3),
    ("0c82fc2c-b84f-4650-95bc-d70aeed436e2", "2027-03-13", "", "AS Timau Basel", True, "planned", 0, 0),
    ("0ed720be-24d6-401a-830c-2ffcbc05a200", "2027-04-24", "", "SV Muttenz", True, "planned", 0, 0),
    ("16c91346-3be2-4955-8424-e33507547ba9", "2026-09-05", "", "FC Zwingen", True, "played", 2, 3),
    ("1b1fbce9-9da7-4e18-a708-ebbdf747b28e", "2026-10-14", "", "BSC Old Boys", False, "played", 2, 6),
    ("24591887-118e-42b1-8485-c4b8ce537712", "2026-09-12", "", "FC Möhlin-Riburg/ACLI", False, "played", 3, 2),
    ("25be8079-d38e-49c6-9743-b5a32c7f0a63", "2026-08-26", "", "AS Timau Basel", False, "played", 3, 0),
    ("25c4cf1f-1a8c-4f54-bf03-ae20acc31349", "2027-04-17", "17:30", "FC Wallbach-Zeiningen", False, "planned", 0, 0),
    ("39f035c3-2eb7-4107-947e-a0e59f27eeb7", "2027-03-06", "17:00", "FC Pratteln", False, "planned", 0, 0),
    ("423c5ccd-1e5f-4ee9-bef9-4e4f16326f30", "2026-10-31", "", "FC Gelterkinden", True, "played", 2, 2),
    ("436afaf9-ace5-4680-b478-ec079822494d", "2026-11-07", "", "FC Breitenbach", False, "played", 2, 3),
    ("44ae80f8-4137-4377-a4d4-9597d163d741", "2027-04-03", "", "FC Zwingen", False, "planned", 0, 0),
    ("7166e29d-c060-4cbd-9338-81b459975bbf", "2027-05-08", "", "FC Amicitia Riehen", True, "planned", 0, 0),
    ("83c483ed-9545-4c37-b750-0e443a6dd433", "2027-04-10", "", "FC Möhlin-Riburg/ACLI", True, "planned", 0, 0),
    ("8c0c66e7-2818-4e20-82d4-aa705e799f21", "2026-09-26", "", "SV Muttenz", False, "played", 0, 3),
    ("a0db323f-1d32-4ec4-b3de-d6fe1228c8a6", "2027-05-16", "14:00", "BSC Old Boys", True, "planned", 0, 0),
    ("a772e2f0-88b3-4cb1-8372-d3deb947de90", "2027-05-01", "17:00", "FC Reinach", False, "planned", 0, 0),
    ("d21defdf-22d2-4833-8b83-1c61f8bbda44", "2027-05-29", "16:00", "FC Gelterkinden", False, "planned", 0, 0),
    ("d5eaf819-64ec-459f-893e-ce4ad4398a6e", "2026-08-29", "", "FC Aesch", True, "played", 0, 12),
    ("e46bccaa-86e2-4b9f-82e7-f041bf4c2870", "2026-08-23", "", "FC Pratteln", True, "played", 3, 5),
    ("eb5dd71a-6cac-453d-983e-1e1698089ba4", "2027-05-22", "", "FC Bubendorf", True, "planned", 0, 0),
    ("f19736e1-963f-4b7d-b4b8-d5f8de2da41a", "2026-09-19", "", "FC Wallbach-Zeiningen", True, "played", 3, 0),
    ("f4fd2450-bd95-4605-ad45-6a1e26b3777e", "2026-10-10", "", "FC Amicitia Riehen", False, "played", 1, 1),
    ("fd46bfb4-7527-42c6-9cc5-c6432e0820ec", "2027-03-20", "17:00", "FC Aesch", False, "planned", 0, 0),
    ("ff82e0f8-4ddd-4213-a20d-047edec74d9c", "2026-10-03", "", "FC Reinach", True, "played", 0, 2),
]
# goal details from the two imported match reports (they had no date; merged into the dated matches)
details = {
    "0abb6ae3-a152-4bc0-a9bf-b7793710f35e": {
        "goals": [{"min": "20", "who": "ecadd3ad-756b-4af3-887e-cd98740a434f", "ast": None},
                  {"min": "90+2", "who": "2a8fe14a-052a-4ea7-b966-73573243eea7", "ast": None}],
        "against": [{"min": "10", "who": "Fabian Böni"}, {"min": "22", "who": "Fabian Frey"}, {"min": "36", "who": "Nicola Schöpfer"}]},
    "436afaf9-ace5-4680-b478-ec079822494d": {
        "goals": [{"min": "9", "who": "bb65582c-2530-48c9-908e-ca6d06f9a7c4", "ast": None},
                  {"min": "88", "who": "bb65582c-2530-48c9-908e-ca6d06f9a7c4", "ast": None}],
        "against": [{"min": "4", "who": "Michael Hänggi"}, {"min": "11", "who": "Jonah Hänggi"}, {"min": "86", "who": "Steve Yannick Mebenga Avom"}]},
}

# other games of the group: date, home, away, hg, ag
fx = """2026-08-19|FC Reinach|FC Amicitia Riehen|3|3
2026-08-22|AS Timau Basel|FC Aesch|2|1
2026-08-22|FC Möhlin-Riburg/ACLI|FC Gelterkinden|3|1
2026-08-22|FC Wallbach-Zeiningen|FC Bubendorf|2|2
2026-08-22|FC Zwingen|FC Breitenbach|2|2
2026-08-23|SV Muttenz|BSC Old Boys|4|4
2026-08-25|FC Gelterkinden|FC Wallbach-Zeiningen|1|0
2026-08-26|BSC Old Boys|FC Reinach|2|3
2026-08-26|FC Aesch|FC Amicitia Riehen|3|1
2026-08-26|FC Breitenbach|FC Möhlin-Riburg/ACLI|2|1
2026-08-26|FC Bubendorf|SV Muttenz|5|3
2026-08-26|FC Pratteln|FC Zwingen|5|0
2026-08-29|FC Amicitia Riehen|BSC Old Boys|2|0
2026-08-29|FC Möhlin-Riburg/ACLI|FC Pratteln|2|1
2026-08-29|FC Reinach|FC Bubendorf|5|1
2026-08-29|FC Zwingen|AS Timau Basel|1|5
2026-08-29|SV Muttenz|FC Gelterkinden|0|3
2026-08-30|FC Wallbach-Zeiningen|FC Breitenbach|5|2
2026-09-05|FC Aesch|BSC Old Boys|2|0
2026-09-05|FC Breitenbach|SV Muttenz|1|1
2026-09-05|FC Bubendorf|FC Amicitia Riehen|2|3
2026-09-05|FC Gelterkinden|FC Reinach|1|3
2026-09-05|FC Pratteln|FC Wallbach-Zeiningen|1|0
2026-09-06|AS Timau Basel|FC Möhlin-Riburg/ACLI|2|0
2026-09-12|FC Amicitia Riehen|FC Gelterkinden|4|0
2026-09-12|FC Reinach|FC Breitenbach|2|3
2026-09-12|FC Zwingen|FC Aesch|1|5
2026-09-13|BSC Old Boys|FC Bubendorf|3|2
2026-09-13|SV Muttenz|FC Pratteln|5|1
2026-09-14|AS Timau Basel|FC Wallbach-Zeiningen|3|5
2026-09-19|AS Timau Basel|SV Muttenz|2|3
2026-09-19|FC Aesch|FC Bubendorf|5|1
2026-09-19|FC Gelterkinden|BSC Old Boys|4|2
2026-09-19|FC Pratteln|FC Reinach|3|0
2026-09-19|FC Zwingen|FC Möhlin-Riburg/ACLI|1|5
2026-09-20|FC Breitenbach|FC Amicitia Riehen|3|2
2026-09-22|FC Möhlin-Riburg/ACLI|FC Wallbach-Zeiningen|3|1
2026-09-26|FC Amicitia Riehen|FC Pratteln|3|1
2026-09-26|FC Bubendorf|FC Gelterkinden|2|0
2026-09-26|FC Möhlin-Riburg/ACLI|FC Aesch|1|1
2026-09-26|FC Reinach|AS Timau Basel|3|4
2026-09-27|BSC Old Boys|FC Breitenbach|0|5
2026-09-27|FC Wallbach-Zeiningen|FC Zwingen|1|2
2026-10-03|FC Aesch|FC Gelterkinden|5|3
2026-10-03|FC Breitenbach|FC Bubendorf|6|2
2026-10-03|FC Pratteln|BSC Old Boys|3|1
2026-10-03|FC Zwingen|SV Muttenz|4|1
2026-10-04|AS Timau Basel|FC Amicitia Riehen|2|1
2026-10-10|FC Bubendorf|FC Pratteln|3|1
2026-10-10|FC Gelterkinden|FC Breitenbach|2|2
2026-10-10|FC Reinach|FC Zwingen|0|0
2026-10-11|BSC Old Boys|AS Timau Basel|2|0
2026-10-11|FC Wallbach-Zeiningen|FC Aesch|2|3
2026-10-11|SV Muttenz|FC Möhlin-Riburg/ACLI|2|0
2026-10-17|FC Aesch|FC Breitenbach|5|3
2026-10-17|FC Pratteln|FC Gelterkinden|2|5
2026-10-17|FC Wallbach-Zeiningen|SV Muttenz|1|0
2026-10-17|FC Zwingen|FC Amicitia Riehen|1|5
2026-10-18|AS Timau Basel|FC Bubendorf|0|1
2026-10-22|FC Reinach|FC Wallbach-Zeiningen|3|1
2026-10-24|FC Amicitia Riehen|FC Möhlin-Riburg/ACLI|4|1
2026-10-24|FC Breitenbach|FC Pratteln|1|2
2026-10-24|FC Gelterkinden|AS Timau Basel|2|3
2026-10-25|BSC Old Boys|FC Zwingen|5|1
2026-10-25|SV Muttenz|FC Aesch|2|4
2026-10-27|FC Möhlin-Riburg/ACLI|FC Reinach|2|1
2026-10-31|AS Timau Basel|FC Breitenbach|2|4
2026-10-31|FC Aesch|FC Pratteln|6|2
2026-10-31|FC Bubendorf|FC Zwingen|1|1
2026-10-31|FC Möhlin-Riburg/ACLI|BSC Old Boys|0|1
2026-11-01|FC Wallbach-Zeiningen|FC Amicitia Riehen|1|1
2026-11-01|SV Muttenz|FC Reinach|1|2
2026-11-07|FC Amicitia Riehen|SV Muttenz|0|2
2026-11-07|FC Bubendorf|FC Möhlin-Riburg/ACLI|0|1
2026-11-07|FC Gelterkinden|FC Zwingen|3|2
2026-11-07|FC Pratteln|AS Timau Basel|1|2
2026-11-07|FC Reinach|FC Aesch|0|5
2026-11-08|BSC Old Boys|FC Wallbach-Zeiningen|2|3"""

analysis_text = """FORM & TREND
Pratteln ist Siebter mit 18 Punkten aus 13 Spielen (6 S, 7 N, 28:31 Tore). Vier Niederlagen aus den letzten fünf Spielen (0,6 Punkte pro Spiel, davor 1,875). In diesen fünf Spielen: 8 Tore, 17 Gegentore.

WANN FALLEN IHRE TORE
Keine Daten: Es liegen keine Torminuten vor. Zeitliche Muster lassen sich nicht beurteilen.

WER TRIFFT
Keine Daten: Es sind keine Torschützen erfasst.

HEIM/AUSWÄRTS
Daheim stark: 4 Siege aus 6 Spielen, 12 Punkte, 15:8 Tore. Auswärts schwach: 2 Siege aus 7 Spielen, 6 Punkte, 13:23 Tore. Das Hinspiel gewannen sie bei uns 5:3.

SCHWACHSTELLEN
Die Abwehr ist anfällig. In 5 von 13 Spielen kassierten sie drei oder mehr Gegentore, darunter 5 gegen Muttenz und Gelterkinden und 6 gegen Aesch. Auswärts kassieren sie im Schnitt etwa 3,3 Tore. Die Datenbasis ist mit 13 Spielen eher dünn.

3 TIPPS FÜR UNS
1. Mutig und mit Tempo nach vorne spielen. Ihre Defensive gibt viele Tore her, vor allem auswärts.
2. Früh in Führung gehen. Sie verloren zuletzt oft hoch und lagen offenbar häufig hinten (Aussage nur aus den Resultaten abgeleitet).
3. Hinten kompakt bleiben. Sie können auch viele Tore schiessen (5:3 und 5:0 in den ersten beiden Spielen), die Offensive darf man nicht unterschätzen."""

rows = [("team", "meta", meta), ("team", "table", table)]
rows += [("players", pid, {"name": n, "nr": None, "pos": "ZM", "year": None}) for pid, n in players]
for mid, d, t, opp, home, st, gf, ga in own:
    det = details.get(mid, {})
    rows.append(("matches", mid, {"date": d, "time": t, "opp": opp, "home": home, "comp": "Meisterschaft", "status": st,
                                  "gf": gf, "ga": ga, "goals": det.get("goals", []), "against": det.get("against", []), "stats": {}}))
for line in fx.splitlines():
    d, h, a, hg, ag = line.split("|")
    rows.append(("fixtures", slug(f"{d}-{h}-{a}"), {"date": d, "home": h, "away": a, "hg": int(hg), "ag": int(ag), "comp": "Meisterschaft", "goals": []}))
rows.append(("analyses", "fc-pratteln", {"opp": "FC Pratteln", "at": "2026-11-17T21:49:48.886Z", "text": analysis_text}))

q = lambda s: "'" + s.replace("'", "''") + "'"
out = ["-- SCB Kader – Daten aus der bisherigen App (Stand 17.11.2026). Einmal NACH setup.sql ausführen.",
       "insert into public.docs (coll, id, data) values"]
out.append(",\n".join(f"  ({q(c)}, {q(i)}, {q(json.dumps(d, ensure_ascii=False))}::jsonb)" for c, i, d in rows))
out.append("on conflict (coll, id) do update set data = excluded.data;")
open("supabase/data.sql", "w").write("\n".join(out) + "\n")
print(len(rows), "rows;", sum(1 for r in rows if r[0] == "fixtures"), "fixtures")
