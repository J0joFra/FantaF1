import { useEffect, useRef } from 'react';

/* ─── PILA DEI GESTORI DI "INDIETRO" ─────────────────────────────────────────
   Capacitor consegna il tasto/gesto indietro a un listener solo, e quel
   listener ragionava di sole rotte: con una finestra aperta — il tutorial, la
   segnalazione, la mappa della stagione — il gesto la scavalcava e andava
   dritto all'uscita. È il motivo per cui un tester ha scritto «the back button
   should not always close the application».

   Qui ogni cosa che si può chiudere registra un gestore finché è aperta. Il
   gesto va al più recente: è l'ordine in cui le cose si sono aperte, quindi è
   l'ordine in cui devono chiudersi. Solo quando non ne resta nessuno il gesto
   arriva alla navigazione.

   Sul web non cambia niente: la pila esiste, ma nessuno la consulta perché il
   listener nativo non viene registrato. */

const stack = [];

/** Registra un gestore. Restituisce la funzione che lo toglie. */
export function pushBackHandler(handler) {
  stack.push(handler);
  return () => {
    const i = stack.indexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

/**
 * Dà il gesto al gestore più recente che lo vuole.
 *
 * Scorre dall'alto: un gestore che restituisce `false` lascia passare il gesto
 * a quello sotto — serve a chi è registrato ma in quel momento non ha niente
 * da chiudere. `true` significa «consumato, non andare oltre».
 */
export function handleBack() {
  for (let i = stack.length - 1; i >= 0; i--) {
    try {
      if (stack[i]() !== false) return true;
    } catch {
      /* Un gestore che esplode non può bloccare il tasto indietro di tutta
         l'app: si passa al successivo. */
    }
  }
  return false;
}

/**
 * Da usare in ogni componente che si può chiudere.
 *
 * `active` è lo stato di apertura: finché è vero il componente è in cima alla
 * pila. `onBack` viene chiamato al gesto indietro e di solito è la stessa
 * funzione del pulsante di chiusura — perché devono fare la stessa cosa, ed è
 * tutto il punto.
 */
export function useBackHandler(active, onBack) {
  const ref = useRef(onBack);
  ref.current = onBack;

  useEffect(() => {
    if (!active) return undefined;
    /* Si toglie da sola appena scatta, senza aspettare che React smonti
       l'effetto: fra il gesto e il render successivo passa un attimo, e due
       pressioni rapide avrebbero chiuso due volte la stessa finestra invece di
       chiuderne due. Una finestra si chiude una volta sola. */
    const remove = pushBackHandler(() => {
      remove();
      ref.current();
      return true;
    });
    return remove;
  }, [active]);
}
