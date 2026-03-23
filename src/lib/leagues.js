/**
 * src/lib/leagues.js
 * Gestione leghe: crea, unisciti, classifica
 */
import {
  doc, getDoc, setDoc, updateDoc,
  collection, query, where, getDocs,
  arrayUnion, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// Genera codice invito 6 caratteri
function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ─── CREA LEGA ────────────────────────────────────────────────────────────────
export async function createLeague(user, name) {
  if (!user?.uid) throw new Error('Login richiesto');
  const inviteCode = generateInviteCode();
  const leagueRef  = doc(collection(db, 'leagues'));

  await setDoc(leagueRef, {
    id:          leagueRef.id,
    name:        name.trim(),
    inviteCode,
    createdBy:   user.uid,
    members:     [user.uid],
    memberCount: 1,
    createdAt:   serverTimestamp(),
  });

  // Aggiungi la lega al profilo utente
  await updateDoc(doc(db, 'users', user.uid), {
    leagues: arrayUnion(leagueRef.id),
  }).catch(() =>
    setDoc(doc(db, 'users', user.uid), { leagues: [leagueRef.id] }, { merge: true })
  );

  return { leagueId: leagueRef.id, inviteCode };
}

// ─── UNISCITI A UNA LEGA ──────────────────────────────────────────────────────
export async function joinLeague(user, inviteCode) {
  if (!user?.uid) throw new Error('Login richiesto');

  const q    = query(collection(db, 'leagues'), where('inviteCode', '==', inviteCode.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Codice invito non valido');

  const leagueDoc  = snap.docs[0];
  const leagueData = leagueDoc.data();

  if (leagueData.members?.includes(user.uid)) throw new Error('Sei già in questa lega');

  await updateDoc(leagueDoc.ref, {
    members:     arrayUnion(user.uid),
    memberCount: (leagueData.memberCount || 1) + 1,
  });

  await updateDoc(doc(db, 'users', user.uid), {
    leagues: arrayUnion(leagueDoc.id),
  }).catch(() =>
    setDoc(doc(db, 'users', user.uid), { leagues: [leagueDoc.id] }, { merge: true })
  );

  return { leagueId: leagueDoc.id, leagueName: leagueData.name };
}

// ─── LEGHE DELL'UTENTE ────────────────────────────────────────────────────────
export async function getUserLeagues(user) {
  if (!user?.uid) return [];

  const userSnap = await getDoc(doc(db, 'users', user.uid));
  const leagueIds = userSnap.data()?.leagues || [];
  if (leagueIds.length === 0) return [];

  const results = await Promise.all(
    leagueIds.map(id => getDoc(doc(db, 'leagues', id)))
  );

  // Recupera il punteggio dell'utente in ogni lega
  const scores = await Promise.all(
    leagueIds.map(async (leagueId) => {
      const q    = query(collection(db, 'leagueScores'), where('leagueId', '==', leagueId), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      return snap.empty ? 0 : snap.docs.reduce((s, d) => s + (d.data().points || 0), 0);
    })
  );

  return results
    .filter(snap => snap.exists())
    .map((snap, i) => ({
      ...snap.data(),
      myScore: scores[i] || 0,
    }));
}

// ─── CLASSIFICA LEGA ─────────────────────────────────────────────────────────
export async function getLeagueStandings(leagueId) {
  const leagueSnap = await getDoc(doc(db, 'leagues', leagueId));
  if (!leagueSnap.exists()) throw new Error('Lega non trovata');

  const members = leagueSnap.data().members || [];

  const standings = await Promise.all(
    members.map(async (uid) => {
      const userSnap = await getDoc(doc(db, 'users', uid));
      const userData = userSnap.data() || {};

      // Somma punteggi di questa lega
      const q    = query(collection(db, 'leagueScores'), where('leagueId', '==', leagueId), where('userId', '==', uid));
      const snap = await getDocs(q);
      const fantaScore = snap.docs.reduce((s, d) => s + (d.data().points || 0), 0);

      return {
        userId:      uid,
        displayName: userData.name  || uid,
        email:       userData.email || '',
        avatar:      userData.avatar || null,
        fantaScore,
      };
    })
  );

  return standings.sort((a, b) => b.fantaScore - a.fantaScore);
}
