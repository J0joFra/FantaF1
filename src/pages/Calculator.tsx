import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Info, X, Share2, Bookmark, ChevronDown, ChevronUp,
  Trophy, AlertTriangle, Sparkles, Target, TrendingUp, Award, Eye, HelpCircle,
  ChevronRight, Filter, Grid3x3, Maximize2, Minimize2
} from "lucide-react";

import { supabase } from "../lib/supabase";

// ─── Costanti F1 2026 ──────────────────────────────────────────────────────
const MAX_RACE_PTS = 25;
const MAX_SPRINT_PTS = 8;
const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const POSITION_LABELS = ["1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°"];
const POSITION_EMOJI = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const SCORING_POSITIONS = RACE_POINTS.map((pts, idx) => ({
  position: idx + 1,
  label: POSITION_LABELS[idx],
  emoji: POSITION_EMOJI[idx],
  points: pts
}));

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

interface MosaicCell {
  yourPos: number;
  rivalPos: number;
  yourPoints: number;
  rivalPoints: number;
  gain: number;
  isPossible: boolean;
  racesNeeded: number;
  overtakeRace: number | null;
}

interface ChampionshipAnalysis {
  driver: Driver;
  racesLeft: number;
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

// 🔥 GENERA IL MOSAICO DELLE COMBINAZIONI
function generateMosaic(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number
): {
  cells: MosaicCell[];
  maxRacesNeeded: number;
  bestCombination: MosaicCell | null;
} {
  const cells: MosaicCell[] = [];
  const startGap = rival.points - yourDriver.points;
  let maxRacesNeeded = 0;
  let bestCombination: MosaicCell | null = null;
  
  // Per ogni possibile posizione del pilota
  for (const yourPos of SCORING_POSITIONS) {
    // Per ogni possibile posizione del rivale
    for (const rivalPos of SCORING_POSITIONS) {
      const gainPerRace = yourPos.points - rivalPos.points;
      
      // Se il guadagno per gara è <= 0, non si può recuperare
      if (gainPerRace <= 0) {
        cells.push({
          yourPos: yourPos.position,
          rivalPos: rivalPos.position,
          yourPoints: yourPos.points,
          rivalPoints: rivalPos.points,
          gain: gainPerRace,
          isPossible: false,
          racesNeeded: 0,
          overtakeRace: null
        });
        continue;
      }
      
      // Calcola quante gare servono per recuperare il gap
      const racesNeeded = Math.ceil((startGap + 1) / gainPerRace);
      
      if (racesNeeded <= racesLeft) {
        maxRacesNeeded = Math.max(maxRacesNeeded, racesNeeded);
        
        const cell: MosaicCell = {
          yourPos: yourPos.position,
          rivalPos: rivalPos.position,
          yourPoints: yourPos.points,
          rivalPoints: rivalPos.points,
          gain: gainPerRace,
          isPossible: true,
          racesNeeded: racesNeeded,
          overtakeRace: racesNeeded
        };
        
        cells.push(cell);
        
        // Trova la migliore combinazione (minor numero di gare)
        if (!bestCombination || racesNeeded < bestCombination.racesNeeded) {
          bestCombination = cell;
        }
      } else {
        cells.push({
          yourPos: yourPos.position,
          rivalPos: rivalPos.position,
          yourPoints: yourPos.points,
          rivalPoints: rivalPos.points,
          gain: gainPerRace,
          isPossible: false,
          racesNeeded: racesNeeded,
          overtakeRace: null
        });
      }
    }
  }
  
  return { cells, maxRacesNeeded, bestCombination };
}

// 🔥 GENERA DETTAGLIO PER UNA CELLA SPECIFICA
function generateDetailedCombination(
  yourDriver: Driver,
  rival: Driver,
  yourPos: number,
  rivalPos: number,
  racesLeft: number
): {
  results: { raceNumber: number; yourTotal: number; rivalTotal: number; isOvertake: boolean }[];
  overtakeAtRace: number;
  finalYourPoints: number;
  finalRivalPoints: number;
} {
  const startYourPoints = yourDriver.points;
  const startRivalPoints = rival.points;
  const yourPointsPerRace = SCORING_POSITIONS.find(p => p.position === yourPos)!.points;
  const rivalPointsPerRace = SCORING_POSITIONS.find(p => p.position === rivalPos)!.points;
  const gainPerRace = yourPointsPerRace - rivalPointsPerRace;
  const racesNeeded = Math.ceil((rival.points - yourDriver.points + 1) / gainPerRace);
  
  const results = [];
  let currentYour = startYourPoints;
  let currentRival = startRivalPoints;
  let overtakeAtRace = -1;
  
  for (let i = 1; i <= Math.min(racesNeeded, racesLeft); i++) {
    currentYour += yourPointsPerRace;
    currentRival += rivalPointsPerRace;
    const isOvertake = overtakeAtRace === -1 && currentYour > currentRival;
    
    if (isOvertake) {
      overtakeAtRace = i;
    }
    
    results.push({
      raceNumber: i,
      yourTotal: currentYour,
      rivalTotal: currentRival,
      isOvertake
    });
  }
  
  return {
    results,
    overtakeAtRace,
    finalYourPoints: currentYour,
    finalRivalPoints: currentRival
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

// 🔥 COMPONENTE MOSAICO INTERATTIVO
function MosaicDiagram({ 
  cells, 
  bestCombination,
  yourDriver,
  rival,
  racesLeft,
  onCellClick 
}: { 
  cells: MosaicCell[];
  bestCombination: MosaicCell | null;
  yourDriver: Driver;
  rival: Driver;
  racesLeft: number;
  onCellClick: (yourPos: number, rivalPos: number) => void;
}) {
  const [hoveredCell, setHoveredCell] = useState<MosaicCell | null>(null);
  
  // Organizza le celle in matrice 10x10
  const matrix: (MosaicCell | null)[][] = Array(10).fill(null).map(() => Array(10).fill(null));
  
  cells.forEach(cell => {
    matrix[cell.yourPos - 1][cell.rivalPos - 1] = cell;
  });
  
  const getCellColor = (cell: MosaicCell | null) => {
    if (!cell) return "bg-gray-100";
    if (!cell.isPossible) return "bg-red-200 hover:bg-red-300";
    if (cell.racesNeeded <= 3) return "bg-green-500 hover:bg-green-600 text-white";
    if (cell.racesNeeded <= 5) return "bg-green-400 hover:bg-green-500 text-white";
    if (cell.racesNeeded <= 7) return "bg-yellow-400 hover:bg-yellow-500";
    return "bg-orange-400 hover:bg-orange-500";
  };
  
  const getCellTooltip = (cell: MosaicCell | null) => {
    if (!cell) return "";
    if (!cell.isPossible) return `❌ Impossibile recuperare (guadagno: ${cell.gain} pt/gara)`;
    return `✅ Possibile in ${cell.racesNeeded} gare\n📈 Guadagno: ${cell.gain} pt/gara\n🎯 Sorpasso alla gara ${cell.overtakeRace}`;
  };
  
  const isBest = (cell: MosaicCell | null) => {
    return cell && bestCombination && 
           cell.yourPos === bestCombination.yourPos && 
           cell.rivalPos === bestCombination.rivalPos;
  };
  
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 overflow-x-auto">
      <div className="flex items-center gap-2 mb-4">
        <Grid3x3 className="w-5 h-5 text-red-500" />
        <h3 className="font-bold text-gray-900">Diagramma a Mosaico</h3>
        <span className="text-xs text-gray-400">Clicca su una cella per i dettagli</span>
      </div>
      
      {/* Legenda */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span>Facile (≤3 gare)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-400 rounded"></div>
          <span>Medio (4-5 gare)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-yellow-400 rounded"></div>
          <span>Difficile (6-7 gare)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-orange-400 rounded"></div>
          <span>Molto difficile (≥8 gare)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-200 rounded"></div>
          <span>Impossibile</span>
        </div>
      </div>
      
      {/* Tabella Mosaico */}
      <div className="inline-block min-w-full">
        {/* Intestazione colonne (risultati rivale) */}
        <div className="grid grid-cols-11 gap-1 mb-1">
          <div className="text-center text-xs font-bold text-gray-500 p-2"></div>
          {SCORING_POSITIONS.map(pos => (
            <div key={`header-${pos.position}`} className="text-center">
              <div className="text-lg">{pos.emoji}</div>
              <div className="text-xs font-bold text-gray-600">{pos.label}</div>
            </div>
          ))}
        </div>
        
        {/* Righe della matrice */}
        {SCORING_POSITIONS.map(yourPos => (
          <div key={`row-${yourPos.position}`} className="grid grid-cols-11 gap-1 mb-1">
            {/* Intestazione riga (risultati pilota) */}
            <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg p-1">
              <div className="text-lg">{yourPos.emoji}</div>
              <div className="text-xs font-bold text-gray-600">{yourPos.label}</div>
            </div>
            
            {/* Celle */}
            {SCORING_POSITIONS.map(rivalPos => {
              const cell = matrix[yourPos.position - 1][rivalPos.position - 1];
              return (
                <motion.button
                  key={`cell-${yourPos.position}-${rivalPos.position}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => cell?.isPossible && onCellClick(cell.yourPos, cell.rivalPos)}
                  onMouseEnter={() => setHoveredCell(cell)}
                  onMouseLeave={() => setHoveredCell(null)}
                  className={`
                    relative rounded-lg p-2 text-center transition-all min-h-[60px]
                    ${getCellColor(cell)}
                    ${isBest(cell) ? 'ring-2 ring-red-500 ring-offset-2' : ''}
                    ${cell?.isPossible ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
                  `}
                  disabled={!cell?.isPossible}
                >
                  {cell && (
                    <>
                      <div className="text-sm font-bold">
                        {cell.isPossible ? `✅ ${cell.racesNeeded}g` : '❌'}
                      </div>
                      <div className="text-xs">
                        ±{Math.abs(cell.gain)} pt/g
                      </div>
                      {isBest(cell) && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      )}
                    </>
                  )}
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Tooltip hover */}
      {hoveredCell && (
        <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm">
          <div className="font-bold mb-1">
            {hoveredCell.isPossible ? '✅ Combinazione Possibile' : '❌ Combinazione Impossibile'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Il tuo piazzamento:</span>
              <span className="ml-2 font-bold">{hoveredCell.yourPos}° ({hoveredCell.yourPoints} pt)</span>
            </div>
            <div>
              <span className="text-gray-500">Piazzamento rivale:</span>
              <span className="ml-2 font-bold">{hoveredCell.rivalPos}° ({hoveredCell.rivalPoints} pt)</span>
            </div>
            <div>
              <span className="text-gray-500">Guadagno a gara:</span>
              <span className="ml-2 font-bold text-green-600">+{hoveredCell.gain} pt</span>
            </div>
            {hoveredCell.isPossible && (
              <>
                <div>
                  <span className="text-gray-500">Gare necessarie:</span>
                  <span className="ml-2 font-bold text-blue-600">{hoveredCell.racesNeeded}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Sorpasso alla gara:</span>
                  <span className="ml-2 font-bold text-green-600">{hoveredCell.overtakeRace}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Best combination highlight */}
      {bestCombination && (
        <div className="mt-3 p-2 bg-green-50 rounded-lg text-xs text-center">
          ⭐ Migliore combinazione: {bestCombination.yourPos}° vs {bestCombination.rivalPos}° → 
          sorpasso in {bestCombination.racesNeeded} gare
        </div>
      )}
    </div>
  );
}

// 🔥 MODAL CON DETTAGLIO DELLA CELLA SELEZIONATA
function CellDetailModal({
  isOpen,
  onClose,
  yourDriver,
  rival,
  yourPos,
  rivalPos,
  racesLeft
}: {
  isOpen: boolean;
  onClose: () => void;
  yourDriver: Driver;
  rival: Driver;
  yourPos: number;
  rivalPos: number;
  racesLeft: number;
}) {
  const yourPosData = SCORING_POSITIONS.find(p => p.position === yourPos)!;
  const rivalPosData = SCORING_POSITIONS.find(p => p.position === rivalPos)!;
  const gainPerRace = yourPosData.points - rivalPosData.points;
  const racesNeeded = Math.ceil((rival.points - yourDriver.points + 1) / gainPerRace);
  
  const details = generateDetailedCombination(yourDriver, rival, yourPos, rivalPos, racesLeft);
  
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
            className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Dettaglio Combinazione</h2>
                  <p className="text-red-100">
                    {yourDriver.driver_name} <strong>{yourPosData.label}</strong> ({yourPosData.points} pt) vs 
                    {rival.driver_name} <strong>{rivalPosData.label}</strong> ({rivalPosData.points} pt)
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">{yourPosData.emoji}</div>
                  <div className="font-bold text-green-800">{yourDriver.driver_name}</div>
                  <div className="text-sm">{yourPosData.points} pt a gara</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">{rivalPosData.emoji}</div>
                  <div className="font-bold text-red-800">{rival.driver_name}</div>
                  <div className="text-sm">{rivalPosData.points} pt a gara</div>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-xl p-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Guadagno a gara:</span>
                    <span className="ml-2 font-bold text-green-600">+{gainPerRace} pt</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Gare necessarie:</span>
                    <span className="ml-2 font-bold">{racesNeeded}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Partenza:</span>
                    <span className="ml-2">{yourDriver.points} - {rival.points}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Arrivo:</span>
                    <span className="ml-2 font-bold">{details.finalYourPoints} - {details.finalRivalPoints}</span>
                  </div>
                </div>
              </div>
              
              <h4 className="font-bold mb-3">📊 Andamento gara per gara:</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {details.results.map(result => (
                  <div 
                    key={result.raceNumber}
                    className={`p-3 rounded-lg ${result.isOvertake ? 'bg-green-100 border border-green-300' : 'bg-gray-50'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Gara {result.raceNumber}</span>
                      {result.isOvertake && (
                        <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">SORPASSO!</span>
                      )}
                    </div>
                    <div className="flex justify-between mt-1 text-sm">
                      <span>{yourDriver.driver_name}: {result.yourTotal} pt</span>
                      <span>{rival.driver_name}: {result.rivalTotal} pt</span>
                      <span className={result.yourTotal > result.rivalTotal ? 'text-green-600 font-bold' : 'text-red-600'}>
                        {result.yourTotal > result.rivalTotal ? '👍 Avanti' : '👎 Dietro'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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
  const [selectedCell, setSelectedCell] = useState<{ yourPos: number; rivalPos: number } | null>(null);

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

  const mosaicData = useMemo(() => {
    if (!selectedDriver || !selectedRival || racesLeft === 0) return null;
    return generateMosaic(selectedDriver, selectedRival, racesLeft);
  }, [selectedDriver, selectedRival, racesLeft]);

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
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Mosaico Strategie</span>
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

            {/* Mosaic Diagram */}
            {selectedRival && mosaicData && (
              <MosaicDiagram
                cells={mosaicData.cells}
                bestCombination={mosaicData.bestCombination}
                yourDriver={selectedDriver}
                rival={selectedRival}
                racesLeft={racesLeft}
                onCellClick={(yourPos, rivalPos) => setSelectedCell({ yourPos, rivalPos })}
              />
            )}

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

      {/* Cell Detail Modal */}
      {selectedCell && selectedDriver && selectedRival && (
        <CellDetailModal
          isOpen={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          yourDriver={selectedDriver}
          rival={selectedRival}
          yourPos={selectedCell.yourPos}
          rivalPos={selectedCell.rivalPos}
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
                <h3 className="font-black text-lg">Diagramma a Mosaico</h3>
                <button onClick={() => setShowInfo(false)} className="w-8 h-8 rounded-full bg-gray-100">
                  <X className="w-4 h-4 mx-auto" />
                </button>
              </div>
              <div className="space-y-4 text-sm text-gray-600">
                <p>
                  Il <strong>diagramma a mosaico</strong> mostra tutte le possibili combinazioni di piazzamenti:
                </p>
                <ul className="list-disc list-inside space-y-2">
                  <li>🟢 <strong>Verde</strong>: Possibile in poche gare</li>
                  <li>🟡 <strong>Giallo</strong>: Possibile in 6-7 gare</li>
                  <li>🟠 <strong>Arancione</strong>: Possibile in 8+ gare</li>
                  <li>🔴 <strong>Rosso</strong>: Impossibile</li>
                </ul>
                <p className="text-xs text-gray-400 mt-2">
                  Clicca su una cella verde/gialla/arancione per vedere il dettaglio gara per gara!
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
