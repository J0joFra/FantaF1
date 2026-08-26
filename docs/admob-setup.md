# AdMob — banner nell'app Android

Integrazione del banner Google AdMob nella build **Android (Capacitor)**.
Sul web (Vercel) è un no-op: gli annunci compaiono solo nell'app nativa.

## ID usati

| Cosa | Valore | Dove |
|------|--------|------|
| App ID | `ca-app-pub-8762257220044998~9823816409` | `android/app/src/main/AndroidManifest.xml` |
| Banner ad unit | `ca-app-pub-8762257220044998/4894923352` | `src/lib/ads.js` |

## Cosa è già stato fatto nel codice

- `package.json`: aggiunto `@capacitor-community/admob`.
- `AndroidManifest.xml`: aggiunto il meta-data con l'**App ID**.
- `src/lib/ads.js`: init SDK (ATT iOS + consenso GDPR/UMP) e `showBanner()` /
  `hideBanner()`, sicuri come no-op sul web.
- `src/App.jsx`: mostra il banner all'avvio (solo su nativo).

## ⚠️ Nota importante sul caricamento remoto

`capacitor.config.json` ha `server.url: https://gridup-f1.web.app`: l'app Android
**carica il sito da quell'URL**, non dai file locali. Quindi il codice JS del
banner deve essere **deployato su `gridup-f1.web.app`** (Firebase Hosting), non
solo su Vercel, altrimenti nell'APK il banner non parte.

## Passi per attivarlo

```bash
# 1. Installa la dipendenza
npm install

# 2. Builda il front-end
npm run build

# 3. Deploya la build su Firebase Hosting (l'URL che l'app carica)
#    (es. firebase deploy --only hosting) → https://gridup-f1.web.app

# 4. Sincronizza il plugin nativo nel progetto Android
npx cap sync android

# 5. Apri Android Studio e genera l'APK/AAB
npx cap open android
```

## 🧪 Test (IMPORTANTE per non violare le norme)

**Non cliccare mai i tuoi annunci reali**: AdMob può sospendere l'account.
Durante lo sviluppo usa gli **annunci di test**:

- Banner di test ufficiale Google: `ca-app-pub-3940256099942544/6300978111`
- Oppure registra il tuo dispositivo come *test device* (vedi log di AdMob al
  primo avvio: stampa l'ID da aggiungere).

Per un test rapido puoi sostituire temporaneamente `BANNER_AD_ID` in
`src/lib/ads.js` con l'ID di test, poi rimettere quello di produzione prima
della pubblicazione.

## Posizionamento

Il banner è ancorato in basso (`BOTTOM_CENTER`) con un margine di `64px`
(`BOTTOM_NAV_PX` in `src/lib/ads.js`) per stare **sopra la barra di
navigazione**. Se sul tuo device lo copre o lascia un vuoto, ritocca quel valore.

## Consenso (GDPR/UMP)

`ads.js` chiama `requestConsentInfo()` e mostra il form di consenso se richiesto
(utenti UE). Configura i messaggi UMP nella console AdMob:
**Privacy e messaggi → GDPR**. Senza messaggio configurato il form non appare.
