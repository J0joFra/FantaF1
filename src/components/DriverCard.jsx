import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * DriverCard — Card pilota ottimizzata per il design F1 Dark
 * Mostra il colore del team, le iniziali, il cognome e il numero di gara.
 */
export default function DriverCard({ driver, selected, onSelect, disabled }) {
  // Estraiamo le iniziali (es: Charles Leclerc -> CL)
  const initials = driver.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Estraiamo solo il cognome per un look più "racing"
  const lastName = driver.name.split(' ').slice(-1)[0];

  return (
    <motion.button
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      onClick={() => !disabled && onSelect(driver)}
      disabled={disabled}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left relative overflow-hidden
        ${selected
          ? 'border-ferrari-red bg-ferrari-red/10 shadow-[0_0_20px_rgba(220,0,0,0.15)]'
          : 'border-white/5 bg-[#1a1a1a] hover:border-white/15 hover:bg-white/[0.03]'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Barra colore Team (laterale sinistra) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: driver.color }}
      />

      {/* Avatar con iniziali */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black shrink-0 shadow-inner"
        style={{ 
          backgroundColor: `${driver.color}20`, 
          color: driver.color,
          border: `1px solid ${driver.color}30`
        }}
      >
        {initials}
      </div>

      {/* Info Pilota */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            {driver.id}
          </span>
        </div>
        <div className="text-base font-black uppercase italic text-white leading-tight truncate">
          {lastName}
        </div>
        <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">
          {driver.team}
        </div>
      </div>

      {/* Numero di Gara */}
      <div className="text-right flex flex-col items-end shrink-0">
        <span className="text-2xl font-black italic text-zinc-800 leading-none tabular-nums">
          {driver.number}
        </span>
      </div>

      {/* Checkmark animato se selezionato */}
      {selected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="ml-2 w-6 h-6 rounded-full bg-ferrari-red flex items-center justify-center shrink-0 shadow-lg shadow-ferrari-red/20"
        >
          <Check className="w-3.5 h-3.5 text-white stroke-[4px]" />
        </motion.div>
      )}
    </motion.button>
  );
}