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

## Passo 5 — Prova

1. Apri l'app, premi il pulsante 🐞 "Segnala un problema", scrivi un messaggio e invia.
2. Controlla che compaia una nuova riga nel Google Sheet.

## Note

- La richiesta usa `Content-Type: text/plain` di proposito, per evitare la
  preflight CORS: Apps Script legge comunque il body. Non modificare questo
  header nel front-end.
- Se non arriva nulla: verifica che la distribuzione sia "Chiunque", che l'URL
  finisca in `/exec` e che tu abbia rifatto la build dopo aver impostato la
  variabile.
- Vuoi ricevere anche un'email a ogni segnalazione? Decommenta la riga
  `MailApp.sendEmail(...)` nello script.
