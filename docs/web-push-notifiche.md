# Notifiche push web — promemoria gara

Invia una notifica push al browser **~1 ora prima** di qualifiche, sprint e gara
del prossimo GP, anche a scheda/app chiusa. Tutto gira sul **free tier**:

- I servizi push dei browser (Chrome/FCM, Firefox, Apple) sono gratuiti.
- L'invio schedulato usa la **Supabase** che già usi: una **Edge Function** +
  **pg_cron** (inclusi nel piano gratuito).

## Come funziona (in breve)

1. L'utente attiva il toggle "Promemoria gara" → il browser si iscrive alle push
   e la subscription viene salvata nella tabella `push_subscriptions`.
2. Un **cron** su Supabase invoca ogni 15 min la Edge Function `send-race-reminders`.
3. La funzione controlla se una sessione del prossimo GP parte tra ~1 ora e, in
   quel caso, invia la push a tutti gli iscritti (una sola volta, grazie a
   `sent_reminders`).

## ⚠️ Limiti onesti

- **iOS/Safari**: le push web arrivano **solo se il sito è aggiunto alla schermata
  Home** (PWA installata). Su Android e desktop funzionano normalmente.
- Serve **HTTPS** (Vercel lo è già). In locale le push funzionano solo su
  `localhost`.

---

## Setup passo-passo

### 1. Genera le chiavi VAPID (gratis, una volta sola)

```bash
npx web-push generate-vapid-keys
```

Ottieni una **Public Key** e una **Private Key**. La pubblica è condivisibile,
la privata è un segreto.

### 2. Applica la migration del database

Crea le tabelle `push_subscriptions` e `sent_reminders`.

Con la Supabase CLI:
```bash
supabase db push
```
Oppure copia il contenuto di `supabase/migrations/0001_push_subscriptions.sql`
nell'**SQL Editor** della dashboard Supabase ed eseguilo.

### 3. Imposta i secret e fai il deploy della Edge Function

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="LA_TUA_PUBLIC_KEY" \
  VAPID_PRIVATE_KEY="LA_TUA_PRIVATE_KEY" \
  VAPID_SUBJECT="mailto:tua@email.com"

supabase functions deploy send-race-reminders
```

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono forniti in automatico alla
> funzione: non serve impostarli.

### 4. Configura la chiave pubblica nel front-end

Nel file `.env` (locale) e nelle **Environment Variables di Vercel**:

```
VITE_VAPID_PUBLIC_KEY=LA_TUA_PUBLIC_KEY
```

Poi rifai la build / il deploy (le variabili `VITE_` sono incorporate a build-time).

### 5. Schedula il cron (ogni 15 minuti)

Nell'**SQL Editor** di Supabase, abilita le estensioni e crea la schedule.
Sostituisci `<PROJECT_REF>` e la `service_role` key.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'race-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/send-race-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    )
  );
  $$
);
```

Per rimuoverlo: `select cron.unschedule('race-reminders');`

### 6. Prova

1. Deploy dell'app, apri il sito su Chrome/Android o desktop.
2. Attiva "Promemoria gara" e concedi il permesso notifiche.
3. Test manuale della funzione (dovrebbe rispondere `{"ok":true,...}`):
   ```bash
   curl -X POST 'https://<PROJECT_REF>.functions.supabase.co/send-race-reminders' \
     -H 'Authorization: Bearer <SERVICE_ROLE_KEY>'
   ```
   Se una sessione è entro la finestra "1 ora prima", ricevi la notifica.

## Sicurezza / note

- Le subscription sono URL "capability": senza la **VAPID private key** (che sta
  solo sui secret della funzione) nessuno può inviare notifiche. Le policy RLS
  permettono all'anon solo di iscriversi/disiscriversi; `sent_reminders` è scritta
  solo dalla funzione (service role).
- Nessun dato personale viene salvato oltre allo user agent e alla lingua scelta.
- Vuoi cambiare l'anticipo (default 60 min) o la finestra? Modifica
  `LEAD_MINUTES` / `WINDOW_MINUTES` in
  `supabase/functions/send-race-reminders/index.ts` (se cambi la finestra,
  tienila ≥ all'intervallo del cron).
