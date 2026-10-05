/**
 * La pila dell'indietro, provata sulle sue regole.
 *
 * Il difetto che ha fatto nascere questo file: il gesto indietro scavalcava le
 * finestre aperte e chiudeva l'app. La correzione è una pila, e di una pila
 * conta una cosa sola — l'ordine. È anche la cosa che si rompe per prima
 * quando qualcuno aggiunge un overlay e dimentica di toglierlo dalla pila.
 *
 *   node scripts/check-backstack.mjs
 */
import { pushBackHandler, handleBack } from '../src/lib/backStack.js';

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

// 1. Senza niente di aperto il gesto non viene consumato: deve arrivare alla
//    navigazione, altrimenti l'app non si chiude mai più.
check(handleBack() === false, 'a pila vuota il gesto risulta consumato');

// 2. Chiude l'ultima aperta, non la prima.
//
//    I gestori si tolgono da soli appena scattano — è quello che fa
//    `useBackHandler`, e la prima stesura di questa prova l'ha scoperto nel
//    modo peggiore: senza, due pressioni rapide chiudevano due volte la stessa
//    finestra invece di chiuderne due, perché fra il gesto e il render
//    successivo il gestore è ancora in pila.
const closed = [];
const oneShot = (name) => {
  const remove = pushBackHandler(() => { remove(); closed.push(name); });
  return remove;
};
oneShot('a');
oneShot('b');
handleBack();
check(closed.join() === 'b', `ha chiuso "${closed.join()}" invece di "b"`);
handleBack();
check(closed.join() === 'b,a', `poi ha chiuso "${closed.join()}" invece di "b,a"`);

// 3. Esaurita la pila, il gesto torna alla navigazione.
check(handleBack() === false, 'un gestore già scattato risponde ancora');

// 4. Chi restituisce `false` lascia passare il gesto a quello sotto.
const seen = [];
const offC = pushBackHandler(() => { seen.push('sotto'); });
const offD = pushBackHandler(() => { seen.push('sopra'); return false; });
check(handleBack() === true, 'nessuno ha consumato il gesto');
check(seen.join() === 'sopra,sotto', `ordine sbagliato: ${seen.join()}`);
offD(); offC();

// 5. Un gestore che esplode non può bloccare il tasto indietro di tutta l'app.
const after = [];
const offE = pushBackHandler(() => { after.push('ok'); });
const offF = pushBackHandler(() => { throw new Error('boom'); });
check(handleBack() === true, 'un gestore rotto ha ingoiato il gesto');
check(after.join() === 'ok', 'dopo un gestore rotto non si passa al successivo');
offF(); offE();

if (problems.length === 0) {
  console.log('ok — l\'ultima finestra aperta è la prima che si chiude');
} else {
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
