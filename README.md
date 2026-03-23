# FantaF1 2026

App mobile-first per il fantasy F1 della stagione 2026.  
Predici la griglia di arrivo prima di ogni GP, accumula punti e scala la classifica della tua lega.

## Stack

- **React 18** + **Vite**
- **Firebase** (Firestore + Auth Google)
- **Tailwind CSS**
- **React Router v6**
- **Lucide React** (icone)

## Setup

```bash
# 1. Installa le dipendenze
npm install

# 2. Crea il file .env copiando il template
cp .env.example .env

# 3. Inserisci le credenziali Firebase nel .env
#    (le trovi su Firebase Console → Impostazioni progetto → Web app)

# 4. Avvia il dev server
npm run dev
```

L'app gira su `http://localhost:5173`.

## Struttura

```
src/
├── components/
│   ├── AppLayout.jsx          # Layout con bottom nav
│   ├── DriverCard.jsx         # Card pilota selezionabile
│   ├── GpCountdown.jsx        # Timer countdown GG:HH:MM:SS
│   └── UserNotRegisteredError.jsx
├── config/
│   └── f1-2026.js             # Piloti e calendario 2026
├── hooks/
│   └── use-mobile.jsx
├── lib/
│   ├── AuthContext.jsx        # Auth Google + profilo Firestore
│   ├── fantaF1.js             # Logica predizioni, punteggi, token
│   ├── firebase.js            # Init Firebase
│   ├── leagues.js             # Gestione leghe
│   ├── PageNotFound.jsx
│   └── scoring.js             # Regole punti
├── pages/
│   ├── AdminResults.jsx       # Admin: inserimento risultati GP
│   ├── Classifica.jsx
│   ├── Home.jsx
│   ├── Leghe.jsx
│   ├── PickGp.jsx             # Form predizione completa
│   ├── Profilo.jsx
│   └── Regolamento.jsx
└── utils/
    └── index.ts
```

## Firestore — Collezioni

| Collezione | Descrizione |
|---|---|
| `users` | Profili utente (uid, name, email, role, tokens) |
| `leagues` | Leghe con codice invito e lista membri |
| `fantaPredictions` | Predizioni utente per gara |
| `fantaResults` | Risultati ufficiali inseriti dall'admin |
| `fantaScores` | Punteggi calcolati per gara/utente |
| `fantaLeaderboard` | Classifica stagionale aggregata |
| `leagueScores` | Punteggi per lega |

## Ruoli

- `user` — utente normale, può fare pick e stare nelle leghe
- `admin` — può accedere a `/admin/results` e inserire i risultati GP

Per impostare un utente come admin, modifica manualmente il campo `role` su Firestore.
