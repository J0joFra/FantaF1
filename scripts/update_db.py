#!/usr/bin/env python3
"""
Aggiorna il DB Supabase dal dump ufficiale f1db (PostgreSQL).

USO (dalla ROOT del progetto):
    python scripts/update_db.py "C:/percorso/al/f1db-sql-postgresql.sql"           # dry-run (mostra cosa farebbe)
    python scripts/update_db.py "C:/percorso/al/f1db-sql-postgresql.sql" --apply    # esegue le scritture

La stagione viene rilevata AUTOMATICAMENTE (= ultimo anno presente nel dump).
Per forzarla:  --year=2026

Aggiorna solo (basso rischio, non tocca struttura/RLS/storico):
  - season_driver_standing        (classifica piloti della stagione)
  - season_constructor_standing   (classifica costruttori della stagione)
  - race_data                     (risultati/qualifiche/sprint/giri veloci/DOTD dei GP della stagione)

Richiede in .env (NON committare .env):
  VITE_SUPABASE_URL=...            (o NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY=...    (chiave service role: bypassa RLS)

Nessuna dipendenza esterna: usa solo la libreria standard di Python 3.
"""
import sys
import os
import re
import json
import urllib.request
import urllib.error

# La console Windows (cp1252) non gestisce alcuni caratteri: forza UTF-8.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# ── Argomenti ────────────────────────────────────────────────────────────────
positional = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
if not positional:
    print('Uso: python scripts/update_db.py "<dump.sql>" [--apply] [--year=YYYY]')
    sys.exit(1)
DUMP = positional[0]
APPLY = "--apply" in flags
YEAR = None
for f in flags:
    if f.startswith("--year="):
        YEAR = int(f.split("=", 1)[1])

if not os.path.isfile(DUMP):
    print(f"ERRORE: file non trovato: {DUMP}")
    sys.exit(1)

# ── .env ─────────────────────────────────────────────────────────────────────
def read_env(path=".env"):
    env = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

try:
    env = read_env()
except FileNotFoundError:
    print("ERRORE: .env non trovato. Esegui lo script dalla ROOT del progetto.")
    sys.exit(1)

URL = env.get("VITE_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
KEY = env.get("SUPABASE_SERVICE_ROLE_KEY")
if not URL or not KEY:
    print("ERRORE: VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti in .env")
    sys.exit(1)

# ── Parser dei VALUES SQL ─────────────────────────────────────────────────────
_DATE_PREFIX = re.compile(r"\b(?:DATE|TIMESTAMP|TIMESTAMPTZ|TIME)\s+'", re.I)

def parse_tuple(raw):
    s = _DATE_PREFIX.sub("'", raw)
    out = []
    i, n = 0, len(s)
    while i < n:
        while i < n and s[i] in " \t,":
            i += 1
        if i >= n:
            break
        if s[i] == "'":
            i += 1
            buf = []
            while i < n:
                if s[i] == "'" and i + 1 < n and s[i + 1] == "'":
                    buf.append("'"); i += 2
                elif s[i] == "'":
                    i += 1; break
                else:
                    buf.append(s[i]); i += 1
            out.append("".join(buf))
        else:
            j = i
            while j < n and s[j] != ",":
                j += 1
            tok = s[i:j].strip(); i = j
            if tok == "" or tok.lower() == "null":
                out.append(None)
            elif tok == "TRUE":
                out.append(True)
            elif tok == "FALSE":
                out.append(False)
            else:
                try:
                    out.append(int(tok))
                except ValueError:
                    try:
                        out.append(float(tok))
                    except ValueError:
                        out.append(tok)
    return out

_INSERT_RE = re.compile(r'^INSERT INTO "([^"]+)"\s*\(([^)]*)\)\s*VALUES\s*\((.*)\);?\s*$')

def parse_insert(line):
    m = _INSERT_RE.match(line)
    if not m:
        return None
    cols = [c.strip().strip('"') for c in m.group(2).split(",")]
    vals = parse_tuple(m.group(3))
    row = {cols[k]: (vals[k] if k < len(vals) else None) for k in range(len(cols))}
    return m.group(1), row, len(cols), len(vals)

def first_int_after_values(line):
    k = line.find("VALUES (")
    if k < 0:
        return None
    m = re.match(r"\s*(\d+)", line[k + 8:])
    return int(m.group(1)) if m else None

# ── Pass 1: race(id→anno) + classifiche ───────────────────────────────────────
print(f"Lettura dump: {DUMP}")
race_year, sds, scs, bad = {}, [], [], 0
with open(DUMP, encoding="utf-8") as fh:
    for line in fh:
        if line.startswith('INSERT INTO "race" ('):
            p = parse_insert(line)
            if p and p[1].get("id") is not None and p[1].get("year") is not None:
                race_year[p[1]["id"]] = p[1]["year"]
        elif line.startswith('INSERT INTO "season_driver_standing"'):
            p = parse_insert(line)
            if p:
                bad += (p[2] != p[3]); sds.append(p[1])
        elif line.startswith('INSERT INTO "season_constructor_standing"'):
            p = parse_insert(line)
            if p:
                bad += (p[2] != p[3]); scs.append(p[1])

if YEAR is None:
    YEAR = max((r.get("year") for r in sds if r.get("year") is not None), default=None)
if YEAR is None:
    print("ERRORE: impossibile rilevare la stagione dal dump.")
    sys.exit(1)

sds = [r for r in sds if r.get("year") == YEAR]
scs = [r for r in scs if r.get("year") == YEAR]
race_ids = sorted(rid for rid, y in race_year.items() if y == YEAR)
race_set = set(race_ids)

# ── Pass 2: race_data delle gare della stagione ───────────────────────────────
rdata = []
with open(DUMP, encoding="utf-8") as fh:
    for line in fh:
        if line.startswith('INSERT INTO "race_data"'):
            rid = first_int_after_values(line)
            if rid in race_set:
                p = parse_insert(line)
                if p:
                    bad += (p[2] != p[3]); rdata.append(p[1])

leader = sds[0] if sds else None
leader_txt = f"{leader.get('driver_id')} ({leader.get('points')} pt)" if leader else "n/d"
span = f"{race_ids[0]}..{race_ids[-1]}" if race_ids else "-"
print(f"\nStagione rilevata: {YEAR}")
print(f"  gare (race_id)             : {len(race_ids)}  [{span}]")
print(f"  season_driver_standing     : {len(sds)}")
print(f"  season_constructor_standing: {len(scs)}")
print(f"  race_data                  : {len(rdata)}")
print(f"  disallineamenti col/val    : {bad}")
print(f"  leader                     : {leader_txt}")

if not APPLY:
    print("\n[DRY RUN] Nessuna scrittura. Rilancia con --apply per eseguire.")
    sys.exit(0)
if bad > 0:
    print("\nERRORE: disallineamenti di parsing rilevati — interrompo per sicurezza.")
    sys.exit(1)

# ── Scrittura su Supabase (REST / PostgREST) ──────────────────────────────────
BASE = URL.rstrip("/") + "/rest/v1"
HEAD = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

def _req(method, path, body=None):
    h = dict(HEAD); h["Prefer"] = "return=minimal"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ERRORE {method} {path}: HTTP {e.code} — {e.read().decode(errors='replace')}")

def delete(table, query):
    _req("DELETE", f"/{table}?{query}")

def insert(table, rows):
    # PostgREST richiede che ogni oggetto del batch abbia le stesse chiavi:
    # le righe del dump (es. race_data) hanno colonne diverse, quindi normalizziamo
    # ogni batch all'unione delle chiavi (riempiendo le mancanti con null).
    for i in range(0, len(rows), 500):
        batch = rows[i:i + 500]
        keys = set()
        for r in batch:
            keys.update(r.keys())
        norm = [{k: r.get(k) for k in keys} for r in batch]
        _req("POST", f"/{table}", body=norm)

print("\n=== APPLY ===")
delete("season_driver_standing", f"year=eq.{YEAR}")
insert("season_driver_standing", sds)
print(f"[OK] season_driver_standing: {len(sds)}")

delete("season_constructor_standing", f"year=eq.{YEAR}")
insert("season_constructor_standing", scs)
print(f"[OK] season_constructor_standing: {len(scs)}")

if race_ids:
    delete("race_data", "race_id=in.(" + ",".join(str(x) for x in race_ids) + ")")
insert("race_data", rdata)
print(f"[OK] race_data: {len(rdata)}")

print("\nFATTO. L'app mostra i nuovi dati al prossimo caricamento (cache ~5 min).")
