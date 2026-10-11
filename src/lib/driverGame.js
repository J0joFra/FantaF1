import DRIVERS from "@/data/driverGame.json";

/* ─── PILOTA DEL GIORNO: regole e salvataggi ─────────────────────────────────
   Qui sta quello che serve anche fuori dal gioco: alla card in Panoramica
   (ha già giocato oggi?) e alla notifica giornaliera (che numero è domani, a
   che serie è arrivato). Il gioco vero è in components/games/DriverGuess.

   Il pilota del giorno dipende solo dalla data locale: niente server, e chi
   gioca alla stessa data trova lo stesso pilota (a patto di avere la stessa
   versione dei dati). */

export { DRIVERS };
export const MAX_GUESSES = 6;
export const STATE_KEY = "gridup_guess_today";
export const STATS_KEY = "gridup_guess_stats";
export const MODE_KEY = "gridup_guess_mode";
// Numero 1 del gioco.
const EPOCH = Date.UTC(2026, 9, 11);
// Coprimo con la dimensione del pool: in N giorni passano tutti, senza ripetere.
const STEP = 37;

export function dayNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / 86400000) + 1;
}

function stepFor(n) {
  let s = STEP;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  while (gcd(s, n) !== 1) s++;
  return s;
}

export function driverOfDay(day) {
  const n = DRIVERS.length;
  const i = (((day * stepFor(n) + 11) % n) + n) % n;
  return DRIVERS[i];
}

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export const EMPTY_STATS = { played: 0, won: 0, streak: 0, maxStreak: 0, lastDay: null };
export function readStats() {
  return readJSON(STATS_KEY, EMPTY_STATS);
}

/** Ha già finito la partita di oggi? */
export function playedToday() {
  const s = readJSON(STATE_KEY, null);
  return !!s && s.day === dayNumber() && s.done;
}

/**
 * La serie ancora viva: quella salvata vale solo se l'ultima partita vinta è
 * di oggi o di ieri. Dopo un giorno saltato è già persa, anche se il numero
 * salvato non è stato ancora azzerato (lo azzera la prossima partita).
 */
export function liveStreak(stats = readStats(), today = dayNumber()) {
  return stats.streak > 0 && stats.lastDay >= today - 1 ? stats.streak : 0;
}

// "hardcore" (senza aiuti, il default) | "easy" (facilitato)
export function readMode() {
  try { return localStorage.getItem(MODE_KEY) === "easy" ? "easy" : "hardcore"; } catch { return "hardcore"; }
}
export function writeMode(mode) {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
}
