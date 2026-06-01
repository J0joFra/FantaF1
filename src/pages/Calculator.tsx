import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Info, X, Share2, Bookmark, ChevronDown, ChevronUp,
  Trophy, RotateCcw, AlertTriangle, Sparkles, Target, Users, CheckCircle2, HelpCircle,
  TrendingUp, Award, BarChart3, Eye, Clock, Equal, Zap, TrendingDown, GitCompare
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
  pointsNeeded: number;
  avgPointsPerRaceNeeded: number;
  difficulty: "impossible" | "very_hard" | "hard" | "medium" | "easy";
  difficultyLabel: string;
  suggestion: string;
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
      
      const totalRaces = racesLeft + sprintsLeft;
      let avgPointsPerRaceNeeded = pointsNeeded / totalRaces;
      
      let difficulty: "impossible" | "very_hard" | "hard" | "medium" | "easy";
      let difficultyLabel: string;
      let suggestion: string;
      
      if (avgPointsPerRaceNeeded > 25) {
        difficulty = "impossible";
        difficultyLabel = "❌ IMPOSSIBILE";
        suggestion = "Non può più raggiungere questo rivale matematicamente";
      } else if (avgPointsPerRaceNeeded > 18) {
        difficulty = "very_hard";
        difficultyLabel = "🔥 ESTREMAMENTE DIFFICILE";
        suggestion = "Deve vincere quasi tutte le gare (1° posto)";
      } else if (avgPointsPerRaceNeeded > 15) {
        difficulty = "hard";
        difficultyLabel = "⚠️ MOLTO DIFFICILE";
        suggestion = "Deve fare sempre podio (1°-2° posto)";
      } else if (avgPointsPerRaceNeeded > 12) {
        difficulty = "medium";
        difficultyLabel = "📈 MEDIO";
        suggestion = "Necessarie prestazioni da Top 3 costanti";
      } else if (avgPointsPerRaceNeeded > 8) {
        difficulty = "medium";
        difficultyLabel = "📊 ABBASTANZA POSSIBILE";
        suggestion = "Piazzamenti da Top 5 sono sufficienti";
      } else {
        difficulty = "easy";
        difficultyLabel = "✅ POSSIBILE";
        suggestion = "Buone prestazioni regolari bastano";
      }
      
      const isMathematicallyEliminated = driverMaxPossible < rival.points;
      
      return {
        driver: rival,
        currentGap,
        pointsNeeded: Math.max(1, pointsNeeded),
        avgPointsPerRaceNeeded,
        difficulty,
        difficultyLabel,
        suggestion,
        isMathematicallyEliminated,
      };
    })
    .sort((a, b) => b.avgPointsPerRaceNeeded - a.avgPointsPerRaceNeeded);
  
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

// 🔥 CALCOLO COMPARAZIONE DIRETTA TRA TE E IL RIVALE
function calculateHeadToHeadComparison(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): {
  scenarios: {
    name: string;
    description: string;
    yourFinishes: { position: string; emoji: string; points: number; count: number; isSprint?: boolean }[];
    rivalFinishes: { position: string; emoji: string; points: number; count: number; isSprint?: boolean }[];
    yourTotalPoints: number;
    rivalTotalPoints: number;
    finalGap: number;
    isEnough: boolean;
  }[];
} {
  const scenarios = [];
  const pointsNeeded = rival.points - yourDriver.points + 1;
  const totalRaces = racesLeft + sprintsLeft;
  const avgNeeded = pointsNeeded / totalRaces;
  
  // Trova la posizione media necessaria
  let avgPosition = 11;
  let avgPoints = 0;
  for (let i = 0; i < RACE_POINTS.length; i++) {
    if (RACE_POINTS[i] >= avgNeeded) {
      avgPosition = i + 1;
      avgPoints = RACE_POINTS[i];
      break;
    }
  }
  
  // Calcola la posizione media del rivale (ipotesi: mantiene la sua media attuale)
  const rivalAvgPosition = getPositionByPointsApprox(rival.points / (racesLeft + sprintsLeft));
  
  // Scenario 1: Performance costante vs rivale costante
  scenarios.push({
    name: "📊 Confronto Costante",
    description: `Tu mantieni una media di ${avgNeeded.toFixed(2)} pt/gara (${avgPosition}° posto), lui mantiene la sua media attuale`,
    yourFinishes: [{ position: POSITION_LABELS[avgPosition - 1], emoji: POSITION_EMOJI[avgPosition - 1], points: avgPoints, count: totalRaces }],
    rivalFinishes: [{ position: rivalAvgPosition.position, emoji: rivalAvgPosition.emoji, points: rivalAvgPosition.points, count: totalRaces }],
    yourTotalPoints: yourDriver.points + (avgPoints * totalRaces),
    rivalTotalPoints: rival.points + (rivalAvgPosition.points * totalRaces),
    finalGap: (yourDriver.points + (avgPoints * totalRaces)) - (rival.points + (rivalAvgPosition.points * totalRaces)),
    isEnough: (avgPoints * totalRaces) >= pointsNeeded
  });
  
  // Scenario 2: Tu fai meglio in ogni gara
  const betterPosition = Math.max(1, avgPosition - 2);
  const betterPoints = RACE_POINTS[betterPosition - 1];
  scenarios.push({
    name: "⚡ Confronto Migliorativo",
    description: `Tu fai meglio del necessario (${betterPosition}° posto), lui mantiene la sua media`,
    yourFinishes: [{ position: POSITION_LABELS[betterPosition - 1], emoji: POSITION_EMOJI[betterPosition - 1], points: betterPoints, count: totalRaces }],
    rivalFinishes: [{ position: rivalAvgPosition.position, emoji: rivalAvgPosition.emoji, points: rivalAvgPosition.points, count: totalRaces }],
    yourTotalPoints: yourDriver.points + (betterPoints * totalRaces),
    rivalTotalPoints: rival.points + (rivalAvgPosition.points * totalRaces),
    finalGap: (yourDriver.points + (betterPoints * totalRaces)) - (rival.points + (rivalAvgPosition.points * totalRaces)),
    isEnough: (betterPoints * totalRaces) >= pointsNeeded
  });
  
  // Scenario 3: Competizione diretta - tu meglio in ogni gara
  const directComp = calculateDirectCompetition(yourDriver, rival, racesLeft, sprintsLeft);
  if (directComp) {
    scenarios.push(directComp);
  }
  
  // Scenario 4: Vittorie vs piazzamenti
  if (avgNeeded > 15) {
    const winsNeeded = Math.ceil(pointsNeeded / 25);
    const remainingRaces = totalRaces - winsNeeded;
    const remainingAvg = (pointsNeeded - (winsNeeded * 25)) / remainingRaces;
    
    let remainingPosition = 10;
    let remainingPoints = 0;
    for (let i = 0; i < RACE_POINTS.length; i++) {
      if (RACE_POINTS[i] >= remainingAvg) {
        remainingPosition = i + 1;
        remainingPoints = RACE_POINTS[i];
        break;
      }
    }
    
    scenarios.push({
      name: "🏆 Vittorie Strategiche",
      description: `${winsNeeded} vittorie e ${remainingRaces} piazzamenti da ${remainingPosition}° posto`,
      yourFinishes: [
        { position: "1°", emoji: "🥇", points: 25, count: winsNeeded },
        { position: POSITION_LABELS[remainingPosition - 1], emoji: POSITION_EMOJI[remainingPosition - 1], points: remainingPoints, count: remainingRaces }
      ],
      rivalFinishes: [{ position: rivalAvgPosition.position, emoji: rivalAvgPosition.emoji, points: rivalAvgPosition.points, count: totalRaces }],
      yourTotalPoints: yourDriver.points + (winsNeeded * 25) + (remainingPoints * remainingRaces),
      rivalTotalPoints: rival.points + (rivalAvgPosition.points * totalRaces),
      finalGap: (yourDriver.points + (winsNeeded * 25) + (remainingPoints * remainingRaces)) - (rival.points + (rivalAvgPosition.points * totalRaces)),
      isEnough: (winsNeeded * 25) + (remainingPoints * remainingRaces) >= pointsNeeded
    });
  }
  
  // Scenario 5: Vantaggio Sprint
  if (sprintsLeft > 0 && avgNeeded > 10) {
    const sprintWins = Math.min(sprintsLeft, Math.ceil(pointsNeeded / 8));
    const remainingNeeded = pointsNeeded - (sprintWins * 8);
    const racesNeeded = Math.ceil(remainingNeeded / 25);
    
    if (racesNeeded <= racesLeft) {
      scenarios.push({
        name: "⚡ Vantaggio Sprint",
        description: `${sprintWins} vittorie nelle Sprint + ${racesNeeded} vittorie nei GP`,
        yourFinishes: [
          { position: "Sprint", emoji: "⚡", points: 8, count: sprintWins, isSprint: true },
          { position: "1°", emoji: "🥇", points: 25, count: racesNeeded }
        ],
        rivalFinishes: [
          { position: "11°+", emoji: "💤", points: 0, count: sprintWins, isSprint: true },
          { position: rivalAvgPosition.position, emoji: rivalAvgPosition.emoji, points: rivalAvgPosition.points, count: totalRaces - sprintWins }
        ],
        yourTotalPoints: yourDriver.points + (sprintWins * 8) + (racesNeeded * 25),
        rivalTotalPoints: rival.points + (rivalAvgPosition.points * (totalRaces - sprintWins)),
        finalGap: (yourDriver.points + (sprintWins * 8) + (racesNeeded * 25)) - (rival.points + (rivalAvgPosition.points * (totalRaces - sprintWins))),
        isEnough: (sprintWins * 8) + (racesNeeded * 25) >= pointsNeeded
      });
    }
  }
  
  return { scenarios: scenarios.filter(s => s.isEnough) };
}

function getPositionByPointsApprox(avgPoints: number): { position: string; emoji: string; points: number } {
  for (let i = 0; i < RACE_POINTS.length; i++) {
    if (RACE_POINTS[i] <= avgPoints) {
      return {
        position: POSITION_LABELS[i],
        emoji: POSITION_EMOJI[i],
        points: RACE_POINTS[i]
      };
    }
  }
  return { position: "11°+", emoji: "💤", points: 0 };
}

function calculateDirectCompetition(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): any {
  const gap = rival.points - yourDriver.points;
  const totalRaces = racesLeft + sprintsLeft;
  
  // Tu fai 1° (25pt), lui fa 2° (18pt) -> recuperi 7 a gara
  const gainPerRace = 7;
  const racesNeeded = Math.ceil((gap + 1) / gainPerRace);
  
  if (racesNeeded <= totalRaces) {
    return {
      name: "🎯 Confronto Diretto",
      description: `In ogni gara finisci ${racesNeeded} volte davanti a ${rival.driver_name} (1° vs 2°)`,
      yourFinishes: [{ position: "1°", emoji: "🥇", points: 25, count: racesNeeded }],
      rivalFinishes: [{ position: "2°", emoji: "🥈", points: 18, count: racesNeeded }],
      yourTotalPoints: yourDriver.points + (25 * racesNeeded),
      rivalTotalPoints: rival.points + (18 * racesNeeded),
      finalGap: (yourDriver.points + (25 * racesNeeded)) - (rival.points + (18 * racesNeeded)),
      isEnough: true
    };
  }
  return null;
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

  const totalRaces = analysis.racesLeft + analysis.sprintsLeft;

  return (
    <div className="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-2xl p-6 shadow-lg">
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 mb-3">
          <Target className="w-4 h-4" />
          <span className="text-xs font-medium">OBIETTIVO</span>
        </div>
        <p className="text-7xl font-black mt-1">{analysis.magicNumber}</p>
        <p className="text-red-100 text-sm mt-2">punti da conquistare</p>
        <p className="text-red-100 text-xs mt-1">
          su {totalRaces} gare totali ({analysis.racesLeft} GP + {analysis.sprintsLeft} Sprint)
        </p>
      </div>

      {analysis.mainRival && (
        <div className="bg-white/10 rounded-xl p-3 mb-4">
          <p className="text-xs text-red-100 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            RIVALE PRINCIPALE
          </p>
          <div className="flex justify-between items-center">
            <div>
              <span className="font-bold text-lg">{analysis.mainRival.driver.driver_name}</span>
              <p className="text-xs text-red-100">{analysis.mainRival.driver.team}</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-mono">{analysis.mainRival.driver.points} pt</span>
              <p className="text-xs text-red-100">dietro di {analysis.mainRival.currentGap} pt</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10">
            <p className="text-xs text-red-100">
              Media necessaria: <strong className="text-lg">{analysis.mainRival.avgPointsPerRaceNeeded.toFixed(2)}</strong> pt/gara
            </p>
            <p className="text-xs text-red-100 mt-1">
              {analysis.mainRival.suggestion}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// 🔥 MODAL CON COMPARAZIONE DIRETTA
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
  const pointsNeeded = rival.points - yourDriver.points + 1;
  const totalRaces = racesLeft + sprintsLeft;
  const avgNeeded = pointsNeeded / totalRaces;
  
  // Calcola la posizione media necessaria
  let avgPosition = 11;
  let avgPoints = 0;
  for (let i = 0; i < RACE_POINTS.length; i++) {
    if (RACE_POINTS[i] >= avgNeeded) {
      avgPosition = i + 1;
      avgPoints = RACE_POINTS[i];
      break;
    }
  }
  
  const comparison = calculateHeadToHeadComparison(yourDriver, rival, racesLeft, sprintsLeft);

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
                  <h2 className="text-2xl font-bold mb-2">Confronto: {yourDriver.driver_name} vs {rival.driver_name}</h2>
                  <p className="text-red-100 text-sm">
                    Devi recuperare <span className="font-bold text-xl">{pointsNeeded}</span> punti
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Statistiche chiave */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    Analisi Matematica
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Gare totali</p>
                      <p className="font-bold text-gray-900">{totalRaces} ({racesLeft} GP + {sprintsLeft} Sprint)</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Punti da recuperare</p>
                      <p className="font-bold text-red-600">{pointsNeeded} pt</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Media punti/gara necessaria</p>
                      <p className="font-bold text-blue-600 text-lg">{avgNeeded.toFixed(2)} pt</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Posizione media necessaria</p>
                      <p className="font-bold text-blue-600">{avgPosition}° posto ({avgPoints} pt)</p>
                    </div>
                  </div>
                </div>

                {/* Scenari di confronto diretto */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-red-500" />
                    Scenari di Confronto Diretto
                  </h3>
                  <div className="space-y-4">
                    {comparison.scenarios.map((scenario, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="border-2 border-gray-200 rounded-xl p-4 hover:border-red-300 transition-all"
                      >
                        <div className="mb-3">
                          <span className="text-sm font-bold text-red-600">{scenario.name}</span>
                          <p className="text-xs text-gray-500 mt-1">{scenario.description}</p>
                        </div>
                        
                        {/* Tabella comparativa */}
                        <div className="grid md:grid-cols-2 gap-4 mt-3">
                          {/* Tuoi risultati */}
                          <div className="bg-green-50 rounded-lg p-3">
                            <h4 className="font-bold text-green-800 mb-2 flex items-center gap-1">
                              <Trophy className="w-4 h-4" />
                              {yourDriver.driver_name}
                            </h4>
                            <div className="space-y-2">
                              {scenario.yourFinishes.map((finish, i) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{finish.emoji}</span>
                                    <span className="font-medium">{finish.position}</span>
                                    {finish.isSprint && <span className="text-xs bg-purple-200 px-1 rounded">Sprint</span>}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-gray-600">×{finish.count}</span>
                                    <span className="font-bold text-green-700">
                                      {finish.points * finish.count} pt
                                    </span>
                                  </div>
                                </div>
                              ))}
                              <div className="border-t border-green-200 mt-2 pt-2">
                                <div className="flex justify-between items-center font-bold">
                                  <span>Punti attuali:</span>
                                  <span>{yourDriver.points} pt</span>
                                </div>
                                <div className="flex justify-between items-center font-bold text-green-700">
                                  <span>Totale finale:</span>
                                  <span>{scenario.yourTotalPoints} pt</span>
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
                              {scenario.rivalFinishes.map((finish, i) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{finish.emoji}</span>
                                    <span className="font-medium">{finish.position}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-gray-600">×{finish.count}</span>
                                    <span className="font-bold text-red-700">
                                      {finish.points * finish.count} pt
                                    </span>
                                  </div>
                                </div>
                              ))}
                              <div className="border-t border-red-200 mt-2 pt-2">
                                <div className="flex justify-between items-center font-bold">
                                  <span>Punti attuali:</span>
                                  <span>{rival.points} pt</span>
                                </div>
                                <div className="flex justify-between items-center font-bold text-red-700">
                                  <span>Totale finale:</span>
                                  <span>{scenario.rivalTotalPoints} pt</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Risultato del confronto */}
                        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <span className="text-sm text-gray-600">Differenza finale:</span>
                            <span className={`font-bold text-lg ${scenario.finalGap > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {scenario.finalGap > 0 ? `+${scenario.finalGap}` : scenario.finalGap} pt
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${scenario.finalGap > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {scenario.finalGap > 0 ? `✅ ${yourDriver.driver_name} supera ${rival.driver_name}` : `❌ Non sufficiente`}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-gray-500 text-center">
                            {scenario.finalGap > 0 
                              ? `🏆 ${yourDriver.driver_name} vincerebbe il confronto diretto con ${scenario.finalGap} punti di vantaggio`
                              : `⚠️ Serve una strategia più aggressiva`}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Suggerimento finale */}
                <div className="bg-yellow-50 rounded-xl p-4">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-yellow-600" />
                    Suggerimento Strategico
                  </h4>
                  <p className="text-sm text-gray-700">
                    {avgNeeded > 18 
                      ? "🔥 Obiettivo molto difficile: devi puntare a vittorie consecutive e sperare in passi falsi del rivale"
                      : avgNeeded > 12 
                      ? "📈 Obiettivo impegnativo: la costanza ai vertici della classifica è fondamentale"
                      : "✅ Obiettivo realistico: con buone prestazioni regolari puoi farcela"}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Le Sprint Race sono un'ottima opportunità per recuperare punti preziosi (max 8 punti per vittoria)
                  </p>
                </div>
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
  driverName, 
  isMain, 
  onCardClick 
}: { 
  rival: RivalAnalysis; 
  driverName: string; 
  isMain?: boolean;
  onCardClick: () => void;
}) {
  const getDifficultyColor = () => {
    switch(rival.difficulty) {
      case "impossible": return "text-gray-500 bg-gray-100";
      case "very_hard": return "text-red-700 bg-red-100";
      case "hard": return "text-orange-700 bg-orange-100";
      case "medium": return "text-yellow-700 bg-yellow-100";
      default: return "text-green-700 bg-green-100";
    }
  };
  
  return (
    <div 
      onClick={onCardClick}
      className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md active:scale-98 ${
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
      
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-500">Media necessaria:</span>
          <span className={`text-sm font-bold ${rival.difficulty === 'impossible' ? 'text-gray-500' : 'text-red-600'}`}>
            {rival.avgPointsPerRaceNeeded.toFixed(2)} pt/gara
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor()}`}>
            {rival.difficultyLabel}
          </span>
          <Eye className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mt-2">{rival.suggestion}</p>
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

            {/* Rivals section */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Piloti da superare
                </h3>
                <span className="text-xs text-gray-400">
                  {analysis.allRivals.filter(r => !r.isMathematicallyEliminated && r.pointsNeeded > 0).length} da battere
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
                    .filter(r => !r.isMathematicallyEliminated && r.pointsNeeded > 0)
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
                className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors active:scale-95"
              >
                <Share2 className="w-4 h-4" /> Condividi
              </button>
              <button
                onClick={handleSave}
                className="flex items-center justify-center gap-2 py-3 bg-red-50 border border-red-200 rounded-xl font-medium text-red-600 hover:bg-red-100 transition-colors active:scale-95"
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
                    <GitCompare className="w-4 h-4 text-red-500" />
                    Confronto Diretto
                  </h4>
                  <p>
                    Cliccando su un rivale, puoi vedere:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>I risultati che DEVI ottenere tu</li>
                    <li>I risultati che FARÀ il rivale (stima)</li>
                    <li>Il confronto finale punto per punto</li>
                    <li>Diverse strategie per superarlo</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
