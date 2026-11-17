#!/usr/bin/env python3
"""Kleines Werkzeug, um die Daten der Kader-App in Supabase zu lesen und zu schreiben.

Braucht den SECRET key (sb_secret_...) in der Umgebungsvariable SUPABASE_SECRET_KEY
oder in einer Datei .env im Repo-Ordner (wird nicht committet):
    SUPABASE_SECRET_KEY=sb_secret_...

Beispiele:
    python3 tools/sb.py list matches
    python3 tools/sb.py get team table
    python3 tools/sb.py put fixtures 2026-11-07-fc-reinach-fc-aesch fixture.json
    echo '{"opp":"FC Aesch","text":"...","at":"2026-11-18T10:00:00Z"}' | python3 tools/sb.py put analyses fc-aesch -
    python3 tools/sb.py put-many rows.json      # [{"coll":..,"id":..,"data":{..}}, ...]
    python3 tools/sb.py delete fixtures some-id
"""
import json, os, sys, urllib.request, urllib.parse, pathlib

URL = "https://mcdjzcisihabimpvmgzg.supabase.co/rest/v1/docs"


def key():
    k = os.environ.get("SUPABASE_SECRET_KEY")
    env = pathlib.Path(__file__).resolve().parent.parent / ".env"
    if not k and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("SUPABASE_SECRET_KEY="):
                k = line.split("=", 1)[1].strip().strip('"')
    if not k or not k.startswith("sb_secret_"):
        sys.exit("SUPABASE_SECRET_KEY fehlt (in .env oder als Umgebungsvariable).")
    return k


def call(method, query="", body=None, prefer=None):
    h = {"apikey": key(), "Content-Type": "application/json"}
    if prefer:
        h["Prefer"] = prefer
    req = urllib.request.Request(URL + query, method=method, headers=h,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            t = r.read().decode()
            return json.loads(t) if t else None
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()}")


def read_json(arg):
    return json.load(sys.stdin) if arg == "-" else json.load(open(arg))


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    cmd = a[0]
    if cmd == "list":
        q = "?select=id,data&coll=eq." + urllib.parse.quote(a[1])
        for r in call("GET", q):
            print(json.dumps({"id": r["id"], **r["data"]}, ensure_ascii=False))
    elif cmd == "get":
        q = f"?select=data&coll=eq.{urllib.parse.quote(a[1])}&id=eq.{urllib.parse.quote(a[2])}"
        r = call("GET", q)
        print(json.dumps(r[0]["data"] if r else None, ensure_ascii=False, indent=2))
    elif cmd == "put":
        call("POST", "?on_conflict=coll,id", [{"coll": a[1], "id": a[2], "data": read_json(a[3])}], "resolution=merge-duplicates")
        print("ok")
    elif cmd == "put-many":
        rows = read_json(a[1])
        for i in range(0, len(rows), 200):
            call("POST", "?on_conflict=coll,id", rows[i:i + 200], "resolution=merge-duplicates")
        print(f"ok, {len(rows)} Zeilen")
    elif cmd == "delete":
        call("DELETE", f"?coll=eq.{urllib.parse.quote(a[1])}&id=eq.{urllib.parse.quote(a[2])}")
        print("ok")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
