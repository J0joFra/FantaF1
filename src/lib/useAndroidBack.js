import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

/* ─── TASTO/GESTO INDIETRO (Android) ─────────────────────────────────────────
   Di default Capacitor chiude l'app al primo "indietro", ovunque ci si trovi:
   da «Scenari» il gesto butta fuori invece di riportare alla Panoramica, che è
   quello che fanno le altre app.

   Qui:
     - da una delle schede della bottom nav  → torna alla Panoramica;
     - da una pagina di dettaglio (/driver/…) → torna indietro nella cronologia;
     - dalla Panoramica                       → serve un secondo "indietro"
       entro EXIT_WINDOW_MS per uscire, con un avviso in mezzo.

   Sul web è tutto un no-op: il gesto indietro lo gestisce il browser. */

const TAB_PATHS = ['/', '/calculator', '/compare', '/ferrari', '/news'];
const HOME_PATH = '/';
const EXIT_WINDOW_MS = 2000;

export function useAndroidBack() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useI18n();

  /* Il listener nativo si registra una volta sola, quindi la sua closure non
     vedrebbe mai un pathname aggiornato: lo leggiamo da un ref. */
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const tRef = useRef(t);
  tRef.current = t;
  const lastBackRef = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle = null;
    let cancelled = false;

    // Import dinamico: il bundle web non tocca il bridge nativo.
    import('@capacitor/app').then(({ App }) => {
      const onBack = () => {
        const current = pathnameRef.current;

        if (current !== HOME_PATH) {
          /* Dentro una scheda → Panoramica. In un dettaglio → indietro vero,
             ma solo se c'è davvero una voce precedente: aperta come prima
             schermata (notifica, deep link) `navigate(-1)` non farebbe nulla
             e il gesto sembrerebbe rotto. */
          const hasHistory = (window.history.state?.idx ?? 0) > 0;
          if (TAB_PATHS.includes(current) || !hasHistory) navigate(HOME_PATH);
          else navigate(-1);
          lastBackRef.current = 0;
          return;
        }

        // Siamo già in Panoramica: il secondo "indietro" ravvicinato esce.
        const now = Date.now();
        if (now - lastBackRef.current < EXIT_WINDOW_MS) {
          App.exitApp();
          return;
        }
        lastBackRef.current = now;
        toast(tRef.current('back_exitHint'));
      };

      return App.addListener('backButton', onBack).then(h => {
        if (cancelled) h.remove();
        else handle = h;
      });
    }).catch(() => { /* plugin assente: resta il comportamento di sistema */ });

    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, [navigate]);
}
