import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Info, X, Share2, Bookmark, ChevronDown, ChevronUp,
  Trophy, RotateCcw, AlertTriangle, Sparkles, Target, Users, CheckCircle2, HelpCircle,
  TrendingUp, Award, BarChart3, Eye, Clock, Equal, Zap
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
  yourFinishes: { position: string; emoji: string; points: number; count: number; isSprint?: boolean }[];
  rivalFinishes: { position: string; emoji: string; points: number; count: number; isSprint?: boolean }[];
  totalYourPoints: number;
  totalRivalPoints: number;
  finalGap: number;
  description: string;
  type: "optimal" | "direct" | "tie" | "sprint" | "realistic";
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

// 🔥 NUOVE FUNZIONI PER GLI SCENARI AVANZATI
function generateRivalCombinations(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): RivalCombination[] {
  const combinations: RivalCombination[] = [];
  const pointsNeeded = rival.points - yourDriver.points + 1;
  
  if (pointsNeeded <= 0) {
    return [];
  }

  // 1. Scenario Ottimale
  const optimal = calculateOptimalScenario(yourDriver, rival, racesLeft, sprintsLeft);
  if (optimal) combinations.push(optimal);

  // 2. Competizione Diretta - Multipli scenari
  const directScenarios = calculateDirectCompetitionScenarios(yourDriver, rival, racesLeft, sprintsLeft);
  combinations.push(...directScenarios);

  // 3. Scenario Pareggio
  const tieScenario = calculateTieScenario(yourDriver, rival, racesLeft, sprintsLeft);
  if (tieScenario) combinations.push(tieScenario);

  // 4. Vantaggio Sprint
  if (sprintsLeft > 0) {
    const sprintAdvantage = calculateSprintAdvantage(yourDriver, rival, racesLeft, sprintsLeft);
    if (sprintAdvantage) combinations.push(sprintAdvantage);
  }

  // 5. Scenario Realistico
  const realistic = calculateRealisticScenario(yourDriver, rival, racesLeft, sprintsLeft);
  if (realistic) combinations.push(realistic);

  return combinations;
}

// Scenario 1: Ottimale
function calculateOptimalScenario(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): RivalCombination | null {
  const yourFinishes: any[] = [];
  const rivalFinishes: any[] = [];
  
  let yourPoints = 0;
  let rivalPoints = 0;
  let remainingRaces = racesLeft;
  
  // Tu vinci quante più gare possibili
  const winsNeeded = Math.ceil((rival.points - yourDriver.points + 1) / 25);
  const actualWins = Math.min(winsNeeded, racesLeft);
  
  if (actualWins > 0) {
    yourFinishes.push({ position: "1°", emoji: "🥇", points: 25, count: actualWins });
    yourPoints += actualWins * 25;
    remainingRaces -= actualWins;
  }
  
  // Il resto podi
  if (remainingRaces > 0) {
    yourFinishes.push({ position: "2°", emoji: "🥈", points: 18, count: remainingRaces });
    yourPoints += remainingRaces * 18;
  }
  
  // Rivale fa piazzamenti medi
  const avgPoints = [12, 10, 8, 6];
  let remainingForRival = racesLeft;
  for (let i = 0; i < avgPoints.length && remainingForRival > 0; i++) {
    const count = Math.min(remainingForRival, Math.ceil(remainingForRival / (avgPoints.length - i)));
    rivalFinishes.push({ 
      position: POSITION_LABELS[i + 3], 
      emoji: POSITION_EMOJI[i + 3], 
      points: avgPoints[i], 
      count 
    });
    rivalPoints += avgPoints[i] * count;
    remainingForRival -= count;
  }
  
  const finalYourPoints = yourDriver.points + yourPoints;
  const finalRivalPoints = rival.points + rivalPoints;
  const finalGap = finalYourPoints - finalRivalPoints;
  
  if (finalGap > 0) {
    return {
      yourFinishes,
      rivalFinishes,
      totalYourPoints: finalYourPoints,
      totalRivalPoints: finalRivalPoints,
      finalGap,
      description: "🏆 Scenario Ottimale: Vittorie dominanti",
      type: "optimal"
    };
  }
  
  return null;
}

// Scenario 2: Competizione Diretta - Multipli scenari
function calculateDirectCompetitionScenarios(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): RivalCombination[] {
  const scenarios: RivalCombination[] = [];
  const gap = rival.points - yourDriver.points;
  
  // Definisci diversi gap da recuperare per gara
  const gapsPerRace = [7, 5, 3, 2]; // 7=1°vs2°, 5=1°vs3°, 3=2°vs4°, 2=3°vs5°
  const descriptions = [
    "🎯 Dominio totale: Tu vinci (25pt), lui 2° (18pt) → +7 a gara",
    "⚡ Vantaggio forte: Tu vinci (25pt), lui 3° (15pt) → +10 a gara",
    "📈 Vantaggio medio: Tu 2° (18pt), lui 4° (12pt) → +6 a gara",
    "🔄 Vantaggio leggero: Tu 3° (15pt), lui 5° (10pt) → +5 a gara"
  ];
  
  for (let i = 0; i < gapsPerRace.length; i++) {
    const gainPerRace = gapsPerRace[i];
    const racesNeeded = Math.ceil((gap + 1) / gainPerRace);
    
    if (racesNeeded <= racesLeft) {
      const yourFinishes: any[] = [];
      const rivalFinishes: any[] = [];
      
      // Determina i piazzamenti in base al gap
      let yourPos = "", rivalPos = "", yourEmoji = "", rivalEmoji = "";
      let yourPts = 0, rivalPts = 0;
      
      switch(gainPerRace) {
        case 7:
          yourPos = "1°"; yourEmoji = "🥇"; yourPts = 25;
          rivalPos = "2°"; rivalEmoji = "🥈"; rivalPts = 18;
          break;
        case 10:
          yourPos = "1°"; yourEmoji = "🥇"; yourPts = 25;
          rivalPos = "3°"; rivalEmoji = "🥉"; rivalPts = 15;
          break;
        case 6:
          yourPos = "2°"; yourEmoji = "🥈"; yourPts = 18;
          rivalPos = "4°"; rivalEmoji = "4️⃣"; rivalPts = 12;
          break;
        case 5:
          yourPos = "3°"; yourEmoji = "🥉"; yourPts = 15;
          rivalPos = "5°"; rivalEmoji = "5️⃣"; rivalPts = 10;
          break;
        default:
          yourPos = "1°"; yourEmoji = "🥇"; yourPts = 25;
          rivalPos = "2°"; rivalEmoji = "🥈"; rivalPts = 18;
      }
      
      yourFinishes.push({ position: yourPos, emoji: yourEmoji, points: yourPts, count: racesNeeded });
      rivalFinishes.push({ position: rivalPos, emoji: rivalEmoji, points: rivalPts, count: racesNeeded });
      
      const finalYourPoints = yourDriver.points + (yourPts * racesNeeded);
      const finalRivalPoints = rival.points + (rivalPts * racesNeeded);
      const finalGap = finalYourPoints - finalRivalPoints;
      
      if (finalGap > 0) {
        scenarios.push({
          yourFinishes,
          rivalFinishes,
          totalYourPoints: finalYourPoints,
          totalRivalPoints: finalRivalPoints,
          finalGap,
          description: descriptions[i],
          type: "direct"
        });
      }
    }
  }
  
  return scenarios;
}

// Scenario 3: Pareggio
function calculateTieScenario(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): RivalCombination | null {
  const gap = rival.points - yourDriver.points;
  
  // Per pareggiare, devi recuperare esattamente il gap
  // Esempio: se sei sotto di 20pt, devi fare 20pt più di lui
  
  // Cerca combinazioni dove recuperi ESATTAMENTE il gap
  for (let gainPerRace = 1; gainPerRace <= 15; gainPerRace++) {
    const racesNeeded = Math.ceil(gap / gainPerRace);
    
    if (racesNeeded <= racesLeft && (gainPerRace * racesNeeded) >= gap) {
      // Verifica se è possibile con piazzamenti reali
      const possibleCombos = findTieCombination(gap, racesNeeded);
      if (possibleCombos) {
        const yourFinishes = possibleCombos.yourFinishes;
        const rivalFinishes = possibleCombos.rivalFinishes;
        
        const finalYourPoints = yourDriver.points + possibleCombos.yourPoints;
        const finalRivalPoints = rival.points + possibleCombos.rivalPoints;
        
        return {
          yourFinishes,
          rivalFinishes,
          totalYourPoints: finalYourPoints,
          totalRivalPoints: finalRivalPoints,
          finalGap: finalYourPoints - finalRivalPoints,
          description: `⚖️ Scenario Pareggio: Recupero esatto di ${gap} punti in ${racesNeeded} gare`,
          type: "tie"
        };
      }
    }
  }
  
  return null;
}

function findTieCombination(gap: number, racesNeeded: number): any {
  // Cerca combinazioni dove yourPts - rivalPts = gap per ogni gara
  // e la somma totale = gap * racesNeeded
  const possiblePairs = [
    { your: 25, rival: 18, diff: 7 },  // 1° vs 2°
    { your: 25, rival: 15, diff: 10 }, // 1° vs 3°
    { your: 25, rival: 12, diff: 13 }, // 1° vs 4°
    { your: 18, rival: 15, diff: 3 },  // 2° vs 3°
    { your: 18, rival: 12, diff: 6 },  // 2° vs 4°
    { your: 15, rival: 12, diff: 3 },  // 3° vs 4°
    { your: 15, rival: 10, diff: 5 },  // 3° vs 5°
    { your: 12, rival: 10, diff: 2 },  // 4° vs 5°
  ];
  
  let remaining = gap;
  const yourFinishes: any[] = [];
  const rivalFinishes: any[] = [];
  let yourPoints = 0;
  let rivalPoints = 0;
  
  for (let i = 0; i < racesNeeded && remaining > 0; i++) {
    // Trova la coppia che si avvicina al remaining senza superarlo
    let bestPair = possiblePairs[0];
    for (const pair of possiblePairs) {
      if (pair.diff <= remaining && pair.diff > bestPair.diff) {
        bestPair = pair;
      }
    }
    
    yourFinishes.push({ position: getPositionByPoints(bestPair.your), emoji: getEmojiByPoints(bestPair.your), points: bestPair.your, count: 1 });
    rivalFinishes.push({ position: getPositionByPoints(bestPair.rival), emoji: getEmojiByPoints(bestPair.rival), points: bestPair.rival, count: 1 });
    yourPoints += bestPair.your;
    rivalPoints += bestPair.rival;
    remaining -= bestPair.diff;
  }
  
  if (remaining <= 0) {
    return { yourFinishes, rivalFinishes, yourPoints, rivalPoints };
  }
  
  return null;
}

// Scenario 4: Vantaggio Sprint
function calculateSprintAdvantage(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): RivalCombination | null {
  const yourFinishes: any[] = [];
  const rivalFinishes: any[] = [];
  const gap = rival.points - yourDriver.points;
  
  let yourPoints = 0;
  let rivalPoints = 0;
  
  // Tu vinci tutte le Sprint (8pt), lui non fa punti
  const sprintWins = Math.min(sprintsLeft, Math.ceil(gap / 8));
  
  if (sprintWins > 0) {
    yourFinishes.push({ position: "Sprint", emoji: "⚡", points: 8, count: sprintWins, isSprint: true });
    rivalFinishes.push({ position: "11°+", emoji: "💤", points: 0, count: sprintWins });
    yourPoints += sprintWins * 8;
    
    const remainingGap = gap - (sprintWins * 8);
    
    if (remainingGap <= 0) {
      const finalYourPoints = yourDriver.points + yourPoints;
      const finalRivalPoints = rival.points + rivalPoints;
      
      return {
        yourFinishes,
        rivalFinishes,
        totalYourPoints: finalYourPoints,
        totalRivalPoints: finalRivalPoints,
        finalGap: finalYourPoints - finalRivalPoints,
        description: `⚡ Vantaggio Sprint: ${sprintWins} vittorie nelle Sprint Race`,
        type: "sprint"
      };
    }
  }
  
  return null;
}

// Scenario 5: Realistico
function calculateRealisticScenario(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): RivalCombination | null {
  const yourFinishes: any[] = [];
  const rivalFinishes: any[] = [];
  const gap = rival.points - yourDriver.points;
  
  // Scenario realistico: tu fai podi, lui fa punti ma non podi
  let yourPoints = 0;
  let rivalPoints = 0;
  let remainingGap = gap;
  let racesUsed = 0;
  
  // Tu fai 3° posto (15pt) e lui 6° posto (8pt) -> guadagno 7 a gara
  const gainPerRace = 7;
  const racesNeeded = Math.ceil((gap + 1) / gainPerRace);
  
  if (racesNeeded <= racesLeft) {
    yourFinishes.push({ position: "3°", emoji: "🥉", points: 15, count: racesNeeded });
    rivalFinishes.push({ position: "6°", emoji: "6️⃣", points: 8, count: racesNeeded });
    yourPoints += 15 * racesNeeded;
    rivalPoints += 8 * racesNeeded;
    
    const finalYourPoints = yourDriver.points + yourPoints;
    const finalRivalPoints = rival.points + rivalPoints;
    
    return {
      yourFinishes,
      rivalFinishes,
      totalYourPoints: finalYourPoints,
      totalRivalPoints: finalRivalPoints,
      finalGap: finalYourPoints - finalRivalPoints,
      description: "📊 Scenario Realistico: Podi costanti contro piazzamenti a punti",
      type: "realistic"
    };
  }
  
  return null;
}

function getPositionByPoints(points: number): string {
  switch(points) {
    case 25: return "1°";
    case 18: return "2°";
    case 15: return "3°";
    case 12: return "4°";
    case 10: return "5°";
    case 8: return "6°";
    case 6: return "7°";
    case 4: return "8°";
    default: return "Punti";
  }
}

function getEmojiByPoints(points: number): string {
  switch(points) {
    case 25: return "🥇";
    case 18: return "🥈";
    case 15: return "🥉";
    case 12: return "4️⃣";
    case 10: return "5️⃣";
    case 8: return "6️⃣";
    case 6: return "7️⃣";
    case 4: return "8️⃣";
    default: return "📊";
  }
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

// 🔥 MODAL CON LAYOUT A COLONNE AFFIANCATE PER MOBILE
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
            className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
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

            {/* Content with scroll */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Gare rimanenti: {racesLeft} GP {sprintsLeft > 0 && `+ ${sprintsLeft} Sprint`}
                  </h3>
                  <p className="text-sm text-gray-600">
                Ecco diverse strategie per superare {rival.driver_name}:
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
                      <div className="mb-3 pb-2 border-b border-gray-100">
                        <span className={`text-sm font-bold px-2 py-1 rounded-full ${
                          combo.type === 'optimal' ? 'bg-green-100 text-green-700' :
                          combo.type === 'direct' ? 'bg-blue-100 text-blue-700' :
                          combo.type === 'tie' ? 'bg-purple-100 text-purple-700' :
                          combo.type === 'sprint' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {combo.description}
                        </span>
                      </div>
                      
                      {/* Layout a colonne affiancate per mobile */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Tuoi risultati */}
                        <div className="bg-green-50 rounded-lg p-3">
                          <h4 className="font-bold text-green-800 mb-3 flex items-center gap-1">
                            <Trophy className="w-4 h-4" />
                            {yourDriver.driver_name}
                          </h4>
                          <div className="space-y-2">
                            {combo.yourFinishes.map((finish, i) => (
                              <div key={i} className="flex justify-between items-center text-sm py-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{finish.emoji}</span>
                                  <span className="font-medium">{finish.position}</span>
                                  {finish.isSprint && <span className="text-xs bg-purple-200 px-1 rounded">Sprint</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-gray-600">×{finish.count}</span>
                                  <span className="font-bold text-green-700 w-16 text-right">
                                    {finish.points * finish.count} pt
                                  </span>
                                </div>
                              </div>
                            ))}
                            <div className="border-t border-green-200 mt-2 pt-2">
                              <div className="flex justify-between items-center font-bold">
                                <span>Totale:</span>
                                <span className="text-green-700">{combo.totalYourPoints} pt</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Risultati rivale */}
                        <div className="bg-red-50 rounded-lg p-3">
                          <h4 className="font-bold text-red-800 mb-3 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            {rival.driver_name}
                          </h4>
                          <div className="space-y-2">
                            {combo.rivalFinishes.map((finish, i) => (
                              <div key={i} className="flex justify-between items-center text-sm py-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{finish.emoji}</span>
                                  <span className="font-medium">{finish.position}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-gray-600">×{finish.count}</span>
                                  <span className="font-bold text-red-700 w-16 text-right">
                                    {finish.points * finish.count} pt
                                  </span>
                                </div>
                              </div>
                            ))}
                            <div className="border-t border-red-200 mt-2 pt-2">
                              <div className="flex justify-between items-center font-bold">
                                <span>Totale:</span>
                                <span className="text-red-700">{combo.totalRivalPoints} pt</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Risultato finale */}
                      <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <span className="text-sm text-gray-600">Distanza finale:</span>
                          <span className={`font-bold text-lg ${combo.finalGap > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {combo.finalGap > 0 ? `+${combo.finalGap} pt` : `${combo.finalGap} pt`}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${combo.finalGap > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {combo.finalGap > 0 ? '✅ Obiettivo raggiunto' : '❌ Non sufficiente'}
                          </span>
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
                💡 Queste sono simulazioni basate su combinazioni realistiche. I risultati effettivi possono variare.
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
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
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

            {/* Rivals section */}
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
                    <Target className="w-4 h-4 text-red-500" />
                    Nuove funzionalità!
                  </h4>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong>5 diversi scenari</strong> per superare ogni rivale</li>
                    <li><strong>Competizione Diretta</strong> con 4 varianti di gap per gara</li>
                    <li><strong>Scenario Pareggio</strong> che calcola esattamente come pareggiare</li>
                    <li><strong>Layout a colonne</strong> ottimizzato per mobile</li>
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
