#!/usr/bin/env python3
"""
Aggiorna il DB Supabase dal dump ufficiale f1db (PostgreSQL).

USO (dalla ROOT del progetto):
    python scripts/update_db.py "C:/percorso/al/f1db-sql-postgresql.sql"           # dry-run (mostra cosa farebbe)
    python scripts/update_db.py "C:/percorso/al/f1db-sql-postgresql.sql" --apply    # esegue le scritture

La stagione viene rilevata AUTOMATICAMENTE (= ultimo anno presente nel dump).
Per forzarla:  --year=2026

Aggiorna solo (basso rischio, non tocca struttura/RLS/storico):
  - driver                        (SOLO i piloti nuovi, non presenti nel DB — upsert)
  - season_driver_standing        (classifica piloti della stagione)
  - season_constructor_standing   (classifica costruttori della stagione)
  - race                          (calendario della stagione: date, round, circuiti; via le gare tolte)
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

# ── Config (.env in locale, oppure variabili d'ambiente su CI) ────────────────
def read_env(path=".env"):
    env = {}
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass  # su GitHub Actions non c'è .env: si usano le env vars
    return env

# Le variabili d'ambiente (secret GitHub) hanno priorità sul .env locale.
env = {**read_env(), **{k: v for k, v in os.environ.items() if v}}

URL = (env.get("VITE_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
       or env.get("SUPABASE_URL"))
KEY = env.get("SUPABASE_SERVICE_ROLE_KEY")
if not URL or not KEY:
    print("ERRORE: SUPABASE_URL (o VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY mancanti.\n"
          "  In locale: mettili nel file .env.\n"
          "  Su GitHub Actions: aggiungili come secret del repository.")
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

# ── Pass 1: race(id→anno) + classifiche + tutti i driver dal dump ─────────────
print(f"Lettura dump: {DUMP}")
race_year, race_rows, sds, scs, bad = {}, {}, [], [], 0
all_drivers_in_dump = {}   # id → row completa

with open(DUMP, encoding="utf-8") as fh:
    for line in fh:
        if line.startswith('INSERT INTO "driver" ('):
            p = parse_insert(line)
            if p and p[1].get("id"):
                bad += (p[2] != p[3])
                all_drivers_in_dump[p[1]["id"]] = p[1]
        elif line.startswith('INSERT INTO "race" ('):
            p = parse_insert(line)
            if p and p[1].get("id") is not None and p[1].get("year") is not None:
                race_year[p[1]["id"]] = p[1]["year"]
                race_rows[p[1]["id"]] = p[1]
                bad += (p[2] != p[3])
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
drivers_needed = set()   # driver_id referenziati in race_data della stagione

with open(DUMP, encoding="utf-8") as fh:
    for line in fh:
        if line.startswith('INSERT INTO "race_data"'):
            rid = first_int_after_values(line)
            if rid in race_set:
                p = parse_insert(line)
                if p:
                    bad += (p[2] != p[3])
                    rdata.append(p[1])
                    if p[1].get("driver_id"):
                        drivers_needed.add(p[1]["driver_id"])

# ── Recupera driver già presenti in Supabase ──────────────────────────────────
BASE = URL.rstrip("/") + "/rest/v1"
HEAD = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

def _req(method, path, body=None, extra_headers=None):
    h = dict(HEAD)
    h["Prefer"] = "return=minimal"
    if extra_headers:
        h.update(extra_headers)
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ERRORE {method} {path}: HTTP {e.code} — {e.read().decode(errors='replace')}")

def get_existing_driver_ids():
    """Recupera tutti gli id driver già presenti nel DB."""
    h = dict(HEAD)
    h["Accept"] = "application/json"
    r = urllib.request.Request(BASE + "/driver?select=id", headers=h, method="GET")
    try:
        with urllib.request.urlopen(r) as resp:
            rows = json.loads(resp.read())
            return {row["id"] for row in rows}
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ERRORE GET /driver: HTTP {e.code} — {e.read().decode(errors='replace')}")

def get_json(path):
    h = dict(HEAD)
    h["Accept"] = "application/json"
    r = urllib.request.Request(BASE + path, headers=h, method="GET")
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ERRORE GET {path}: HTTP {e.code} — {e.read().decode(errors='replace')}")

def patch(table, query, body):
    _req("PATCH", f"/{table}?{query}", body=body)

def delete(table, query):
    _req("DELETE", f"/{table}?{query}")

def upsert(table, rows):
    """Upsert: inserisce o aggiorna in base alla PK (on_conflict=merge-duplicates)."""
    for i in range(0, len(rows), 500):
        batch = rows[i:i + 500]
        keys = set()
        for row in batch:
            keys.update(row.keys())
        norm = [{k: row.get(k) for k in keys} for row in batch]
        _req("POST", f"/{table}", body=norm,
             extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"})

def insert(table, rows):
    for i in range(0, len(rows), 500):
        batch = rows[i:i + 500]
        keys = set()
        for row in batch:
            keys.update(row.keys())
        norm = [{k: row.get(k) for k in keys} for row in batch]
        _req("POST", f"/{table}", body=norm)

# ── Calcola driver mancanti ───────────────────────────────────────────────────
print("\nControllo driver mancanti nel DB...")
existing_ids = get_existing_driver_ids()
missing_ids = drivers_needed - existing_ids
new_drivers = [all_drivers_in_dump[did] for did in missing_ids if did in all_drivers_in_dump]
unknown_ids = missing_ids - set(all_drivers_in_dump.keys())

# ── Calendario: cosa cambia rispetto a Supabase ───────────────────────────────
# Se F1DB toglie o sposta una gara (nel 2026: Bahrain e Arabia Saudita
# cancellati), gli id delle gare successive cambiano. Prima questo script
# aggiornava solo race_data, con gli id nuovi, lasciando il calendario
# vecchio: ogni risultato finiva sulla gara dopo. Ora il calendario della
# stagione si allinea al dump prima di scrivere i risultati.
db_races = {r["id"]: r for r in get_json(f"/race?year=eq.{YEAR}&select=id,round,grand_prix_id,date")}
stale_race_ids = sorted(set(db_races) - race_set)
changed_races = [rid for rid in race_ids
                 if rid not in db_races
                 or any(db_races[rid].get(k) != race_rows[rid].get(k) for k in ("round", "grand_prix_id", "date"))]

leader = sds[0] if sds else None
leader_txt = f"{leader.get('driver_id')} ({leader.get('points')} pt)" if leader else "n/d"
span = f"{race_ids[0]}..{race_ids[-1]}" if race_ids else "-"

print(f"\nStagione rilevata: {YEAR}")
print(f"  gare (race_id)             : {len(race_ids)}  [{span}]")
print(f"  calendario: gare da togliere: {stale_race_ids or '-'}")
changed_txt = ", ".join(f"{rid}=R{race_rows[rid].get('round')} {race_rows[rid].get('grand_prix_id')}"
                        for rid in changed_races)
print(f"  calendario: gare cambiate   : {len(changed_races)}" + (f"  ({changed_txt})" if changed_txt else ""))
print(f"  season_driver_standing     : {len(sds)}")
print(f"  season_constructor_standing: {len(scs)}")
print(f"  race_data                  : {len(rdata)}")
print(f"  driver nuovi da aggiungere : {len(new_drivers)}", end="")
if new_drivers:
    names = ", ".join(d.get("id", "?") for d in new_drivers)
    print(f"  ({names})", end="")
print()
if unknown_ids:
    print(f"  ATTENZIONE driver in race_data ma non nel dump: {unknown_ids}")
print(f"  disallineamenti col/val    : {bad}")
print(f"  leader                     : {leader_txt}")

if not APPLY:
    print("\n[DRY RUN] Nessuna scrittura. Rilancia con --apply per eseguire.")
    sys.exit(0)
if bad > 0:
    print("\nERRORE: disallineamenti di parsing rilevati — interrompo per sicurezza.")
    sys.exit(1)
if unknown_ids:
    print(f"\nERRORE: driver referenziati in race_data ma assenti dal dump: {unknown_ids}")
    sys.exit(1)

# ── Scrittura su Supabase ─────────────────────────────────────────────────────
print("\n=== APPLY ===")

# 0. Upsert driver nuovi (prima di race_data per rispettare la FK)
if new_drivers:
    upsert("driver", new_drivers)
    print(f"[OK] driver nuovi (upsert): {len(new_drivers)}")
else:
    print("[OK] driver: nessun nuovo pilota da aggiungere")

# 0b. Calendario della stagione (prima di race_data, che lo referenzia)
if stale_race_ids:
    ids = ",".join(str(x) for x in stale_race_ids)
    for t in ("race_data", "race_driver_standing", "race_constructor_standing"):
        delete(t, f"race_id=in.({ids})")
    delete("race", f"id=in.({ids})")
    print(f"[OK] race: tolte {len(stale_race_ids)} gare non più nel calendario ({ids})")
if changed_races:
    # (year, round) è unico: prima si spostano i round esistenti fuori dalla
    # strada, poi si scrive il calendario nuovo. Senza, spostare Miami dal
    # round 6 al 4 urta contro il round 4 vecchio ancora presente.
    for rid in race_ids:
        if rid in db_races:
            patch("race", f"id=eq.{rid}", {"round": 1000 + rid})
    race_cols = set((get_json("/race?select=*&limit=1") or [{}])[0].keys())
    rows = [{k: v for k, v in race_rows[rid].items() if not race_cols or k in race_cols} for rid in race_ids]
    upsert("race", rows)
    print(f"[OK] race: calendario {YEAR} allineato ({len(rows)} gare)")
else:
    print(f"[OK] race: calendario {YEAR} già allineato")

# 1. Classifiche piloti
delete("season_driver_standing", f"year=eq.{YEAR}")
insert("season_driver_standing", sds)
print(f"[OK] season_driver_standing: {len(sds)}")

# 2. Classifiche costruttori
delete("season_constructor_standing", f"year=eq.{YEAR}")
insert("season_constructor_standing", scs)
print(f"[OK] season_constructor_standing: {len(scs)}")

# 3. race_data
if race_ids:
    delete("race_data", "race_id=in.(" + ",".join(str(x) for x in race_ids) + ")")
insert("race_data", rdata)
print(f"[OK] race_data: {len(rdata)}")

print("\nFATTO. L'app mostra i nuovi dati al prossimo caricamento (cache ~5 min).")
