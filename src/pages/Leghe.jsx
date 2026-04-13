import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import {
  collection, collectionGroup, query, where,
  getDocs, addDoc, doc, getDoc, setDoc, updateDoc,
  serverTimestamp, orderBy
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, LogIn, Copy, X, Loader2, ChevronRight, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/AuthContext';

// ─── BOTTOM SHEET ─────────────────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
            style={{ maxHeight: '85vh' }}
          >
            <div className="bg-[#0d0d14] rounded-t-[28px] border-t border-white/[0.06] flex flex-col" style={{ maxHeight: '85vh' }}>
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-8 h-1 rounded-full bg-white/10" />
              </div>
              {title && (
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.05] shrink-0">
                  <h2 className="font-black text-sm uppercase tracking-widest text-white">{title}</h2>
                  <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── CLASSIFICA LEGA ─────────────────────────────────────────────────────────
function LeagueStandings({ league, currentUserEmail }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!league) return;
    async function load() {
      try {
        const q = query(
          collection(db, 'fantaF1Leagues', league.id, 'members'),
          orderBy('total_points', 'desc')
        );
        const snap = await getDocs(q);
        setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [league]);

  const medals = ['🥇', '🥈', '🥉'];

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-700" />
    </div>
  );

  return (
    <div className="pb-8">
      <div className="px-5 py-3">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-600">
            Codice invito
          </p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(league.code);
            toast.success(`Codice "${league.code}" copiato!`);
          }}
          className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 w-full hover:border-white/10 transition-all"
        >
          <span className="font-mono font-black text-lg text-white tracking-[0.3em] flex-1 text-center">
            {league.code}
          </span>
          <Copy size={14} className="text-zinc-500 shrink-0" />
        </button>
      </div>

      {members.length === 0 ? (
        <p className="text-center text-zinc-600 text-sm py-8">Nessun membro</p>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {members.map((m, i) => {
            const isMe = m.user_email === currentUserEmail;
            const initials = (m.user_name || '?')[0]?.toUpperCase();
            return (
              <div key={m.id} className={`flex items-center gap-3 px-5 py-3.5 ${isMe ? 'bg-red-500/5' : ''}`}>
                <span className="text-lg w-6 text-center shrink-0">
                  {i < 3 ? medals[i] : <span className="font-black text-sm text-zinc-700">{i + 1}</span>}
                </span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                  isMe ? 'bg-red-500/15 border border-red-500/25 text-red-400' : 'bg-white/[0.04] border border-white/[0.06] text-zinc-400'
                }`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-white uppercase tracking-tight truncate">
                      {m.user_name?.split(' ')[0] || 'Pilota'}
                    </span>
                    {isMe && (
                      <span className="text-[8px] font-black bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-widest shrink-0">Tu</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`font-black text-xl tabular-nums ${i === 0 ? 'text-yellow-400' : isMe ? 'text-red-400' : 'text-white'}`}>
                    {m.total_points || 0}
                  </span>
                  <span className="text-[9px] text-zinc-600 font-bold ml-1">pts</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── FORM: CREA LEGA ─────────────────────────────────────────────────────────
function CreateLeagueForm({ onCreated }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const ref = await addDoc(collection(db, 'fantaF1Leagues'), {
        name: name.trim(),
        code,
        admin_id: user.uid,
        admin_email: user.email,
        created_at: serverTimestamp(),
        memberCount: 1,
      });
      await setDoc(doc(db, 'fantaF1Leagues', ref.id, 'members', user.uid), {
        user_id: user.uid,
        user_email: user.email,
        user_name: user.displayName || user.email?.split('@')[0] || 'Pilota',
        role: 'admin',
        total_points: 0,
        joined_at: serverTimestamp(),
      });
      toast.success(`"${name.trim()}" creata! 🏁`);
      onCreated();
    } catch {
      toast.error('Errore durante la creazione');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 space-y-4">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handle()}
        placeholder="Nome della lega..."
        maxLength={40}
        autoFocus
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40 transition-all"
      />
      <button
        onClick={handle}
        disabled={saving || !name.trim()}
        className="w-full py-4 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-500 transition-all"
      >
        {saving && <Loader2 size={13} className="animate-spin" />}
        Crea la lega
      </button>
    </div>
  );
}

// ─── FORM: UNISCITI ───────────────────────────────────────────────────────────
function JoinLeagueForm({ onJoined }) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    if (code.length < 6 || !user) return;
    setSaving(true);
    try {
      const q = query(collection(db, 'fantaF1Leagues'), where('code', '==', code.toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) { toast.error('Codice non valido'); setSaving(false); return; }

      const leagueDoc = snap.docs[0];
      const memberRef = doc(db, 'fantaF1Leagues', leagueDoc.id, 'members', user.uid);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        toast.error('Sei già in questa lega');
        setSaving(false);
        return;
      }

      await setDoc(memberRef, {
        user_id: user.uid,
        user_email: user.email,
        user_name: user.displayName || user.email?.split('@')[0] || 'Pilota',
        role: 'member',
        total_points: 0,
        joined_at: serverTimestamp(),
      });
      const ld = leagueDoc.data();
      await updateDoc(leagueDoc.ref, { memberCount: (ld.memberCount || 1) + 1 });
      toast.success(`Benvenuto in "${ld.name}"! 🏎️`);
      onJoined();
    } catch {
      toast.error("Errore nell'unione");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 space-y-4">
      <input
        type="text"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        onKeyDown={e => e.key === 'Enter' && handle()}
        placeholder="CODICE"
        maxLength={6}
        autoFocus
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-4 text-white text-2xl font-black tracking-[0.4em] text-center uppercase placeholder:text-zinc-700 placeholder:text-base placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-blue-500/40 transition-all"
      />
      <button
        onClick={handle}
        disabled={saving || code.length < 6}
        className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-500 transition-all"
      >
        {saving && <Loader2 size={13} className="animate-spin" />}
        Entra nella lega
      </button>
    </div>
  );
}

// ─── CARD LEGA ────────────────────────────────────────────────────────────────
function LeagueCard({ league, onOpen, index }) {
  const isAdmin = league.myRole === 'admin';
  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => onOpen(league)}
      className="w-full flex items-center gap-4 bg-[#0f0f17] border border-white/[0.06] rounded-2xl p-4 hover:border-white/10 hover:bg-[#131320] transition-all text-left"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
        isAdmin ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-white/[0.03] border border-white/[0.06]'
      }`}>
        <Trophy className={`w-5 h-5 ${isAdmin ? 'text-yellow-500' : 'text-zinc-600'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-black text-sm uppercase tracking-tight text-white truncate">{league.name}</span>
          {isAdmin && (
            <span className="text-[8px] font-black bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-widest shrink-0">Admin</span>
          )}
        </div>
        <span className="text-[10px] text-zinc-600 font-mono font-bold">
          {league.code} · {league.memberCount || 1} {league.memberCount === 1 ? 'membro' : 'membri'}
        </span>
      </div>
      <ChevronRight size={14} className="text-zinc-700 shrink-0" />
    </motion.button>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Leghe() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);

  const loadLeagues = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      // Query sulle sottocollezioni 'members' dove user_id == uid
      const q = query(
        collectionGroup(db, 'members'),
        where('user_id', '==', user.uid)
      );
      const snap = await getDocs(q);

      const results = await Promise.all(
        snap.docs.map(async d => {
          const leagueRef = d.ref.parent.parent;
          if (!leagueRef) return null;
          const leagueSnap = await getDoc(leagueRef);
          if (!leagueSnap.exists()) return null;
          return {
            id: leagueSnap.id,
            ...leagueSnap.data(),
            myRole: d.data().role,
            myPoints: d.data().total_points || 0,
          };
        })
      );
      setLeagues(results.filter(Boolean));
    } catch (err) {
      console.error(err);
      toast.error('Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadLeagues(); }, [loadLeagues]);

  const handleCreated = () => { setCreateOpen(false); loadLeagues(); };
  const handleJoined = () => { setJoinOpen(false); loadLeagues(); };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative pt-12 pb-5 px-5">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/10 to-transparent pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[9px] font-black tracking-[0.35em] uppercase text-blue-400/60 mb-1.5">Competizione</p>
          <h1 className="text-4xl font-black uppercase tracking-tight leading-none">
            Le tue <span className="text-blue-400">Leghe</span>
          </h1>
        </motion.div>
      </div>

      <div className="px-4 pb-8 space-y-3">

        {/* Pulsanti azione */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-3"
          >
            <button
              onClick={() => setCreateOpen(true)}
              className="flex flex-col items-center gap-2.5 py-5 bg-red-500/[0.06] border border-red-500/20 rounded-2xl hover:bg-red-500/10 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <Plus className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-red-400">Crea lega</span>
            </button>
            <button
              onClick={() => setJoinOpen(true)}
              className="flex flex-col items-center gap-2.5 py-5 bg-blue-500/[0.06] border border-blue-500/20 rounded-2xl hover:bg-blue-500/10 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <LogIn className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-400">Unisciti</span>
            </button>
          </motion.div>
        )}

        {/* Lista leghe */}
        {!user ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl bg-[#0f0f17] border border-white/[0.06] p-10 text-center"
          >
            <p className="font-black text-sm uppercase text-zinc-600">Accedi per vedere le tue leghe</p>
          </motion.div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-700" />
          </div>
        ) : leagues.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl bg-[#0a0a10] border border-dashed border-white/[0.06] p-12 text-center"
          >
            <Trophy className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
            <p className="font-black text-sm uppercase text-zinc-600 mb-1">Nessuna lega</p>
            <p className="text-xs text-zinc-700">Creane una o unisciti con un codice</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-700 px-1">
              {leagues.length} {leagues.length === 1 ? 'lega' : 'leghe'}
            </p>
            {leagues.map((l, i) => (
              <LeagueCard key={l.id} league={l} onOpen={setSelectedLeague} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom sheet: Crea */}
      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Nuova lega">
        <CreateLeagueForm onCreated={handleCreated} />
      </BottomSheet>

      {/* Bottom sheet: Unisciti */}
      <BottomSheet open={joinOpen} onClose={() => setJoinOpen(false)} title="Inserisci codice">
        <JoinLeagueForm onJoined={handleJoined} />
      </BottomSheet>

      {/* Bottom sheet: Classifica lega */}
      <BottomSheet
        open={!!selectedLeague}
        onClose={() => setSelectedLeague(null)}
        title={selectedLeague?.name}
      >
        {selectedLeague && (
          <LeagueStandings league={selectedLeague} currentUserEmail={user?.email} />
        )}
      </BottomSheet>
    </div>
  );
}
