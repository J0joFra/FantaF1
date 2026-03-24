// pages/Home.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getUserLeagues, savePick, getUserPick } from '../lib/firestoreService';
import { getNextGrandPrix } from '../lib/supabaseData';
import { Trophy, Zap, ChevronRight, Flag, Star, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import GpCountdown from '../components/GpCountdown';
import PickModal from '../components/PickModal';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [nextGp, setNextGp] = useState(null);
  const [myPick, setMyPick] = useState(null);
  const [myLeagues, setMyLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPickModalOpen, setIsPickModalOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      
      const gp = await getNextGrandPrix();
      setNextGp(gp);
      
      const leagues = await getUserLeagues(user.uid);
      setMyLeagues(leagues);
      
      if (gp) {
        const pick = await getUserPick(user.uid, gp.raceId);
        setMyPick(pick);
      }
    } catch (err) {
      console.error('Errore caricamento Home:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePickConfirm(selectedDriver) {
    if (!nextGp) return;
    
    try {
      await savePick(user.uid, nextGp.raceId, selectedDriver.id, selectedDriver.name);
      
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast.success(`Pick confermato: ${selectedDriver.name}!`);
      
      // Aggiorna il pick nello stato
      setMyPick({
        driverId: selectedDriver.id,
        driverName: selectedDriver.name,
      });
    } catch (err) {
      console.error(err);
      toast.error("Errore durante il salvataggio");
      throw err;
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-ferrari-red" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <Flag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-barlow font-black text-2xl mb-2">Benvenuto su FantaF1</h2>
          <p className="text-muted-foreground mb-6">Accedi per iniziare a giocare</p>
          <button 
            onClick={() => window.location.href = '/api/auth/signin'}
            className="bg-ferrari-red text-white px-8 py-3 rounded-xl font-bold uppercase text-sm"
          >
            Accedi con Google
          </button>
        </div>
      </div>
    );
  }

  const isPickLocked = nextGp ? new Date(nextGp.lockDate) <= new Date() : false;

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Hero */}
      <div className="pt-12 pb-8 px-6 bg-gradient-to-b from-ferrari-red/10 to-transparent">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-muted-foreground mb-1">
            FantaF1 2026
          </p>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black uppercase leading-none">
              Ciao, <span className="text-ferrari-red">{user?.displayName?.split(' ')[0] || 'Pilota'}</span>
            </h1>
            {user?.photoURL && (
              <img src={user.photoURL} alt="avatar" className="w-12 h-12 rounded-full border-2 border-ferrari-red/30" />
            )}
          </div>
        </motion.div>
      </div>

      <div className="px-6 max-w-md mx-auto space-y-6">
        
        {/* Next GP Card */}
        {nextGp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-2xl bg-card border border-border"
          >
            <div className="h-1 w-full bg-ferrari-red" />
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Prossimo GP</span>
                  <h2 className="text-2xl font-black uppercase">{nextGp.name}</h2>
                  <p className="text-sm text-muted-foreground">{nextGp.circuit}</p>
                </div>
                <span className="text-3xl">{nextGp.flag}</span>
              </div>

              <div className="bg-secondary/50 rounded-xl p-4 mb-6">
                <GpCountdown targetDate={nextGp.lockDate} />
              </div>

              <button
                onClick={() => setIsPickModalOpen(true)}
                disabled={isPickLocked}
                className={`flex items-center justify-center gap-3 w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                  myPick && !isPickLocked
                    ? 'bg-secondary text-muted-foreground border border-border hover:bg-secondary/70'
                    : myPick && isPickLocked
                    ? 'bg-secondary/50 text-muted-foreground border border-border cursor-not-allowed'
                    : 'bg-ferrari-red text-white hover:bg-ferrari-red/90'
                }`}
              >
                {myPick ? (
                  <>
                    <Star size={16} />
                    {isPickLocked ? 'Pick Bloccato' : `Pick: ${myPick.driverName}`}
                    {!isPickLocked && ' (modifica)'}
                  </>
                ) : (
                  <>
                    <Flag size={16} />
                    {isPickLocked ? 'Pick Chiusi' : 'Fai il tuo Pick'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Link to="/leghe" className="bg-card border border-border rounded-xl p-4 text-center hover:border-ferrari-red/50 transition">
            <Trophy className="w-6 h-6 text-ferrari-gold mx-auto mb-2" />
            <p className="text-2xl font-black">{myLeagues.length}</p>
            <p className="text-xs text-muted-foreground">Le mie leghe</p>
          </Link>
          
          <Link to="/classifica" className="bg-card border border-border rounded-xl p-4 text-center hover:border-ferrari-red/50 transition">
            <Zap className="w-6 h-6 text-ferrari-red mx-auto mb-2" />
            <p className="text-2xl font-black">
              {myLeagues.reduce((sum, l) => sum + (l.myPoints || 0), 0)}
            </p>
            <p className="text-xs text-muted-foreground">Punti totali</p>
          </Link>
        </div>

        {/* How it works */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-barlow font-bold text-sm uppercase tracking-widest text-muted-foreground mb-4">
            Come Funziona
          </h3>
          <div className="space-y-4">
            {[
              { step: '01', title: 'Crea o unisciti a una Lega', desc: 'Sfida i tuoi amici con un codice segreto' },
              { step: '02', title: 'Scegli il tuo Pilota', desc: 'Prima della chiusura dei pick (1h prima della gara)' },
              { step: '03', title: 'Accumula Punti', desc: 'Vittorie, pole, giri veloci e molto altro' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <span className="text-2xl font-black text-ferrari-red w-8">{item.step}</span>
                <div>
                  <p className="font-bold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Link to="/regolamento" className="mt-4 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition">
            <span>Leggi il regolamento completo</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* Pick Modal */}
      <PickModal
        isOpen={isPickModalOpen}
        onClose={() => setIsPickModalOpen(false)}
        onConfirm={handlePickConfirm}
        currentPick={myPick}
        raceName={nextGp?.name}
        raceFlag={nextGp?.flag}
        deadline={nextGp?.lockDate}
      />
    </div>
  );
}