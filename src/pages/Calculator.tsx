import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Info, X, Share2, Bookmark, ChevronDown, ChevronUp,
  Trophy, AlertTriangle, Sparkles, Target, TrendingUp, Award, Eye, HelpCircle,
  ChevronRight, Filter, ListChecks
} from "lucide-react";

import { supabase } from "../lib/supabase";

// ─── Costanti F1 2026 ──────────────────────────────────────────────────────
const MAX_RACE_PTS = 25;
const MAX_SPRINT_PTS = 8;
const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const POSITION_LABELS = ["1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°+"];
const POSITION_EMOJI = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "💤"];

// Solo posizioni che danno punti (1°-10°)
const SCORING_POSITIONS = RACE_POINTS.map((pts, idx) => ({
  position: idx + 1,
  label: POSITION_LABELS[idx],
  emoji: POSITION_EMOJI[idx],
  points: pts
})).filter(p => p.points > 0);

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
  currentGap: number;
  pointsNeeded: number;
  isMathematicallyEliminated: boolean;
}

interface RaceResult {
  raceNumber: number;
  yourPosition: number;
  yourPoints: number;
  rivalPosition: number;
  rivalPoints: number;
  yourTotalAfter: number;
  rivalTotalAfter: number;
  isOvertake: boolean;
}

interface Combination {
  id: string;
  results: RaceResult[];
  totalRacesUsed: number;
  overtakeAtRace: number;
  finalYourPoints: number;
  finalRivalPoints: number;
  finalGap: number;
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
}

function calculateChampionshipAnalysis(
  driver: Driver,
  allDrivers: Driver[],
  racesLeft: number,
  sprintsLeft: number
): ChampionshipAnalysis {
  const maxRemainingPoints = racesLeft * MAX_RACE_PTS + sprintsLeft * MAX_SPRINT_PTS;
  const driverMaxPossible = driver.points + maxRemainingPoints;
  
  const rivalsAnalysis: RivalAnalysis[] = allDrivers
    .filter(d => d.id !== driver.id && d.points >= driver.points)
    .map(rival => {
      const currentGap = rival.points - driver.points;
      let pointsNeeded = currentGap + 1;
      
      if (currentGap === 0 && driver.victories <= rival.victories) {
        pointsNeeded = 1;
      }
      
      const isMathematicallyEliminated = driverMaxPossible < rival.points;
      
      return {
        driver: rival,
        currentGap,
        pointsNeeded: Math.max(1, pointsNeeded),
        isMathematicallyEliminated,
      };
    })
    .sort((a, b) => b.pointsNeeded - a.pointsNeeded);
  
  const activeRivals = rivalsAnalysis.filter(r => !r.isMathematicallyEliminated && r.pointsNeeded > 0);
  const mainRival = activeRivals.length > 0 ? activeRivals[0] : null;
  const isAlreadyChampion = activeRivals.length === 0 && driver.points > Math.max(...allDrivers.map(d => d.points));
  const isMathematicallyOut = driverMaxPossible < Math.max(...allDrivers.map(d => d.points));
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

// 🔥 GENERA TUTTE LE COMBINAZIONI DI PIACCIAMENTI PER TUTTE LE GARE
function generateAllPossibleCombinations(
  yourDriver: Driver,
  rival: Driver,
  totalRaces: number
): Combination[] {
  const combinations: Combination[] = [];
  const startYourPoints = yourDriver.points;
  const startRivalPoints = rival.points;
  
  // Funzione ricorsiva per generare tutte le sequenze di risultati
  function generateSequence(
    raceIndex: number,
    currentYourPoints: number,
    currentRivalPoints: number,
    currentResults: RaceResult[],
    hasOvertaken: boolean
  ) {
    // Se abbiamo già superato prima, questa combinazione è valida
    if (hasOvertaken) {
      combinations.push({
        id: `${Date.now()}-${combinations.length}`,
        results: [...currentResults],
        totalRacesUsed: raceIndex,
        overtakeAtRace: currentResults.find(r => r.isOvertake)?.raceNumber || raceIndex,
        finalYourPoints: currentYourPoints,
        finalRivalPoints: currentRivalPoints,
        finalGap: currentYourPoints - currentRivalPoints
      });
      return;
    }
    
    // Se siamo all'ultima gara, registra la combinazione solo se abbiamo superato
    if (raceIndex >= totalRaces) {
      if (currentYourPoints > currentRivalPoints) {
        combinations.push({
          id: `${Date.now()}-${combinations.length}`,
          results: [...currentResults],
          totalRacesUsed: totalRaces,
          overtakeAtRace: totalRaces,
          finalYourPoints: currentYourPoints,
          finalRivalPoints: currentRivalPoints,
          finalGap: currentYourPoints - currentRivalPoints
        });
      }
      return;
    }
    
    // Genera tutte le possibili coppie di posizioni per questa gara
    // Il rivale prende SEMPRE punti (posizioni 1-10, mai 11+)
    for (const yourPos of SCORING_POSITIONS) {
      for (const rivalPos of SCORING_POSITIONS) {
        const newYourPoints = currentYourPoints + yourPos.points;
        const newRivalPoints = currentRivalPoints + rivalPos.points;
        const isOvertake = !hasOvertaken && (newYourPoints > newRivalPoints);
        
        const newResult: RaceResult = {
          raceNumber: raceIndex + 1,
          yourPosition: yourPos.position,
          yourPoints: yourPos.points,
          rivalPosition: rivalPos.position,
          rivalPoints: rivalPos.points,
          yourTotalAfter: newYourPoints,
          rivalTotalAfter: newRivalPoints,
          isOvertake
        };
        
        generateSequence(
          raceIndex + 1,
          newYourPoints,
          newRivalPoints,
          [...currentResults, newResult],
          hasOvertaken || isOvertake
        );
      }
    }
  }
  
  generateSequence(0, startYourPoints, startRivalPoints, [], false);
  
  // Ordina per numero di gare usate (meno gare prima) e poi per gap
  return combinations.sort((a, b) => {
    if (a.totalRacesUsed !== b.totalRacesUsed) return a.totalRacesUsed - b.totalRacesUsed;
    return b.finalGap - a.finalGap;
  });
}

// 🔥 VERSIONE OTTIMIZZATA PER TANTE GARE (USA STRATEGIE PRE-CALCOLATE)
function generateOptimizedCombinations(
  yourDriver: Driver,
  rival: Driver,
  totalRaces: number
): Combination[] {
  const combinations: Combination[] = [];
  const startYourPoints = yourDriver.points;
  const startRivalPoints = rival.points;
  const needed = rival.points - yourDriver.points + 1;
  
  // Strategia 1: Vittorie costanti del pilota, piazzamenti medi del rivale
  for (let wins = 1; wins <= Math.min(totalRaces, Math.ceil(needed / 25) + 5); wins++) {
    const yourPointsFromWins = wins * 25;
    const remainingRaces = totalRaces - wins;
    
    // Il rivale fa piazzamenti medi (esempio: 4° posto = 12pt)
    const rivalAvgPoints = Math.min(12, Math.floor(18 / (remainingRaces + 1)) + 8);
    const rivalPointsTotal = remainingRaces * rivalAvgPoints;
    
    let currentYourPoints = startYourPoints;
    let currentRivalPoints = startRivalPoints;
    const results: RaceResult[] = [];
    let overtakeAtRace = -1;
    let overtaken = false;
    
    for (let i = 0; i < totalRaces; i++) {
      let yourPos = 1;
      let yourPts = 25;
      let rivalPos = 4;
      let rivalPts = 12;
      
      if (i < wins) {
        yourPos = 1;
        yourPts = 25;
      } else {
        yourPos = 3;
        yourPts = 15;
        rivalPts = rivalAvgPoints;
      }
      
      currentYourPoints += yourPts;
      currentRivalPoints += rivalPts;
      
      const isOvertake = !overtaken && (currentYourPoints > currentRivalPoints);
      if (isOvertake) {
        overtaken = true;
        overtakeAtRace = i + 1;
      }
      
      results.push({
        raceNumber: i + 1,
        yourPosition: yourPos,
        yourPoints: yourPts,
        rivalPosition: rivalPos,
        rivalPoints: rivalPts,
        yourTotalAfter: currentYourPoints,
        rivalTotalAfter: currentRivalPoints,
        isOvertake
      });
      
      if (overtaken && i + 1 < totalRaces) {
        // Continua con risultati neutrali
        continue;
      }
    }
    
    if (overtaken) {
      combinations.push({
        id: `opt-${wins}`,
        results,
        totalRacesUsed: overtakeAtRace,
        overtakeAtRace,
        finalYourPoints: currentYourPoints,
        finalRivalPoints: currentRivalPoints,
        finalGap: currentYourPoints - currentRivalPoints
      });
    }
  }
  
  // Strategia 2: Progressione graduale
  const gainPerRace = 5; // Recupero medio di 5 punti a gara
  const racesNeeded = Math.ceil(needed / gainPerRace);
  
  if (racesNeeded <= totalRaces) {
    let currentYourPoints = startYourPoints;
    let currentRivalPoints = startRivalPoints;
    const results: RaceResult[] = [];
    let overtaken = false;
    let overtakeAtRace = -1;
    
    for (let i = 0; i < totalRaces; i++) {
      let yourPos = i < racesNeeded ? 2 : 4;
      let yourPts = i < racesNeeded ? 18 : 12;
      let rivalPos = i < racesNeeded ? 4 : 6;
      let rivalPts = i < racesNeeded ? 12 : 8;
      
      currentYourPoints += yourPts;
      currentRivalPoints += rivalPts;
      
      const isOvertake = !overtaken && (currentYourPoints > currentRivalPoints);
      if (isOvertake && !overtaken) {
        overtaken = true;
        overtakeAtRace = i + 1;
      }
      
      results.push({
        raceNumber: i + 1,
        yourPosition: yourPos,
        yourPoints: yourPts,
        rivalPosition: rivalPos,
        rivalPoints: rivalPts,
        yourTotalAfter: currentYourPoints,
        rivalTotalAfter: currentRivalPoints,
        isOvertake
      });
    }
    
    if (overtaken) {
      combinations.push({
        id: `grad-${racesNeeded}`,
        results,
        totalRacesUsed: overtakeAtRace,
        overtakeAtRace,
        finalYourPoints: currentYourPoints,
        finalRivalPoints: currentRivalPoints,
        finalGap: currentYourPoints - currentRivalPoints
      });
    }
  }
  
  return combinations.sort((a, b) => a.totalRacesUsed - b.totalRacesUsed);
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
        <p className="text-red-100 text-sm mt-2">punti da conquistare</p>
      </div>

      {analysis.mainRival && (
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-xs text-red-100 mb-2">🎯 RIVALE PRINCIPALE</p>
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg">{analysis.mainRival.driver.driver_name}</span>
            <span className="text-sm font-mono">{analysis.mainRival.driver.points} pt</span>
          </div>
          <p className="text-xs text-red-100 mt-1">dietro di {analysis.mainRival.currentGap} punti</p>
        </div>
      )}
    </div>
  );
}

// 🔥 MODAL CON TABELLA DELLE COMBINAZIONI
function RivalDetailModal({ 
  isOpen, 
  onClose, 
  yourDriver, 
  rival, 
  racesLeft 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  yourDriver: Driver; 
  rival: Driver; 
  racesLeft: number;
}) {
  const [showDetails, setShowDetails] = useState<string | null>(null);
  
  const combinations = useMemo(() => {
    if (racesLeft > 6) {
      // Per tante gare, usa versione ottimizzata
      return generateOptimizedCombinations(yourDriver, rival, racesLeft);
    } else {
      // Per poche gare, genera tutte le combinazioni
      return generateAllPossibleCombinations(yourDriver, rival, racesLeft);
    }
  }, [yourDriver, rival, racesLeft]);
  
  const pointsNeeded = rival.points - yourDriver.points + 1;
  
  // Raggruppa per gara di sorpasso
  const groupedByOvertake = combinations.reduce((acc, combo) => {
    const race = combo.overtakeAtRace;
    if (!acc[race]) acc[race] = [];
    acc[race].push(combo);
    return acc;
  }, {} as Record<number, Combination[]>);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Combinazioni per superare {rival.driver_name}</h2>
                  <p className="text-red-100 text-sm">
                    Devi recuperare <span className="font-bold text-xl">{pointsNeeded}</span> punti in {racesLeft} gare
                  </p>
                  <p className="text-red-100 text-xs mt-1">
                    {yourDriver.driver_name} ({yourDriver.points} pt) → {rival.driver_name} ({rival.points} pt)
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {combinations.length} combinazioni trovate
                </span>
              </div>
              <div className="text-xs text-gray-400">
                {Object.keys(groupedByOvertake).length} diversi tempi di sorpasso
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {Object.entries(groupedByOvertake)
                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([raceNumber, combos]) => (
                    <div key={raceNumber} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Header del gruppo */}
                      <div className="bg-green-100 px-4 py-2 border-b border-green-200">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-green-700" />
                          <span className="font-bold text-green-800">
                            Sorpasso alla Gara {raceNumber}
                          </span>
                          <span className="text-xs text-green-600">
                            ({combos.length} combinazioni)
                          </span>
                        </div>
                      </div>
                      
                      {/* Tabella delle combinazioni */}
                      <div className="divide-y divide-gray-100">
                        {combos.slice(0, 5).map((combo, idx) => (
                          <div key={combo.id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-sm font-medium text-gray-500">
                                Combinazione {idx + 1}
                              </span>
                              <button
                                onClick={() => setShowDetails(showDetails === combo.id ? null : combo.id)}
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                {showDetails === combo.id ? "Nascondi dettagli" : "Mostra dettagli"}
                              </button>
                            </div>
                            
                            {/* Riepilogo compatto */}
                            <div className="grid grid-cols-2 gap-4 mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-green-600 font-bold">📊 {yourDriver.driver_name}</span>
                                <span className="text-sm">
                                  {combo.results.slice(0, combo.overtakeAtRace).reduce((sum, r) => sum + r.yourPoints, 0)} pt
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-red-600 font-bold">📊 {rival.driver_name}</span>
                                <span className="text-sm">
                                  {combo.results.slice(0, combo.overtakeAtRace).reduce((sum, r) => sum + r.rivalPoints, 0)} pt
                                </span>
                              </div>
                            </div>
                            
                            <div className="text-xs text-gray-400">
                              Guadagno finale: +{combo.finalGap} punti
                            </div>
                            
                            {/* Dettaglio delle gare */}
                            {showDetails === combo.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 pt-4 border-t border-gray-200"
                              >
                                <h4 className="font-bold text-sm mb-3">Dettaglio gare:</h4>
                                <div className="space-y-2">
                                  {combo.results.map((result, i) => (
                                    <div 
                                      key={i}
                                      className={`grid grid-cols-2 gap-4 p-2 rounded-lg ${
                                        result.isOvertake ? 'bg-green-100 border border-green-300' : 'bg-gray-50'
                                      }`}
                                    >
                                      {/* Tuoi risultati */}
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-lg">
                                            {SCORING_POSITIONS.find(p => p.position === result.yourPosition)?.emoji}
                                          </span>
                                          <span className="font-mono">
                                            Gara {result.raceNumber}: {result.yourPosition}°
                                          </span>
                                        </div>
                                        <span className="font-bold text-green-600">
                                          +{result.yourPoints} pt
                                        </span>
                                      </div>
                                      
                                      {/* Risultati rivale */}
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-lg">
                                            {SCORING_POSITIONS.find(p => p.position === result.rivalPosition)?.emoji}
                                          </span>
                                          <span className="font-mono text-gray-600">
                                            {result.rivalPosition}°
                                          </span>
                                        </div>
                                        <span className="font-bold text-red-600">
                                          +{result.rivalPoints} pt
                                        </span>
                                      </div>
                                      
                                      {/* Punteggio totale dopo la gara */}
                                      <div className="col-span-2 text-xs text-center text-gray-500 mt-1">
                                        Punteggio: {result.yourTotalAfter} - {result.rivalTotalAfter}
                                        {result.isOvertake && (
                                          <span className="ml-2 text-green-600 font-bold">
                                            ✅ SORPASSO!
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                
                {combinations.length === 0 && (
                  <div className="text-center py-12">
                    <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nessuna combinazione possibile con {racesLeft} gare rimanenti</p>
                    <p className="text-xs text-gray-400 mt-2">Il divario è troppo ampio da recuperare</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 p-4 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                💡 Il rivale prende sempre punti (posizioni 1°-10°). Il sorpasso può avvenire prima della fine delle gare.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RivalCard({ 
  rival, 
  isMain, 
  onCardClick 
}: { 
  rival: RivalAnalysis; 
  driverName: string; 
  isMain?: boolean;
  onCardClick: () => void;
}) {
  return (
    <div 
      onClick={onCardClick}
      className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${
        isMain ? 'border-red-300 bg-red-50/30 hover:bg-red-50/50' : 'border-gray-100 hover:border-gray-300'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900">{rival.driver.driver_name}</p>
            {isMain && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Principale</span>}
          </div>
          <p className="text-xs text-gray-500">{rival.driver.team}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">{rival.driver.points} pt</p>
          <p className="text-xs text-gray-400">distanza: -{rival.currentGap} pt</p>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <div>
          <p className="text-sm font-medium text-red-600">
            Devi fare {rival.pointsNeeded} punti in più
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
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
  const [selectedRival, setSelectedRival] = useState<Driver | null>(null);

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
      ? `🏆 ${analysis.driver.driver_name} è già Campione del Mondo F1 2026!`
      : analysis.isMathematicallyOut
      ? `❌ ${analysis.driver.driver_name} è matematicamente fuori dalla corsa al titolo F1 2026`
      : `🎯 ${analysis.driver.driver_name} deve fare ${analysis.magicNumber} punti per vincere il titolo F1 2026`;
    
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
              Leader: <span className="font-bold">{leader.driver_name}</span> ({leader.points} pt)
            </p>
          )}
        </div>

        {/* Races counter */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-gray-900">🏁 GP rimanenti</p>
              <p className="text-xs text-gray-500">Gare da disputare</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRacesLeft(Math.max(0, racesLeft - 1))}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-mono font-bold text-2xl text-gray-900">{racesLeft}</span>
              <button
                onClick={() => setRacesLeft(racesLeft + 1)}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
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
            <MagicNumberCard analysis={analysis} driverColor="red" />

            {/* Rivals section */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Piloti da superare
                </h3>
                <span className="text-xs text-gray-400">
                  {analysis.allRivals.filter(r => !r.isMathematicallyEliminated).length} da battere
                </span>
              </div>
              <div className="space-y-2">
                {analysis.allRivals.length === 0 ? (
                  <div className="text-center py-6">
                    <Award className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-gray-600 font-medium">Sei in testa! 🎯</p>
                  </div>
                ) : (
                  analysis.allRivals
                    .filter(r => !r.isMathematicallyEliminated)
                    .map(rival => (
                      <RivalCard
                        key={rival.driver.id}
                        rival={rival}
                        driverName={selectedDriver.driver_name}
                        isMain={analysis.mainRival?.driver.id === rival.driver.id}
                        onCardClick={() => setSelectedRival(rival.driver)}
                      />
                    ))
                )}
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
                      <span className={`font-mono ${s.isChampion ? 'text-green-600' : s.isOut ? 'text-gray-400' : 'text-red-600'}`}>
                        {s.isChampion ? "🏆 Campione" : s.isOut ? "❌ Fuori" : `+${s.magicNumber} pt`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {!selectedDriver && drivers.length > 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Seleziona un pilota</p>
          </div>
        )}
      </div>

      {/* Rival Detail Modal */}
      {selectedRival && selectedDriver && (
        <RivalDetailModal
          isOpen={!!selectedRival}
          onClose={() => setSelectedRival(null)}
          yourDriver={selectedDriver}
          rival={selectedRival}
          racesLeft={racesLeft}
        />
      )}

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
                  Clicca su un rivale per vedere tutte le <strong>combinazioni possibili</strong> di piazzamenti
                  che ti permettono di superarlo.
                </p>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="font-mono text-xs">
                    • Il rivale prende SEMPRE punti (1°-10° posto)<br />
                    • Il sorpasso può avvenire prima della fine delle gare<br />
                    • Per ogni combinazione vedrai il dettaglio gara per gara
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
