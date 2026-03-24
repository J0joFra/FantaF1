// lib/firestoreService.js
import { db } from './firebase';
import { 
  collection, doc, setDoc, getDoc, getDocs, 
  query, where, orderBy, updateDoc, arrayUnion,
  deleteDoc, Timestamp
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
// LEGHE
// ─────────────────────────────────────────────────────────────

/**
 * Crea una nuova lega
 * @param {string} userId - ID dell'utente che crea (admin)
 * @param {string} userName - Nome visualizzato
 * @param {string} userEmail - Email dell'admin
 * @param {string} leagueName - Nome della lega
 * @returns {Promise<{id: string, code: string}>}
 */
export async function createLeague(userId, userName, userEmail, leagueName) {
  const leagueCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const leagueRef = doc(collection(db, 'fantaF1Leagues'));
  
  await setDoc(leagueRef, {
    name: leagueName,
    code: leagueCode,
    adminId: userId,
    adminEmail: userEmail,
    createdAt: Timestamp.now(),
    memberCount: 1,
  });
  
  const memberRef = doc(leagueRef, 'members', userId);
  await setDoc(memberRef, {
    userId,
    userEmail,
    userName,
    role: 'admin',
    totalPoints: 0,
    joinedAt: Timestamp.now(),
  });
  
  return { id: leagueRef.id, code: leagueCode };
}

/**
 * Unisce un utente a una lega tramite codice
 * @param {string} userId - ID dell'utente
 * @param {string} userName - Nome visualizzato
 * @param {string} userEmail - Email
 * @param {string} inviteCode - Codice invito
 * @returns {Promise<{leagueId: string, leagueName: string}>}
 */
export async function joinLeague(userId, userName, userEmail, inviteCode) {
  const leaguesRef = collection(db, 'fantaF1Leagues');
  const q = query(leaguesRef, where('code', '==', inviteCode.toUpperCase()));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error('Codice invito non valido');
  }
  
  const leagueDoc = snapshot.docs[0];
  const leagueId = leagueDoc.id;
  const leagueData = leagueDoc.data();
  
  // Verifica se l'utente è già membro
  const memberRef = doc(db, 'fantaF1Leagues', leagueId, 'members', userId);
  const memberSnap = await getDoc(memberRef);
  
  if (memberSnap.exists()) {
    throw new Error('Sei già in questa lega');
  }
  
  await setDoc(memberRef, {
    userId,
    userEmail,
    userName,
    role: 'member',
    totalPoints: 0,
    joinedAt: Timestamp.now(),
  });
  
  // Incrementa contatore membri
  await updateDoc(leagueDoc.ref, {
    memberCount: (leagueData.memberCount || 0) + 1
  });
  
  return { leagueId, leagueName: leagueData.name };
}

/**
 * Recupera tutte le leghe di un utente
 * @param {string} userId - ID dell'utente
 * @returns {Promise<Array>}
 */
export async function getUserLeagues(userId) {
  if (!userId) return [];
  
  // Query su tutte le subcollections 'members' dove userId corrisponde
  const membersQuery = query(
    collection(db, 'fantaF1Leagues', '***', 'members'),
    where('userId', '==', userId)
  );
  const leaguesRef = collection(db, 'fantaF1Leagues');
  const leaguesSnapshot = await getDocs(leaguesRef);
  
  const userLeagues = [];
  for (const leagueDoc of leaguesSnapshot.docs) {
    const memberRef = doc(leagueDoc.ref, 'members', userId);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      userLeagues.push({
        id: leagueDoc.id,
        name: leagueDoc.data().name,
        code: leagueDoc.data().code,
        adminId: leagueDoc.data().adminId,
        memberCount: leagueDoc.data().memberCount,
        myRole: memberSnap.data().role,
        myPoints: memberSnap.data().totalPoints || 0,
      });
    }
  }
  
  return userLeagues;
}

/**
 * Recupera la classifica di una lega
 * @param {string} leagueId
 * @returns {Promise<Array>}
 */
export async function getLeagueStandings(leagueId) {
  const membersRef = collection(db, 'fantaF1Leagues', leagueId, 'members');
  const q = query(membersRef, orderBy('totalPoints', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

// ─────────────────────────────────────────────────────────────
// PICKS
// ─────────────────────────────────────────────────────────────

/**
 * Salva un pick per un GP (unico per utente, non per lega)
 * @param {string} userId
 * @param {string} raceId - ID del GP (da Supabase)
 * @param {string} driverId
 * @param {string} driverName
 * @returns {Promise<void>}
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
 * @param {string} userId
 * @param {string} raceId
 * @returns {Promise<object|null>}
 */
export async function getUserPick(userId, raceId) {
  const pickRef = doc(db, 'picks', `${userId}_${raceId}`);
  const snap = await getDoc(pickRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Recupera tutti i picks per un GP (usato dall'admin per calcolare punti)
 * @param {string} raceId
 * @returns {Promise<Array>}
 */
export async function getAllPicksForRace(raceId) {
  const picksRef = collection(db, 'picks');
  const q = query(picksRef, where('raceId', '==', raceId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Aggiorna i punti di un pick
 * @param {string} pickId
 * @param {number} points
 * @param {object} bonusDetails
 */
export async function updatePickPoints(pickId, points, bonusDetails) {
  const pickRef = doc(db, 'picks', pickId);
  await updateDoc(pickRef, {
    points,
    bonusDetails,
    isLocked: true,
  });
}

/**
 * Aggiorna i punti totali di un membro in una lega
 */
export async function updateMemberPoints(leagueId, userId, newTotalPoints) {
  const memberRef = doc(db, 'fantaF1Leagues', leagueId, 'members', userId);
  await updateDoc(memberRef, { totalPoints: newTotalPoints });
}

// ─────────────────────────────────────────────────────────────
// FUNZIONI UTILITY
// ─────────────────────────────────────────────────────────────

/**
 * Calcola i punti totali di un utente in una lega
 * @param {string} userId
 * @param {Array} raceIds - Array di ID dei GP da considerare
 */
export async function calculateUserTotalPoints(userId, raceIds) {
  let total = 0;
  for (const raceId of raceIds) {
    const pick = await getUserPick(userId, raceId);
    if (pick && pick.points) total += pick.points;
  }
  return total;
}

/**
 * Aggiorna i totali di tutti i membri di una lega dopo un GP
 */
export async function updateAllMemberTotals(leagueId, raceIds) {
  const members = await getLeagueStandings(leagueId);
  
  for (const member of members) {
    const totalPoints = await calculateUserTotalPoints(member.userId, raceIds);
    await updateMemberPoints(leagueId, member.userId, totalPoints);
  }
}