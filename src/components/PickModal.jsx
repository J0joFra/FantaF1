// components/PickModal.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2, CheckCircle2, Flag, Lock } from 'lucide-react';
import { getActiveDrivers } from '../lib/supabaseData';
import { DRIVERS_2026 } from '../config/f1-2026';

function DriverItem({ driver, selected, onSelect, disabled }) {
  const lastName = (driver.surname || driver.name?.split(' ').slice(-1)[0] || driver.name || '').toUpperCase();
  const firstName = driver.name?.split(' ').slice(0, -1).join(' ') || '';
  const initials = (driver.name || driver.surname || '??')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const teamColor = driver.color || driver.team_color || '#666';
  const teamName = driver.team || driver.team_name || driver.constructor_name || '';

  return (
    <motion.button
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      onClick={() => !disabled && onSelect(driver)}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left relative overflow-hidden ${
        selected
          ? 'border-red-500/50 bg-red-500/8'
          : 'border-white/[0.05] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Team color stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full opacity-80"
        style={{ backgroundColor: teamColor }}
      />

      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ml-1"
        style={{
          backgroundColor: `${teamColor}18`,
          color: teamColor,
          border: `1px solid ${teamColor}30`,
        }}
      >
        {initials}
      </div>

      {/* Driver info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] text-zinc-600 font-bold">{driver.id || driver.driver_id}</span>
        </div>
        <div className="font-black text-sm uppercase tracking-tight text-white leading-none truncate">
          {lastName}
        </div>
        <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight mt-0.5 truncate">
          {teamName}
        </div>
      </div>

      {/* Number */}
      <span className="text-xl font-black italic text-zinc-800 tabular-nums shrink-0">
        {driver.number || driver.driver_number || ''}
      </span>

      {/* Selected check */}
      {selected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0"
        >
          <CheckCircle2 className="w-3 h-3 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
}

// Normalize driver from Supabase or from local config
function normalizeDriver(d) {
  // If from Supabase
  if (d.surname || d.driver_number !== undefined) {
    const fullName = d.full_name || `${d.name || ''} ${d.surname || ''}`.trim();
    return {
      id: d.abbreviation || d.driver_id || d.code || d.id,
      name: fullName,
      surname: d.surname || fullName.split(' ').slice(-1)[0],
      number: d.driver_number ?? d.number,
      team: d.team_name || d.constructor_name || d.team || '',
      color: d.team_color || d.color || '#666666',
    };
  }
  // Already in local format
  return d;
}

export default function PickModal({
  isOpen, onClose, onConfirm,
  currentPick, raceName, raceFlag, deadline
}) {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
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
      // Try Supabase first
      const data = await getActiveDrivers(2026);
      if (data && data.length > 0) {
        setDrivers(data.map(normalizeDriver));
      } else {
        // Fallback to local config
        setDrivers(DRIVERS_2026);
      }
    } catch (err) {
      console.error('Using local drivers fallback:', err);
      setDrivers(DRIVERS_2026);
    } finally {
      setLoading(false);
    }
  }

  const filteredDrivers = drivers.filter(d => {
    const q = search.toLowerCase();
    return (
      (d.name || '').toLowerCase().includes(q) ||
      (d.surname || '').toLowerCase().includes(q) ||
      (d.team || '').toLowerCase().includes(q) ||
      (d.id || '').toLowerCase().includes(q)
    );
  });

  const handleConfirm = async () => {
    if (!selectedDriver || confirming) return;
    setConfirming(true);
    try {
      await onConfirm(selectedDriver);
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  const isLocked = deadline ? new Date(deadline) <= new Date() : false;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
            style={{ maxHeight: '90vh' }}
          >
            <div className="bg-[#0d0d14] rounded-t-[2rem] border-t border-white/[0.06] flex flex-col" style={{ maxHeight: '90vh' }}>

              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/10" />
              </div>

              {/* Header */}
              <div className="px-5 pb-4 border-b border-white/[0.05] shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-2xl">{raceFlag || '🏁'}</span>
                      <h2 className="text-lg font-black uppercase tracking-tight">Scegli il Pilota</h2>
                    </div>
                    {raceName && (
                      <p className="text-xs text-zinc-500 ml-8">{raceName}</p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors"
                  >
                    <X size={18} className="text-zinc-500" />
                  </button>
                </div>

                {isLocked && (
                  <div className="mt-3 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
                    <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <p className="text-xs text-red-400 font-bold uppercase tracking-widest">
                      Pick chiusi
                    </p>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-col overflow-hidden flex-1">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-7 h-7 animate-spin text-zinc-700" />
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div className="px-5 pt-4 pb-3 shrink-0">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Cerca pilota o team..."
                          className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40 transition-all"
                        />
                      </div>
                    </div>

                    {/* Drivers list */}
                    <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1.5">
                      {filteredDrivers.length === 0 ? (
                        <p className="text-center text-zinc-600 text-sm py-8">Nessun pilota trovato</p>
                      ) : (
                        filteredDrivers.map((driver) => (
                          <DriverItem
                            key={driver.id}
                            driver={driver}
                            selected={selectedDriver?.id === driver.id}
                            onSelect={setSelectedDriver}
                            disabled={isLocked}
                          />
                        ))
                      )}
                    </div>

                    {/* Confirm button */}
                    {!isLocked && (
                      <div className="px-5 pb-6 pt-3 border-t border-white/[0.05] shrink-0">
                        {selectedDriver && (
                          <p className="text-center text-xs text-zinc-500 mb-3">
                            Selezionato:{' '}
                            <span className="font-black text-white uppercase">
                              {selectedDriver.name}
                            </span>
                          </p>
                        )}
                        <button
                          onClick={handleConfirm}
                          disabled={!selectedDriver || confirming}
                          className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2.5 ${
                            selectedDriver
                              ? 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/30'
                              : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed border border-white/[0.04]'
                          }`}
                        >
                          {confirming ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          {currentPick ? 'Aggiorna Pick' : 'Conferma Pick'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}