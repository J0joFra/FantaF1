import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collectionGroup, query, where, getDocs, 
  setDoc, doc, getDoc, serverTimestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, X, CheckCircle2, Search, Loader2, AlertCircle } from 'lucide-react';
import DriverCard from '../components/DriverCard';
import GpCountdown from '../components/GpCountdown';
import { getNextGrandPrix, getActiveDrivers } from '../lib/supabaseData';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function PickGp() {
  const [user, setUser] = useState(auth.currentUser);
  const [nextGp, setNextGp] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [existingPick, setExistingPick] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const u = auth.currentUser;
      setUser(u);

      // 1. Recupero GP e Piloti da Supabase
      const [currentGp, driversData] = await Promise.all([
        getNextGrandPrix(),
        getActiveDrivers(2026),
      ]);

      setNextGp(currentGp);
      setDrivers(driversData);

      if (currentGp && u) {
        // 2. Recupero le leghe dell'utente
        const qLeagues = query(collectionGroup(db, 'members'), where('user_email', '==', u.email));
        const leagueSnap = await getDocs(qLeagues);
        const leagues = leagueSnap.docs.map(d => d.ref.parent.parent.id);
        setMyLeagues(leagues);

        // 3. Controllo se esiste già un pick (nella prima lega trovata per semplicità)
        if (leagues.length > 0) {
          const pickRef = doc(db, 'fantaF1Leagues', leagues[0], 'picks', currentGp.raceId, 'userPicks', u.uid);
          const pickSnap = await getDoc(pickRef);
          if (pickSnap.exists()) {
            setExistingPick(pickSnap.data());
            const driver = driversData.find(d => d.id === pickSnap.data().driverId);
            if (driver) setSelectedDriver(driver);
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Errore nel caricamento dati");
    } finally {
      setLoading(false);
    }
  }

  const filteredDrivers = useMemo(() => {
    if (!search) return drivers;
    const s = search.toLowerCase();
    return drivers.filter(d => 
      d.name.toLowerCase().includes(s) || 
      d.team.toLowerCase().includes(s) || 
      d.id.toLowerCase().includes(s)
    );
  }, [search, drivers]);

  const handleConfirm = async () => {
    if (!selectedDriver || !user || !nextGp) return;
    setSaving(true);

    try {
      // Salviamo il pick in tutte le leghe di cui l'utente fa parte
      const savePromises = myLeagues.map(leagueId => {
        const pickRef = doc(db, 'fantaF1Leagues', leagueId, 'picks', nextGp.raceId, 'userPicks', user.uid);
        return setDoc(pickRef, {
          driverId: selectedDriver.id,
          driverName: selectedDriver.name,
          user_email: user.email,
          timestamp: serverTimestamp(),
          status: 'confirmed'
        });
      });

      await Promise.all(savePromises);

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });
      toast.success(`Pick confermato: ${selectedDriver.name}!`);
      setExistingPick({ driverId: selectedDriver.id });
      setIsModalOpen(false);
    } catch (err) {
      toast.error("Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050507]">
        <Loader2 className="animate-spin text-ferrari-red" size={40} />
      </div>
    );
  }

  if (!nextGp) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="bg-zinc-900/40 border border-white/5 p-10 rounded-[3rem] backdrop-blur-xl">
          <Flag className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
          <h2 className="text-2xl font-black uppercase italic italic text-white">Stagione Conclusa</h2>
          <p className="text-zinc-500 mt-2 text-sm uppercase tracking-widest font-bold">Ci vediamo al prossimo semaforo verde</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="pt-12 pb-8 px-6 bg-gradient-to-b from-ferrari-red/10 to-transparent">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-zinc-500 mb-1">Pick Grand Prix</p>
              <h1 className="text-3xl font-black italic uppercase leading-none text-white">
                {nextGp.flag} {nextGp.name}
              </h1>
              <p className="text-zinc-500 text-xs font-bold mt-2 uppercase tracking-tighter">{nextGp.circuit}</p>
            </div>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-3xl p-4 backdrop-blur-md">
            <GpCountdown targetDate={nextGp.lockDate} />
          </div>
        </div>
      </div>

      <div className="px-6 max-w-md mx-auto">
        {existingPick ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900/40 border border-white/5 p-8 rounded-[2.5rem] text-center backdrop-blur-xl shadow-2xl relative overflow-hidden"
          >
             <div className="absolute top-0 left-0 w-full h-1 bg-ferrari-red" />
             <CheckCircle2 className="w-16 h-16 text-ferrari-red mx-auto mb-4" />
             <h2 className="text-2xl font-black uppercase italic text-white">Pick Confermato</h2>
             <p className="text-zinc-500 text-sm mt-1 mb-6">Hai scelto di scendere in pista con:</p>
             
             <div className="bg-black/40 border border-white/5 p-6 rounded-3xl inline-block w-full">
                <p className="text-3xl font-black uppercase italic text-white">{selectedDriver?.name}</p>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mt-2">
                  {selectedDriver?.team} · #{selectedDriver?.number}
                </p>
             </div>
             
             <button 
               onClick={() => setExistingPick(null)}
               className="mt-8 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors"
             >
               Cambia scelta
             </button>
          </motion.div>
        ) : (
          <>
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="CERCA PILOTA O TEAM..."
                className="w-full bg-zinc-900/40 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-xs font-black uppercase tracking-widest text-white placeholder:text-zinc-700 focus:border-ferrari-red/50 outline-none transition-all"
              />
            </div>

            {/* Drivers List */}
            <div className="space-y-3">
              {filteredDrivers.map((driver, i) => (
                <motion.div
                  key={driver.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <DriverCard
                    driver={driver}
                    selected={selectedDriver?.id === driver.id}
                    onSelect={(d) => {
                      setSelectedDriver(d);
                      setIsModalOpen(true);
                    }}
                  />
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Drawer-style Modal */}
      <AnimatePresence>
        {isModalOpen && selectedDriver && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#121214] border-t border-white/10 rounded-t-[3rem] p-8 max-w-md mx-auto"
            >
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8" />
              
              <div className="flex items-center gap-6 mb-8">
                <div 
                  className="w-20 h-20 rounded-[2rem] flex items-center justify-center text-2xl font-black italic shadow-2xl"
                  style={{ backgroundColor: `${selectedDriver.color}20`, color: selectedDriver.color, border: `1px solid ${selectedDriver.color}40` }}
                >
                  {selectedDriver.id}
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase italic text-white leading-none">{selectedDriver.name}</h3>
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mt-2">{selectedDriver.team}</p>
                </div>
              </div>

              <p className="text-zinc-400 text-sm leading-relaxed mb-8 px-2">
                Stai confermando <span className="text-white font-bold">{selectedDriver.name}</span> per il weekend di gara. I punti verranno calcolati in base alla sua prestazione reale.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="py-4 rounded-2xl bg-zinc-900 text-zinc-400 font-black uppercase text-[10px] tracking-widest border border-white/5 active:scale-95 transition-all"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="py-4 rounded-2xl bg-white text-black font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : "Conferma Pick"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}