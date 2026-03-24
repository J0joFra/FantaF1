import { db, auth } from '../lib/firebase';
import { collectionGroup, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { CheckCircle2, X, Trophy, Zap } from 'lucide-react';
import DriverCard from '../components/DriverCard';
import GpCountdown from '../components/GpCountdown';
import { motion, AnimatePresence } from 'framer-motion';
import { isAfter, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { DRIVERS_2026, CALENDAR_2026 } from '../config/f1-2026';

export default function PickGp() {
  const [user, setUser] = useState(null);
  const [nextGp, setNextGp] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const now = new Date();
    const futureRaces = CALENDAR_2026.filter(race => isAfter(parseISO(race.date), now));
    if (futureRaces.length > 0) {
      const gp = futureRaces[0];
      setNextGp({
        id: gp.raceId,
        name: gp.name,
        circuit: gp.circuit,
        deadline: gp.lockDate,
        flag: gp.flag
      });
    }
    setUser(auth.currentUser);
    setLoading(false);
  }, []);

  const handleConfirmPick = async () => {
    setSaving(true);
    try {
      // Recuperiamo la lega dell'utente (assumendo ne abbia almeno una)
      const q = query(collectionGroup(db, 'members'), where('user_email', '==', user.email));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        toast.error("Unisciti prima a una lega!");
        return;
      }

      const leagueId = snap.docs[0].ref.parent.parent.id;
      const pickRef = doc(db, 'fantaF1Leagues', leagueId, 'picks', nextGp.id, 'userPicks', user.uid);

      await setDoc(pickRef, {
        driver_id: selectedDriver.id,
        driver_name: selectedDriver.name,
        team: selectedDriver.team,
        updated_at: serverTimestamp(),
        user_name: user.displayName || user.email
      }, { merge: true });

      // Feedback aptico (se supportato)
      if (window.navigator.vibrate) window.navigator.vibrate(20);
      
      setIsModalOpen(false);
      toast.success(`Pick confermato: ${selectedDriver.name}! 🏎️`);
    } catch (e) {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="px-6 pt-10 pb-32">
      {/* Header GP */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Prossimo Round</span>
        <h1 className="text-4xl font-black italic uppercase text-white leading-none mt-1">{nextGp?.name}</h1>
        <div className="mt-4 inline-block bg-zinc-900 border border-white/5 rounded-2xl p-4">
           <GpCountdown deadline={nextGp?.deadline} />
        </div>
      </motion.div>

      {/* Lista Piloti */}
      <div className="space-y-3">
        {DRIVERS_2026.map((driver) => (
          <DriverCard 
            key={driver.id} 
            driver={driver} 
            selected={selectedDriver?.id === driver.id}
            onSelect={(d) => {
              setSelectedDriver(d);
              setIsModalOpen(true); // Apriamo il pop-up alla selezione
            }}
          />
        ))}
      </div>

      {/* MODAL DI CONFERMA (Pop-up) */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            {/* Overlay scuro */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            />
            
            {/* Pop-up */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 100 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 100 }}
              className="fixed bottom-10 left-6 right-6 bg-[#121214] border border-white/10 rounded-[32px] p-8 z-[101] shadow-2xl"
            >
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-zinc-500"><X size={20}/></button>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-1 bg-zinc-800 rounded-full mb-6" />
                <div className="p-4 rounded-full mb-4" style={{ backgroundColor: `${selectedDriver.color}20` }}>
                  <Trophy size={32} style={{ color: selectedDriver.color }} />
                </div>
                
                <h3 className="text-2xl font-black uppercase italic italic text-white leading-tight">
                  Confermi <br/> <span style={{ color: selectedDriver.color }}>{selectedDriver.name}</span>?
                </h3>
                <p className="text-zinc-500 text-sm mt-2 font-medium">Questa scelta sarà bloccata all'inizio del GP.</p>

                <button
                  onClick={handleConfirmPick}
                  disabled={saving}
                  className="mt-8 w-full py-5 rounded-2xl bg-white text-black font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  {saving ? "Salvataggio..." : "Conferma Pick 🏁"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}