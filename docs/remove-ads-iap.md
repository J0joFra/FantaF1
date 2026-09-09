# Acquisto in-app "Rimuovi pubblicità" (0,99 €)

Prodotto singolo (non consumabile) che disattiva per sempre il banner AdMob.
Funziona solo nell'**app Android** (nativa); sul web è un no-op.

## Cosa c'è nel codice
- `AndroidManifest.xml`: permesso `com.android.vending.BILLING`.
- `package.json`: `cordova-plugin-purchase` (Google Play Billing).
- `src/lib/purchases.js`: init store, acquisto, ripristino, entitlement in
  `localStorage['gridup_no_ads']`.
- `src/lib/ads.js`: se l'utente ha acquistato, il banner non viene mostrato.
- `src/components/RemoveAdsCard.jsx`: card "Rimuovi pubblicità" nella Home
  (visibile solo su nativo e finché non è stato acquistato) + "Ripristina acquisti".
- `src/App.jsx`: `initPurchases()` all'avvio (ripristina l'acquisto).

**Product ID atteso: `remove_ads`** (non consumabile).

## Passi su Google Play Console
1. **Monetizzazione → Prodotti → Prodotti in-app → Crea prodotto**
2. **ID prodotto:** `remove_ads` (deve combaciare con `REMOVE_ADS_ID` in `purchases.js`)
3. Tipo: **Gestito / non consumabile**
4. Nome/descrizione (es. "Rimuovi pubblicità")
5. **Prezzo: 0,99 €**
6. **Attiva** il prodotto e salva.

> Il prodotto compare solo dopo aver caricato in Play **almeno una AAB che
> dichiara il permesso BILLING** (ecco perché prima serviva aggiungerlo).

## Come compilare e testare
```bash
npm install            # scarica cordova-plugin-purchase
npm run build
firebase deploy --only hosting   # l'app carica da gridup-f1.web.app
npx cap sync android   # aggiunge il plugin di billing al progetto nativo
# build AAB firmato → carica su Play
```

### Test degli acquisti (senza pagare davvero)
- Aggiungi il tuo account come **tester delle licenze**:
  Play Console → **Impostazioni → Test delle licenze** → aggiungi la tua email.
- Usa un binario firmato con la stessa chiave caricata su Play (track interno/chiuso).
- Con l'account tester l'acquisto è **gratuito** e mostra "(test)".

## Note tecniche
- L'entitlement è in cache in `localStorage` per nascondere subito il banner
  all'avvio; `initPurchases()` poi verifica la proprietà con Google e corregge.
- "Ripristina acquisti" serve se l'utente reinstalla o cambia dispositivo.
- ⚠️ Da testare **sul dispositivo**: il flusso di billing non è verificabile in
  locale sul web. Se l'API di `cordova-plugin-purchase` cambiasse in una major
  futura, adegua `purchases.js` (metodi `store.register/when/initialize/owned`).
