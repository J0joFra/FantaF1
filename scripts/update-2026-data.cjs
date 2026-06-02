/* Refresh della stagione in corso (2026) su Supabase dal dump ufficiale f1db.
 *
 * Ambito (basso rischio, non tocca struttura/RLS/storico):
 *   - season_driver_standing        (classifica piloti)
 *   - season_constructor_standing   (classifica costruttori)
 *   - race_data                     (risultati/qualifiche/sprint/giri veloci/DOTD) per i GP 2026
 *
 * Uso (dalla ROOT del progetto):
 *   node scripts/update-2026-data.cjs            # dry-run: mostra cosa verrebbe scritto
 *   node scripts/update-2026-data.cjs --apply    # esegue le scritture
 *
 * Richiede SUPABASE_SERVICE_ROLE_KEY in .env (NON committare .env).
 * Aggiorna le costanti DUMP / YEAR / RACE_ID_RANGE quando cambia stagione o dump.
 */
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

// ── Config ──────────────────────────────────────────────────────────────────
const DUMP = process.env.F1DB_DUMP
  || "C:/Users/FrancalanciJoaquim/Downloads/f1db-sql-postgresql (1)/f1db-sql-postgresql.sql";
const YEAR = 2026;
const RACE_ID_RANGE = [1150, 1171]; // intervallo id gara del 2026 nel dump f1db
const APPLY = process.argv.includes("--apply");

// ── Setup client ──────────────────────────────────────────────────────────────
const env = fs.readFileSync(".env", "utf8");
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || env.match(/VITE_SUPABASE_URL=(.*)/))[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const sb = createClient(url, key, { auth: { persistSession: false } });

const RACE_IDS = []; for (let i = RACE_ID_RANGE[0]; i <= RACE_ID_RANGE[1]; i++) RACE_IDS.push(i);
const RACE_SET = new Set(RACE_IDS);

// ── Parser dei VALUES SQL ─────────────────────────────────────────────────────
function parseTuple(raw) {
  const s = raw.replace(/\b(?:DATE|TIMESTAMP|TIMESTAMPTZ|TIME)\s+'/gi, "'");
  const out = []; let i = 0; const n = s.length;
  while (i < n) {
    while (i < n && (s[i] === " " || s[i] === "\t" || s[i] === ",")) i++;
    if (i >= n) break;
    if (s[i] === "'") {
      i++; let str = "";
      while (i < n) {
        if (s[i] === "'" && s[i + 1] === "'") { str += "'"; i += 2; }
        else if (s[i] === "'") { i++; break; }
        else { str += s[i]; i++; }
      }
      out.push(str);
    } else {
      let j = i; while (j < n && s[j] !== ",") j++;
      const tok = s.slice(i, j).trim(); i = j;
      if (tok === "" || /^null$/i.test(tok)) out.push(null);
      else if (tok === "TRUE") out.push(true);
      else if (tok === "FALSE") out.push(false);
      else { const num = Number(tok); out.push(Number.isNaN(num) ? tok : num); }
    }
  }
  return out;
}
function parseInsert(line) {
  const m = line.match(/^INSERT INTO "([^"]+)"\s*\(([^)]*)\)\s*VALUES\s*\((.*)\);?\s*$/);
  if (!m) return null;
  const cols = m[2].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
  const vals = parseTuple(m[3]);
  const row = {}; cols.forEach((c, idx) => { row[c] = vals[idx]; });
  return { table: m[1], row, ncols: cols.length, nvals: vals.length };
}
function firstIntAfterValues(line) {
  const k = line.indexOf("VALUES (");
  if (k < 0) return null;
  const mm = line.slice(k + 8).match(/^\s*(\d+)/);
  return mm ? Number(mm[1]) : null;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Reading dump: ${DUMP}`);
  const lines = fs.readFileSync(DUMP, "utf8").split("\n");

  const sds = [], scs = [], rdata = [];
  let bad = 0;
  for (const line of lines) {
    if (line.startsWith('INSERT INTO "season_driver_standing"')) {
      const p = parseInsert(line);
      if (p && p.row.year === YEAR) { if (p.ncols !== p.nvals) bad++; sds.push(p.row); }
    } else if (line.startsWith('INSERT INTO "season_constructor_standing"')) {
      const p = parseInsert(line);
      if (p && p.row.year === YEAR) { if (p.ncols !== p.nvals) bad++; scs.push(p.row); }
    } else if (line.startsWith('INSERT INTO "race_data"')) {
      const rid = firstIntAfterValues(line);
      if (rid !== null && RACE_SET.has(rid)) {
        const p = parseInsert(line);
        if (p) { if (p.ncols !== p.nvals) bad++; rdata.push(p.row); }
      }
    }
  }

  console.log(`\nDal dump (${YEAR}):`);
  console.log("  season_driver_standing     :", sds.length);
  console.log("  season_constructor_standing:", scs.length);
  console.log("  race_data (id " + RACE_ID_RANGE.join("-") + ") :", rdata.length);
  console.log("  disallineamenti col/val    :", bad);
  console.log("  leader:", sds[0] ? `${sds[0].driver_id} (${sds[0].points} pt)` : "n/d");

  if (!APPLY) { console.log("\n[DRY RUN] Nessuna scrittura. Rilancia con --apply per eseguire."); return; }
  if (bad > 0) throw new Error("Disallineamenti di parsing rilevati: interrompo per sicurezza.");

  console.log("\n=== APPLY ===");
  const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const ins = async (t, rows) => { for (const c of chunk(rows, 500)) { const { error } = await sb.from(t).insert(c); if (error) throw new Error(`${t} insert: ${error.message}`); } };

  let r = await sb.from("season_driver_standing").delete().eq("year", YEAR);
  if (r.error) throw new Error("del sds: " + r.error.message);
  await ins("season_driver_standing", sds);
  console.log("✓ season_driver_standing:", sds.length);

  r = await sb.from("season_constructor_standing").delete().eq("year", YEAR);
  if (r.error) throw new Error("del scs: " + r.error.message);
  await ins("season_constructor_standing", scs);
  console.log("✓ season_constructor_standing:", scs.length);

  r = await sb.from("race_data").delete().in("race_id", RACE_IDS);
  if (r.error) throw new Error("del race_data: " + r.error.message);
  await ins("race_data", rdata);
  console.log("✓ race_data:", rdata.length);

  console.log("\nFATTO.");
}
main().catch(e => { console.error("ERRORE:", e.message); process.exit(1); });
