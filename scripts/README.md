# Script di manutenzione dati (Supabase)

Aggiorna il DB Supabase a partire dal dump ufficiale **f1db** (PostgreSQL).
Usa la `SUPABASE_SERVICE_ROLE_KEY` letta da `.env` → **eseguire sempre dalla root del progetto** e non committare `.env`.

## update_db.py  ⭐ (consigliato)
Script Python autonomo: gli passi il file del dump e **rileva da solo la stagione**
(ultimo anno presente) e l'intervallo gare. Nessuna costante da aggiornare a inizio
stagione, nessuna dipendenza esterna (solo Python 3).

```
# dry-run (mostra cosa farebbe, non scrive)
python scripts/update_db.py "C:/percorso/f1db-sql-postgresql.sql"
# esegue le scritture
python scripts/update_db.py "C:/percorso/f1db-sql-postgresql.sql" --apply
# forzare una stagione diversa: --year=2027
```
Aggiorna `season_driver_standing`, `season_constructor_standing` e `race_data`
della stagione. Richiede `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

## update-2026-data.cjs  (versione Node, legacy)
Refresh mirato della stagione in corso: classifica piloti + classifica costruttori + risultati (`race_data`).
Operazione a basso rischio: cancella e reinserisce solo le righe della stagione, non tocca struttura/RLS/storico.

1. Scarica il dump aggiornato (`f1db-sql-postgresql.sql`).
2. Aggiorna nello script la costante `DUMP` (o esporta `F1DB_DUMP=<percorso>`). A inizio nuova stagione aggiorna anche `YEAR` e `RACE_ID_RANGE`.
3. Dry-run:  `node scripts/update-2026-data.cjs`
4. Applica:  `node scripts/update-2026-data.cjs --apply`

> Nota: il calendario `race` (date/round) non viene toccato da questo script.
> Per cambi di calendario (es. GP cancellati) serve un riallineamento dedicato della tabella `race`.
