import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Info, X, Share2, Bookmark, ChevronDown, ChevronUp,
  Trophy, RotateCcw, AlertTriangle, Sparkles, Target, Users
} from "lucide-react";

import { supabase } from "../lib/supabase";

// ─── Costanti F1 2026 ──────────────────────────────────────────────────────
// Regolamento 2026: niente punto giro veloce, max 25 punti a GP, 8 a Sprint
const MAX_RACE_PTS = 25;
const MAX_SPRINT_PTS = 8;
const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const POSITION_LABELS = ["1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°+"];
const POSITION_EMOJI = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "💤"];

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
};

// ─── LOGICA CORRETTA DI CALCOLO ────────────────────────────────────────────

interface Driver {
  id: string;
  position: number;
  driver_name: string;
  driver_code: string;
  team: string;
  points: number;
  victories: number;
}

interface RivalAnalysis {
  driver: Driver;
  maxPossible: number;
  pointsNeeded: number;
  isMathematicallyEliminated: boolean;
}

interface ChampionshipAnalysis {
  driver: Driver;
  racesLeft: number;
  sprintsLeft: number;
  isAlreadyChampion: boolean;
  isMathematicallyOut: boolean;
  mainRival: RivalAnalysis | null;
  allRivals: RivalAnalysis[];
  magicNumber: number; // Punti che il pilota deve ancora fare
}

/**
 * Calcola l'analisi completa del campionato per un pilota
 * 
 * Formula corretta:
 * Per ogni rivale R, calcoliamo i punti massimi che R può ancora ottenere:
 *   R_max_finale = R.points + (racesLeft * 25) + (sprintsLeft * 8)
 * 
 * Il pilota P deve superare TUTTI i rivali.
 * Per superare un rivale specifico, P deve fare almeno:
 *   needed_vs_R = R_max_finale - P.points + 1
 * 
 * Ma attenzione: in caso di PAREGGIO, vince chi ha più vittorie!
 * Quindi se P e R arrivano a pari punti, P vince solo se ha più vittorie.
 * 
 * Il numero magico è il massimo dei needed_vs_R
 */
function calculateChampionshipAnalysis(
  driver: Driver,
  allDrivers: Driver[],
  racesLeft: number,
  sprintsLeft: number
): ChampionshipAnalysis {
  const maxRemainingPoints = racesLeft * MAX_RACE_PTS + sprintsLeft * MAX_SPRINT_PTS;
  const driverMaxPossible = driver.points + maxRemainingPoints;

  // Analizza ogni rivale
  const rivalsAnalysis: RivalAnalysis[] = allDrivers
    .filter(d => d.id !== driver.id)
    .map(rival => {
      const rivalMaxPossible = rival.points + maxRemainingPoints;
      
      // Punti che il driver deve fare per superare QUESTO rivale
      // Considera anche lo scenario di pareggio
      let pointsNeeded: number;
      
      if (driverMaxPossible <= rival.points) {
        // Già matematicamente dietro (impossibile recuperare)
        pointsNeeded = Infinity;
      } else if (driver.points > rivalMaxPossible) {
        // Già avanti, non serve nulla
        pointsNeeded = 0;
      } else {
        // Calcolo base: serve almeno rivalMaxPossible - driver.points + 1
        pointsNeeded = rivalMaxPossible - driver.points + 1;
        
        // Se il pareggio è possibile, verifica le vittorie
        const possibleTie = (driver.points + pointsNeeded) === rivalMaxPossible;
        if (possibleTie && driver.victories <= rival.victories) {
          // In caso di pareggio, chi ha più vittorie vince
          // Se driver ha meno vittorie, serve 1 punto in più
          pointsNeeded += 1;
        }
      }
      
      const isMathematicallyEliminated = driverMaxPossible < rival.points;
      
      return {
        driver: rival,
        maxPossible: rivalMaxPossible,
        pointsNeeded: Math.max(0, pointsNeeded),
        isMathematicallyEliminated,
      };
    });

  // Filtra rivali che sono già stati battuti matematicamente
  const activeRivals = rivalsAnalysis.filter(r => r.pointsNeeded > 0 && !r.isMathematicallyEliminated);
  
  // Il rivale più pericoloso è quello che richiede più punti
  const mainRival = activeRivals.length > 0
    ? activeRivals.reduce((a, b) => a.pointsNeeded > b.pointsNeeded ? a : b)
    : null;

  const isAlreadyChampion = activeRivals.length === 0 && driverMaxPossible > 0;
  const isMathematicallyOut = driverMaxPossible < Math.max(...allDrivers.map(d => d.points));
  
  // Numero magico: punti che il driver deve ancora fare per essere certo campione
  const magicNumber = mainRival?.pointsNeeded ?? 0;

  return {
    driver,
    racesLeft,
    sprintsLeft,
    isAlreadyChampion,
    isMathematicallyOut,
    mainRival,
    allRivals: rivalsAnalysis,
    magicNumber,
  };
}

/**
 * Trova la combinazione minima di piazzamenti per raggiungere X punti
 */
function findMinimumFinishes(pointsNeeded: number, racesLeft: number): {
  possible: boolean;
  finishes: { position: string; emoji: string; points: number; count: number }[];
  totalPoints: number;
  racesUsed: number;
} {
  if (pointsNeeded <= 0) {
    return { possible: true, finishes: [], totalPoints: 0, racesUsed: 0 };
  }
  if (racesLeft === 0) {
    return { possible: false, finishes: [], totalPoints: 0, racesUsed: 0 };
  }

  let remaining = pointsNeeded;
  let racesUsed = 0;
  const finishes: { position: string; emoji: string; points: number; count: number }[] = [];

  // Greedy: usa i piazzamenti migliori prima
  for (let i = 0; i < RACE_POINTS.length && remaining > 0 && racesUsed < racesLeft; i++) {
    const pts = RACE_POINTS[i];
    if (pts === 0) continue;
    
    // Quante di queste posizioni servono?
    const maxPossible = Math.floor(remaining / pts);
    const count = Math.min(maxPossible, racesLeft - racesUsed);
    
    if (count > 0) {
      finishes.push({
        position: POSITION_LABELS[i],
        emoji: POSITION_EMOJI[i],
        points: pts,
        count,
      });
      remaining -= count * pts;
      racesUsed += count;
    }
  }

  return {
    possible: remaining === 0,
    finishes,
    totalPoints: pointsNeeded - remaining,
    racesUsed,
  };
}

// ─── UI COMPONENTS ─────────────────────────────────────────────────────────

function MagicNumberCard({ analysis, driverColor }: { analysis: ChampionshipAnalysis; driverColor: string }) {
  if (analysis.isAlreadyChampion) {
    return (
      <div className="bg-gradient-to-br from-green-600 to-green-700 text-white rounded-2xl p-6 text-center">
        <Sparkles className="w-12 h-12 mx-auto mb-3 text-yellow-300" />
        <h3 className="font-bold text-2xl">Campione del Mondo!</h3>
        <p className="text-green-100 text-sm mt-2">
          {analysis.driver.driver_name} ha già vinto il campionato matematicamente.
        </p>
      </div>
    );
  }

  if (analysis.isMathematicallyOut) {
    return (
      <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-2xl p-6 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <h3 className="font-bold text-2xl">Matematicamente Fuori</h3>
        <p className="text-gray-300 text-sm mt-2">
          {analysis.driver.driver_name} non può più vincere il campionato.
        </p>
      </div>
    );
  }

  const combo = findMinimumFinishes(analysis.magicNumber, analysis.racesLeft);

  return (
    <div className="bg-gradient-to-br from-red-600 to-red-700 text-white rounded-2xl p-6">
      <div className="text-center mb-4">
        <p className="text-red-100 text-sm uppercase tracking-wider">Numero Magico</p>
        <p className="text-6xl font-black mt-1">{analysis.magicNumber}</p>
        <p className="text-red-100 text-xs mt-1">punti da conquistare</p>
      </div>

      {analysis.mainRival && (
        <div className="bg-white/10 rounded-xl p-3 mb-4">
          <p className="text-xs text-red-100 mb-1">📊 RIVALE PRINCIPALE</p>
          <div className="flex justify-between items-center">
            <span className="font-bold">{analysis.mainRival.driver.driver_name}</span>
            <span className="text-sm font-mono">
              {analysis.mainRival.driver.points} pt → max {analysis.mainRival.maxPossible} pt
            </span>
          </div>
        </div>
      )}

      {combo.possible && combo.finishes.length > 0 && (
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-xs text-red-100 mb-2">🎯 COMBINAZIONE MINIMA</p>
          <div className="flex flex-wrap gap-2">
            {combo.finishes.map((f, i) => (
              <div key={i} className="bg-white/20 rounded-lg px-2 py-1 text-sm">
                {f.emoji} ×{f.count}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-red-100 mt-2">
            * Nei weekend Sprint si possono ottenere +8 punti il sabato
          </p>
        </div>
      )}
    </div>
  );
}

function RivalCard({ rival, driverName, isMain }: { rival: RivalAnalysis; driverName: string; isMain?: boolean }) {
  const borderClass = isMain ? "border-l-4 border-l-red-500" : "";
  
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 ${borderClass}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-gray-900">{rival.driver.driver_name}</p>
          <p className="text-xs text-gray-500">{rival.driver.team}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">{rival.driver.points} pt</p>
          <p className="text-xs text-gray-400">max {rival.maxPossible} pt</p>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-50">
        {rival.pointsNeeded === 0 ? (
          <p className="text-green-600 text-sm font-medium">✓ Già battuto</p>
        ) : (
          <p className="text-sm">
            {driverName} deve fare{" "}
            <span className="font-bold text-red-600">{rival.pointsNeeded} pt</span>{" "}
            per superarlo
          </p>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function ScenariosPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [racesLeft, setRacesLeft] = useState(0);
  const [sprintsLeft, setSprintsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<any[]>([]);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch drivers
        const { data: driversData, error: driversError } = await supabase
          .from("current_season_driver_standings")
          .select("*")
          .order("position_number", { ascending: true });
        
        if (driversError) throw driversError;
        
        // Fetch calendar for remaining races
        const today = new Date().toISOString().slice(0, 10);
        const { data: calendarData, error: calendarError } = await supabase
          .from("race_calendar_with_results")
          .select("*")
          .or("has_results.is.null,has_results.eq.false")
          .gte("date", today)
          .order("date", { ascending: true });
        
        if (calendarError) throw calendarError;
        
        // Process drivers
        const processedDrivers: Driver[] = (driversData || []).map((row: any, idx: number) => ({
          id: row.driver_id ?? String(idx),
          position: row.position_number ?? idx + 1,
          driver_name: row.full_name ?? `${row.driver_first_name || ""} ${row.driver_last_name || ""}`.trim() || `Driver ${idx + 1}`,
          driver_code: row.driver_code || (row.driver_id?.toUpperCase().slice(0, 3) ?? "N/A"),
          team: row.constructor_name ?? row.team_name ?? "Unknown",
          points: Number(row.points ?? 0),
          victories: Number(row.wins ?? row.victories ?? 0),
        }));
        
        setDrivers(processedDrivers);
        
        // Process calendar
        const sprintWeekends = (calendarData || []).filter((r: any) => r.sprint_race_date != null).length;
        setRacesLeft(calendarData?.length ?? 0);
        setSprintsLeft(sprintWeekends);
        
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err.message || "Errore nel caricamento dei dati");
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);
  const analysis = useMemo(() => {
    if (!selectedDriver || racesLeft === 0) return null;
    return calculateChampionshipAnalysis(selectedDriver, drivers, racesLeft, sprintsLeft);
  }, [selectedDriver, drivers, racesLeft, sprintsLeft]);

  const maxPossiblePoints = racesLeft * MAX_RACE_PTS + sprintsLeft * MAX_SPRINT_PTS;

  const handleShare = () => {
    if (!analysis) return;
    
    const text = analysis.isAlreadyChampion
      ? `🏆 ${analysis.driver.driver_name} è già Campione del Mondo F1 2026!`
      : analysis.isMathematicallyOut
      ? `❌ ${analysis.driver.driver_name} è matematicamente fuori dalla corsa al titolo F1 2026`
      : `🎯 ${analysis.driver.driver_name} deve fare ${analysis.magicNumber} punti per vincere il titolo F1 2026\n\nGare rimaste: ${analysis.racesLeft} GP, ${analysis.sprintsLeft} Sprint`;
    
    if (navigator.share) {
      navigator.share({ title: "Analisi Campionato F1 2026", text });
    } else {
      navigator.clipboard.writeText(text);
      alert("Copiato negli appunti!");
    }
  };

  const handleSave = () => {
    if (!analysis) return;
    
    setSavedScenarios(prev => [{
      id: Date.now(),
      date: new Date().toLocaleTimeString(),
      driverName: analysis.driver.driver_name,
      magicNumber: analysis.magicNumber,
      isChampion: analysis.isAlreadyChampion,
      isOut: analysis.isMathematicallyOut,
    }, ...prev].slice(0, 5));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-red-500" />
            <h1 className="font-black text-xl text-gray-900">F1 2026</h1>
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Campioni</span>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 py-5 space-y-5">
        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-red-600 font-medium"
            >
              Riprova ↻
            </button>
          </div>
        )}

        {/* Driver selector */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Pilota
          </label>
          {loading ? (
            <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          ) : (
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full h-12 bg-gray-50 border-0 rounded-xl px-4 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Seleziona un pilota...</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>
                  P{d.position} — {d.driver_name} ({d.points} pt)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Races/Sprints counters */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-sm font-bold text-gray-900">GP rimanenti</p>
              <p className="text-xs text-gray-500">Weekend principali</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRacesLeft(Math.max(0, racesLeft - 1))}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-mono font-bold text-lg">{racesLeft}</span>
              <button
                onClick={() => setRacesLeft(racesLeft + 1)}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-gray-900">Sprint rimanenti</p>
              <p className="text-xs text-gray-500">Gare del sabato</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSprintsLeft(Math.max(0, sprintsLeft - 1))}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-mono font-bold text-lg">{sprintsLeft}</span>
              <button
                onClick={() => setSprintsLeft(sprintsLeft + 1)}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Punti massimi ancora disponibili</p>
              <p className="text-2xl font-black text-gray-900">{maxPossiblePoints}</p>
            </div>
          </div>
        </div>

        {/* Analysis results */}
        {!loading && selectedDriver && analysis && (
          <motion.div
            key={selectedDriverId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <MagicNumberCard analysis={analysis} driverColor={TEAM_COLORS[selectedDriver.team] || "#ccc"} />

            {/* Rivals section */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Rivali
              </h3>
              <div className="space-y-2">
                {analysis.allRivals
                  .sort((a, b) => a.pointsNeeded - b.pointsNeeded)
                  .slice(0, 5)
                  .map(rival => (
                    <RivalCard
                      key={rival.driver.id}
                      rival={rival}
                      driverName={selectedDriver.driver_name}
                      isMain={analysis.mainRival?.driver.id === rival.driver.id}
                    />
                  ))}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-xl font-medium text-gray-700"
              >
                <Share2 className="w-4 h-4" /> Condividi
              </button>
              <button
                onClick={handleSave}
                className="flex items-center justify-center gap-2 py-3 bg-red-50 border border-red-200 rounded-xl font-medium text-red-600"
              >
                <Bookmark className="w-4 h-4" /> Salva
              </button>
            </div>

            {/* Saved scenarios */}
            {savedScenarios.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Ultime simulazioni
                </p>
                <div className="space-y-2">
                  {savedScenarios.map(s => (
                    <div key={s.id} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-900">{s.driverName}</span>
                      <span className="font-mono text-gray-500">
                        {s.isChampion ? "🏆 Campione" : s.isOut ? "❌ Fuori" : `+${s.magicNumber} pt`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {!loading && !selectedDriver && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Seleziona un pilota per iniziare</p>
          </div>
        )}
      </div>

      {/* Info modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-md rounded-t-3xl p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-lg">Come funziona</h3>
                <button onClick={() => setShowInfo(false)} className="w-8 h-8 rounded-full bg-gray-100">
                  <X className="w-4 h-4 mx-auto" />
                </button>
              </div>
              <div className="space-y-4 text-sm text-gray-600">
                <p>
                  <strong className="text-gray-900">Numero Magico</strong> = punti che il pilota deve ancora conquistare
                  per essere certo campione, indipendentemente dai risultati altrui.
                </p>
                <div className="bg-gray-50 p-3 rounded-xl font-mono text-xs">
                  <p className="text-gray-400">// Formula</p>
                  <p>Punti Necessari = (Punti Rivale + MaxRimanenti) − Punti Pilota + 1</p>
                </div>
                <p className="text-xs text-gray-400">
                  * In caso di parità, vince chi ha più vittorie.<br />
                  * Regolamento 2026: niente punto giro veloce.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
