import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Trophy, Zap, ChevronRight, CheckCircle2, Flag, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { isAfter, parseISO } from 'date-fns';
import GpCountdown from '../components/GpCountdown';

import { CALENDAR_2026, DRIVERS_2026 } from '../config/f1-2026';

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
      // 1. Calcolo Prossimo GP dai tuoi dati locali
      const now = new Date();
      const gp = CALENDAR_2026.find(race => isAfter(parseISO(race.date), now));
      
      if (gp) {
        setNextGp({
          ...gp,
          targetDate: gp.lockDate // Mappatura per GpCountdown
        });

        // 2. Recupero Pick dell'utente per questo GP
        const qLeagues = query(collectionGroup(db, 'members'), where('user_email', '==', currentUser.email));
        const leagueSnap = await getDocs(qLeagues);
        
        if (!leagueSnap.empty) {
          const leagueId = leagueSnap.docs[0].ref.parent.parent.id;
          const pickRef = doc(db, 'fantaF1Leagues', leagueId, 'picks', gp.raceId, 'userPicks', currentUser.uid);
          const pickSnap = await getDoc(pickRef);
          if (pickSnap.exists()) {
            setMyPick(pickSnap.data());
          }
        }
      }
    } catch (err) {
      console.error("Errore caricamento Home:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050507]">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-4 border-ferrari-red border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-[#050507]">
      {/* Hero Section */}
      <div className="pt-12 pb-8 px-6 bg-gradient-to-b from-ferrari-red/10 to-transparent">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-zinc-500 mb-1">
            FantaF1 World Championship
          </p>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black italic uppercase leading-none">
              Ciao, <span className="text-ferrari-red">{user?.displayName?.split(' ')[0] || 'Pilota'}</span>
            </h1>
            <div className="w-12 h-12 rounded-full border-2 border-white/10 p-1 overflow-hidden">
               <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="avatar" className="rounded-full" />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="px-6 space-y-6 max-w-md mx-auto">
        
        {/* Next GP Glass Card */}
        {nextGp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-[2.5rem] bg-zinc-900/40 border border-white/5 backdrop-blur-xl shadow-2xl"
          >
            <div className="h-1.5 w-full bg-ferrari-red" />
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="bg-white/5 text-zinc-400 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter mb-2 inline-block">Prossimo Round</span>
                  <h2 className="text-2xl font-black uppercase italic tracking-tight">{nextGp.name}</h2>
                  <p className="text-zinc-500 text-xs font-bold">{nextGp.circuit}</p>
                </div>
                <span className="text-4xl grayscale opacity-50">{nextGp.flag}</span>
              </div>

              <div className="bg-black/40 rounded-3xl p-5 mb-6 border border-white/5">
                <GpCountdown targetDate={nextGp.targetDate} />
              </div>

              <Link
                to="/pick"
                className={`flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                  myPick 
                    ? 'bg-zinc-800 text-zinc-400 border border-white/5' 
                    : 'bg-white text-black hover:bg-ferrari-red hover:text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                }`}
              >
                {myPick ? (
                  <>
                    <CheckCircle2 size={16} />
                    Pick Effettuato
                  </>
                ) : (
                  <>
                    <Flag size={16} />
                    Fai il tuo Pick
                  </>
                )}
              </Link>
            </div>
          </motion.div>
        )}

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-4">
          <QuickActionCard 
            to="/leghe" 
            icon={<Trophy className="text-amber-500" size={24} />} 
            label="Le mie Leghe" 
            delay={0.2}
          />
          <QuickActionCard 
            to="/classifica" 
            icon={<Zap className="text-blue-500" size={24} />} 
            label="Classifica" 
            delay={0.3}
          />
        </div>

        {/* Progress Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-zinc-900/40 border border-white/5 rounded-[2rem] p-6"
        >
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-xs font-black uppercase italic text-zinc-400">Progresso Stagione</h3>
            <span className="text-xs font-black italic">{nextGp?.round || 0}/24</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${((nextGp?.round || 1) / 24) * 100}%` }}
              className="h-full bg-ferrari-red rounded-full shadow-[0_0_10px_rgba(220,0,0,0.5)]"
            />
          </div>
        </motion.div>

        {/* Top Drivers Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-6"
        >
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-xs font-black uppercase italic text-zinc-400">Driver Focus</h3>
            <Link to="/pick" className="text-[10px] font-black uppercase text-ferrari-red flex items-center gap-1">
              Tutti <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-4">
            {DRIVERS_2026.slice(0, 3).map((driver) => (
              <div key={driver.id} className="flex items-center gap-4 bg-black/20 p-3 rounded-2xl border border-white/[0.03]">
                <div className="w-1 h-8 rounded-full" style={{ backgroundColor: driver.color }} />
                <div className="flex-1">
                  <p className="text-sm font-black uppercase italic leading-none">{driver.name}</p>
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">{driver.team}</p>
                </div>
                <div className="text-zinc-800 font-black italic text-xl">#{driver.number}</div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}

function QuickActionCard({ to, icon, label, delay }) {
  return (
    <Link to={to} className="block group">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        whileTap={{ scale: 0.95 }}
        className="bg-zinc-900/40 border border-white/5 p-6 rounded-[2rem] flex flex-col items-center gap-3 backdrop-blur-md hover:bg-zinc-800/60 transition-all"
      >
        <div className="p-4 bg-black/40 rounded-2xl shadow-inner group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</span>
      </motion.div>
    </Link>
  );
}