/**
 * src/lib/fantaF1.js
 * Logica core: predizioni, calcolo punteggio, risultati, leaderboard, token
 */
import {
  doc, getDoc, setDoc, updateDoc, increment,
  collection, query, orderBy, limit, getDocs,
  serverTimestamp, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { DRIVERS_2026, CALENDAR_2026 } from '../config/f1-2026';

export { DRIVERS_2026, CALENDAR_2026 };
export const FANTA_CALENDAR = CALENDAR_2026;

// ─── SISTEMA PUNTI ────────────────────────────────────────────────────────────
export const POINTS = {
  exactPosition:    100,
  podiumWrong:       25,
  top10Wrong:        17,
  lastTailExact:     20,
  lastTailZone:      10,
  lastFiveExact:     15,
  podiumBonus:        1,
  top10Bonus:         3,
  pos13Bonus:         5,
  fastestLapExact:   15,
  safetyCarCorrect:   5,
  dnfCorrect:         8,
  teamDoublePodium:  12,
  winningConstructor: 5,
};

// ─── GARA CORRENTE / PROSSIMA ─────────────────────────────────────────────────
export function getCurrentRace() {
  const now  = new Date();
  const next = FANTA_CALENDAR.find(r => new Date(r.date) >= now);
  return next ?? FANTA_CALENDAR[FANTA_CALENDAR.length - 1];
}

export function isRaceLocked(race) {
  if (!race) return true;
  const lockDateTime = new Date(race.lockDate + 'T23:59:00');
  return new Date() >= lockDateTime;
}

// ─── SALVA PREDIZIONE UTENTE ──────────────────────────────────────────────────
// prediction: {
//   fullGrid: [{ pos: 1, driverId: 'LEC' }, ...],   // top 10
//   lastTail: [{ pos: 11, driverId: 'SAI' }, ...],  // pos 11-22
//   bonuses:  { fastestLap: 'HAM', safetyCar: true, dnfDrivers: ['VER'] }
// }
export async function savePrediction(user, raceId, prediction) {
  if (!user?.uid) throw new Error('Login richiesto');

  const race = FANTA_CALENDAR.find(r => r.raceId === raceId);
  if (!race) throw new Error('Gara non trovata');
  if (isRaceLocked(race)) throw new Error('Predizioni chiuse per questa gara');
  if (!prediction.fullGrid || !Array.isArray(prediction.fullGrid))
    throw new Error('Dati predizione non validi');

  const docId = `${user.uid}_${raceId}`;
  await setDoc(doc(db, 'fantaPredictions', docId), {
    userId:      user.uid,
    userName:    user.name  || user.email?.split('@')[0],
    userAvatar:  user.avatar || null,
    raceId,
    raceName:    race.name,
    submittedAt: serverTimestamp(),
    fullGrid:    prediction.fullGrid,
    lastTail:    prediction.lastTail || [],
    bonuses:     prediction.bonuses  || { fastestLap: null, safetyCar: null, dnfDrivers: [] },
  });
  return true;
}

// ─── CARICA PREDIZIONE UTENTE ─────────────────────────────────────────────────
export async function getUserPrediction(user, raceId) {
  if (!user?.uid) return null;
  const snap = await getDoc(doc(db, 'fantaPredictions', `${user.uid}_${raceId}`));
  return snap.exists() ? snap.data() : null;
}

// ─── CARICA RISULTATO UFFICIALE ───────────────────────────────────────────────
export async function getRaceResult(raceId) {
  const snap = await getDoc(doc(db, 'fantaResults', raceId));
  return snap.exists() ? snap.data() : null;
}

// ─── SALVA RISULTATO UFFICIALE (ADMIN) ───────────────────────────────────────
export async function saveRaceResult(raceId, result) {
  const race = FANTA_CALENDAR.find(r => r.raceId === raceId);
  if (!race) throw new Error(`Gara non trovata: ${raceId}`);
  await setDoc(doc(db, 'fantaResults', raceId), {
    ...result,
    raceId,
    raceName: race.name,
    scoredAt: serverTimestamp(),
  });
  return true;
}

// ─── CALCOLA PUNTEGGIO ────────────────────────────────────────────────────────
export function calculateScore(prediction, result) {
  if (!prediction || !result) return null;

  let pts = 0;
  const breakdown = {
    posizioniEsatte: 0, podioPartial: 0, top10Partial: 0,
    codaEsatte: 0, codaZona: 0, ultimiCinqueEsatti: 0,
    podioBonus: 0, top10Bonus: 0, pos13Bonus: 0,
    giroVeloce: 0, safetyCar: 0, dnfCorretti: 0,
    costruttoreVincitore: 0, doppiettaTeam: 0,
  };

  const realGrid = result.fullGrid || [];
  const predGrid = prediction.fullGrid || [];

  // ── Griglia top 10 ──
  predGrid.forEach(({ pos, driverId }) => {
    const real = realGrid.find(r => r.driverId === driverId);
    if (!real) return;
    if (real.pos === pos) {
      pts += POINTS.exactPosition; breakdown.posizioniEsatte += POINTS.exactPosition;
    } else if (pos <= 3 && real.pos <= 3) {
      pts += POINTS.podiumWrong; breakdown.podioPartial += POINTS.podiumWrong;
    } else if (pos <= 10 && real.pos <= 10) {
      pts += POINTS.top10Wrong; breakdown.top10Partial += POINTS.top10Wrong;
    }
  });

  // ── Zona coda (11-22) ──
  const lastTail    = prediction.lastTail || [];
  const realTail    = result.lastTail    || [];
  const allRealGrid = [...realGrid, ...realTail];

  lastTail.forEach(({ pos, driverId }) => {
    const real = allRealGrid.find(r => r.driverId === driverId);
    if (!real || real.pos < 11) return;
    const isLastFive = pos >= 18;
    if (real.pos === pos) {
      if (isLastFive) { pts += POINTS.lastFiveExact; breakdown.ultimiCinqueEsatti += POINTS.lastFiveExact; }
      else            { pts += POINTS.lastTailExact; breakdown.codaEsatte         += POINTS.lastTailExact; }
    } else {
      pts += POINTS.lastTailZone; breakdown.codaZona += POINTS.lastTailZone;
    }
  });

  // ── Bonus 13° posto ──
  const pred13 = [...predGrid, ...lastTail].find(e => e.pos === 13);
  const real13 = allRealGrid.find(r => r.pos === 13);
  if (pred13 && real13 && pred13.driverId === real13.driverId) {
    pts += POINTS.pos13Bonus; breakdown.pos13Bonus += POINTS.pos13Bonus;
  }

  // ── Bonus collettivo podio ──
  const predPodium = predGrid.filter(e => e.pos <= 3).map(e => e.driverId);
  const realPodium = realGrid.filter(r => r.pos <= 3).map(r => r.driverId);
  if (predPodium.filter(d => realPodium.includes(d)).length >= 2) {
    pts += POINTS.podiumBonus; breakdown.podioBonus += POINTS.podiumBonus;
  }

  // ── Bonus collettivo top 10 ──
  const predTop10 = predGrid.filter(e => e.pos <= 10).map(e => e.driverId);
  const realTop10 = realGrid.filter(r => r.pos <= 10).map(r => r.driverId);
  if (predTop10.filter(d => realTop10.includes(d)).length >= 7) {
    pts += POINTS.top10Bonus; breakdown.top10Bonus += POINTS.top10Bonus;
  }

  const pb = prediction.bonuses || {};
  const rb = result.bonuses    || {};

  if (pb.fastestLap && pb.fastestLap === rb.fastestLap) {
    pts += POINTS.fastestLapExact; breakdown.giroVeloce += POINTS.fastestLapExact;
  }
  if (pb.safetyCar !== undefined && pb.safetyCar === rb.safetyCar) {
    pts += POINTS.safetyCarCorrect; breakdown.safetyCar += POINTS.safetyCarCorrect;
  }
  (pb.dnfDrivers || []).forEach(d => {
    if ((rb.dnfDrivers || []).includes(d)) {
      pts += POINTS.dnfCorrect; breakdown.dnfCorretti += POINTS.dnfCorrect;
    }
  });
  if (pb.teamDoublePodium && pb.teamDoublePodium === rb.teamDoublePodium) {
    pts += POINTS.teamDoublePodium; breakdown.doppiettaTeam += POINTS.teamDoublePodium;
  }
  if (pb.winningConstructor && pb.winningConstructor === rb.winningConstructor) {
    pts += POINTS.winningConstructor; breakdown.costruttoreVincitore += POINTS.winningConstructor;
  }

  return { total: pts, breakdown };
}

// ─── SALVA PUNTEGGIO ──────────────────────────────────────────────────────────
export async function saveScore(userId, raceId, score) {
  const docId = `${userId}_${raceId}`;
  await setDoc(doc(db, 'fantaScores', docId), {
    userId, raceId,
    points:    score.total,
    breakdown: score.breakdown,
    scoredAt:  serverTimestamp(),
  });
  const lbRef  = doc(db, 'fantaLeaderboard', userId);
  const lbSnap = await getDoc(lbRef);
  if (lbSnap.exists()) {
    const prev = lbSnap.data();
    await updateDoc(lbRef, {
      totalPoints: (prev.totalPoints || 0) + score.total,
      racesPlayed: (prev.racesPlayed || 0) + 1,
      bestScore:   Math.max(prev.bestScore || 0, score.total),
    });
  } else {
    const predSnap = await getDoc(doc(db, 'fantaPredictions', `${userId}_${raceId}`));
    const pred     = predSnap.data();
    await setDoc(lbRef, {
      userId,
      name:        pred?.userName  || userId,
      avatar:      pred?.userAvatar || null,
      totalPoints: score.total,
      racesPlayed: 1,
      bestScore:   score.total,
    });
  }
}

// ─── LEADERBOARD STAGIONALE ───────────────────────────────────────────────────
export async function getFantaLeaderboard(n = 50) {
  try {
    const q    = query(collection(db, 'fantaLeaderboard'), orderBy('totalPoints', 'desc'), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));
  } catch { return []; }
}

// ─── STATS UTENTE ─────────────────────────────────────────────────────────────
export async function getUserStats(userId) {
  try {
    const q    = query(collection(db, 'fantaScores'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const scores = snap.docs.map(d => d.data());
    return {
      racesPlayed: scores.length,
      totalPoints: scores.reduce((s, r) => s + (r.points || 0), 0),
      bestScore:   Math.max(0, ...scores.map(r => r.points || 0)),
      avgScore:    scores.length
        ? Math.round(scores.reduce((s, r) => s + (r.points || 0), 0) / scores.length)
        : 0,
    };
  } catch {
    return { racesPlayed: 0, totalPoints: 0, bestScore: 0, avgScore: 0 };
  }
}

// ─── TOKEN PREMI ──────────────────────────────────────────────────────────────
const FANTA_TOKEN_PRIZES = [250, 180, 150, 120, 100, 80, 60, 40, 30, 20];

export async function awardPredictionTokens(raceId) {
  const q    = query(collection(db, 'fantaScores'), where('raceId', '==', raceId), orderBy('points', 'desc'));
  const snap = await getDocs(q);
  if (snap.empty) return [];

  const results = snap.docs.map((d, i) => ({
    rank: i + 1, userId: d.data().userId, points: d.data().points,
    tokensAwarded: FANTA_TOKEN_PRIZES[i] ?? 0,
  }));

  const awarded = [];
  for (const entry of results) {
    if (entry.tokensAwarded === 0) break;
    const uid = entry.userId.replace(/[^a-zA-Z0-9_.-]/g, '_');
    await setDoc(doc(db, 'users', uid), { tokens: increment(entry.tokensAwarded), updatedAt: Date.now() }, { merge: true });
    await setDoc(doc(db, 'fantaScores', `${entry.userId}_${raceId}`), { tokensAwarded: entry.tokensAwarded, rank: entry.rank }, { merge: true });
    awarded.push(entry);
  }
  return awarded;
}

export function getFantaTokenPrizes() {
  return FANTA_TOKEN_PRIZES.map((tokens, i) => ({ rank: i + 1, tokens }));
}
