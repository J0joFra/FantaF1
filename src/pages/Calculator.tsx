import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Info, X, Share2, Bookmark, ChevronDown, ChevronUp,
  Trophy, RotateCcw, AlertTriangle, Sparkles, Target, Users, CheckCircle2, HelpCircle,
  TrendingUp, Award, BarChart3, Eye, Clock
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
  currentGap: number;
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

interface RivalCombination {
  yourFinishes: { position: string; emoji: string; points: number; count: number }[];
  rivalFinishes: { position: string; emoji: string; points: number; count: number }[];
  totalYourPoints: number;
  totalRivalPoints: number;
  finalGap: number;
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

  const rivalsAnalysis: RivalAnalysis[] = allDrivers
    .filter(d => d.id !== driver.id && d.points >= driver.points)
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
    .sort((a, b) => a.pointsNeeded - b.pointsNeeded);

  const activeRivals = rivalsAnalysis.filter(r => r.pointsNeeded > 0 && !r.isMathematicallyEliminated);
  
  const mainRival = activeRivals.length > 0
    ? activeRivals.reduce((a, b) => a.pointsNeeded > b.pointsNeeded ? a : b)
    : null;

  const isAlreadyChampion = activeRivals.length === 0 && driverMaxPossible > 0 && driver.points > Math.max(...allDrivers.map(d => d.points));
  const isMathematicallyOut = driverMaxPossible < Math.max(...allDrivers.map(d => d.points));
  
  const magicNumber = mainRival?.pointsNeeded ?? 0;

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
  const realisticPoints = [12, 10, 8, 6, 4];
  let remaining = pointsNeeded;
  let racesUsed = 0;
  const finishes: any[] = [];
  
  for (let i = 0; i < realisticPoints.length && remaining > 0 && racesUsed < racesLeft; i++) {
    const pts = realisticPoints[i];
    const count = Math.min(Math.ceil(remaining / pts), racesLeft - racesUsed);
    
    if (count > 0) {
      finishes.push({
        position: POSITION_LABELS[i + 3],
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

// 🔥 NUOVA FUNZIONE: Genera combinazioni specifiche per superare un rivale
function generateRivalCombinations(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): RivalCombination[] {
  const combinations: RivalCombination[] = [];
  const pointsNeeded = rival.points - yourDriver.points + 1; // Punti da recuperare
  
  if (pointsNeeded <= 0) {
    return [];
  }

  // Strategia 1: Vittorie dominanti (tu fai tante vittorie, lui fa piazzamenti medi)
  const strat1 = calculateScenario(yourDriver, rival, racesLeft, sprintsLeft, {
    yourBest: true,
    rivalAverage: true
  });
  if (strat1) combinations.push(strat1);

  // Strategia 2: Tu fai podi costanti, lui fa risultati mediocri
  const strat2 = calculateScenario(yourDriver, rival, racesLeft, sprintsLeft, {
    yourConsistent: true,
    rivalPoor: true
  });
  if (strat2) combinations.push(strat2);

  // Strategia 3: Competizione diretta (stessi risultati, ma tu meglio in alcune gare)
  const strat3 = calculateDirectCompetition(yourDriver, rival, racesLeft, sprintsLeft);
  if (strat3) combinations.push(strat3);

  // Strategia 4: Tu sfrutti le Sprint, lui no
  if (sprintsLeft > 0) {
    const strat4 = calculateSprintAdvantage(yourDriver, rival, racesLeft, sprintsLeft);
    if (strat4) combinations.push(strat4);
  }

  return combinations.slice(0, 4);
}

function calculateScenario(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number,
  type: { yourBest?: boolean; yourConsistent?: boolean; rivalAverage?: boolean; rivalPoor?: boolean }
): RivalCombination | null {
  let yourPoints = 0;
  let rivalPoints = 0;
  const yourFinishes: { position: string; emoji: string; points: number; count: number }[] = [];
  const rivalFinishes: { position: string; emoji: string; points: number; count: number }[] = [];

  let remainingRaces = racesLeft;
  let remainingSprints = sprintsLeft;

  // Calcola i tuoi risultati
  if (type.yourBest) {
    // Tu fai più vittorie possibili
    const wins = Math.min(Math.ceil((rival.points - yourDriver.points + 1) / 25), racesLeft);
    if (wins > 0) {
      yourFinishes.push({ position: "1°", emoji: "🥇", points: 25, count: wins });
      yourPoints += wins * 25;
      remainingRaces -= wins;
    }
    
    // Il resto podi
    if (remainingRaces > 0) {
      const podiums = remainingRaces;
      yourFinishes.push({ position: "2°", emoji: "🥈", points: 18, count: podiums });
      yourPoints += podiums * 18;
    }
  } else if (type.yourConsistent) {
    // Tu fai sempre podi (2° o 3° posto)
    const totalRaces = remainingRaces;
    const secondPlaces = Math.floor(totalRaces / 2);
    const thirdPlaces = totalRaces - secondPlaces;
    
    if (secondPlaces > 0) {
      yourFinishes.push({ position: "2°", emoji: "🥈", points: 18, count: secondPlaces });
      yourPoints += secondPlaces * 18;
    }
    if (thirdPlaces > 0) {
      yourFinishes.push({ position: "3°", emoji: "🥉", points: 15, count: thirdPlaces });
      yourPoints += thirdPlaces * 15;
    }
  }

  // Calcola i risultati del rivale
  if (type.rivalAverage) {
    // Rivale fa piazzamenti medi (5°-8° posto)
    const totalRaces = remainingRaces;
    const avgPoints = [10, 8, 6, 4]; // 4°,5°,6°,7°
    for (let i = 0; i < totalRaces && i < avgPoints.length; i++) {
      const count = Math.ceil((totalRaces - i) / (avgPoints.length - i));
      rivalFinishes.push({ 
        position: POSITION_LABELS[i + 3], 
        emoji: POSITION_EMOJI[i + 3], 
        points: avgPoints[i], 
        count: Math.min(count, totalRaces - rivalFinishes.reduce((acc, f) => acc + f.count, 0))
      });
      rivalPoints += avgPoints[i] * count;
    }
  } else if (type.rivalPoor) {
    // Rivale fa risultati pessimi (fuori punti)
    rivalFinishes.push({ position: "11°+", emoji: "💤", points: 0, count: remainingRaces });
    rivalPoints = 0;
  }

  const finalYourPoints = yourDriver.points + yourPoints;
  const finalRivalPoints = rival.points + rivalPoints;
  const finalGap = finalYourPoints - finalRivalPoints;

  if (finalGap > 0) {
    return {
      yourFinishes: yourFinishes.filter(f => f.count > 0),
      rivalFinishes: rivalFinishes.filter(f => f.count > 0),
      totalYourPoints: finalYourPoints,
      totalRivalPoints: finalRivalPoints,
      finalGap,
      description: getScenarioDescription(type)
    };
  }

  return null;
}

function calculateDirectCompetition(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): RivalCombination | null {
  const yourFinishes: { position: string; emoji: string; points: number; count: number }[] = [];
  const rivalFinishes: { position: string; emoji: string; points: number; count: number }[] = [];
  
  let yourPoints = 0;
  let rivalPoints = 0;
  let gapClosed = 0;
  let racesNeeded = 0;

  // Simula competizione diretta: in ogni gara devi finire meglio del rivale
  for (let i = 0; i < racesLeft && gapClosed < (rival.points - yourDriver.points); i++) {
    // Tu vinci (25 pt), lui fa 2° (18 pt) -> guadagni 7 punti a gara
    yourPoints += 25;
    rivalPoints += 18;
    gapClosed += 7;
    racesNeeded++;
  }

  if (gapClosed >= (rival.points - yourDriver.points)) {
    yourFinishes.push({ position: "1°", emoji: "🥇", points: 25, count: racesNeeded });
    rivalFinishes.push({ position: "2°", emoji: "🥈", points: 18, count: racesNeeded });
    
    return {
      yourFinishes,
      rivalFinishes,
      totalYourPoints: yourDriver.points + yourPoints,
      totalRivalPoints: rival.points + rivalPoints,
      finalGap: (yourDriver.points + yourPoints) - (rival.points + rivalPoints),
      description: "🎯 Competizione diretta: finisci sempre davanti al rivale"
    };
  }

  return null;
}

function calculateSprintAdvantage(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): RivalCombination | null {
  const yourFinishes: { position: string; emoji: string; points: number; count: number }[] = [];
  const rivalFinishes: { position: string; emoji: string; points: number; count: number }[] = [];
  
  // Sfrutti le Sprint (tu vinci Sprint, lui non fa punti)
  const sprintAdvantage = 8 * sprintsLeft;
  const remainingNeeded = (rival.points - yourDriver.points + 1) - sprintAdvantage;
  
  if (remainingNeeded <= 0) {
    yourFinishes.push({ position: "Sprint", emoji: "⚡", points: 8, count: sprintsLeft, isSprint: true });
    rivalFinishes.push({ position: "11°+", emoji: "💤", points: 0, count: sprintsLeft });
    
    return {
      yourFinishes,
      rivalFinishes,
      totalYourPoints: yourDriver.points + (sprintsLeft * 8),
      totalRivalPoints: rival.points,
      finalGap: (yourDriver.points + (sprintsLeft * 8)) - rival.points,
      description: "⚡ Vantaggio Sprint: domini le gare del sabato"
    };
  }
  
  return null;
}

function getScenarioDescription(type: any): string {
  if (type.yourBest && type.rivalAverage) return "🏆 Scenario ottimale: Tu vinci, lui è a metà classifica";
  if (type.yourConsistent && type.rivalPoor) return "📊 Scenario sicuro: Tu sempre a podio, lui fuori punti";
  return "📈 Scenario alternativo";
}

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

// 🔥 NUOVO COMPONENTE: Modal per le combinazioni del rivale
function RivalDetailModal({ 
  isOpen, 
  onClose, 
  yourDriver, 
  rival, 
  racesLeft, 
  sprintsLeft 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  yourDriver: Driver; 
  rival: Driver; 
  racesLeft: number; 
  sprintsLeft: number;
}) {
  const combinations = useMemo(() => {
    if (!yourDriver || !rival) return [];
    return generateRivalCombinations(yourDriver, rival, racesLeft, sprintsLeft);
  }, [yourDriver, rival, racesLeft, sprintsLeft]);

  const pointsToRecover = rival.points - yourDriver.points + 1;

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
            className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Come superare {rival.driver_name}</h2>
                  <p className="text-red-100 text-sm">
                    Devi recuperare <span className="font-bold text-xl">{pointsToRecover}</span> punti
                  </p>
                  <p className="text-red-100 text-xs mt-1">
                    Situazione attuale: {yourDriver.driver_name} ({yourDriver.points} pt) vs {rival.driver_name} ({rival.points} pt)
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Gare rimanenti: {racesLeft} GP {sprintsLeft > 0 && `+ ${sprintsLeft} Sprint`}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Ecco alcune strategie per superare {rival.driver_name}:
                  </p>
                </div>

                {combinations.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Non ci sono combinazioni possibili con le gare rimanenti</p>
                  </div>
                ) : (
                  combinations.map((combo, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow"
                    >
                      <div className="mb-3">
                        <span className="text-sm font-bold text-red-600">{combo.description}</span>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Tuoi risultati */}
                        <div className="bg-green-50 rounded-lg p-3">
                          <h4 className="font-bold text-green-800 mb-2 flex items-center gap-1">
                            <Trophy className="w-4 h-4" />
                            {yourDriver.driver_name}
                          </h4>
                          <div className="space-y-2">
                            {combo.yourFinishes.map((finish, i) => (
                              <div key={i} className="flex justify-between items-center text-sm">
                                <span>{finish.emoji} {finish.position}</span>
                                <span className="font-mono">×{finish.count}</span>
                                <span className="font-bold">{finish.points * finish.count} pt</span>
                              </div>
                            ))}
                            <div className="border-t border-green-200 mt-2 pt-2">
                              <div className="flex justify-between items-center font-bold">
                                <span>Totale:</span>
                                <span>{combo.totalYourPoints} pt</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Risultati rivale */}
                        <div className="bg-red-50 rounded-lg p-3">
                          <h4 className="font-bold text-red-800 mb-2 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            {rival.driver_name}
                          </h4>
                          <div className="space-y-2">
                            {combo.rivalFinishes.map((finish, i) => (
                              <div key={i} className="flex justify-between items-center text-sm">
                                <span>{finish.emoji} {finish.position}</span>
                                <span className="font-mono">×{finish.count}</span>
                                <span className="font-bold">{finish.points * finish.count} pt</span>
                              </div>
                            ))}
                            <div className="border-t border-red-200 mt-2 pt-2">
                              <div className="flex justify-between items-center font-bold">
                                <span>Totale:</span>
                                <span>{combo.totalRivalPoints} pt</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Distanza finale:</span>
                          <span className="font-bold text-lg text-green-600">+{combo.finalGap} pt</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {combo.finalGap > 0 ? `✅ ${yourDriver.driver_name} supera ${rival.driver_name}` : "❌ Non sufficiente"}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 p-4 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                💡 Queste sono combinazioni realistiche. I risultati effettivi possono variare in base alle prestazioni in pista.
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
  driverName, 
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
      className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${isMain ? 'border-red-300 bg-red-50/30 hover:bg-red-50/50' : 'border-gray-100 hover:border-gray-300'}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
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
        <Eye className="w-4 h-4 text-gray-400" />
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

            <CombinationsCard combinations={analysis.combinations} magicNumber={analysis.magicNumber} />

            {/* Rivals section - CLICCABILE */}
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

      {/* Rival Detail Modal */}
      {selectedRival && selectedDriver && (
        <RivalDetailModal
          isOpen={!!selectedRival}
          onClose={() => setSelectedRival(null)}
          yourDriver={selectedDriver}
          rival={selectedRival}
          racesLeft={racesLeft}
          sprintsLeft={sprintsLeft}
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
                    È il numero di punti che un pilota deve ancora conquistare per essere <strong className="text-gray-900">matematicamente certo</strong> di vincere il campionato.
                  </p>
                </div>

                <div className="bg-purple-50 p-4 rounded-xl">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-600" />
                    Clicca su un rivale
                  </h4>
                  <p>
                    Cliccando su qualsiasi pilota nella lista "Piloti da superare", potrai vedere nel dettaglio:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Quanti primi posti ti servono</li>
                    <li>Quali combinazioni di piazzamenti sono possibili</li>
                    <li>Scenario ottimale, alternativo e realistico</li>
                    <li>Confronto diretto dei risultati necessari</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Pareggio in classifica
                  </h4>
                  <p>
                    In caso di parità di punti, vince chi ha più <strong className="text-gray-900">vittorie</strong> in stagione.
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
