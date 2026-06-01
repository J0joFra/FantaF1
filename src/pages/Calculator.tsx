import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Info, X, Share2, Bookmark, ChevronDown, ChevronUp,
  Trophy, RotateCcw, AlertTriangle, Sparkles, Target, Users, CheckCircle2, HelpCircle,
  TrendingUp, Award, BarChart3
} from "lucide-react";

import { supabase } from "../lib/supabase";

// ─── Costanti F1 2026 ──────────────────────────────────────────────────────
const MAX_RACE_PTS = 25;
const MAX_SPRINT_PTS = 8;
const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const POSITION_LABELS = ["1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°+"];
const POSITION_EMOJI = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "💤"];

const TEAM_COLORS: Record<string, string> = {
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
  currentGap: number; // Distanza attuale in punti
  maxPossible: number;
  pointsNeeded: number;
  isMathematicallyEliminated: boolean;
}

interface Combination {
  type: "race" | "sprint";
  positions: { position: string; emoji: string; points: number; count: number }[];
  totalPoints: number;
  racesUsed: number;
  description: string;
}

interface ChampionshipAnalysis {
  driver: Driver;
  racesLeft: number;
  sprintsLeft: number;
  isAlreadyChampion: boolean;
  isMathematicallyOut: boolean;
  mainRival: RivalAnalysis | null;
  allRivals: RivalAnalysis[];
  magicNumber: number;
  combinations: Combination[];
}

function calculateChampionshipAnalysis(
  driver: Driver,
  allDrivers: Driver[],
  racesLeft: number,
  sprintsLeft: number
): ChampionshipAnalysis {
  const maxRemainingPoints = racesLeft * MAX_RACE_PTS + sprintsLeft * MAX_SPRINT_PTS;
  const driverMaxPossible = driver.points + maxRemainingPoints;

  // 🔥 FILTRO: Solo piloti con PIÙ PUNTI o PARI PUNTI
  const rivalsAnalysis: RivalAnalysis[] = allDrivers
    .filter(d => d.id !== driver.id && d.points >= driver.points) // Solo chi è davanti o pari
    .map(rival => {
      const rivalMaxPossible = rival.points + maxRemainingPoints;
      const currentGap = rival.points - driver.points;
      
      let pointsNeeded: number;
      
      if (driverMaxPossible <= rival.points) {
        pointsNeeded = Infinity;
      } else if (driver.points > rivalMaxPossible) {
        pointsNeeded = 0;
      } else {
        pointsNeeded = rivalMaxPossible - driver.points + 1;
        
        const possibleTie = (driver.points + pointsNeeded) === rivalMaxPossible;
        if (possibleTie && driver.victories <= rival.victories) {
          pointsNeeded += 1;
        }
      }
      
      const isMathematicallyEliminated = driverMaxPossible < rival.points;
      
      return {
        driver: rival,
        currentGap,
        maxPossible: rivalMaxPossible,
        pointsNeeded: Math.max(0, pointsNeeded),
        isMathematicallyEliminated,
      };
    })
    .sort((a, b) => a.pointsNeeded - b.pointsNeeded); // Ordina dal più facile al più difficile

  const activeRivals = rivalsAnalysis.filter(r => r.pointsNeeded > 0 && !r.isMathematicallyEliminated);
  
  const mainRival = activeRivals.length > 0
    ? activeRivals.reduce((a, b) => a.pointsNeeded > b.pointsNeeded ? a : b)
    : null;

  const isAlreadyChampion = activeRivals.length === 0 && driverMaxPossible > 0 && driver.points > Math.max(...allDrivers.map(d => d.points));
  const isMathematicallyOut = driverMaxPossible < Math.max(...allDrivers.map(d => d.points));
  
  const magicNumber = mainRival?.pointsNeeded ?? 0;

  // 🔥 Calcola tutte le combinazioni possibili
  const combinations = generateAllCombinations(magicNumber, racesLeft, sprintsLeft);

  return {
    driver,
    racesLeft,
    sprintsLeft,
    isAlreadyChampion,
    isMathematicallyOut,
    mainRival,
    allRivals: rivalsAnalysis,
    magicNumber,
    combinations,
  };
}

// 🔥 GENERA TUTTE LE COMBINAZIONI POSSIBILI
function generateAllCombinations(pointsNeeded: number, racesLeft: number, sprintsLeft: number): Combination[] {
  const combinations: Combination[] = [];

  if (pointsNeeded <= 0) {
    combinations.push({
      type: "race",
      positions: [],
      totalPoints: 0,
      racesUsed: 0,
      description: "✅ Nessun punto necessario - già campione!",
    });
    return combinations;
  }

  // Combinazione 1: Solo GP (massimizza vittorie)
  const onlyRaces = findBestCombination(pointsNeeded, racesLeft, RACE_POINTS, "race");
  if (onlyRaces.possible) {
    combinations.push({
      type: "race",
      positions: onlyRaces.finishes,
      totalPoints: onlyRaces.totalPoints,
      racesUsed: onlyRaces.racesUsed,
      description: onlyRaces.racesUsed === 1 
        ? `Basta ${onlyRaces.racesUsed} GP con questo risultato` 
        : `Combinazione di ${onlyRaces.racesUsed} GP`,
    });
  }

  // Combinazione 2: Solo Sprint
  if (sprintsLeft > 0) {
    const onlySprints = findBestCombination(pointsNeeded, sprintsLeft, SPRINT_POINTS, "sprint");
    if (onlySprints.possible) {
      combinations.push({
        type: "sprint",
        positions: onlySprints.finishes,
        totalPoints: onlySprints.totalPoints,
        racesUsed: onlySprints.racesUsed,
        description: onlySprints.racesUsed === 1 
          ? `Basta ${onlySprints.racesUsed} Sprint` 
          : `Combinazione di ${onlySprints.racesUsed} Sprint`,
      });
    }
  }

  // Combinazione 3: Mista (GP + Sprint) - ottimizzata
  if (sprintsLeft > 0 && racesLeft > 0) {
    const mixed = findMixedCombination(pointsNeeded, racesLeft, sprintsLeft);
    if (mixed.possible) {
      combinations.push({
        type: "race",
        positions: mixed.finishes,
        totalPoints: mixed.totalPoints,
        racesUsed: mixed.racesUsed + mixed.sprintsUsed,
        description: `${mixed.racesUsed} GP + ${mixed.sprintsUsed} Sprint`,
      });
    }
  }

  // Combinazione 4: Scenario più realistico (piazzamenti medi)
  const realistic = findRealisticCombination(pointsNeeded, racesLeft, sprintsLeft);
  if (realistic.possible) {
    combinations.push({
      type: "race",
      positions: realistic.finishes,
      totalPoints: realistic.totalPoints,
      racesUsed: realistic.racesUsed,
      description: "🎯 Scenario realistico (piazzamenti medi)",
    });
  }

  return combinations;
}

function findBestCombination(
  pointsNeeded: number, 
  maxRaces: number, 
  pointsTable: number[], 
  type: "race" | "sprint"
): { possible: boolean; finishes: any[]; totalPoints: number; racesUsed: number } {
  if (pointsNeeded <= 0) {
    return { possible: true, finishes: [], totalPoints: 0, racesUsed: 0 };
  }
  if (maxRaces === 0) {
    return { possible: false, finishes: [], totalPoints: 0, racesUsed: 0 };
  }

  let remaining = pointsNeeded;
  let racesUsed = 0;
  const finishes: { position: string; emoji: string; points: number; count: number }[] = [];

  for (let i = 0; i < pointsTable.length && remaining > 0 && racesUsed < maxRaces; i++) {
    const pts = pointsTable[i];
    if (pts === 0) continue;
    
    const maxPossible = Math.ceil(remaining / pts);
    const count = Math.min(maxPossible, maxRaces - racesUsed);
    
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
    possible: remaining <= 0,
    finishes,
    totalPoints: pointsNeeded - remaining,
    racesUsed,
  };
}

function findMixedCombination(
  pointsNeeded: number,
  racesLeft: number,
  sprintsLeft: number
): { possible: boolean; finishes: any[]; totalPoints: number; racesUsed: number; sprintsUsed: number } {
  let best: any = { possible: false, finishes: [], totalPoints: 0, racesUsed: 0, sprintsUsed: 0 };
  
  // Prova diverse combinazioni di vittorie Sprint + GP
  for (let sprints = 0; sprints <= Math.min(sprintsLeft, 3); sprints++) {
    const sprintPoints = sprints * 8;
    if (sprintPoints > pointsNeeded) continue;
    
    const remaining = pointsNeeded - sprintPoints;
    const racesNeeded = Math.ceil(remaining / MAX_RACE_PTS);
    
    if (racesNeeded <= racesLeft) {
      const raceCombo = findBestCombination(remaining, racesNeeded, RACE_POINTS, "race");
      if (raceCombo.possible) {
        best = {
          possible: true,
          finishes: [
            ...(sprints > 0 ? [{ 
              position: "Sprint", 
              emoji: "⚡", 
              points: 8, 
              count: sprints,
              isSprint: true 
            }] : []),
            ...raceCombo.finishes
          ],
          totalPoints: pointsNeeded,
          racesUsed: raceCombo.racesUsed,
          sprintsUsed: sprints,
        };
        break;
      }
    }
  }
  
  return best;
}

function findRealisticCombination(
  pointsNeeded: number,
  racesLeft: number,
  sprintsLeft: number
): { possible: boolean; finishes: any[]; totalPoints: number; racesUsed: number } {
  // Scenario realistico: piazzamenti tra 4° e 8° posto
  const realisticPoints = [12, 10, 8, 6, 4]; // 4° a 8° posto
  let remaining = pointsNeeded;
  let racesUsed = 0;
  const finishes: any[] = [];
  
  for (let i = 0; i < realisticPoints.length && remaining > 0 && racesUsed < racesLeft; i++) {
    const pts = realisticPoints[i];
    const count = Math.min(Math.ceil(remaining / pts), racesLeft - racesUsed);
    
    if (count > 0) {
      finishes.push({
        position: POSITION_LABELS[i + 3], // +3 perché partiamo dal 4°
        emoji: POSITION_EMOJI[i + 3],
        points: pts,
        count,
      });
      remaining -= count * pts;
      racesUsed += count;
    }
  }
  
  return {
    possible: remaining <= 0,
    finishes,
    totalPoints: pointsNeeded - remaining,
    racesUsed,
  };
}

// ─── UI COMPONENTS ─────────────────────────────────────────────────────────

function MagicNumberCard({ analysis }: { analysis: ChampionshipAnalysis; driverColor: string }) {
  if (analysis.isAlreadyChampion) {
    return (
      <div className="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-2xl p-6 text-center">
        <div className="relative inline-block mb-3">
          <Sparkles className="w-16 h-16 text-yellow-300 animate-pulse" />
          <Trophy className="w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-yellow-400" />
        </div>
        <h3 className="font-bold text-2xl mb-2">Campione del Mondo! 🏆</h3>
        <p className="text-green-100 text-sm">
          {analysis.driver.driver_name} ha già vinto matematicamente il campionato.
        </p>
      </div>
    );
  }

  if (analysis.isMathematicallyOut) {
    return (
      <div className="bg-gradient-to-br from-gray-600 to-gray-800 text-white rounded-2xl p-6 text-center">
        <AlertTriangle className="w-16 h-16 mx-auto mb-3 text-gray-400" />
        <h3 className="font-bold text-2xl mb-2">Matematicamente Fuori ❌</h3>
        <p className="text-gray-300 text-sm">
          {analysis.driver.driver_name} non può più vincere il campionato.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-2xl p-6 shadow-lg">
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 mb-3">
          <Target className="w-4 h-4" />
          <span className="text-xs font-medium">OBIETTIVO</span>
        </div>
        <p className="text-7xl font-black mt-1">{analysis.magicNumber}</p>
        <p className="text-red-100 text-sm mt-2">punti da conquistare per essere campione</p>
      </div>

      {analysis.mainRival && (
        <div className="bg-white/10 rounded-xl p-3 mb-4">
          <p className="text-xs text-red-100 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            RIVALE PIÙ PERICOLOSO
          </p>
          <div className="flex justify-between items-center">
            <div>
              <span className="font-bold text-lg">{analysis.mainRival.driver.driver_name}</span>
              <p className="text-xs text-red-100">{analysis.mainRival.driver.team}</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-mono">{analysis.mainRival.driver.points} pt</span>
              <p className="text-xs text-red-100">distanza: -{analysis.mainRival.currentGap} pt</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RivalCard({ rival, driverName, isMain }: { rival: RivalAnalysis; driverName: string; isMain?: boolean }) {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border ${isMain ? 'border-red-300 bg-red-50/30' : 'border-gray-100'}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-gray-900">{rival.driver.driver_name}</p>
          <p className="text-xs text-gray-500">{rival.driver.team}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">{rival.driver.points} pt</p>
          <p className="text-xs text-gray-400">distanza: -{rival.currentGap} pt</p>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-100">
        {rival.pointsNeeded === 0 ? (
          <p className="text-green-600 text-sm font-medium flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Già superato
          </p>
        ) : rival.isMathematicallyEliminated ? (
          <p className="text-gray-400 text-sm">Non può più raggiungerti</p>
        ) : (
          <p className="text-sm">
            Devi recuperare{" "}
            <span className="font-bold text-red-600 text-lg">{rival.pointsNeeded} pt</span>
          </p>
        )}
      </div>
    </div>
  );
}

function CombinationsCard({ combinations, magicNumber }: { combinations: Combination[]; magicNumber: number }) {
  if (magicNumber <= 0) return null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-red-500" />
        Combinazioni Possibili
      </h3>
      <div className="space-y-3">
        {combinations.slice(0, 3).map((combo, idx) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase">
                {idx === 0 ? "🎯 OTTIMALE" : idx === 1 ? "⚡ ALTERNATIVA" : "📊 REALISTICO"}
              </span>
              <span className="text-xs font-mono text-gray-600">{combo.description}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {combo.positions.map((pos, i) => (
                <div key={i} className="inline-flex items-center gap-1 bg-white rounded-lg px-2 py-1 text-sm border border-gray-200">
                  <span>{pos.emoji}</span>
                  <span className="font-medium">{pos.count}×</span>
                  <span className="text-gray-600">{pos.position}</span>
                  {pos.isSprint && <span className="text-xs text-purple-600 ml-1">(Sprint)</span>}
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Totale: {combo.totalPoints} / {magicNumber} punti
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3 text-center">
        💡 Più vittorie = meno gare necessarie
      </p>
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

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        const { data: driversData, error: driversError } = await supabase
          .from("current_season_driver_standings")
          .select("*")
          .order("position_number", { ascending: true });
        
        if (driversError) throw driversError;
        
        const today = new Date().toISOString().slice(0, 10);
        const { data: calendarData, error: calendarError } = await supabase
          .from("race_calendar_with_results")
          .select("*")
          .or("has_results.is.null,has_results.eq.false")
          .gte("date", today)
          .order("date", { ascending: true });
        
        if (calendarError) throw calendarError;
        
        const processedDrivers: Driver[] = (driversData || []).map((row: any, idx: number) => ({
          id: row.driver_id ?? String(idx),
          position: row.position_number ?? idx + 1,
          driver_name: row.full_name ?? (`${row.driver_first_name || ""} ${row.driver_last_name || ""}`.trim() || `Driver ${idx + 1}`),
          driver_code: row.driver_code ?? (row.driver_id?.toUpperCase().slice(0, 3) ?? "N/A"),
          team: row.constructor_name ?? row.team_name ?? "Unknown",
          points: Number(row.points ?? 0),
          victories: Number(row.wins ?? row.victories ?? 0),
        }));
        
        setDrivers(processedDrivers);
        
        const sprintWeekends = (calendarData || []).filter((r: any) => r.sprint_race_date != null).length;
        setRacesLeft(calendarData?.length ?? 0);
        setSprintsLeft(sprintWeekends);
        
        if (processedDrivers.length > 0) {
          setSelectedDriverId(processedDrivers[0].id);
        }
        
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
    if (!selectedDriver || racesLeft === 0 || drivers.length === 0) return null;
    return calculateChampionshipAnalysis(selectedDriver, drivers, racesLeft, sprintsLeft);
  }, [selectedDriver, drivers, racesLeft, sprintsLeft]);

  const maxPossiblePoints = racesLeft * MAX_RACE_PTS + sprintsLeft * MAX_SPRINT_PTS;
  const leader = drivers.length > 0 ? drivers.reduce((a, b) => a.points > b.points ? a : b) : null;

  const handleShare = () => {
    if (!analysis) return;
    
    const text = analysis.isAlreadyChampion
      ? `🏆 ${analysis.driver.driver_name} è già Campione del Mondo F1 2026! #F1 #Champion`
      : analysis.isMathematicallyOut
      ? `❌ ${analysis.driver.driver_name} è matematicamente fuori dalla corsa al titolo F1 2026 #F1`
      : `🎯 ${analysis.driver.driver_name} deve fare ${analysis.magicNumber} punti per vincere il titolo F1 2026\n\n📊 Gare rimaste: ${analysis.racesLeft} GP, ${analysis.sprintsLeft} Sprint\n#F1 #Championship`;
    
    if (navigator.share) {
      navigator.share({ title: "Analisi Campionato F1 2026", text });
    } else {
      navigator.clipboard.writeText(text);
      alert("📋 Copiato negli appunti!");
    }
  };

  const handleSave = () => {
    if (!analysis) return;
    
    setSavedScenarios(prev => [{
      id: Date.now(),
      date: new Date().toLocaleTimeString(),
      driverName: analysis.driver.driver_name,
      driverTeam: analysis.driver.team,
      magicNumber: analysis.magicNumber,
      isChampion: analysis.isAlreadyChampion,
      isOut: analysis.isMathematicallyOut,
    }, ...prev].slice(0, 5));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento dati F1 2026...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Trophy className="w-7 h-7 text-red-500" />
              <Sparkles className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1" />
            </div>
            <h1 className="font-black text-xl text-gray-900">F1 2026</h1>
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Scenario Campionato</span>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 py-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-red-600 font-medium hover:text-red-700"
            >
              Riprova ↻
            </button>
          </div>
        )}

        {/* Driver selector */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Seleziona Pilota
          </label>
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="w-full h-12 bg-gray-50 border-0 rounded-xl px-4 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
          >
            {drivers.map(d => (
              <option key={d.id} value={d.id}>
                {d.position === 1 ? "👑 " : ""}{d.driver_name} — {d.points} pts
              </option>
            ))}
          </select>
          {leader && (
            <p className="text-xs text-gray-500 mt-2">
              Leader attuale: <span className="font-bold">{leader.driver_name}</span> ({leader.points} pts)
            </p>
          )}
        </div>

        {/* Races/Sprints counters */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-sm font-bold text-gray-900">🏁 GP rimanenti</p>
              <p className="text-xs text-gray-500">Gare della domenica</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRacesLeft(Math.max(0, racesLeft - 1))}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-mono font-bold text-2xl text-gray-900">{racesLeft}</span>
              <button
                onClick={() => setRacesLeft(racesLeft + 1)}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-gray-900">⚡ Sprint rimanenti</p>
              <p className="text-xs text-gray-500">Gare del sabato</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSprintsLeft(Math.max(0, sprintsLeft - 1))}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-mono font-bold text-2xl text-gray-900">{sprintsLeft}</span>
              <button
                onClick={() => setSprintsLeft(sprintsLeft + 1)}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Punti massimi ancora disponibili</p>
              <p className="text-3xl font-black text-gray-900">{maxPossiblePoints}</p>
              <p className="text-xs text-gray-400 mt-1">(25 a GP + 8 a Sprint)</p>
            </div>
          </div>
        </div>

        {/* Analysis results */}
        {selectedDriver && analysis && (
          <motion.div
            key={selectedDriverId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <MagicNumberCard analysis={analysis} driverColor={TEAM_COLORS[selectedDriver.team] || "#ccc"} />

            {/* Combinations Section - NUOVA */}
            <CombinationsCard combinations={analysis.combinations} magicNumber={analysis.magicNumber} />

            {/* Rivals section - SOLO CHI HA PIÙ PUNTI */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Piloti da superare
                </h3>
                <span className="text-xs text-gray-400">
                  {analysis.allRivals.filter(r => r.pointsNeeded > 0 && !r.isMathematicallyEliminated).length} da battere
                </span>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {analysis.allRivals.length === 0 ? (
                  <div className="text-center py-6">
                    <Award className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-gray-600 font-medium">Sei in testa alla classifica! 🎯</p>
                    <p className="text-xs text-gray-400 mt-1">Nessun pilota davanti a te</p>
                  </div>
                ) : (
                  analysis.allRivals
                    .filter(r => r.pointsNeeded > 0 && !r.isMathematicallyEliminated)
                    .map(rival => (
                      <RivalCard
                        key={rival.driver.id}
                        rival={rival}
                        driverName={selectedDriver.driver_name}
                        isMain={analysis.mainRival?.driver.id === rival.driver.id}
                      />
                    ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Share2 className="w-4 h-4" /> Condividi
              </button>
              <button
                onClick={handleSave}
                className="flex items-center justify-center gap-2 py-3 bg-red-50 border border-red-200 rounded-xl font-medium text-red-600 hover:bg-red-100 transition-colors"
              >
                <Bookmark className="w-4 h-4" /> Salva scenario
              </button>
            </div>

            {/* Saved scenarios */}
            {savedScenarios.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Bookmark className="w-3 h-3" />
                  Ultime simulazioni salvate
                </p>
                <div className="space-y-2">
                  {savedScenarios.map(s => (
                    <div key={s.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <span className="font-medium text-gray-900">{s.driverName}</span>
                        <p className="text-xs text-gray-400">{s.driverTeam}</p>
                      </div>
                      <span className={`font-mono text-sm font-bold ${s.isChampion ? 'text-green-600' : s.isOut ? 'text-gray-400' : 'text-red-600'}`}>
                        {s.isChampion ? "🏆 Campione" : s.isOut ? "❌ Fuori" : `+${s.magicNumber} pt`}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {!selectedDriver && drivers.length > 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Calculator className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Seleziona un pilota per iniziare</p>
            <p className="text-xs text-gray-400 mt-2">Analizza le possibilità di vittoria del campionato</p>
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
              className="bg-white w-full max-w-md rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pt-2 pb-4">
                <h3 className="font-black text-xl">Come funziona</h3>
                <button onClick={() => setShowInfo(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                  <X className="w-4 h-4 mx-auto" />
                </button>
              </div>
              <div className="space-y-6 text-sm text-gray-600">
                <div className="bg-blue-50 p-4 rounded-xl">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-red-500" />
                    Cos'è il "Numero Magico"?
                  </h4>
                  <p>
                    È il numero di punti che un pilota deve ancora conquistare per essere <strong className="text-gray-900">matematicamente certo</strong> di vincere il campionato, 
                    indipendentemente dai risultati degli altri.
                  </p>
                </div>

                <div className="bg-purple-50 p-4 rounded-xl">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    Combinazioni Possibili
                  </h4>
                  <p>
                    Mostriamo diverse strategie per raggiungere il numero magico:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong>Ottimale:</strong> Massimo risultato col minor numero di gare</li>
                    <li><strong>Alternativa:</strong> Include vittorie nelle Sprint</li>
                    <li><strong>Realistico:</strong> Piazzamenti medi (4°-8° posto)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Pareggio in classifica
                  </h4>
                  <p>
                    In caso di parità di punti, vince chi ha più <strong className="text-gray-900">vittorie</strong> in stagione.
                    Il nostro calcolo tiene conto di questo aspetto.
                  </p>
                </div>

                <div className="bg-green-50 p-3 rounded-xl">
                  <p className="text-xs text-green-800">
                    💡 <strong className="font-bold">Suggerimento:</strong> Puoi modificare il numero di GP e Sprint rimanenti per simulare diversi scenari!
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
