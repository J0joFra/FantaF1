// lib/firestoreService.js
import { db } from './firebase';
import {
  collection, doc, setDoc, getDoc, getDocs,
  query, where, orderBy, updateDoc,
  deleteDoc, Timestamp
} from 'firebase/firestore';

// ─── PICKS ───────────────────────────────────────────────────────────────────

/**
 * Salva un pick per un GP
 */
export async function savePick(userId, raceId, driverId, driverName) {
  const pickRef = doc(db, 'picks', `${userId}_${raceId}`);
  await setDoc(pickRef, {
    userId,
    driverId,
    driverName,
    raceId,
    timestamp: Timestamp.now(),
    points: 0,
    isLocked: false,
  });
}

/**
 * Recupera il pick di un utente per un GP
 */
export async function getUserPick(userId, raceId) {
  if (!userId || !raceId) return null;
  const pickRef = doc(db, 'picks', `${userId}_${raceId}`);
  const snap = await getDoc(pickRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Recupera tutti i picks per un GP
 */
export async function getAllPicksForRace(raceId) {
  const q = query(collection(db, 'picks'), where('raceId', '==', raceId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Aggiorna i punti di un pick
 */
export async function updatePickPoints(pickId, points, bonusDetails) {
  const pickRef = doc(db, 'picks', pickId);
  await updateDoc(pickRef, { points, bonusDetails, isLocked: true });
}

// ─── LEGHE ───────────────────────────────────────────────────────────────────

/**
 * Recupera tutte le leghe di un utente (basato su uid)
 */
export async function getUserLeagues(userId) {
  if (!userId) return [];
  try {
    const leaguesSnap = await getDocs(collection(db, 'fantaF1Leagues'));
    const userLeagues = [];

    for (const leagueDoc of leaguesSnap.docs) {
      const memberRef = doc(leagueDoc.ref, 'members', userId);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) {
        const data = leagueDoc.data();
        const memberData = memberSnap.data();
        userLeagues.push({
          id: leagueDoc.id,
          name: data.name,
          code: data.code,
          adminId: data.admin_id || data.adminId,
          memberCount: data.memberCount || 1,
          myRole: memberData.role,
          myPoints: memberData.total_points || 0,
          myScore: memberData.total_points || 0,
        });
      }
    }
    return userLeagues;
  } catch (err) {
    console.error('getUserLeagues error:', err);
    return [];
  }
}

/**
 * Recupera la classifica di una lega
 */
export async function getLeagueStandings(leagueId) {
  try {
    const q = query(
      collection(db, 'fantaF1Leagues', leagueId, 'members'),
      orderBy('total_points', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

/**
 * Aggiorna i punti totali di un membro in una lega
 */
export async function updateMemberPoints(leagueId, userId, newTotalPoints) {
  const memberRef = doc(db, 'fantaF1Leagues', leagueId, 'members', userId);
  await updateDoc(memberRef, { total_points: newTotalPoints });
}

/**
 * Aggiorna i totali di tutti i membri di una lega dopo un GP
 */
export async function updateAllMemberTotals(leagueId, raceIds) {
  const members = await getLeagueStandings(leagueId);
  for (const member of members) {
    let total = 0;
    for (const raceId of raceIds) {
      const pick = await getUserPick(member.user_id || member.id, raceId);
      if (pick?.points) total += pick.points;
    }
    await updateMemberPoints(leagueId, member.user_id || member.id, total);
  }
}