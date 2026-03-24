// components/PickModal.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2, CheckCircle2, Flag } from 'lucide-react';
import { getActiveDrivers } from '../lib/supabaseData';
import DriverCard from './DriverCard';

export default function PickModal({ isOpen, onClose, onConfirm, currentPick, raceName, raceFlag, deadline }) {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDrivers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentPick && drivers.length > 0) {
      const current = drivers.find(d => d.id === currentPick.driverId);
      if (current) setSelectedDriver(current);
    }
  }, [currentPick, drivers]);

  async function loadDrivers() {
    setLoading(true);
    try {
      const data = await getActiveDrivers(2026);
      setDrivers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.team.toLowerCase().includes(search.toLowerCase()) ||
    d.surname.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!selectedDriver) return;
    setConfirming(true);
    await onConfirm(selectedDriver);
    setConfirming(false);
    onClose();
  };

  // Verifica se il pick è ancora aperto
  const isLocked = deadline ? new Date(deadline) <= new Date() : false;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#121214] border-t border-white/10 rounded-t-[2rem] max-w-md mx-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#121214] rounded-t-[2rem] pt-6 pb-3 px-6 border-b border-white/5">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{raceFlag}</span>
                  <h2 className="text-lg font-black uppercase italic">Scegli il tuo pilota</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition">
                  <X size={20} className="text-zinc-500" />
                </button>
              </div>
              <p className="text-xs text-zinc-500">{raceName}</p>
              
              {isLocked && (
                <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-red-400" />
                  <p className="text-xs text-red-400 font-bold uppercase tracking-wider">
                    Pick chiusi! La finestra di selezione è terminata.
                  </p>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="px-6 pb-8 max-h-[70vh] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-ferrari-red" />
                </div>
              ) : (
                <>
                  {/* Search */}
                  <div className="relative mb-4 mt-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cerca pilota o team..."
                      className="w-full bg-zinc-900/60 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-ferrari-red/50 transition"
                    />
                  </div>

                  {/* Drivers list */}
                  <div className="space-y-2">
                    {filteredDrivers.map((driver) => (
                      <DriverCard
                        key={driver.id}
                        driver={driver}
                        selected={selectedDriver?.id === driver.id}
                        onSelect={setSelectedDriver}
                        disabled={isLocked}
                      />
                    ))}
                  </div>

                  {/* Current pick info */}
                  {currentPick && !selectedDriver && (
                    <div className="mt-4 p-4 bg-zinc-900/40 border border-white/5 rounded-xl">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Pick attuale</p>
                      <p className="font-bold text-white">{currentPick.driverName}</p>
                    </div>
                  )}

                  {/* Confirm button */}
                  {!isLocked && (
                    <button
                      onClick={handleConfirm}
                      disabled={!selectedDriver || confirming}
                      className={`w-full mt-6 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                        selectedDriver
                          ? 'bg-ferrari-red text-white hover:bg-ferrari-red/90'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      {confirming ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" />
                      )}
                      {currentPick ? 'Aggiorna Pick' : 'Conferma Pick'}
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}