import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Road S-path (shared) ──────────────────────────────────────────────────────
const ROAD_D =
  "M65,278 C65,232 24,222 24,182 C24,140 106,132 106,90 C106,50 65,44 65,6";

// F1 car drawn horizontally, nose pointing +x (rotate="auto" turns it along the path)
function RaceCar({ color = "#E8002D" }) {
  return (
    <g>
      {/* rear wing */}
      <rect x="-15" y="-7" width="3.5" height="14" rx="1.5" fill={color} opacity="0.85" />
      {/* body */}
      <rect x="-12" y="-4.5" width="22" height="9" rx="3.5" fill={color} />
      {/* nose */}
      <path d="M10,-3 L17,0 L10,3 Z" fill={color} opacity="0.9" />
      {/* cockpit */}
      <rect x="-3" y="-3" width="7" height="6" rx="2.5" fill="#1a1a2e" opacity="0.85" />
      {/* front wing */}
      <rect x="12" y="-6" width="4" height="12" rx="1.5" fill={color} opacity="0.7" />
      {/* wheels */}
      <rect x="-9" y="-8.5" width="6" height="3.5" rx="1.5" fill="#222" />
      <rect x="-9" y="5"    width="6" height="3.5" rx="1.5" fill="#222" />
      <rect x="4"  y="-8.5" width="6" height="3.5" rx="1.5" fill="#222" />
      <rect x="4"  y="5"    width="6" height="3.5" rx="1.5" fill="#222" />
    </g>
  );
}

// A car following the S-path via SMIL animateMotion
function PathCar({ color, dur, keyPoints, lateral = 0, delay = 0 }) {
  return (
    <g opacity="0">
      <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${delay}s`} fill="freeze" />
      <animateMotion
        dur={`${dur}s`}
        begin={`${delay}s`}
        fill="freeze"
        rotate="auto"
        calcMode="linear"
        keyPoints={keyPoints}
        keyTimes="0;1"
      >
        <mpath href="#roadPath" xlinkHref="#roadPath" />
      </animateMotion>
      <g transform={`translate(0, ${lateral})`}>
        <RaceCar color={color} />
      </g>
    </g>
  );
}

// ── Final logo — F1 app icon ──────────────────────────────────────────────────
function F1Icon({ size = 104 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <defs>
        <linearGradient id="f1grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E8002D" />
          <stop offset="1" stopColor="#b0001e" />
        </linearGradient>
        <clipPath id="f1round">
          <rect x="0" y="0" width="512" height="512" rx="112" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="512" height="512" rx="112" fill="url(#f1grad)" />
      {/* white grid lines */}
      <g clipPath="url(#f1round)" stroke="white" strokeWidth="10" opacity="0.9">
        <line x1="171" y1="70" x2="171" y2="442" />
        <line x1="341" y1="70" x2="341" y2="442" />
        <line x1="70" y1="171" x2="442" y2="171" />
        <line x1="70" y1="341" x2="442" y2="341" />
      </g>
      {/* "F1" */}
      <text x="256" y="258" textAnchor="middle" dominantBaseline="central"
            fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900"
            fontSize="210" fill="white" letterSpacing="-6">F1</text>
    </svg>
  );
}

function FinalLogo() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-[26px] shadow-2xl overflow-hidden">
        <F1Icon size={104} />
      </div>
      <p className="font-heading font-black text-foreground text-2xl tracking-widest">GridUP</p>
      <p className="text-muted-foreground font-body text-xs tracking-[0.2em]">www.formula-rossa.it</p>
    </div>
  );
}

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState("race"); // race | logo

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("logo"), 5200);
    const t2 = setTimeout(onDone, 7000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[9999] mx-auto w-full max-w-[430px] overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100"
      >
        {/* ── FULL-SCREEN S-TRACK ── */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 130 284"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <path id="roadPath" d={ROAD_D} />
          </defs>

          {/* Guardrail posts (peek out as ticks on both edges) */}
          <use href="#roadPath" xlinkHref="#roadPath"
               fill="none" stroke="#6f7887" strokeWidth="54"
               strokeDasharray="2.5 11" strokeLinecap="butt" opacity="0.65" />
          {/* Guardrail rail band */}
          <use href="#roadPath" xlinkHref="#roadPath"
               fill="none" stroke="#aab2c0" strokeWidth="48" strokeLinecap="round" />
          {/* Road surface */}
          <use href="#roadPath" xlinkHref="#roadPath"
               fill="none" stroke="#eaeaf0" strokeWidth="40" strokeLinecap="round" />
          {/* Scrolling centre line */}
          <path d={ROAD_D} fill="none" stroke="#ffffff" strokeWidth="2.6"
                strokeDasharray="12 16" strokeLinecap="round" opacity="0.9">
            <animate attributeName="stroke-dashoffset" from="28" to="0"
                     dur="0.5s" repeatCount="indefinite" />
          </path>

          {/* Finish line — fixed near top */}
          <g transform="translate(45,12)">
            {Array.from({ length: 20 }).map((_, i) => {
              const col = i % 10, row = Math.floor(i / 10);
              return (
                <rect key={i} x={col * 4} y={row * 6} width="4" height="6"
                      fill={(col + row) % 2 === 0 ? "#111" : "#fff"} />
              );
            })}
          </g>

          {/* Opponents — slower, offset to the sides */}
          <PathCar color="#5577bb" dur={5}   keyPoints="0.40;0.80" lateral={9} />
          <PathCar color="#448844" dur={5}   keyPoints="0.55;0.94" lateral={-9} />
          <PathCar color="#9aa0aa" dur={5}   keyPoints="0.66;1.00" lateral={9} />

          {/* Player — fast, full path bottom → top */}
          {phase === "race" && (
            <PathCar color="#E8002D" dur={5.2} keyPoints="0;1" lateral={0} />
          )}
        </svg>

        {/* ── FINAL LOGO ── */}
        <AnimatePresence>
          {phase === "logo" && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45 }}
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 18 }}
              >
                <FinalLogo />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
