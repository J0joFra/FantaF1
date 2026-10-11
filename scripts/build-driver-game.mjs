/**
 * I piloti del gioco «Pilota del giorno».
 *
 * Legge il dump JSON di F1DB e scrive
 * `src/data/driverGame.json`: i vincitori di almeno un GP che hanno debuttato
 * dal 1975 in poi più
 * la griglia dell'ultima stagione. Sono i piloti che un appassionato può
 * davvero indovinare; i 900 nomi di tutta la storia renderebbero il gioco una
 * lotteria.
 *
 * Per ogni pilota tiene solo gli indizi del gioco: nazionalità, anno di
 * debutto, vittorie, titoli e la scuderia con cui ha corso più gare (non
 * l'ultima: Prost lo si ricorda alla McLaren, non alla Williams del '93).
 *
 * Va rigenerato ogni tanto, o vittorie e titoli dei piloti in attività
 * restano fermi. Il dump va preso dall'ultima release, dove ogni tabella è un
 * file a sé:
 *
 *   curl -LO https://github.com/f1db/f1db/releases/latest/download/f1db-json-splitted.zip
 *   unzip f1db-json-splitted.zip -d /tmp/f1db
 *   node scripts/build-driver-game.mjs /tmp/f1db
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('Uso: node scripts/build-driver-game.mjs <cartella F1DB>');
  process.exit(1);
}
// Chi ha debuttato prima resta fuori: Siffert o Rindt li conosce solo chi c'era.
const FIRST_DEBUT = 1975;

const read = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

// F1DB usa nomi di paese, flagcdn i codici ISO a due lettere.
const ISO = Object.fromEntries(read('f1db-countries.json').map((c) => [c.id, c.alpha2Code.toLowerCase()]));

const drivers = read('f1db-drivers.json');
const teams = Object.fromEntries(read('f1db-constructors.json').map((c) => [c.id, c.name]));
const results = read('f1db-races-race-results.json');

const lastYear = Math.max(...results.map((r) => r.year));
const years = {};
const teamRaces = {};
for (const r of results) {
  (years[r.driverId] ??= new Set()).add(r.year);
  const t = (teamRaces[r.driverId] ??= {});
  t[r.constructorId] = (t[r.constructorId] ?? 0) + 1;
}
const grid = new Set(results.filter((r) => r.year === lastYear).map((r) => r.driverId));

const out = [];
for (const d of drivers) {
  const ys = years[d.id];
  if (!ys) continue;
  const winner = d.totalRaceWins > 0 && Math.min(...ys) >= FIRST_DEBUT;
  if (!winner && !grid.has(d.id)) continue;

  const iso = ISO[d.nationalityCountryId];
  if (!iso) throw new Error(`Manca il codice ISO di ${d.nationalityCountryId} (${d.name})`);
  const [mainTeam] = Object.entries(teamRaces[d.id]).sort((a, b) => b[1] - a[1])[0];

  out.push({
    id: d.id,
    name: d.name,
    iso,
    debut: Math.min(...ys),
    wins: d.totalRaceWins,
    titles: d.totalChampionshipWins,
    team: teams[mainTeam],
  });
}
out.sort((a, b) => a.name.localeCompare(b.name));

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/driverGame.json', JSON.stringify(out, null, 0).replace(/},{/g, '},\n{') + '\n');
console.log(`${out.length} piloti (vincitori debuttanti dal ${FIRST_DEBUT} + griglia ${lastYear}) → src/data/driverGame.json`);
