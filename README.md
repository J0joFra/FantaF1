# FantaF1

App Fanta F1 con:
- **Firestore** per auth/profili, leghe, pick, punti
- **Supabase** per dati statistici (gare, circuiti, piloti)

## Setup locale

1. Installa dipendenze:
   - `npm install`
2. Crea `.env.local` con:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

3. Avvia:
   - `npm run dev`
