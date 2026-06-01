import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Info, X, Share2, Bookmark, ChevronDown, ChevronUp,
  Trophy, AlertTriangle, Sparkles, Target, TrendingUp, Award, Eye, HelpCircle,
  ChevronRight, Filter
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

interface Combination {
  yourFinishes: { position: number; label: string; emoji: string; count: number }[];
  rivalFinishes: { position: number; label: string; emoji: string; count: number }[];
  yourTotalPoints: number;
  rivalTotalPoints: number;
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

// 🔥 GENERA TUTTE LE COMBINAZIONI POSSIBILI DI PIACCIAMENTI
function generateAllCombinations(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number
): Combination[] {
  const combinations: Combination[] = [];
  const pointsNeeded = rival.points - yourDriver.points + 1;
  
  if (pointsNeeded <= 0) return [];
  
  // Genera tutte le possibili distribuzioni di piazzamenti
  // Usiamo un approccio ricorsivo per generare tutte le combinazioni
  const yourDistributions: { position: number; count: number }[][] = [];
  const rivalDistributions: { position: number; count: number }[][] = [];
  
  // Genera tutte le possibili distribuzioni di piazzamenti per un pilota
  function generateDistributions(
    remainingRaces: number,
    currentDist: { position: number; count: number }[],
    startPos: number,
    results: { position: number; count: number }[][]
  ) {
    if (remainingRaces === 0) {
      results.push([...currentDist]);
      return;
    }
    
    for (let pos = startPos; pos <= SCORING_POSITIONS.length; pos++) {
      const positionData = SCORING_POSITIONS[pos - 1];
      const maxCount = remainingRaces;
      
      for (let count = 1; count <= maxCount; count++) {
        const newDist = [...currentDist, { position: positionData.position, count }];
        generateDistributions(remainingRaces - count, newDist, pos + 1, results);
      }
    }
  }
  
  // Genera distribuzioni per entrambi i piloti
  generateDistributions(racesLeft, [], 1, yourDistributions);
  generateDistributions(racesLeft, [], 1, rivalDistributions);
  
  // Calcola i punti per ogni distribuzione
  for (const yourDist of yourDistributions) {
    const yourPoints = calculatePointsFromDistribution(yourDist);
    const yourTotal = yourDriver.points + yourPoints;
    
    for (const rivalDist of rivalDistributions) {
      const rivalPoints = calculatePointsFromDistribution(rivalDist);
      const rivalTotal = rival.points + rivalPoints;
      const finalGap = yourTotal - rivalTotal;
      
      // Solo combinazioni dove vinciamo
      if (finalGap > 0) {
        combinations.push({
          yourFinishes: yourDist.map(d => ({
            position: d.position,
            label: POSITION_LABELS[d.position - 1],
            emoji: POSITION_EMOJI[d.position - 1],
            count: d.count
          })),
          rivalFinishes: rivalDist.map(d => ({
            position: d.position,
            label: POSITION_LABELS[d.position - 1],
            emoji: POSITION_EMOJI[d.position - 1],
            count: d.count
          })),
          yourTotalPoints: yourTotal,
          rivalTotalPoints: rivalTotal,
          finalGap
        });
      }
    }
  }
  
  // Ordina per miglior risultato (minor numero di gare necessarie o maggior gap)
  return combinations
    .sort((a, b) => {
      const aRaces = a.yourFinishes.reduce((sum, f) => sum + f.count, 0);
      const bRaces = b.yourFinishes.reduce((sum, f) => sum + f.count, 0);
      if (aRaces !== bRaces) return aRaces - bRaces;
      return b.finalGap - a.finalGap;
    })
    .slice(0, 50); // Limita a 50 combinazioni per performance
}

function calculatePointsFromDistribution(dist: { position: number; count: number }[]): number {
  return dist.reduce((sum, item) => {
    const positionData = SCORING_POSITIONS.find(p => p.position === item.position);
    return sum + (positionData?.points || 0) * item.count;
  }, 0);
}

// 🔥 VERSIONE OTTIMIZZATA PER NON ESPLODERE CON TANTE GARE
function generateOptimizedCombinations(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number
): Combination[] {
  const combinations: Combination[] = [];
  const pointsNeeded = rival.points - yourDriver.points + 1;
  
  if (pointsNeeded <= 0) return [];
  
  // Strategie pre-calcolate invece di generare tutte le combinazioni
  
  // Strategia 1: Vittorie pure
  const winsNeeded = Math.ceil(pointsNeeded / 25);
  if (winsNeeded <= racesLeft) {
    combinations.push({
      yourFinishes: [{ position: 1, label: "1°", emoji: "🥇", count: winsNeeded }],
      rivalFinishes: [{ position: 11, label: "11°+", emoji: "💤", count: racesLeft }],
      yourTotalPoints: yourDriver.points + (winsNeeded * 25),
      rivalTotalPoints: rival.points,
      finalGap: (yourDriver.points + (winsNeeded * 25)) - rival.points
    });
  }
  
  // Strategia 2: Podi costanti
  const podiumsNeeded = Math.ceil(pointsNeeded / 15);
  if (podiumsNeeded <= racesLeft) {
    combinations.push({
      yourFinishes: [{ position: 3, label: "3°", emoji: "🥉", count: podiumsNeeded }],
      rivalFinishes: [{ position: 6, label: "6°", emoji: "6️⃣", count: racesLeft }],
      yourTotalPoints: yourDriver.points + (podiumsNeeded * 15),
      rivalTotalPoints: rival.points + (racesLeft * 8),
      finalGap: (yourDriver.points + (podiumsNeeded * 15)) - (rival.points + (racesLeft * 8))
    });
  }
  
  // Strategia 3: Top 5 costanti
  const top5Needed = Math.ceil(pointsNeeded / 10);
  if (top5Needed <= racesLeft) {
    combinations.push({
      yourFinishes: [{ position: 5, label: "5°", emoji: "5️⃣", count: top5Needed }],
      rivalFinishes: [{ position: 8, label: "8°", emoji: "8️⃣", count: racesLeft }],
      yourTotalPoints: yourDriver.points + (top5Needed * 10),
      rivalTotalPoints: rival.points + (racesLeft * 4),
      finalGap: (yourDriver.points + (top5Needed * 10)) - (rival.points + (racesLeft * 4))
    });
  }
  
  // Strategia 4: Vittorie + piazzamenti
  for (let wins = 1; wins <= Math.min(winsNeeded, racesLeft); wins++) {
    const remainingPoints = pointsNeeded - (wins * 25);
    if (remainingPoints <= 0) continue;
    
    const remainingRaces = racesLeft - wins;
    const avgNeeded = remainingPoints / remainingRaces;
    
    let position = 10;
    for (let i = 0; i < SCORING_POSITIONS.length; i++) {
      if (SCORING_POSITIONS[i].points >= avgNeeded) {
        position = SCORING_POSITIONS[i].position;
        break;
      }
    }
    
    const positionData = SCORING_POSITIONS.find(p => p.position === position);
    if (positionData && positionData.points * remainingRaces >= remainingPoints) {
      combinations.push({
        yourFinishes: [
          { position: 1, label: "1°", emoji: "🥇", count: wins },
          { position: position, label: positionData.label, emoji: positionData.emoji, count: remainingRaces }
        ],
        rivalFinishes: [{ position: 11, label: "11°+", emoji: "💤", count: racesLeft }],
        yourTotalPoints: yourDriver.points + (wins * 25) + (positionData.points * remainingRaces),
        rivalTotalPoints: rival.points,
        finalGap: (yourDriver.points + (wins * 25) + (positionData.points * remainingRaces)) - rival.points
      });
    }
  }
  
  // Filtra solo quelle valide e ordina
  return combinations
    .filter(c => c.finalGap > 0)
    .sort((a, b) => {
      const aRaces = a.yourFinishes.reduce((sum, f) => sum + f.count, 0);
      const bRaces = b.yourFinishes.reduce((sum, f) => sum + f.count, 0);
      if (aRaces !== bRaces) return aRaces - bRaces;
      return b.finalGap - a.finalGap;
    });
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

// 🔥 MODAL CON COMBINAZIONI STILE TABELLA
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
  const [showOnlyBest, setShowOnlyBest] = useState(true);
  
  const combinations = useMemo(() => {
    if (racesLeft > 8) {
      // Per tante gare, usa versione ottimizzata
      return generateOptimizedCombinations(yourDriver, rival, racesLeft);
    } else {
      // Per poche gare, genera tutte le combinazioni
      return generateAllCombinations(yourDriver, rival, racesLeft);
    }
  }, [yourDriver, rival, racesLeft]);
  
  const pointsNeeded = rival.points - yourDriver.points + 1;
  const displayedCombinations = showOnlyBest ? combinations.slice(0, 10) : combinations;
  
  // Raggruppa per numero di gare usate
  const groupedByRaces = displayedCombinations.reduce((acc, combo) => {
    const racesUsed = combo.yourFinishes.reduce((sum, f) => sum + f.count, 0);
    if (!acc[racesUsed]) acc[racesUsed] = [];
    acc[racesUsed].push(combo);
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
            className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
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

            {/* Controls */}
            <div className="px-6 pt-4 pb-2 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Filtri:</span>
                <button
                  onClick={() => setShowOnlyBest(!showOnlyBest)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    showOnlyBest ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {showOnlyBest ? "📊 Solo migliori" : "🔽 Tutte"}
                </button>
              </div>
              <span className="text-xs text-gray-400">
                {combinations.length} combinazioni trovate
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {Object.entries(groupedByRaces).sort((a, b) => Number(a[0]) - Number(b[0])).map(([racesUsed, combos]) => (
                  <div key={racesUsed}>
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="bg-gray-200 rounded-full px-3 py-1 text-sm">
                        📍 {racesUsed} gare utilizzate
                      </span>
                    </h3>
                    <div className="space-y-3">
                      {combos.slice(0, 3).map((combo, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border border-gray-200 rounded-xl overflow-hidden"
                        >
                          {/* Intestazione della combinazione */}
                          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                            <span className="text-sm font-medium text-gray-600">
                              Combinazione {idx + 1} • Guadagno finale: +{combo.finalGap} pt
                            </span>
                          </div>
                          
                          {/* Tabella dei risultati */}
                          <div className="grid grid-cols-2 divide-x divide-gray-200">
                            {/* Tuoi risultati */}
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Trophy className="w-5 h-5 text-green-600" />
                                <h4 className="font-bold text-green-800">{yourDriver.driver_name}</h4>
                              </div>
                              <div className="space-y-2">
                                {combo.yourFinishes.map((finish, i) => (
                                  <div key={i} className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl">{finish.emoji}</span>
                                      <span className="font-medium">{finish.label}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-gray-500">×{finish.count}</span>
                                      <span className="font-mono font-bold">
                                        {SCORING_POSITIONS.find(p => p.position === finish.position)?.points || 0 * finish.count} pt
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                <div className="border-t border-green-200 mt-2 pt-2">
                                  <div className="flex justify-between font-bold">
                                    <span>Totale:</span>
                                    <span className="text-green-700">{combo.yourTotalPoints} pt</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Risultati rivale */}
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                <h4 className="font-bold text-red-800">{rival.driver_name}</h4>
                              </div>
                              <div className="space-y-2">
                                {combo.rivalFinishes.map((finish, i) => (
                                  <div key={i} className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl">{finish.emoji}</span>
                                      <span className="font-medium">{finish.label}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-gray-500">×{finish.count}</span>
                                      <span className="font-mono font-bold">
                                        {SCORING_POSITIONS.find(p => p.position === finish.position)?.points || 0 * finish.count} pt
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                <div className="border-t border-red-200 mt-2 pt-2">
                                  <div className="flex justify-between font-bold">
                                    <span>Totale:</span>
                                    <span className="text-red-700">{combo.rivalTotalPoints} pt</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Footer della combinazione */}
                          <div className="bg-green-50 px-4 py-2 border-t border-green-200">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Risultato finale:</span>
                              <span className="font-bold text-green-600">
                                ✅ {yourDriver.driver_name} supera {rival.driver_name} di {combo.finalGap} punti
                              </span>
                            </div>
                          </div>
                        </motion.div>
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
                💡 Sono mostrate solo le combinazioni con posizioni che danno punti (1°-10°)
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
                    Per ogni combinazione vedrai:<br />
                    • I tuoi piazzamenti (es: 5× 1°)<br />
                    • I piazzamenti del rivale (es: 5× 2°)<br />
                    • Il risultato finale
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  * Sono considerate solo le posizioni che danno punti (1°-10°)
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
