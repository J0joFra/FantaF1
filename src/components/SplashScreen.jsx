import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Simple inline F1 car SVG pointing right
function F1Car({ className }) {
  return (
    <svg className={className} viewBox="0 0 80 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="10" y="8" width="52" height="12" rx="4" fill="#E8002D"/>
      {/* Nose cone */}
      <path d="M62 10 L76 14 L62 18 Z" fill="#C20028"/>
      {/* Cockpit */}
      <rect x="28" y="4" width="18" height="10" rx="3" fill="#1a1a1a"/>
      <rect x="30" y="5" width="14" height="7" rx="2" fill="#4aa8ff" opacity="0.6"/>
      {/* Front wing */}
      <rect x="64" y="16" width="12" height="3" rx="1" fill="#E8002D"/>
      <rect x="64" y="9" width="12" height="3" rx="1" fill="#E8002D"/>
      {/* Rear wing */}
      <rect x="4" y="5" width="10" height="3" rx="1" fill="#E8002D"/>
      <rect x="4" y="20" width="10" height="3" rx="1" fill="#E8002D"/>
      <rect x="6" y="8" width="2" height="12" rx="1" fill="#C20028"/>
      {/* Wheels */}
      <circle cx="20" cy="21" r="5" fill="#111"/>
      <circle cx="20" cy="21" r="2.5" fill="#333"/>
      <circle cx="56" cy="21" r="5" fill="#111"/>
      <circle cx="56" cy="21" r="2.5" fill="#333"/>
      <circle cx="20" cy="7" r="4" fill="#111"/>
      <circle cx="20" cy="7" r="2" fill="#333"/>
      <circle cx="56" cy="7" r="4" fill="#111"/>
      <circle cx="56" cy="7" r="2" fill="#333"/>
    </svg>
  );
}

function Cone({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 32" fill="none">
      <polygon points="12,0 22,28 2,28" fill="#FF6B00"/>
      <rect x="2" y="28" width="20" height="4" rx="1" fill="#fff"/>
      <rect x="5" y="10" width="14" height="2.5" rx="1" fill="white" opacity="0.7"/>
      <rect x="6" y="18" width="12" height="2" rx="1" fill="white" opacity="0.7"/>
    </svg>
  );
}

function CheckeredFlag() {
  const cols = 4;
  const rows = 6;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={c * 8}
          y={r * 8}
          width="8"
          height="8"
          fill={(r + c) % 2 === 0 ? "white" : "black"}
        />
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${cols * 8} ${rows * 8}`} className="w-8 h-12">
      {cells}
    </svg>
  );
}

// Confetti particles for victory
const CONFETTI_COLORS = ["#E8002D", "#FFD700", "#fff", "#00C6FF", "#FF6B00"];
const CONFETTI_COUNT = 18;

function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
        const left = (i / CONFETTI_COUNT) * 100;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const delay = (i * 0.12) % 1.2;
        const dur = 1.0 + (i % 4) * 0.2;
        return (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-sm"
            style={{ left: `${left}%`, top: "-8px", backgroundColor: color }}
            animate={{ y: ["0px", "320px"], rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)], opacity: [1, 0] }}
            transition={{ duration: dur, delay, ease: "easeIn", repeat: Infinity, repeatDelay: 0.3 }}
          />
        );
      })}
    </div>
  );
}

// Race animation: 5s race + 1.5s victory + 0.5s fade = 7s
const RACE_DURATION = 5; // seconds

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState("race"); // race | victory | done
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("victory"), 5000);
    const t2 = setTimeout(() => setVisible(false), 6500);
    const t3 = setTimeout(onDone, 7000);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [onDone]);

  // Car x: goes from off-screen-left to off-screen-right over 5s
  // Car y: swerves at two points to dodge cones
  // Cone 1 is at ~33% track width → car is near it around t=1.5s (30%)
  // Cone 2 is at ~62% track width → car is near it around t=2.9s (58%)
  // Car arrives at finish (~85%) around t=4.5s (90%) and exits right
  const carX = ["-90px", "25%", "28%", "33%", "55%", "59%", "65%", "110%"];
  const carY = [0,        0,    -22,   0,     0,     18,    0,     0    ];
  const carTimes = [0,   0.25, 0.31, 0.38, 0.54,  0.60,  0.68,  1.0  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "linear-gradient(160deg, #0d0d1a 0%, #1a0005 60%, #0d0d1a 100%)" }}
        >
          {/* Title */}
          <motion.p
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-white/80 font-body font-semibold tracking-widest text-sm mb-6"
            style={{ letterSpacing: "0.18em" }}
          >
            www.formula-rossa.it
          </motion.p>

          {/* Track */}
          <div className="relative w-full" style={{ height: 110 }}>

            {/* Asphalt road */}
            <div className="absolute left-0 right-0"
                 style={{ top: 30, height: 60, background: "#1c1c24", borderTop: "2px solid #333", borderBottom: "2px solid #333" }}>
              {/* White dashes on center line */}
              <div className="absolute left-0 right-0" style={{ top: 28, borderTop: "2px dashed rgba(255,255,255,0.15)" }} />
              {/* Red & white kerb strips left edge */}
              <div className="absolute left-0 top-0 right-0 h-2" style={{ background: "repeating-linear-gradient(90deg,#E8002D 0 16px,white 16px 32px)" }} />
              <div className="absolute left-0 bottom-0 right-0 h-2" style={{ background: "repeating-linear-gradient(90deg,white 0 16px,#E8002D 16px 32px)" }} />
            </div>

            {/* Finish line */}
            <motion.div
              className="absolute top-[30px] flex items-stretch"
              style={{ right: "12%", height: 60 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === "race" ? 1 : 0 }}
              transition={{ delay: 2.5, duration: 0.4 }}
            >
              <CheckeredFlag />
            </motion.div>

            {/* Cone 1 — at ~33% */}
            <motion.div
              className="absolute"
              style={{ left: "33%", top: 36 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === "race" ? 1 : 0 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              <Cone className="w-5 h-7" />
            </motion.div>

            {/* Cone 2 — at ~62% */}
            <motion.div
              className="absolute"
              style={{ left: "62%", top: 42 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === "race" ? 1 : 0 }}
              transition={{ delay: 1.2, duration: 0.3 }}
            >
              <Cone className="w-5 h-7" />
            </motion.div>

            {/* F1 Car */}
            {phase === "race" && (
              <motion.div
                className="absolute"
                style={{ top: 44 }}
                initial={{ x: "-90px", y: 0 }}
                animate={{ x: carX, y: carY }}
                transition={{
                  duration: RACE_DURATION,
                  times: carTimes,
                  ease: "linear",
                }}
              >
                {/* Speed lines behind car */}
                <motion.div
                  className="absolute right-full top-1/2 -translate-y-1/2 flex flex-col gap-1 pr-1"
                  animate={{ opacity: [0.6, 0.2, 0.6] }}
                  transition={{ duration: 0.3, repeat: Infinity }}
                >
                  {[14, 8, 12, 6].map((w, i) => (
                    <div key={i} className="h-px bg-white/30 rounded" style={{ width: w }} />
                  ))}
                </motion.div>
                <F1Car className="w-20 h-7" />
              </motion.div>
            )}
          </div>

          {/* Victory section */}
          <AnimatePresence>
            {phase === "victory" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="mt-8 flex flex-col items-center gap-2 relative"
              >
                <Confetti />
                <motion.p
                  className="text-5xl"
                  animate={{ rotate: [-8, 8, -8] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  🏆
                </motion.p>
                <motion.p
                  className="font-heading font-black text-white text-2xl tracking-widest"
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                >
                  VITTORIA!
                </motion.p>
                <p className="text-white/50 font-body text-xs tracking-wider mt-1">formula-rossa.it</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading dots during race */}
          {phase === "race" && (
            <div className="flex gap-1.5 mt-8">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white/30"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
