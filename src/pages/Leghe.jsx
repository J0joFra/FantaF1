import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import {
  collection, collectionGroup, query, where,
  getDocs, addDoc, doc, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, LogIn, ChevronRight, Trophy, Copy, X, Loader2, Lock, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../lib/AuthContext';

function LeagueCard({ league, index }) {
  const isAdmin = league.myRole === 'admin';
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
    >
      <Link
        to={`/classifica?league=${league.id}`}
        className="group relative overflow-hidden flex items-center gap-4 bg-[#0f0f17] border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 hover:bg-[#131320] transition-all duration-300"
      >
        {/* Glow on hover */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-red-500/0 to-transparent group-hover:via-red-500/60 transition-all duration-500 rounded-full" />

        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          isAdmin ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-white/[0.03] border border-white/[0.06]'
        }`}>
          <Trophy className={`w-5 h-5 ${isAdmin ? 'text-yellow-500' : 'text-zinc-500'}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-black text-sm uppercase tracking-tight text-white truncate">
              {league.name}
            </span>
            {isAdmin && (
              <span className="text-[8px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-600 font-mono font-bold tracking-wider">
              {league.code}
            </span>
            <span className="text-zinc-800">·</span>
            <span className="text-[10px] text-zinc-600 font-bold">
              {league.memberCount || league.myPoints || 0} {league.memberCount ? 'membri' : 'pts'}
            </span>
          </div>
        </div>

        {/* Copy + Arrow */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigator.clipboard.writeText(league.code);
              toast.success(`Codice "${league.code}" copiato!`);
            }}
            className="p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
          >
            <Copy size={12} className="text-zinc-500" />
          </button>
          <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>
    </motion.div>
  );
}

export default function Leghe() {
  const { user } = useAuth();
  const [myLeagues, setMyLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadData();
    else setLoading(false);
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const q = query(collectionGroup(db, 'members'), where('user_email', '==', user.email));
      const snapshot = await getDocs(q);

      const leaguesData = [];
      for (const memberDoc of snapshot.docs) {
        const leagueRef = memberDoc.ref.parent.parent;
        const leagueSnap = await getDoc(leagueRef);
        if (leagueSnap.exists()) {
          leaguesData.push({
            id: leagueSnap.id,
            ...leagueSnap.data(),
            myRole: memberDoc.data().role,
            myPoints: memberDoc.data().total_points || 0,
          });
        }
      }
      setMyLeagues(leaguesData);
    } catch (err) {
      console.error(err);
      toast.error('Errore nel caricamento delle leghe');
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;
    setSaving(true);
    try {
      const leagueCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const leagueRef = await addDoc(collection(db, 'fantaF1Leagues'), {
        name: newName.trim(),
        code: leagueCode,
        admin_id: user.uid,
        admin_email: user.email,
        created_at: serverTimestamp(),
        memberCount: 1,
      });

      await setDoc(doc(db, 'fantaF1Leagues', leagueRef.id, 'members', user.uid), {
        user_id: user.uid,
        user_email: user.email,
        user_name: user.displayName || user.email,
        role: 'admin',
        total_points: 0,
        joined_at: serverTimestamp(),
      });

      toast.success(`Lega "${newName.trim()}" creata! 🏁`);
      setNewName('');
      setShowCreate(false);
      loadData();
    } catch {
      toast.error('Errore durante la creazione');
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !user) return;
    setSaving(true);
    try {
      const q = query(
        collection(db, 'fantaF1Leagues'),
        where('code', '==', joinCode.trim().toUpperCase())
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error('Codice non valido');
        return;
      }

      const leagueId = snap.docs[0].id;
      const memberRef = doc(db, 'fantaF1Leagues', leagueId, 'members', user.uid);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        toast.error('Sei già in questa lega');
      } else {
        await setDoc(memberRef, {
          user_id: user.uid,
          user_email: user.email,
          user_name: user.displayName || user.email,
          role: 'member',
          total_points: 0,
          joined_at: serverTimestamp(),
        });

        // Update member count
        const leagueData = snap.docs[0].data();
        await setDoc(snap.docs[0].ref, {
          ...leagueData,
          memberCount: (leagueData.memberCount || 1) + 1,
        });

        toast.success('Benvenuto nella lega! 🏎️');
        setJoinCode('');
        setShowJoin(false);
        loadData();
      }
    } catch {
      toast.error("Errore nell'unione");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative pt-12 pb-6 px-5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/10 to-transparent pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[10px] font-black tracking-[0.35em] uppercase text-blue-400/60 mb-2">
            Competizione
          </p>
          <h1 className="text-4xl font-black uppercase tracking-tight leading-none">
            Le tue <span className="text-blue-400">Leghe</span>
          </h1>
        </motion.div>
      </div>

      <div className="px-5 space-y-4 pb-6">

        {/* Not logged in */}
        {!user && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-[#0f0f17] border border-white/[0.06] p-8 text-center"
          >
            <Lock className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <p className="font-black text-lg uppercase text-white mb-1">Accesso richiesto</p>
            <p className="text-zinc-500 text-sm">Accedi per vedere e gestire le tue leghe</p>
          </motion.div>
        )}

        {/* Action Buttons */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-3"
          >
            <button
              onClick={() => { setShowCreate(!showCreate); setShowJoin(false); }}
              className={`relative overflow-hidden flex flex-col items-center gap-2.5 py-5 px-4 rounded-2xl border transition-all duration-300 ${
                showCreate
                  ? 'bg-red-500/10 border-red-500/40 text-red-400'
                  : 'bg-[#0f0f17] border-white/[0.06] text-zinc-400 hover:border-white/10 hover:text-white'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${showCreate ? 'bg-red-500/20' : 'bg-white/[0.04]'}`}>
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.15em]">Crea Lega</span>
            </button>

            <button
              onClick={() => { setShowJoin(!showJoin); setShowCreate(false); }}
              className={`relative overflow-hidden flex flex-col items-center gap-2.5 py-5 px-4 rounded-2xl border transition-all duration-300 ${
                showJoin
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                  : 'bg-[#0f0f17] border-white/[0.06] text-zinc-400 hover:border-white/10 hover:text-white'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${showJoin ? 'bg-blue-500/20' : 'bg-white/[0.04]'}`}>
                <LogIn className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.15em]">Unisciti</span>
            </button>
          </motion.div>
        )}

        {/* Animated Forms */}
        <AnimatePresence mode="wait">
          {user && (showCreate || showJoin) && (
            <motion.div
              key={showCreate ? 'create' : 'join'}
              initial={{ opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className={`relative rounded-2xl border p-5 ${
                showCreate
                  ? 'bg-red-950/10 border-red-500/20'
                  : 'bg-blue-950/10 border-blue-500/20'
              }`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-xs font-black uppercase tracking-widest ${showCreate ? 'text-red-400' : 'text-blue-400'}`}>
                    {showCreate ? '🏁 Nuova Sfida' : '🏎️ Inserisci Codice'}
                  </h3>
                  <button
                    onClick={() => { setShowCreate(false); setShowJoin(false); }}
                    className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                  >
                    <X size={14} className="text-zinc-500" />
                  </button>
                </div>

                <input
                  type="text"
                  value={showCreate ? newName : joinCode}
                  onChange={(e) => showCreate ? setNewName(e.target.value) : setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && (showCreate ? handleCreate() : handleJoin())}
                  placeholder={showCreate ? 'Nome della lega...' : 'ES: XJ72KW'}
                  maxLength={showCreate ? 40 : 6}
                  className={`w-full bg-black/30 border rounded-xl px-4 py-3.5 text-white placeholder:text-zinc-600 focus:outline-none transition-all mb-4 font-bold ${
                    showCreate
                      ? 'border-white/10 focus:border-red-500/50 text-sm'
                      : 'border-white/10 focus:border-blue-500/50 text-center text-lg tracking-[0.4em] uppercase'
                  }`}
                  autoFocus
                />

                <button
                  onClick={showCreate ? handleCreate : handleJoin}
                  disabled={saving || (showCreate ? !newName.trim() : joinCode.length < 6)}
                  className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                    showCreate
                      ? 'bg-red-600 text-white hover:bg-red-500'
                      : 'bg-blue-600 text-white hover:bg-blue-500'
                  }`}
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {showCreate ? 'Crea la Lega' : 'Unisciti Ora'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* League List */}
        {user && (
          <div className="space-y-2.5">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-zinc-700" />
              </div>
            ) : myLeagues.length > 0 ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 px-1 mb-3">
                  {myLeagues.length} {myLeagues.length === 1 ? 'Lega' : 'Leghe'}
                </p>
                {myLeagues.map((league, i) => (
                  <LeagueCard key={league.id} league={league} index={i} />
                ))}
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="rounded-3xl bg-[#0a0a10] border border-dashed border-white/[0.06] p-12 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-zinc-700" />
                </div>
                <p className="font-black text-sm uppercase text-zinc-500 mb-1">Nessuna lega</p>
                <p className="text-xs text-zinc-700">Crea la tua prima lega o unisciti a quella di un amico</p>
              </motion.div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}