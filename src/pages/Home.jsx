import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Trophy, Zap, ChevronRight, Star, Target } from 'lucide-react';
import GpCountdown from '../components/GpCountdown';
import { isAfter, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { DRIVERS_2026, CALENDAR_2026 } from '../config/f1-2026';

export default function Home() {
  const [user, setUser] = useState(null);
  const [nextGp, setNextGp] = useState(null);
  const [myPick, setMyPick] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
        loadData(u);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  async function loadData(currentUser) {
    try {
      const now = new Date();
      const gp = CALENDAR_2026.find(race => isAfter(parseISO(race.date), now));
      const mappedGp = gp ? {
        id: gp.raceId,
        name: gp.name,
        circuit: gp.circuit,
        race_date: gp.date,
        targetDate: gp.lockDate,
        flag_emoji: gp.flag
      } : null;

      const q = query(collectionGroup(db, 'members'), where('user_email', '==', currentUser.email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const leagueId = snap.docs[0].ref.parent.parent.id;
        const pickRef = doc(db, 'fantaF1Leagues', leagueId, 'picks', gp.raceId, 'userPicks', currentUser.uid);
        const pickSnap = await getDoc(pickRef);
        if (pickSnap.exists()) setMyPick(pickSnap.data());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="flex h-screen items-center justify-center font-barlow italic font-black text-2xl">CARICAMENTO...</div>;

  return (
    <div className="px-6 pt-12 pb-24 space-y-8">
      {/* Header con Benvenuto */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Benvenuto nel 2026</p>
          <h1 className="text-3xl font-black uppercase italic italic leading-none">
            Ciao, <span className="text-ferrari-red">{user?.displayName?.split(' ')[0] || 'Pilota'}</span>
          </h1>
        </div>
        <div className="w-12 h-12 rounded-full border-2 border-ferrari-red/30 p-1">
          <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="avatar" className="rounded-full bg-zinc-800" />
        </div>
      </motion.div>

      {/* CARD PROSSIMO GP - Qui c'è il Countdown */}
      {nextGp && (
        <motion.div 
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-[32px] bg-zinc-900 border border-white/5 p-6 shadow-2xl"
        >
          {/* Background decorativo */}
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <span className="text-8xl font-black italic">{nextGp.flag_emoji}</span>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-ferrari-red text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">Prossima Gara</span>
            </div>
            
            <h2 className="text-2xl font-black uppercase italic leading-tight">{nextGp.name}</h2>
            <p className="text-zinc-500 font-bold text-sm mb-6">{nextGp.circuit}</p>

            {/* Il Countdown */}
            <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/5">
                <GpCountdown targetDate={nextGp.targetDate} />
            </div>

            <Link 
              to="/pick" 
              className={`mt-6 w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${
                myPick ? 'bg-zinc-800 text-zinc-500' : 'bg-white text-black hover:bg-ferrari-red hover:text-white'
              }`}
            >
              {myPick ? <Star fill="currentColor" size={18}/> : <Target size={18} />}
              {myPick ? 'Pick Effettuato' : 'Fai il tuo Pick'}
            </Link>
          </div>
        </motion.div>
      )}

      {/* Sezione Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <QuickActionLink to="/leghe" icon={<Trophy className="text-ferrari-gold"/>} label="Le mie Leghe" />
        <QuickActionLink to="/classifica" icon={<Zap className="text-blue-400"/>} label="Classifica" />
      </div>
    </div>
  );
}

function QuickActionLink({ to, icon, label }) {
  return (
    <Link to={to}>
      <motion.div 
        whileTap={{ scale: 0.95 }}
        className="bg-zinc-900/50 border border-white/5 p-4 rounded-3xl flex flex-col items-center gap-3"
      >
        <div className="p-3 bg-white/5 rounded-2xl">{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</span>
      </motion.div>
    </Link>
  );
}