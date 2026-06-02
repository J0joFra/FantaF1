# Script di manutenzione dati (Supabase)

Aggiorna il DB Supabase a partire dal dump ufficiale **f1db** (PostgreSQL).
Usa la `SUPABASE_SERVICE_ROLE_KEY` letta da `.env` → **eseguire sempre dalla root del progetto** e non committare `.env`.

## update-2026-data.cjs
Refresh mirato della stagione in corso: classifica piloti + classifica costruttori + risultati (`race_data`).
Operazione a basso rischio: cancella e reinserisce solo le righe della stagione, non tocca struttura/RLS/storico.

1. Scarica il dump aggiornato (`f1db-sql-postgresql.sql`).
2. Aggiorna nello script la costante `DUMP` (o esporta `F1DB_DUMP=<percorso>`). A inizio nuova stagione aggiorna anche `YEAR` e `RACE_ID_RANGE`.
3. Dry-run:  `node scripts/update-2026-data.cjs`
4. Applica:  `node scripts/update-2026-data.cjs --apply`

> Nota: il calendario `race` (date/round) non viene toccato da questo script.
> Per cambi di calendario (es. GP cancellati) serve un riallineamento dedicato della tabella `race`.
