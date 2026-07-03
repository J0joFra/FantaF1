import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLUMNS = 5;

// One column of the F1 start gantry: two stacked red lights
function LightColumn({ lit }) {
  const glow = lit
    ? "0 0 14px 3px rgba(232,0,45,0.75), inset 0 0 6px rgba(255,120,120,0.6)"
    : "inset 0 2px 4px rgba(0,0,0,0.6)";
  const bg = lit ? "#ff1a3c" : "#2a0a0f";
  return (
    <div className="flex flex-col gap-2.5">
      {[0, 1].map(i => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{ width: 26, height: 26, background: bg, boxShadow: glow }}
          initial={false}
          animate={{ background: bg, boxShadow: glow }}
          transition={{ duration: 0.12 }}
        />
      ))}
    </div>
  );
}

function StartGantry({ litCount, lightsOut }) {
  return (
    <div
      className="flex items-center gap-3.5 px-5 py-4 rounded-2xl"
      style={{
        background: "linear-gradient(180deg,#1a1a22,#0e0e14)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {Array.from({ length: COLUMNS }).map((_, i) => (
        <LightColumn key={i} lit={!lightsOut && i < litCount} />
      ))}
    </div>
  );
}

function FinalLogo() {
  return (
    <div className="flex flex-col items-center gap-3">
      <img
        src="/icons/icon-512.png"
        alt="GridUP"
        width={104}
        height={104}
        className="rounded-[26px] shadow-2xl"
        style={{ width: 104, height: 104 }}
      />
      <p className="font-heading font-black text-white text-2xl tracking-widest">GridUP</p>
      <p className="text-white/45 font-body text-xs tracking-[0.28em]">www.formula-rossa.it</p>
    </div>
  );
}

export default function SplashScreen({ onDone }) {
  const [litCount, setLitCount] = useState(0);
  const [lightsOut, setLightsOut] = useState(false);
  const [phase, setPhase] = useState("lights"); // lights | logo

  useEffect(() => {
    const timers = [];
    // Light up the 5 columns one by one
    [420, 760, 1100, 1440, 1780].forEach((ms, i) => {
      timers.push(setTimeout(() => setLitCount(i + 1), ms));
    });
    // Dramatic "lights out" beat
    timers.push(setTimeout(() => setLightsOut(true), 2500));
    // Reveal logo
    timers.push(setTimeout(() => setPhase("logo"), 2750));
    // Finish
    timers.push(setTimeout(onDone, 4400));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[9999] mx-auto w-full max-w-[430px] overflow-hidden flex items-center justify-center"
        style={{ background: "radial-gradient(120% 90% at 50% 30%, #16161f 0%, #0b0b11 60%, #07070b 100%)" }}
      >
        {/* subtle track-line accents in the background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
             style={{ backgroundImage: "repeating-linear-gradient(180deg, #fff 0 1px, transparent 1px 46px)" }} />

        <AnimatePresence mode="wait">
          {phase === "lights" ? (
            <motion.div
              key="lights"
              className="flex flex-col items-center gap-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4 }}
            >
              <StartGantry litCount={litCount} lightsOut={lightsOut} />
              <motion.p
                className="font-body text-[11px] tracking-[0.3em] uppercase"
                style={{ color: lightsOut ? "#ff2a48" : "rgba(255,255,255,0.35)" }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                {lightsOut ? "Lights out" : "www.formula-rossa.it"}
              </motion.p>
            </motion.div>
          ) : (
            <motion.div
              key="logo"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
            >
              <FinalLogo />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
