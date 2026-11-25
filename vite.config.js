import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Variabili senza le quali l'app non parte: senza Supabase non c'è nessun dato
// da mostrare. Da quando l'app Android usa i file del bundle (non più il sito
// remoto), una build senza queste variabili diventa un'app che si apre su una
// pagina bianca — ed è così che Google Play ha respinto la 1.0.17 («l'app non
// si apre o non si carica»). Meglio che a fallire sia la build.
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
    const missing = REQUIRED_ENV.filter((k) => !env[k]);
    if (missing.length) {
      throw new Error(
        `\n\nMancano ${missing.join(', ')}.\n` +
        'Senza, l\'app compilata si apre su una pagina bianca.\n' +
        'Mettile in .env.local (vedi .env.example) e rilancia la build.\n'
      );
    }
  }

  return {
    plugins: [react()],
    build: {
      // Down-transpile modern syntax (||=, ?., ??) so older Android WebViews
      // don't white-screen on a parse error.
      target: 'es2019',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),  // ← this must be here
      },
    },
  };
});
