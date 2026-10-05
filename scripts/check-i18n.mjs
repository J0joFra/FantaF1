/**
 * Il dizionario non può mentire.
 *
 * Le chiavi mancanti in una lingua ricadono sull'italiano **in silenzio**: in
 * app non si rompe niente, si legge solo italiano dentro un'interfaccia
 * francese. L'ha trovato un tester, non noi, e fra le ventotto chiavi che
 * mancavano c'erano i testi delle notifiche — che arrivano sul telefono, dove
 * la lingua sbagliata si nota ancora di più.
 *
 * Controlla due cose:
 *   1. ogni chiave dell'italiano esiste in tutte le lingue  → errore;
 *   2. ogni chiave del dizionario è usata da qualche parte  → avviso.
 *
 * Il secondo è un avviso e non un errore perché alcune chiavi si compongono a
 * runtime (`t(`sess_${k}`)`) e nessuna analisi statica onesta può esserne
 * certa: lo script riconosce i prefissi, ma preferisce segnalare che accusare.
 *
 *   node scripts/check-i18n.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DICT_FILE = 'src/lib/i18n.jsx';
const SRC = 'src';

const src = readFileSync(DICT_FILE, 'utf8');
const start = src.indexOf('const DICT = {');
const end = src.indexOf('\n};', start);
if (start < 0 || end < 0) {
  console.error(`Non trovo il dizionario in ${DICT_FILE}`);
  process.exit(1);
}

// I commenti di riga stanno fra la graffa e la prima chiave: vanno via prima
// di cercare le chiavi, o la prima di ogni sezione sparisce dal conteggio.
const dict = src.slice(start, end).replace(/^\s*\/\/[^\n]*$/gm, '');
const langs = [...dict.matchAll(/\n {2}([a-z]{2}): \{/g)].map((m) => m[1]);

const keysOf = (lang) => {
  const head = `\n  ${lang}: {`;
  const from = dict.indexOf(head) + head.length;
  const next = langs
    .map((l) => dict.indexOf(`\n  ${l}: {`))
    .filter((i) => i > from)
    .sort((a, b) => a - b)[0] ?? dict.length;
  const body = dict.slice(from, next);
  const found = new Set([...body.matchAll(/[{,]\s*([a-zA-Z_]\w*)\s*:/g)].map((m) => m[1]));
  // La primissima chiave non ha né graffa né virgola davanti.
  const first = /^\s*([a-zA-Z_]\w*)\s*:/.exec(body);
  if (first) found.add(first[1]);
  return found;
};

const keys = Object.fromEntries(langs.map((l) => [l, keysOf(l)]));
const base = keys.it;

const problems = [];
const warnings = [];

for (const lang of langs) {
  if (lang === 'it') continue;
  const missing = [...base].filter((k) => !keys[lang].has(k));
  const extra = [...keys[lang]].filter((k) => !base.has(k));
  if (missing.length) {
    problems.push(`${lang}: ${missing.length} chiavi mancanti → si leggerà italiano\n      ${missing.join(' ')}`);
  }
  if (extra.length) {
    warnings.push(`${lang}: ${extra.length} chiavi che l'italiano non ha (${extra.join(' ')})`);
  }
}

// --- chiavi usate davvero -------------------------------------------------
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(jsx?|tsx?)$/.test(name) && path !== DICT_FILE) files.push(path);
  }
})(SRC);

/*
 * «Usata» vuol dire: la stringa compare da qualche parte in `src`.
 *
 * Cercare `t('chiave')` sembrava più preciso ed era solo più sbagliato: la
 * funzione viaggia anche come `tRef.current(...)`, dentro tabelle di
 * configurazione, o come valore di una prop. Con quel criterio il controllo
 * accusava ottantotto chiavi di cui la gran parte era usata eccome — e un
 * avviso che grida al lupo è un avviso che si impara a saltare.
 *
 * Cercare la stringa e basta sbaglia nella direzione buona: può lasciar
 * passare una chiave morta, non può accusarne una viva.
 */
const used = new Set();
const prefixes = new Set();
for (const file of files) {
  const code = readFileSync(file, 'utf8');
  for (const m of code.matchAll(/['"`]([a-zA-Z_]\w*)['"`]/g)) used.add(m[1]);
  // `prefisso_${…}`: di queste si può sapere solo il prefisso.
  for (const m of code.matchAll(/`([a-zA-Z_]\w*?)_\$\{/g)) prefixes.add(m[1] + '_');
}

const dead = [...base].filter((k) => {
  if (used.has(k)) return false;
  for (const p of prefixes) if (k.startsWith(p)) return false;
  return true;
});
if (dead.length) {
  warnings.push(`${dead.length} chiavi nel dizionario che nessuno chiama: ${dead.join(' ')}`);
}

console.log(`${langs.length} lingue, ${base.size} chiavi ciascuna, ${files.length} file letti`);
for (const w of warnings) console.log(`  ! ${w}`);

if (problems.length) {
  console.log('');
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
} else {
  console.log('\nok — nessuna lingua ricade sull\'italiano');
}
