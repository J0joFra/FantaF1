import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// F1 car pointing UP — softer palette
function F1Car({ color = "#cc1830", small = false }) {
  const w = small ? 22 : 26;
  const h = small ? 52 : 62;
  return (
    <svg width={w} height={h} viewBox="0 0 26 62" fill="none">
      <path d="M13 0 L17 10 L9 10 Z" fill={color} opacity="0.85" />
      <rect x="4" y="9" width="18" height="3" rx="1.5" fill={color} opacity="0.7" />
      <rect x="7" y="12" width="12" height="30" rx="3.5" fill={color} />
      <rect x="9" y="15" width="8" height="14" rx="2.5" fill="#111" />
      <rect x="10" y="16" width="6" height="11" rx="2" fill="#3a6fa0" opacity="0.45" />
      <rect x="3" y="42" width="20" height="4" rx="2" fill={color} opacity="0.85" />
      <rect x="10" y="40" width="6" height="6" rx="1" fill={color} opacity="0.6" />
      <ellipse cx="5.5"  cy="19" rx="4.5" ry="3.5" fill="#1a1a1a" />
      <ellipse cx="20.5" cy="19" rx="4.5" ry="3.5" fill="#1a1a1a" />
      <ellipse cx="5.5"  cy="38" rx="4.5" ry="3.5" fill="#1a1a1a" />
      <ellipse cx="20.5" cy="38" rx="4.5" ry="3.5" fill="#1a1a1a" />
    </svg>
  );
}

// GridUp logo (same as original splash)
function GridUpLogo() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
           style={{ background: "linear-gradient(135deg, #c41a2e 0%, #8b0f1e 100%)" }}>
        <svg viewBox="0 0 32 32" width="46" height="46" fill="none">
          <rect x="4"  y="6"  width="8" height="8" fill="white" />
          <rect x="12" y="6"  width="8" height="8" fill="#c41a2e" />
          <rect x="4"  y="14" width="8" height="8" fill="#c41a2e" />
          <rect x="12" y="14" width="8" height="8" fill="white" />
          <rect x="20" y="6"  width="8" height="16" fill="white" opacity="0.12" />
          <line x1="4" y1="6" x2="4" y2="26" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="font-heading font-black text-white text-2xl tracking-widest">GridUP</p>
      <p className="text-white/35 font-body text-xs tracking-[0.2em]">www.formula-rossa.it</p>
    </div>
  );
}

// Scrolling road dash (goes upward to give speed illusion)
function Dash({ delay }) {
  return (
    <motion.div
      className="absolute left-1/2 -translate-x-px rounded-full"
      style={{ width: 2, height: 24, background: "rgba(255,255,255,0.12)", top: "100%" }}
      animate={{ y: [0, "-110vh"] }}
      transition={{ duration: 1.4, delay, repeat: Infinity, ease: "linear" }}
    />
  );
}

// Opponent car — moves downward from its start position
function OpponentCar({ color, laneX, startY, endY, delay = 0, duration = 5 }) {
  return (
    <motion.div
      className="absolute"
      style={{ x: laneX, top: 0 }}
      initial={{ y: startY }}
      animate={{ y: endY }}
      transition={{ delay, duration, ease: "linear" }}
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

  // Player: moves from 82vh to 10vh (top = finish) over 5.2s
  // Swerves slightly when overtaking each opponent
  const playerY  = ["82vh", "63vh", "60vh", "55vh", "40vh", "37vh", "32vh", "20vh", "17vh", "12vh", "10vh"];
  const playerX  = [    0,      0,    -11,     0,      0,     11,      0,      0,    -10,      0,      0  ];
  const pTimes   = [    0,   0.18,   0.26,  0.33,   0.40,   0.46,  0.53,   0.60,   0.65,  0.85,   1.0  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex justify-center overflow-hidden"
          style={{ background: "#0f0f17" }}
        >
          {/* ── TRACK STRIP ── */}
          <div className="relative w-full flex justify-center">

            {/* Asphalt */}
            <div className="absolute top-0 bottom-0 bg-[#1b1b26]" style={{ width: 140 }} />

            {/* Left kerb */}
            <div className="absolute top-0 bottom-0" style={{
              width: 10, left: "calc(50% - 70px - 10px)",
              background: "repeating-linear-gradient(180deg, #9e1020 0 14px, #e8e8e8 14px 28px)"
            }} />
            {/* Right kerb */}
            <div className="absolute top-0 bottom-0" style={{
              width: 10, left: "calc(50% + 70px)",
              background: "repeating-linear-gradient(180deg, #e8e8e8 0 14px, #9e1020 14px 28px)"
            }} />

            {/* Scrolling center dashes */}
            {[0, 0.35, 0.70, 1.05, 1.40].map((d, i) => <Dash key={i} delay={d} />)}

            {/* ── FINISH LINE — fixed at top ── */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-10"
              style={{ top: "10%", width: 140, height: 14 }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", height: "100%" }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{ background: (Math.floor(i / 10) + (i % 10)) % 2 === 0 ? "white" : "#111" }} />
                ))}
              </div>
            </div>
            {/* Finish line label */}
            <motion.p
              className="absolute z-10 text-white/30 font-body text-[9px] tracking-widest"
              style={{ top: "calc(10% + 16px)", left: "50%", transform: "translateX(-50%)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              FINISH
            </motion.p>

            {/* ── OPPONENTS (move downward) ── */}
            <div className="absolute inset-0 flex justify-center">
              {/* Opp 1 — right lane, furthest ahead */}
              <OpponentCar color="#3a5a9a" laneX={32}  startY="18vh" endY="95vh" duration={5} />
              {/* Opp 2 — left lane, middle */}
              <OpponentCar color="#2e6e3a" laneX={-32} startY="32vh" endY="108vh" duration={5} />
              {/* Opp 3 — right lane, closest behind finish */}
              <OpponentCar color="#666"    laneX={32}  startY="46vh" endY="120vh" duration={5} />
            </div>

            {/* ── PLAYER CAR — moves upward ── */}
            {phase === "race" && (
              <motion.div
                className="absolute z-20"
                style={{ left: "50%", marginLeft: -13 }}
                animate={{
                  top: playerY,
                  x: playerX,
                }}
                transition={{
                  duration: 5.2,
                  times: pTimes,
                  ease: "easeInOut",
                }}
              >
                {/* Exhaust glow */}
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 rounded-full blur-md"
                  style={{ bottom: -8, width: 12, height: 12, background: "#ff5500", opacity: 0.55 }}
                  animate={{ scaleY: [1, 1.6, 1], opacity: [0.55, 0.25, 0.55] }}
                  transition={{ duration: 0.25, repeat: Infinity }}
                />
                <F1Car color="#cc1830" />
              </motion.div>
            )}

            {/* ── LOGO — appears when player reaches finish ── */}
            <AnimatePresence>
              {phase === "logo" && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center z-30"
                  style={{ background: "#0f0f17" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
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
