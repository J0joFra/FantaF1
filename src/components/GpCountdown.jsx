import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * GpCountdown — Timer alla rovescia per la chiusura dei pick.
 * Design ottimizzato per il look F1 Dark.
 */
export default function GpCountdown({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    if (!targetDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const units = [
    { label: 'GG', value: timeLeft.days },
    { label: 'ORE', value: timeLeft.hours },
    { label: 'MIN', value: timeLeft.minutes },
    { label: 'SEC', value: timeLeft.seconds },
  ];

  const isExpired = timeLeft.days + timeLeft.hours + timeLeft.minutes + timeLeft.seconds === 0;

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      {units.map((unit, i) => (
        <div key={unit.label} className="flex items-center gap-3">
          <div className="flex flex-col items-center min-w-[45px]">
            {/* Animazione cifra singola */}
            <AnimatePresence mode="wait">
              <motion.span
                key={unit.value}
                initial={{ y: 5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -5, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`text-2xl font-black italic tabular-nums leading-none ${
                  isExpired ? 'text-zinc-600' : 'text-white'
                }`}
              >
                {String(unit.value).padStart(2, '0')}
              </motion.span>
            </AnimatePresence>
            
            <span className="text-[8px] font-black text-zinc-500 tracking-[0.2em] mt-1 uppercase">
              {unit.label}
            </span>
          </div>

          {/* Separatore (due punti) */}
          {i < units.length - 1 && (
            <div className={`text-lg font-black mb-4 ${isExpired ? 'text-zinc-800' : 'text-ferrari-red/50 animate-pulse'}`}>
              :
            </div>
          )}
        </div>
      ))}
    </div>
  );
}