# Segnalazioni bug → Google Sheet

Questa guida collega il pulsante **"Segnala un problema"** dell'app a un
**Google Sheet**: ogni segnalazione inviata dall'utente viene salvata
automaticamente come nuova riga nel foglio.

Il front-end è già pronto: `src/components/BugReportModal.jsx` invia una
richiesta `POST` all'URL definito nella variabile d'ambiente
`VITE_BUG_REPORT_WEBHOOK_URL`. Manca solo la parte lato Google (lo script che
riceve i dati e li scrive nel foglio) e l'impostazione della variabile.

## Dati inviati a ogni segnalazione

Il modale invia un JSON con questi campi:

| Campo        | Descrizione                                  |
|--------------|----------------------------------------------|
| `message`    | Testo scritto dall'utente                    |
| `page`       | Pagina dell'app da cui è partita la segnalazione (`window.location.pathname`) |
| `appVersion` | Valore di `VITE_APP_VERSION` (se impostato)  |
| `userAgent`  | Browser/dispositivo dell'utente              |
| `timestamp`  | Data/ora ISO lato client                     |

---

## Passo 1 — Crea il Google Sheet

1. Vai su <https://sheets.google.com> e crea un nuovo foglio, es. **"FantaF1 – Bug Reports"**.
2. (Facoltativo) Nella prima riga metti le intestazioni:
   `Ricevuto il | Messaggio | Pagina | Versione | User agent | Timestamp client`

## Passo 2 — Aggiungi l'Apps Script

1. Nel foglio: menù **Estensioni → Apps Script**.
2. Cancella il contenuto di default e incolla il codice di
   [`scripts/bug-report-apps-script.gs`](../scripts/bug-report-apps-script.gs).
3. Salva (icona floppy).

## Passo 3 — Pubblica come Web App

1. In alto a destra: **Distribuisci → Nuova distribuzione**.
2. Tipo (icona ingranaggio): **App web**.
3. Configurazione:
   - **Esegui come:** *Me* (il tuo account).
   - **Chi può accedere:** *Chiunque* (necessario perché l'app la chiami senza login).
4. **Distribuisci** → autorizza gli accessi quando richiesto.
5. Copia l'**URL dell'app web** (finisce con `/exec`). Questo è il tuo webhook.

> ⚠️ Ogni volta che modifichi lo script devi fare **Distribuisci → Gestisci
> distribuzioni → Modifica → Nuova versione**, altrimenti l'URL continua a usare
> la versione vecchia.

## Passo 4 — Configura la variabile d'ambiente

Crea un file `.env` nella radice del progetto (copiando `.env.example`) e
incolla l'URL:

```
VITE_BUG_REPORT_WEBHOOK_URL=https://script.google.com/macros/s/XXXXXXXX/exec
```

Poi riavvia il dev server (`npm run dev`) o rifai la build (`npm run build`).

### In produzione (Vercel)

Aggiungi la stessa variabile in **Vercel → Project → Settings → Environment
Variables**:

- Nome: `VITE_BUG_REPORT_WEBHOOK_URL`
- Valore: l'URL `/exec`
- Ambiente: Production (ed eventualmente Preview)

Poi fai un nuovo deploy perché le variabili `VITE_` vengono incorporate al
momento della build.

### Nell'APK Android — la parte che si dimentica

Vale la stessa regola, ed è la ragione per cui il pulsante ha smesso di
funzionare nell'app pubblicata mentre in locale andava: il workflow
`Build Android APK` compilava senza la variabile, quindi nel bundle finito
dentro l'APK l'URL era `undefined`. Non è recuperabile a runtime: se manca
alla build, manca per sempre in quella versione dell'app.

Va impostata come **secret del repository** — GitHub → Settings → Secrets and
variables → Actions → *New repository secret*:

| Secret | Valore |
| --- | --- |
| `VITE_BUG_REPORT_WEBHOOK_URL` | l'URL `/exec` dell'Apps Script |
| `VITE_VAPID_PUBLIC_KEY` | la chiave pubblica VAPID (notifiche push) |

Il workflow li legge da lì. Se mancano, la build **non fallisce** — sarebbe
peggio bloccare un rilascio — ma stampa un avviso ben visibile nel riepilogo
del run: *"VITE_BUG_REPORT_WEBHOOK_URL non è nel bundle"*. Se lo vedi, la
segnalazione bug in quell'APK non funziona.

## Passo 5 — Prova

1. Apri l'app, premi il pulsante 🐞 "Segnala un problema", scrivi un messaggio e invia.
2. Controlla che compaia una nuova riga nel Google Sheet.

## Perché l'invio usa `mode: "no-cors"`

Un Web App di Apps Script risponde con un redirect verso
`script.googleusercontent.com`, e quella risposta non porta gli header CORS.
Con una `fetch` normale il browser rifiuta di farci leggere la risposta e la
promise viene respinta — **anche quando la segnalazione è arrivata e la riga è
già nel foglio**. Era il comportamento peggiore possibile: l'utente leggeva
"Invio non riuscito", riprovava, e ogni tentativo finiva nel foglio.

Con `mode: "no-cors"` la richiesta parte lo stesso (`text/plain` è fra i
Content-Type ammessi senza preflight) e la risposta torna opaca. Non possiamo
leggere lo stato — quindi un errore *dentro* lo script non lo vedremo — ma una
rete assente o un timeout fanno comunque fallire la fetch, che è la distinzione
che serve davvero a chi sta scrivendo.

C'è anche un timeout di 15 secondi: senza, una rete che non risponde lasciava
la finestra in "Invio in corso…" per sempre, e siccome durante l'invio non si
poteva chiudere, l'unico modo di uscire era terminare l'app.

## Note

- La richiesta usa `Content-Type: text/plain` di proposito, per evitare la
  preflight CORS: Apps Script legge comunque il body. Non modificare questo
  header nel front-end.
- Se non arriva nulla: verifica che la distribuzione sia "Chiunque", che l'URL
  finisca in `/exec` e che tu abbia rifatto la build dopo aver impostato la
  variabile.
- Vuoi ricevere anche un'email a ogni segnalazione? Decommenta la riga
  `MailApp.sendEmail(...)` nello script.
