import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// F1 car pointing UP
function F1Car({ color = "#E8002D", small = false }) {
  const w = small ? 22 : 26;
  const h = small ? 52 : 62;
  return (
    <svg width={w} height={h} viewBox="0 0 26 62" fill="none">
      <path d="M13 0 L17 10 L9 10 Z" fill={color} opacity="0.9" />
      <rect x="4" y="9" width="18" height="3" rx="1.5" fill={color} opacity="0.6" />
      <rect x="7" y="12" width="12" height="30" rx="3.5" fill={color} />
      <rect x="9" y="15" width="8" height="14" rx="2.5" fill="#1a1a2e" opacity="0.85" />
      <rect x="10" y="16" width="6" height="11" rx="2" fill="#88b8d8" opacity="0.35" />
      <rect x="3" y="42" width="20" height="4" rx="2" fill={color} opacity="0.75" />
      <rect x="10" y="40" width="6" height="6" rx="1" fill={color} opacity="0.5" />
      <ellipse cx="5.5"  cy="19" rx="4.5" ry="3.5" fill="#222" />
      <ellipse cx="20.5" cy="19" rx="4.5" ry="3.5" fill="#222" />
      <ellipse cx="5.5"  cy="38" rx="4.5" ry="3.5" fill="#222" />
      <ellipse cx="20.5" cy="38" rx="4.5" ry="3.5" fill="#222" />
    </svg>
  );
}

// GridUp logo
function GridUpLogo() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl"
           style={{ background: "linear-gradient(135deg, #E8002D 0%, #b0001e 100%)" }}>
        <svg viewBox="0 0 32 32" width="46" height="46" fill="none">
          <rect x="4"  y="6"  width="8" height="8" fill="white" />
          <rect x="12" y="6"  width="8" height="8" fill="#E8002D" />
          <rect x="4"  y="14" width="8" height="8" fill="#E8002D" />
          <rect x="12" y="14" width="8" height="8" fill="white" />
          <rect x="20" y="6"  width="8" height="16" fill="white" opacity="0.12" />
          <line x1="4" y1="6" x2="4" y2="26" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="font-heading font-black text-foreground text-2xl tracking-widest">GridUP</p>
      <p className="text-muted-foreground font-body text-xs tracking-[0.2em]">www.formula-rossa.it</p>
    </div>
  );
}

// Scrolling center dash — light style
function Dash({ delay }) {
  return (
    <motion.div
      className="absolute left-1/2 -translate-x-px rounded-full"
      style={{ width: 2, height: 20, background: "rgba(0,0,0,0.10)", top: "100%" }}
      animate={{ y: [0, "-110vh"] }}
      transition={{ duration: 1.4, delay, repeat: Infinity, ease: "linear" }}
    />
  );
}

function OpponentCar({ color, laneX, startY, endY, duration = 5 }) {
  return (
    <motion.div
      className="absolute"
      style={{ x: laneX, top: 0 }}
      initial={{ y: startY }}
      animate={{ y: endY }}
      transition={{ duration, ease: "linear" }}
    >
      <F1Car color={color} small />
    </motion.div>
  );
}

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState("race"); // race | logo
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("logo"), 5200);
    const t2 = setTimeout(() => setVisible(false), 6500);
    const t3 = setTimeout(onDone, 7000);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [onDone]);

  const playerY  = ["82vh","63vh","60vh","55vh","40vh","37vh","32vh","20vh","17vh","12vh","10vh"];
  const playerX  = [0, 0, -11, 0, 0, 11, 0, 0, -10, 0, 0];
  const pTimes   = [0, 0.18, 0.26, 0.33, 0.40, 0.46, 0.53, 0.60, 0.65, 0.85, 1.0];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex justify-center overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100"
        >
          {/* ── TRACK STRIP ── */}
          <div className="relative w-full flex justify-center">

            {/* Road surface — light asphalt */}
            <div className="absolute top-0 bottom-0 rounded-none"
                 style={{ width: 140, background: "#e8e8ed" }} />

            {/* Left kerb */}
            <div className="absolute top-0 bottom-0" style={{
              width: 8,
              left: "calc(50% - 70px - 8px)",
              background: "repeating-linear-gradient(180deg, #E8002D 0 12px, white 12px 24px)",
            }} />
            {/* Right kerb */}
            <div className="absolute top-0 bottom-0" style={{
              width: 8,
              left: "calc(50% + 70px)",
              background: "repeating-linear-gradient(180deg, white 0 12px, #E8002D 12px 24px)",
            }} />

            {/* Scrolling center dashes */}
            {[0, 0.35, 0.70, 1.05, 1.40].map((d, i) => <Dash key={i} delay={d} />)}

            {/* ── FINISH LINE — fixed at top ── */}
            <div className="absolute left-1/2 -translate-x-1/2 z-10"
                 style={{ top: "10%", width: 140, height: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", height: "100%" }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{ background: (Math.floor(i/10) + (i%10)) % 2 === 0 ? "#111" : "white" }} />
                ))}
              </div>
            </div>
            <p className="absolute z-10 font-body text-[9px] tracking-widest text-gray-400"
               style={{ top: "calc(10% + 16px)", left: "50%", transform: "translateX(-50%)" }}>
              FINISH
            </p>

            {/* ── OPPONENTS ── */}
            <div className="absolute inset-0 flex justify-center">
              <OpponentCar color="#5577bb" laneX={32}  startY="18vh" endY="95vh"  duration={5} />
              <OpponentCar color="#448844" laneX={-32} startY="32vh" endY="108vh" duration={5} />
              <OpponentCar color="#aaaaaa" laneX={32}  startY="46vh" endY="120vh" duration={5} />
            </div>

            {/* ── PLAYER CAR ── */}
            {phase === "race" && (
              <motion.div
                className="absolute z-20"
                style={{ left: "50%", marginLeft: -13 }}
                animate={{ top: playerY, x: playerX }}
                transition={{ duration: 5.2, times: pTimes, ease: "easeInOut" }}
              >
                {/* Exhaust — subtle warm glow */}
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 rounded-full blur-sm"
                  style={{ bottom: -6, width: 10, height: 8, background: "#ff7700", opacity: 0.4 }}
                  animate={{ scaleY: [1, 1.5, 1], opacity: [0.4, 0.15, 0.4] }}
                  transition={{ duration: 0.2, repeat: Infinity }}
                />
                <F1Car color="#E8002D" />
              </motion.div>
            )}

            {/* ── LOGO on finish ── */}
            <AnimatePresence>
              {phase === "logo" && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center z-30 bg-gradient-to-b from-gray-50 to-gray-100"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.45 }}
                >
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 18 }}
                  >
                    <GridUpLogo />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
