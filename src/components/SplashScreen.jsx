import { useEffect, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";

// F1 car pointing UPWARD
function F1Car({ color = "#E8002D", className }) {
  return (
    <svg className={className} viewBox="0 0 28 72" fill="none">
      {/* Nose */}
      <path d="M14 0 L18 12 L10 12 Z" fill={color === "#E8002D" ? "#C20028" : "#555"} />
      {/* Front wing */}
      <rect x="4" y="10" width="20" height="4" rx="1.5" fill={color} />
      {/* Body */}
      <rect x="8" y="14" width="12" height="36" rx="4" fill={color} />
      {/* Cockpit */}
      <rect x="10" y="18" width="8" height="16" rx="3" fill="#111" />
      <rect x="11" y="19" width="6" height="12" rx="2" fill="#4aa8ff" opacity="0.5" />
      {/* Rear wing */}
      <rect x="3" y="50" width="22" height="5" rx="2" fill={color} />
      <rect x="11" y="48" width="6" height="8" rx="1" fill={color === "#E8002D" ? "#C20028" : "#444"} />
      {/* Wheels */}
      <ellipse cx="6"  cy="22" rx="5" ry="4" fill="#111" />
      <ellipse cx="22" cy="22" rx="5" ry="4" fill="#111" />
      <ellipse cx="6"  cy="22" rx="2.5" ry="2" fill="#333" />
      <ellipse cx="22" cy="22" rx="2.5" ry="2" fill="#333" />
      <ellipse cx="6"  cy="46" rx="5" ry="4" fill="#111" />
      <ellipse cx="22" cy="46" rx="5" ry="4" fill="#111" />
      <ellipse cx="6"  cy="46" rx="2.5" ry="2" fill="#333" />
      <ellipse cx="22" cy="46" rx="2.5" ry="2" fill="#333" />
    </svg>
  );
}

// Scrolling road dash
function RoadDash({ delay }) {
  return (
    <motion.div
      className="absolute left-1/2 -translate-x-1/2 w-1 rounded-full bg-white/20"
      style={{ height: 28, top: -30 }}
      animate={{ y: ["0vh", "110vh"] }}
      transition={{ duration: 1.2, delay, repeat: Infinity, ease: "linear" }}
    />
  );
}

// Opponent car that scrolls down past the player
function Opponent({ color, laneX, startDelay, duration = 3.5 }) {
  return (
    <motion.div
      className="absolute"
      style={{ x: laneX, top: 0 }}
      initial={{ y: "-10%" }}
      animate={{ y: "110%" }}
      transition={{ delay: startDelay, duration, ease: "linear" }}
    >
      <F1Car color={color} className="w-7 h-16" />
    </motion.div>
  );
}

const CONFETTI_COLORS = ["#E8002D", "#FFD700", "#ffffff", "#00C6FF", "#FF6B00"];

function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            left: `${(i / 20) * 100}%`,
            top: -8,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          }}
          animate={{ y: ["0px", "100vh"], rotate: [0, i % 2 === 0 ? 360 : -360], opacity: [1, 0] }}
          transition={{ duration: 1.2 + (i % 4) * 0.15, delay: (i * 0.08) % 0.8, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState("race"); // race | victory
  const [visible, setVisible] = useState(true);

  // Player car x offset: swerves left/right to overtake
  // Opponent 1 is in right lane → player swerves right then back
  // Opponent 2 is in left lane → player swerves left then back
  const playerX = [0, 0, 28, 28, 0, 0, -28, -28, 0, 0];
  const playerTimes = [0, 0.18, 0.26, 0.38, 0.45, 0.52, 0.60, 0.72, 0.79, 1.0];

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("victory"), 5200);
    const t2 = setTimeout(() => setVisible(false), 6500);
    const t3 = setTimeout(onDone, 7000);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center overflow-hidden"
          style={{ background: "linear-gradient(180deg, #0d0d1a 0%, #1a0008 100%)" }}
        >
          {/* Top label */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-white font-body text-xs tracking-[0.22em] mt-14 z-10"
          >
            www.formula-rossa.it
          </motion.p>

          {/* ── TRACK ── */}
          <div className="relative flex-1 w-full flex justify-center overflow-hidden">

            {/* Asphalt strip */}
            <div
              className="absolute top-0 bottom-0 bg-[#1a1a24]"
              style={{ width: 130, left: "50%", transform: "translateX(-50%)" }}
            />

            {/* Left kerb */}
            <div
              className="absolute top-0 bottom-0 w-3"
              style={{
                left: "calc(50% - 65px - 12px)",
                background: "repeating-linear-gradient(180deg, #E8002D 0 12px, white 12px 24px)",
              }}
            />
            {/* Right kerb */}
            <div
              className="absolute top-0 bottom-0 w-3"
              style={{
                left: "calc(50% + 65px)",
                background: "repeating-linear-gradient(180deg, white 0 12px, #E8002D 12px 24px)",
              }}
            />

            {/* Center lane dashes (scrolling) */}
            {[0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8].map((d, i) => (
              <RoadDash key={i} delay={d} />
            ))}

            {/* Finish line — scrolls in near the end */}
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 z-10"
              style={{ width: 130, height: 16, top: 0 }}
              initial={{ y: "-5%" }}
              animate={{ y: "70vh" }}
              transition={{ delay: 3.8, duration: 1.4, ease: "linear" }}
            >
              {/* Checkered */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", height: "100%" }}>
                {Array.from({ length: 32 }).map((_, i) => (
                  <div key={i} style={{ background: (Math.floor(i / 8) + (i % 8)) % 2 === 0 ? "white" : "black" }} />
                ))}
              </div>
            </motion.div>

            {/* Opponents */}
            {/* Opponent 1: right lane, appears early */}
            <div className="absolute inset-0 flex justify-center">
              <Opponent color="#4444cc" laneX={28} startDelay={0.6} duration={2.8} />
            </div>
            {/* Opponent 2: left lane */}
            <div className="absolute inset-0 flex justify-center">
              <Opponent color="#229922" laneX={-28} startDelay={2.2} duration={2.6} />
            </div>
            {/* Opponent 3: center, slower */}
            <div className="absolute inset-0 flex justify-center">
              <Opponent color="#888888" laneX={0} startDelay={0.0} duration={4.0} />
            </div>

            {/* Player car — fixed at 70% height, swerves x */}
            {phase === "race" && (
              <motion.div
                className="absolute z-20"
                style={{ top: "68%", left: "50%", x: "-50%", marginLeft: -14 }}
                animate={{ x: playerX.map(v => `calc(-50% + ${v}px)`) }}
                transition={{ duration: 5.2, times: playerTimes, ease: "easeInOut" }}
              >
                {/* Exhaust glow */}
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 rounded-full blur-sm"
                  style={{ bottom: -6, width: 14, height: 10, background: "#ff6600" }}
                  animate={{ opacity: [0.8, 0.3, 0.8], scaleY: [1, 1.4, 1] }}
                  transition={{ duration: 0.2, repeat: Infinity }}
                />
                <F1Car color="#E8002D" className="w-7 h-16" />
              </motion.div>
            )}
          </div>

          {/* ── VICTORY ── */}
          <AnimatePresence>
            {phase === "victory" && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                style={{ background: "linear-gradient(180deg, #0d0d1a 0%, #1a0008 100%)" }}
              >
                <Confetti />
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  className="flex flex-col items-center gap-3"
                >
                  <motion.p
                    className="text-6xl"
                    animate={{ rotate: [-6, 6, -6] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    🏆
                  </motion.p>
                  <motion.p
                    className="font-heading font-black text-white text-3xl tracking-widest"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                  >
                    VITTORIA!
                  </motion.p>
                  <p className="text-white/40 font-body text-xs tracking-[0.2em] mt-1">
                    www.formula-rossa.it
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
