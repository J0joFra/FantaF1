import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function GpCountdown({ targetDate, light = false, compact = false }) {
  const calc = useCallback(() => {
    if (!targetDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff / 3600000) % 24),
      minutes: Math.floor((diff / 60000) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [targetDate]);

  const [t, setT] = useState(calc);
  useEffect(() => {
    setT(calc());
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, [calc]);

  const units = [
    { l: "GG",  v: t.days    },
    { l: "ORE", v: t.hours   },
    { l: "MIN", v: t.minutes },
    { l: "SEC", v: t.seconds },
  ];

  // ── Compact mode: inline red numbers ──────────────────────────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {units.map((u, i) => (
          <div key={u.l} className="flex items-center gap-1.5">
            <div className="text-center">
              <AnimatePresence mode="wait">
                <motion.span
                  key={u.v}
                  initial={{ y: 3, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -3, opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="font-heading font-black text-2xl leading-none tabular-nums text-primary block"
                >
                  {String(u.v).padStart(2, "0")}
                </motion.span>
              </AnimatePresence>
              <span className="text-[9px] font-body text-muted-foreground uppercase tracking-widest mt-0.5 block">
                {u.l}
              </span>
            </div>
            {i < 3 && (
              <span className="font-heading font-black text-lg text-primary/30 mb-3">:</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Full mode ─────────────────────────────────────────────────────────────
  return (
    <div className="flex items-end gap-2.5 mt-1">
      {units.map((u, i) => (
        <div key={u.l} className="flex items-end gap-2.5">
          <div className="text-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={u.v}
                initial={{ y: 4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -4, opacity: 0 }}
                transition={{ duration: 0.1 }}
                className={`font-heading font-black text-2xl leading-none tabular-nums block
                  ${light ? "text-foreground" : "text-white"}`}
              >
                {String(u.v).padStart(2, "0")}
              </motion.span>
            </AnimatePresence>
            <span className={`text-[9px] font-body uppercase tracking-[0.2em] mt-0.5 block
              ${light ? "text-muted-foreground" : "text-white/40"}`}>
              {u.l}
            </span>
          </div>
          {i < 3 && (
            <span className={`font-heading font-black text-lg mb-4
              ${light ? "text-primary/30" : "text-white/20"}`}>:</span>
          )}
        </div>
      ))}
    </div>
  );
}
