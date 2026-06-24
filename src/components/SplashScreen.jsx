import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

function HelmetIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 34C10 18 20 8 32 8C44 8 54 18 54 34V42C54 46 51 49 47 49H17C13 49 10 46 10 42V34Z"
            fill="#E8002D" />
      <path d="M14 30C14 22 22 16 32 16C42 16 50 22 50 30V34H14V30Z"
            fill="#1a1a2e" fillOpacity="0.85" />
      <path d="M17 22C19 19 24 17 29 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      <path d="M18 49C18 49 20 56 32 56C44 56 46 49 46 49" stroke="#C20028" strokeWidth="2" fill="none"/>
      <path d="M10 36H54" stroke="white" strokeWidth="2.5" opacity="0.2"/>
    </svg>
  );
}

const ORBIT_RADIUS = 80; // px from center

export default function SplashScreen({ onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 500);
    }, 7000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#01161E]"
        >
          {/* Orbit container — centered, fixed size */}
          <div className="relative flex items-center justify-center"
               style={{ width: ORBIT_RADIUS * 2 + 48, height: ORBIT_RADIUS * 2 + 48 }}>

            {/* Orbit ring */}
            <div className="absolute rounded-full border border-white/10"
                 style={{ width: ORBIT_RADIUS * 2, height: ORBIT_RADIUS * 2 }} />

            {/* Rotating arm — centered, rotates in place */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              {/* Helmet at orbit radius — translateX pushes it to the edge */}
              <motion.div
                style={{ x: ORBIT_RADIUS }}
                /* counter-rotate so helmet stays upright */
                animate={{ rotate: -360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              >
                <HelmetIcon className="w-10 h-10 drop-shadow-lg" />
              </motion.div>
            </motion.div>

            {/* Center logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: "backOut" }}
              className="flex flex-col items-center gap-1 z-10"
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-[#E8002D] to-[#C20028] flex items-center justify-center shadow-xl"
              >
                <svg viewBox="0 0 32 32" className="w-9 h-9" fill="none">
                  <rect x="4" y="6" width="8" height="8" fill="white"/>
                  <rect x="12" y="6" width="8" height="8" fill="#E8002D"/>
                  <rect x="4" y="14" width="8" height="8" fill="#E8002D"/>
                  <rect x="12" y="14" width="8" height="8" fill="white"/>
                  <rect x="20" y="6" width="8" height="16" fill="white" opacity="0.15"/>
                  <line x1="4" y1="6" x2="4" y2="26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </motion.div>

              <p className="font-heading font-black text-white text-2xl tracking-widest mt-1">GridUP</p>
              <p className="text-white/40 text-[11px] font-body tracking-wider">www.formula-rossa.it</p>
            </motion.div>
          </div>

          {/* Loading dots */}
          <div className="flex gap-1.5 mt-12">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-white/30"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
