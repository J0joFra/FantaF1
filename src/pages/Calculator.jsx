import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator as CalcIcon, Loader2, Info, X,
  Share2, Bookmark, ChevronUp, ChevronDown, ChevronRight,
  LayoutDashboard, Trophy, Sliders, Settings, RotateCcw, Check, Sparkles
} from "lucide-react";


// Configurazione ufficiale dei colori dei team per la stagione 2026 (Nuovo regolamento e debutto Audi/Cadillac)
const TEAM_COLORS = {
  "Mercedes": "#27F4D2",
  "Red Bull Racing": "#3671C6",
  "Ferrari": "#E8002D",
  "McLaren": "#FF8000",
  "Aston Martin": "#358C75",
  "Alpine": "#FF87BC",
  "Williams": "#64C4FF",
  "Racing Bulls": "#6692FF",
  "Haas F1 Team": "#B6BABD",
  "Audi": "#F50537",
  "Cadillac": "#FFD700"
};

// Griglia Piloti 2026 ufficiale aggiornata con i reali partecipanti della stagione
const DRIVERS_2026_MOCK = [
  { id: "rus", position: 1, driver_name: "George Russell", driver_code: "RUS", team: "Mercedes", points: 285, victories: 6 },
  { id: "lec", position: 2, driver_name: "Charles Leclerc", driver_code: "LEC", team: "Ferrari", points: 272, victories: 5 },
  { id: "ver", position: 3, driver_name: "Max Verstappen", driver_code: "VER", team: "Red Bull Racing", points: 268, victories: 5 },
  { id: "nor", position: 4, driver_name: "Lando Norris", driver_code: "NOR", team: "McLaren", points: 254, victories: 3 },
  { id: "ham", position: 5, driver_name: "Lewis Hamilton", driver_code: "HAM", team: "Ferrari", points: 220, victories: 2 },
  { id: "ant", position: 6, driver_name: "Kimi Antonelli", driver_code: "ANT", team: "Mercedes", points: 195, victories: 1 },
  { id: "sai", position: 7, driver_name: "Carlos Sainz", driver_code: "SAI", team: "Williams", points: 142, victories: 1 },
  { id: "pia", position: 8, driver_name: "Oscar Piastri", driver_code: "PIA", team: "McLaren", points: 138, victories: 1 },
  { id: "alo", position: 9, driver_name: "Fernando Alonso", driver_code: "ALO", team: "Aston Martin", points: 98, victories: 0 },
  { id: "gas", position: 10, driver_name: "Pierre Gasly", driver_code: "GAS", team: "Alpine", points: 74, victories: 0 },
  { id: "bea", position: 11, driver_name: "Oliver Bearman", driver_code: "BEA", team: "Haas F1 Team", points: 58, victories: 0 },
  { id: "bor", position: 12, driver_name: "Gabriel Bortoleto", driver_code: "BOR", team: "Audi", points: 42, victories: 0 },
  { id: "ocn", position: 13, driver_name: "Esteban Ocon", driver_code: "OCN", team: "Haas F1 Team", points: 38, victories: 0 },
  { id: "alb", position: 14, driver_name: "Alexander Albon", driver_code: "ALB", team: "Williams", points: 35, victories: 0 },
  { id: "law", position: 15, driver_name: "Liam Lawson", driver_code: "LAW", team: "Racing Bulls", points: 28, victories: 0 },
  { id: "per", position: 16, driver_name: "Sergio Perez", driver_code: "PER", team: "Cadillac", points: 25, victories: 0 },
  { id: "had", position: 17, driver_name: "Isack Hadjar", driver_code: "HAD", team: "Red Bull Racing", points: 22, victories: 0 },
  { id: "str", position: 18, driver_name: "Lance Stroll", driver_code: "STR", team: "Aston Martin", points: 18, victories: 0 },
  { id: "col", position: 19, driver_name: "Franco Colapinto", driver_code: "COL", team: "Alpine", points: 12, victories: 0 },
  { id: "lin", position: 20, driver_name: "Arvid Lindblad", driver_code: "LIN", team: "Racing Bulls", points: 10, victories: 0 },
  { id: "bot", position: 21, driver_name: "Valtteri Bottas", driver_code: "BOT", team: "Cadillac", points: 6, victories: 0 },
  { id: "hul", position: 22, driver_name: "Nico Hulkenberg", driver_code: "HUL", team: "Audi", points: 4, victories: 0 }
];

// Calendario gare rimanenti per simulare la corsa iridata nel finale di stagione
const CALENDAR_2026_MOCK = [
  { id: "imola", name: "Imola", flag: "🇮🇹", date: "19 Mag", points: 25 },
  { id: "monaco", name: "Monaco", flag: "🇲🇨", date: "26 Mag", points: 25 },
  { id: "canada", name: "Canada", flag: "🇨🇦", date: "9 Giu", points: 25 },
  { id: "spagna", name: "Spagna", flag: "🇪🇸", date: "23 Giu", points: 25 },
  { id: "austria", name: "Austria", flag: "🇦🇹", date: "30 Giu", points: 34 }
];

// Costanti di punteggio F1 (Giro veloce abolito a partire dal 2025/2026)
const MAX_POINTS_RACE = 25;
const MAX_POINTS_SPRINT = 8;
const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0];

const FINISH_LABELS = ["1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°+"];
const FINISH_EMOJI = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "💤"];

// Funzione helper per ottenere il colore del team
function getTeamColor(teamName) {
  return TEAM_COLORS[teamName] || "#B6BABD";
}


/**
 * Calcola se un pilota ha già vinto matematicamente, è escluso o quanti punti servono.
 */
function clinchAnalysis(selectedDriver, allDrivers, racesLeft, sprintsLeft) {
  if (!selectedDriver) return null;

  const maxPointsAvailable = (racesLeft * MAX_POINTS_RACE) + (sprintsLeft * MAX_POINTS_SPRINT);
  const driverMaxPoints = selectedDriver.points + maxPointsAvailable;

  // Trova il punteggio massimo attuale tra tutti i piloti
  const highestCurrentPoints = Math.max(...allDrivers.map(d => d.points));

  // Un pilota è escluso se non può superare nemmeno i punti attuali del leader
  const mathematicallyOut = driverMaxPoints < highestCurrentPoints;

  const allRivals = allDrivers
    .filter(d => d.id !== selectedDriver.id)
    .map(rival => {
      // Massimo teorico che il rivale può raggiungere
      const rivalMax = rival.points + (racesLeft * MAX_POINTS_RACE) + (sprintsLeft * MAX_POINTS_SPRINT);
      // Punti necessari per superare questo specifico rivale
      const needed = Math.max(0, rivalMax - selectedDriver.points + 1);
      return {
        rival,
        rivalMax,
        needed,
        done: selectedDriver.points > rivalMax
      };
    });

  // Il rivale più pericoloso è quello che richiede più punti per essere battuto
  const activeRivals = allRivals.filter(r => r.needed > 0);
  let hardest = null;
  if (activeRivals.length > 0) {
    hardest = activeRivals.reduce((prev, current) => (prev.needed > current.needed) ? prev : current);
  }

  const alreadyClinched = allRivals.every(r => r.done);

  return {
    alreadyClinched,
    mathematicallyOut,
    hardest: hardest || { rival: allDrivers[0], needed: 0, rivalMax: allDrivers[0].points },
    allRivals
  };
}

/**
 * Calcola la combinazione ottimale di risultati per raccogliere i punti richiesti.
 */
function finishCombo(needed, racesLeft) {
  if (needed <= 0) return { label: "Già clinchato ✓", rows: [], total: 0 };
  if (racesLeft <= 0) return { label: "Impossibile — gare esaurite", rows: [], total: 0, impossible: true };

  let remaining = needed;
  let racesUsed = 0;
  const rows = [];

  for (let pi = 0; pi < RACE_POINTS.length && remaining > 0 && racesUsed < racesLeft; pi++) {
    const pts = RACE_POINTS[pi];
    if (pts === 0) continue;
    const count = Math.min(Math.ceil(remaining / pts), racesLeft - racesUsed);
    if (count <= 0) continue;
    const earned = count * pts;
    rows.push({ pos: pi + 1, label: FINISH_LABELS[pi], emoji: FINISH_EMOJI[pi], count, pts, earned });
    remaining -= earned;
    racesUsed += count;
    if (remaining <= 0) break;
  }

  const total = rows.reduce((s, r) => s + r.earned, 0);
  const impossible = total < needed;

  return {
    rows,
    total,
    impossible,
    label: impossible
      ? "Impossibile matematicamente"
      : rows.map(r => `${r.count}×${r.label}`).join(" + ")
  };
}

/**
 * Genera la griglia di simulazione "se finisce sempre in posizione X".
 */
function buildGrid(driverPts, rivalPts, racesLeft, sprintsLeft) {
  const grid = [];
  for (let pi = 0; pi <= 10; pi++) {
    const ptsPerRace = RACE_POINTS[pi] ?? 0;
    const ptsPerSprint = SPRINT_POINTS[pi] ?? 0;
    const driverTotal = driverPts + (racesLeft * ptsPerRace) + (sprintsLeft * ptsPerSprint);
    const rivalTotal = rivalPts + (racesLeft * MAX_POINTS_RACE) + (sprintsLeft * MAX_POINTS_SPRINT);
    grid.push({
      pos: pi + 1,
      label: FINISH_LABELS[pi],
      emoji: FINISH_EMOJI[pi],
      driverTotal,
      rivalTotal,
      driverWins: driverTotal > rivalTotal,
    });
  }
  return grid;
}


function ArcGauge({ current, target, maxPossible }) {
  const percentage = Math.min(100, Math.max(0, (current / (target || 1)) * 100));
  const radius = 70;
  const circumference = Math.PI * radius; // Semicerchio
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center pt-2">
      <svg viewBox="0 0 160 100" className="w-48 h-28">
        {/* Sfondo arco */}
        <path
          d="M 10 90 A 70 70 0 0 1 150 90"
          fill="none"
          stroke="#1F2937"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Progresso attivo */}
        <path
          d="M 10 90 A 70 70 0 0 1 150 90"
          fill="none"
          stroke="#E8002D"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      
      {/* Testo centrale e valori */}
      <div className="absolute top-12 text-center">
        <span className="text-3xl font-black tracking-tighter text-white font-heading">{target || current}</span>
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Punti Target</p>
      </div>

      <div className="flex justify-between w-full px-8 -mt-2 text-[10px] text-gray-400 font-mono">
        <span className="flex flex-col items-center">
          <span className="font-bold text-white">{current}</span>
          <span>ATTUALI</span>
        </span>
        <span className="flex flex-col items-center">
          <span className="font-bold text-white">{maxPossible}</span>
          <span>POSSIBILI</span>
        </span>
      </div>
    </div>
  );
}

function InfoModal({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md px-4 pb-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", damping: 25 }}
        className="w-full max-w-lg bg-white rounded-[28px] p-6 shadow-2xl border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-black text-xl uppercase tracking-wide text-gray-900">Logica di Calcolo</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-black">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4 text-sm text-gray-600">
          <div className="bg-gray-50 rounded-2xl p-4 font-mono text-xs space-y-2 border border-gray-100">
            <p className="text-gray-400">// Peggior scenario possibile per il pilota</p>
            <p><span className="text-red-500 font-bold">Max Rivale</span> = Punti + (Gare × 25) + (Sprint × 8)</p>
            <p><span className="text-red-500 font-bold">Punti Necessari</span> = Max Rivale − Punti Pilota + 1</p>
          </div>
          <p>Il punto addizionale per il giro veloce è stato <b className="text-black">abolito dal regolamento 2025/2026</b>. Il punteggio massimo per weekend di gara standard è di <b className="text-black">25 punti</b>.</p>
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200/60">
            <p className="text-amber-700 font-heading font-black text-[11px] uppercase tracking-widest mb-1">⚠ Criterio di Parità</p>
            <p className="text-xs text-amber-900">In caso di perfetto pareggio di punti a fine stagione, il titolo mondiale viene assegnato al pilota con il maggior numero di vittorie nei Gran Premi.</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stepper({ value, onChange, min = 0 }) {
  return (
    <div className="flex items-center bg-gray-100/80 rounded-2xl p-1 border border-gray-200/30">
      <button onClick={() => onChange(Math.max(min, value - 1))}
        className="w-9 h-9 rounded-xl bg-white flex items-center justify-center
                   text-gray-600 shadow-sm hover:text-black transition-all active:scale-95">
        <ChevronDown className="w-4 h-4" />
      </button>
      <span className="font-mono font-black text-lg w-12 text-center tabular-nums text-gray-900 select-none">{value}</span>
      <button onClick={() => onChange(value + 1)}
        className="w-9 h-9 rounded-xl bg-white flex items-center justify-center
                   text-gray-600 shadow-sm hover:text-black transition-all active:scale-95">
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  );
}


function FinishBreakdown({ needed, racesLeft, driverColor }) {
  const combo = finishCombo(needed, racesLeft);
  return (
    <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-50 bg-gray-50/50">
        <span className="font-heading font-black text-[11px] uppercase tracking-widest text-gray-400">
          Combinazione minima di risultati
        </span>
      </div>
      <div className="p-5">
        {combo.impossible ? (
          <p className="font-heading font-bold text-red-600 text-sm">
            Impossibile raccogliere {needed} punti in {racesLeft} gare rimaste.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {combo.rows.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between"
                >
                  <div className="w-16 shrink-0 flex items-center gap-2">
                    <span className="text-base">{r.emoji}</span>
                    <span className="font-heading font-black text-sm text-gray-900">{r.label}</span>
                  </div>
                  
                  <div className="flex-1 flex items-center px-4">
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(r.count, 6) }).map((_, j) => (
                        <div key={j}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-sm"
                          style={{ backgroundColor: driverColor }}
                        >
                          {r.pts}
                        </div>
                      ))}
                      {r.count > 6 && (
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold bg-gray-100 text-gray-500 border border-gray-200">
                          +{r.count - 6}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="font-mono font-black text-sm tabular-nums" style={{ color: driverColor }}>
                    +{r.earned} PTI
                  </span>
                </motion.div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="font-heading font-bold text-[11px] text-gray-400 uppercase tracking-wider truncate max-w-[70%]">
                {combo.rows.map(r => `${r.count}× ${r.label}`).join(" + ")}
              </span>
              <span className="font-mono font-black text-base" style={{ color: driverColor }}>
                Totale: +{combo.total} pti
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RivalsTable({ allRivals, racesLeft, sprintsLeft, onSelectRival, selectedRivalId }) {
  if (!allRivals?.length) return null;
  const sorted = [...allRivals].sort((a, b) => b.needed - a.needed);

  return (
    <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-gray-50 bg-gray-50/50">
        <span className="font-heading font-black text-[11px] uppercase tracking-widest text-gray-400">
          Tutti i rivali · Tocca per espandere
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {sorted.map((r, i) => {
          const done        = r.needed <= 0;
          const rivalColor  = getTeamColor(r.rival.team);
          const isSelected  = r.rival.id === selectedRivalId;

          return (
            <div key={r.rival.id}>
              <button
                onClick={() => onSelectRival(isSelected ? null : r.rival.id)}
                className={`w-full flex items-center justify-between px-5 py-4 transition-all
                  ${done ? "opacity-40" : ""} ${isSelected ? "bg-gray-50/80" : "hover:bg-gray-50/40"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1.5 h-7 rounded-full shrink-0" style={{ backgroundColor: rivalColor }} />
                  <div className="text-left">
                    <p className={`font-heading font-bold text-sm text-gray-900 truncate ${done ? "line-through" : ""}`}>
                      {r.rival.driver_name}
                    </p>
                    <p className="font-mono text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
                      {r.rival.team} · {r.rival.points} pti
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-mono font-black text-sm text-gray-950">
                      {done ? "✓" : `+${r.needed}`}
                    </p>
                    <p className="font-heading text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      {done ? "Escluso" : "Richiesti"}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform text-gray-300 ${isSelected ? "rotate-90 text-gray-600" : ""}`} />
                </div>
              </button>

              <AnimatePresence>
                {isSelected && !done && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-gray-50/50 border-t border-gray-100"
                  >
                    <div className="p-4 space-y-4">
                      <div>
                        <p className="font-heading font-black text-[10px] text-gray-400 uppercase tracking-widest mb-2">
                          Se finisce sempre in posizione...
                        </p>
                        <div className="grid grid-cols-5 gap-1.5">
                          {buildGrid(r.needed, r.rival.points, racesLeft, sprintsLeft).slice(0, 5).map((row) => (
                            <div key={row.pos} className={`rounded-xl p-2 text-center border bg-white ${row.driverWins ? "border-green-200 bg-green-50/30" : "border-gray-100"}`}>
                              <p className="text-sm">{row.emoji}</p>
                              <p className={`font-mono font-black text-[11px] mt-1 ${row.driverWins ? "text-green-600" : "text-gray-400"}`}>
                                {row.driverWins ? "WIN" : "OUT"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export default function ScenariosPage() {
  const [showInfo, setShowInfo] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [racesLeft, setRacesLeft] = useState(4); // Default per simulazione finale di stagione
  const [sprintsLeft, setSprintsLeft] = useState(1);
  const [selectedRivalId, setSelectedRivalId] = useState(null);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [alertMsg, setAlertMsg] = useState("");

  const drivers = DRIVERS_2026_MOCK;
  const liveRaces = 5;
  const liveSprints = 1;

  const effRaces = racesLeft;
  const effSprints = sprintsLeft;

  const maxPointsAvailable = (effRaces * MAX_POINTS_RACE) + (effSprints * MAX_POINTS_SPRINT);

  const driver = driverId ? drivers.find(d => d.id === driverId) : null;
  const driverColor = driver ? getTeamColor(driver.team) : "#E8002D";
  const analysis = driver ? clinchAnalysis(driver, drivers, effRaces, effSprints) : null;

  const shareText = analysis && driver
    ? [
        `🏎 FantaF1 — ${driver.driver_name} (${driver.points} pts)`,
        analysis.alreadyClinched
          ? "🏆 Campione matematico!"
          : analysis.mathematicallyOut
          ? "❌ Eliminato matematicamente"
          : `Servono +${analysis.hardest.needed} pts per battere ${analysis.hardest.rival.driver_name}`,
        `Gare rimaste: ${effRaces} | Sprint: ${effSprints}`,
      ].join("\n")
    : "";

  const triggerAlert = (msg) => {
    setAlertMsg(msg);
    setTimeout(() => {
      setAlertMsg("");
    }, 3000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "Scenario FantaF1 2026", text: shareText })
        .catch(() => triggerAlert("Errore durante la condivisione"));
    } else {
      navigator.clipboard.writeText(shareText);
      triggerAlert("Copiato negli appunti! 📋");
    }
  };

  const handleSave = () => {
    const newScenario = {
      id: Date.now(),
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      driverName: driver.driver_name,
      pointsNeeded: analysis.alreadyClinched ? 0 : analysis.hardest.needed,
      clinched: analysis.alreadyClinched,
      out: analysis.mathematicallyOut
    };
    setSavedScenarios([newScenario, ...savedScenarios].slice(0, 5));
    triggerAlert("Scenario salvato localmente! 💾");
  };

  const handleResetLive = () => {
    setRacesLeft(liveRaces);
    setSprintsLeft(liveSprints);
    triggerAlert("Valori live ripristinati! 🔄");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-gray-900 font-sans pb-32">
      {/* Alert Banner */}
      <AnimatePresence>
        {alertMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-[#0D1520] text-white px-5 py-3 rounded-full text-xs font-heading font-black uppercase tracking-wider shadow-xl border border-white/10"
          >
            {alertMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar Header */}
      <div className="w-full max-w-md mx-auto px-5 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-red-500 font-heading font-black text-2xl tracking-tight">F1 </span>
          <span className="text-gray-950 font-heading font-black text-2xl tracking-tight">CHAMP POINTS</span>
        </div>
        <button onClick={() => setShowInfo(true)} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500">
          <Info className="w-5 h-5" />
        </button>
      </div>

      <div className="w-full max-w-md mx-auto px-5 mt-6 space-y-5">
        {/* Titolo e Auto 2026 Vettoriale Premium */}
        <div className="relative bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 overflow-hidden flex items-center justify-between">
          <div className="z-10 max-w-[50%]">
            <span className="text-[10px] font-heading font-black text-red-500 tracking-widest uppercase">Stagione 2026</span>
            <h2 className="text-lg font-heading font-black text-gray-900 leading-tight mt-1">Calcola la corsa al titolo F1</h2>
            <p className="text-[10px] text-gray-400 mt-1">Simula i piazzamenti con i nuovi regolamenti.</p>
          </div>
          
          {/* F1 Car Illustration SVG */}
          <div className="absolute right-0 bottom-2 w-44 opacity-90">
            <svg viewBox="0 0 200 100" fill="none" className="w-full h-auto">
              {/* Pneumatici posteriori */}
              <rect x="140" y="20" width="30" height="50" rx="6" fill="#111" />
              <rect x="143" y="25" width="6" height="40" fill="#333" />
              {/* Pneumatici anteriori */}
              <rect x="30" y="25" width="22" height="40" rx="4" fill="#111" />
              <rect x="32" y="29" width="4" height="32" fill="#333" />
              {/* Corpo vettura principale */}
              <path d="M 40 45 L 145 40 L 155 45 L 150 55 L 40 50 Z" fill="#222" />
              <path d="M 80 43 L 130 41 L 135 45 L 80 47 Z" fill="#E8002D" /> {/* Striature Ferrari Red */}
              {/* Ala Posteriore */}
              <path d="M 155 25 L 170 25 L 165 65 L 155 65 Z" fill="#111" />
              <rect x="148" y="30" width="22" height="5" fill="#E8002D" />
              {/* Ala Anteriore */}
              <path d="M 15 42 L 35 43 L 35 48 L 15 49 Z" fill="#111" />
              <rect x="10" y="44" width="25" height="3" fill="#E8002D" />
              {/* Abitacolo & Halo */}
              <ellipse cx="95" cy="44" rx="12" ry="5" fill="#fff" opacity="0.3" />
              <path d="M 88 44 C 92 38, 102 38, 106 44" stroke="#111" strokeWidth="3" fill="none" />
            </svg>
          </div>
        </div>

        {/* Selezione Pilota */}
        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
          <p className="font-heading font-black text-[10px] uppercase tracking-widest text-gray-400 mb-2.5">
            Pilota da analizzare
          </p>
          <div className="relative">
            <select
              value={driverId}
              onChange={e => { setDriverId(e.target.value); setSelectedRivalId(null); }}
              className="w-full font-heading font-bold h-12 rounded-2xl bg-gray-50 border-0 px-4 text-gray-900 shadow-inner appearance-none outline-none cursor-pointer"
            >
              <option value="">Seleziona un pilota...</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>
                  P{d.position} · {d.driver_name} ({d.team})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Dashboard dei Contatori */}
        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-heading font-black text-sm text-gray-900">Gare rimanenti</p>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5">GP Principali a calendario</p>
            </div>
            <Stepper value={effRaces} onChange={setRacesLeft} min={0} />
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-50">
            <div>
              <p className="font-heading font-black text-sm text-gray-900">Sprint rimanenti</p>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5">Gare Sprint (Sabato)</p>
            </div>
            <Stepper value={effSprints} onChange={setSprintsLeft} min={0} />
          </div>
          
          <div className="flex items-center gap-3 pt-2">
            <div className="bg-[#0D1520] text-white rounded-2xl p-4 flex-1 flex items-center justify-between shadow-md">
              <span className="font-heading font-bold text-[10px] tracking-widest uppercase text-gray-400">Punti Max Rimanenti</span>
              <span className="font-mono font-black text-lg text-red-500">{maxPointsAvailable} <span className="text-[10px] text-white">PTI</span></span>
            </div>
            
            {(racesLeft !== liveRaces || sprintsLeft !== liveSprints) && (
              <button 
                onClick={handleResetLive}
                className="w-14 h-14 bg-red-50 hover:bg-red-100/90 text-red-600 rounded-2xl flex items-center justify-center shadow-sm border border-red-100 transition-colors shrink-0"
                title="Ripristina valori live"
              >
                <RotateCcw className="w-5 h-5 animate-spin-reverse" />
              </button>
            )}
          </div>
        </div>

        {/* VERDICT CARD STILE HIGH-CONTRAST SPROUT SCREENSHOT */}
        <AnimatePresence mode="wait">
          {analysis && driver ? (
            <motion.div
              key={`${driverId}-${effRaces}-${effSprints}`}
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Box Scuro Principale */}
              <div className="bg-[#0D1520] text-white rounded-[28px] p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex items-center justify-between mb-2">
                  <span className="font-heading font-black text-[10px] uppercase tracking-widest text-gray-400">
                    Punti necessari per vincere
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400">
                    <Trophy className="w-4 h-4" />
                  </div>
                </div>

                {analysis.alreadyClinched ? (
                  <div className="text-center py-4">
                    <Sparkles className="w-8 h-8 text-yellow-400 mx-auto mb-2 animate-bounce" />
                    <p className="font-heading font-black text-2xl text-green-400 leading-tight">
                      {driver.driver_name} è già Campione del Mondo! 🏆
                    </p>
                  </div>
                ) : analysis.mathematicallyOut ? (
                  <div className="py-2">
                    <p className="font-heading font-black text-xl text-red-500 leading-tight">
                      Matematicamente Fuori dai Giochi
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-2 leading-relaxed">
                      Il distacco da {analysis.hardest?.rival.driver_name || "leader"} è incolmabile con {maxPointsAvailable} punti disponibili.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                      <p className="text-xs text-gray-300 leading-relaxed font-heading uppercase tracking-wider">
                        {driver.driver_name} si assicura il titolo se ottiene almeno:
                      </p>
                      
                      <div className="flex items-baseline gap-2 mt-3">
                        <span className="text-5xl font-heading font-black text-white tracking-tighter">
                          {analysis.hardest.needed}
                        </span>
                        <span className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest">Punti</span>
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-1 text-[11px] text-gray-400">
                        <div>
                          RIVALE DI RIFERIMENTO:
                        </div>
                        <span className="font-heading font-bold text-white uppercase tracking-wider" style={{ color: getTeamColor(analysis.hardest.rival.team) }}>
                          {analysis.hardest.rival.driver_name}
                        </span>
                      </div>
                    </div>

                    {/* Dynamic Gauge Arc Component */}
                    <div className="flex justify-center border-l border-white/5 pl-4">
                      <ArcGauge 
                        current={driver.points} 
                        target={driver.points + analysis.hardest.needed} 
                        maxPossible={driver.points + maxPointsAvailable} 
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Combinazioni Minime */}
              {!analysis.alreadyClinched && !analysis.mathematicallyOut && (
                <FinishBreakdown
                  needed={analysis.hardest.needed}
                  racesLeft={effRaces}
                  driverColor={driverColor}
                />
              )}

              {/* Tabella Rivai */}
              <RivalsTable
                allRivals={analysis.allRivals}
                racesLeft={effRaces}
                sprintsLeft={effSprints}
                onSelectRival={setSelectedRivalId}
                selectedRivalId={selectedRivalId}
              />

              {/* Pulsanti Condividi e Salva */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-gray-200 py-3.5 font-heading font-bold text-sm text-gray-700 hover:bg-gray-50 shadow-sm transition-all active:scale-95"
                >
                  <Share2 className="w-4 h-4 text-gray-500" />
                  Condividi
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-red-50 border border-red-100 py-3.5 font-heading font-bold text-sm text-red-600 hover:bg-red-100/60 shadow-sm transition-all active:scale-95"
                >
                  <Bookmark className="w-4 h-4 text-red-500" />
                  Salva
                </button>
              </div>

              {/* Saved Scenarios Feed */}
              {savedScenarios.length > 0 && (
                <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
                  <p className="font-heading font-black text-[10px] uppercase tracking-widest text-gray-400 mb-3">Simulazioni salvate di recente</p>
                  <div className="space-y-2">
                    {savedScenarios.map((sc, idx) => (
                      <div key={sc.id} className="flex justify-between items-center text-xs border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                        <span className="font-heading font-bold text-gray-800">{sc.driverName}</span>
                        <div className="flex items-center gap-2">
                          {sc.clinched ? (
                            <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded text-[9px]">CLINCHED</span>
                          ) : sc.out ? (
                            <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded text-[9px]">ELIMINATO</span>
                          ) : (
                            <span className="font-mono text-gray-600">+{sc.pointsNeeded} pti</span>
                          )}
                          <span className="text-[10px] text-gray-400">{sc.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-[28px] border border-gray-100 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4 shadow-inner">
                <CalcIcon className="w-8 h-8" />
              </div>
              <h3 className="font-heading font-black text-lg text-gray-900 uppercase tracking-wide">Nessun Pilota Selezionato</h3>
              <p className="text-gray-400 text-sm mt-1 max-w-[280px]">
                Seleziona un pilota sulla griglia per calcolare tutti gli scenari iridati matematici.
              </p>
            </div>
          )}
        </AnimatePresence>

        {/* Calendario Gare Restanti */}
        <div className="space-y-3">
          <span className="font-heading font-black text-[10px] uppercase tracking-widest text-gray-400">Calendario e punti restanti</span>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
            {CALENDAR_2026_MOCK.map((cal, i) => (
              <div 
                key={cal.id} 
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between min-w-[110px] snap-center hover:border-red-500/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{cal.flag}</span>
                  <span className="font-heading font-black text-xs text-gray-900">{cal.name}</span>
                </div>
                <div className="mt-4 text-[11px] text-gray-400 font-mono">{cal.date}</div>
                <div className="mt-1 inline-flex text-[10px] font-mono font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-1.5 py-0.5 justify-center">
                  {cal.points} pti
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation Sticky Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 shadow-lg px-6 py-3 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between text-center">
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors">
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-heading font-bold uppercase tracking-wider">Panoramica</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors">
            <Trophy className="w-5 h-5" />
            <span className="text-[10px] font-heading font-bold uppercase tracking-wider">Classifiche</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-red-500 font-bold transition-colors">
            <Sliders className="w-5 h-5 text-red-500" />
            <span className="text-[10px] font-heading uppercase tracking-wider">Scenari</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors">
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-heading font-bold uppercase tracking-wider">Impostazioni</span>
          </button>
        </div>
      </div>

      {/* Modale d'info */}
      <AnimatePresence>
        {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      </AnimatePresence>
    </div>
  );
}
