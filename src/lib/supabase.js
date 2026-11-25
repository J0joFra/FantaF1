import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.warn(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

/* Senza configurazione createClient lancia un'eccezione già all'import, e
   l'app intera resta una pagina bianca. Con un indirizzo che non risponde,
   invece, l'app si apre e ogni richiesta fallisce: le pagine mostrano la
   schermata d'errore con «Riprova». La build di produzione si rifiuta
   comunque di partire senza queste variabili (vite.config.js). */
export const supabase = createClient(
  supabaseUrl || 'https://supabase-non-configurato.invalid',
  supabaseAnonKey || 'missing-anon-key',
);
