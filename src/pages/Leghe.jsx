import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import {
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, LogIn, ChevronRight, Trophy, Copy, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function Leghe() {
  const [user, setUser] = useState(auth.currentUser);
  const [myLeagues, setMyLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const q = query(collectionGroup(db, 'members'), where('user_email', '==', user.email));
      const querySnapshot = await getDocs(q);
      
      const leaguesData = [];
      for (const memberDoc of querySnapshot.docs) {
        const leagueRef = memberDoc.ref.parent.parent;
        const leagueSnap = await getDoc(leagueRef);
        if (leagueSnap.exists()) {
          leaguesData.push({
            id: leagueSnap.id,
            ...leagueSnap.data(),
            myRole: memberDoc.data().role,
            myPoints: memberDoc.data().total_points || 0
          });
        }
      }
      setMyLeagues(leaguesData);
    } catch (err) {
      console.error(err);
      toast.error("Errore nel caricamento delle leghe");
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
        name: newName,
        code: leagueCode,
        admin_id: user.uid,
        admin_email: user.email,
        created_at: serverTimestamp(),
      });

      await setDoc(doc(db, 'fantaF1Leagues', leagueRef.id, 'members', user.uid), {
        user_id: user.uid,
        user_email: user.email,
        user_name: user.displayName || user.email,
        role: 'admin',
        total_points: 0,
        joined_at: serverTimestamp()
      });

      toast.success(`Lega "${newName}" creata!`);
      setNewName('');
      setShowCreate(false);
      loadData();
    } catch (e) {
      toast.error("Errore durante la creazione");
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !user) return;
    setSaving(true);
    try {
      const q = query(collection(db, 'fantaF1Leagues'), where('code', '==', joinCode.trim().toUpperCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error("Codice non valido");
        return;
      }

      const leagueId = snap.docs[0].id;
      const memberRef = doc(db, 'fantaF1Leagues', leagueId, 'members', user.uid);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        toast.error("Sei già in questa lega");
      } else {
        await setDoc(memberRef, {
          user_id: user.uid,
          user_email: user.email,
          user_name: user.displayName || user.email,
          role: 'member',
          total_points: 0,
          joined_at: serverTimestamp()
        });
        toast.success("Ti sei unito alla lega!");
        setJoinCode('');
        setShowJoin(false);
        loadData();
      }
    } catch (e) {
      toast.error("Errore nell'unione");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="pt-12 pb-6 px-6">
        <div className="max-w-md mx-auto">
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-zinc-500 mb-1">Competizione</p>
          <h1 className="text-3xl font-black italic uppercase text-white">Le tue Leghe</h1>
        </div>
      </div>

      <div className="px-6 max-w-md mx-auto space-y-4">
        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setShowCreate(!showCreate); setShowJoin(false); }}
            className="bg-zinc-900/40 border border-white/5 backdrop-blur-md p-5 rounded-[2rem] flex flex-col items-center gap-2 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-ferrari-red/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-ferrari-red" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Crea Lega</span>
          </button>
          <button
            onClick={() => { setShowJoin(!showJoin); setShowCreate(false); }}
            className="bg-zinc-900/40 border border-white/5 backdrop-blur-md p-5 rounded-[2rem] flex flex-col items-center gap-2 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <LogIn className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Unisciti</span>
          </button>
        </div>

        {/* Forms Animati */}
        <AnimatePresence>
          {(showCreate || showJoin) && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -20 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -20 }}
              className="overflow-hidden bg-zinc-900/60 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                  {showCreate ? "Crea una nuova sfida" : "Inserisci codice invito"}
                </h3>
                <button onClick={() => { setShowCreate(false); setShowJoin(false); }}>
                  <X size={18} className="text-zinc-600" />
                </button>
              </div>

              <input
                type="text"
                value={showCreate ? newName : joinCode}
                onChange={(e) => showCreate ? setNewName(e.target.value) : setJoinCode(e.target.value)}
                placeholder={showCreate ? "Nome della lega..." : "ES: XJ72KW"}
                className={`w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-ferrari-red outline-none mb-4 transition-all ${!showCreate && 'text-center font-black tracking-[0.3em] uppercase'}`}
              />
              
              <button
                onClick={showCreate ? handleCreate : handleJoin}
                disabled={saving}
                className="w-full py-4 rounded-2xl bg-white text-black font-black uppercase text-xs tracking-[0.2em] shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : (showCreate ? "Crea Lega 🏁" : "Unisciti Ora 🏎️")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* League list */}
        <div className="space-y-3 pt-2">
          {loading ? (
             <div className="flex justify-center py-10"><Loader2 className="animate-spin text-zinc-700" size={32} /></div>
          ) : myLeagues.map((league, i) => (
            <motion.div
              key={league.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                to={`/classifica?league=${league.id}`}
                className="bg-zinc-900/40 border border-white/5 backdrop-blur-md p-5 rounded-[2rem] flex items-center gap-4 hover:bg-zinc-800/40 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-black/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Trophy className={league.myRole === 'admin' ? "text-ferrari-gold" : "text-zinc-500"} size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black uppercase italic text-white truncate">{league.name}</span>
                    {league.myRole === 'admin' && (
                      <span className="text-[8px] font-black bg-ferrari-red text-white px-1.5 py-0.5 rounded-sm">ADMIN</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Codice: {league.code}</span>
                  </div>
                </div>
                
                <div className="text-right flex flex-col items-end gap-1">
                   <button 
                    onClick={(e) => {
                      e.preventDefault();
                      navigator.clipboard.writeText(league.code);
                      toast.success("Codice copiato!");
                    }}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <Copy size={14} className="text-zinc-400" />
                  </button>
                </div>
                <ChevronRight className="text-zinc-700 group-hover:translate-x-1 transition-transform" size={18} />
              </Link>
            </motion.div>
          ))}

          {!loading && myLeagues.length === 0 && (
            <div className="bg-zinc-900/20 border border-dashed border-white/10 rounded-[2.5rem] p-12 text-center">
              <Users className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
              <h3 className="text-sm font-black uppercase text-zinc-500">Nessuna Lega attiva</h3>
              <p className="text-xs text-zinc-600 mt-2">Crea la tua prima lega o unisciti a quella dei tuoi amici per iniziare a giocare.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}