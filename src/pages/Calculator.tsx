import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { shareElementAsImage } from "@/lib/shareImage";
import {
  Calculator, Info, X, Share2, ChevronDown, ChevronUp,
  Trophy, AlertTriangle, Sparkles, Target, TrendingUp, Award, Eye, HelpCircle,
  ChevronRight, Grid3x3, Zap, Clock, TrendingDown
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { getDriverStandings, getDriverSeasonStats } from "../lib/supabaseData";
import PageHeader from "@/components/PageHeader";
import { useI18n } from "@/lib/i18n";

// ─── Costanti F1 2026 ──────────────────────────────────────────────────────
const MAX_RACE_PTS = 25;
const MAX_SPRINT_PTS = 8;
const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
// Punti sprint: top 8
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const sprintPtsForPos = (pos: number) => (pos >= 1 && pos <= 8 ? SPRINT_POINTS[pos - 1] : 0);
const POSITION_LABELS = ["1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°"];
const POSITION_EMOJI = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const SCORING_POSITIONS = RACE_POINTS.map((pts, idx) => ({
  position: idx + 1,
  label: POSITION_LABELS[idx],
  emoji: POSITION_EMOJI[idx],
  points: pts,
  sprintPoints: sprintPtsForPos(idx + 1)
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

// 🔥 GENERA IL MOSAICO DELLE COMBINAZIONI (gara + sprint)
function generateMosaic(
  yourDriver: Driver,
  rival: Driver,
  racesLeft: number,
  sprintsLeft: number
): {
  cells: MosaicCell[];
  maxRacesNeeded: number;
  bestCombination: MosaicCell | null;
} {
  const cells: MosaicCell[] = [];
  const startGap = rival.points - yourDriver.points;
  const target = startGap + 1;
  const sprints = Math.min(Math.max(0, sprintsLeft), racesLeft);
  let maxRacesNeeded = 0;
  let bestCombination: MosaicCell | null = null;

  for (const yourPos of SCORING_POSITIONS) {
    for (const rivalPos of SCORING_POSITIONS) {
      const raceGain = yourPos.points - rivalPos.points;
      const sprintGain = yourPos.sprintPoints - rivalPos.sprintPoints;

      // Simula weekend per weekend: i prossimi `sprints` weekend includono anche la sprint.
      let cumulative = 0;
      let racesNeeded = 0;
      let reached = false;
      for (let i = 1; i <= racesLeft; i++) {
        cumulative += raceGain + (i <= sprints ? sprintGain : 0);
        if (cumulative >= target) { racesNeeded = i; reached = true; break; }
      }

      const cell: MosaicCell = {
        yourPos: yourPos.position,
        rivalPos: rivalPos.position,
        yourPoints: yourPos.points,
        rivalPoints: rivalPos.points,
        gain: raceGain,
        isPossible: reached,
        racesNeeded: reached ? racesNeeded : 0,
        overtakeRace: reached ? racesNeeded : null
      };
      cells.push(cell);

      if (reached) {
        maxRacesNeeded = Math.max(maxRacesNeeded, racesNeeded);
        if (!bestCombination || racesNeeded < bestCombination.racesNeeded) {
          bestCombination = cell;
        }
      }
    }
  }

  return { cells, maxRacesNeeded, bestCombination };
}

// 🔥 GENERA DETTAGLIO PER UNA CELLA SPECIFICA (gara + sprint)
function generateDetailedCombination(
  yourDriver: Driver,
  rival: Driver,
  yourPos: number,
  rivalPos: number,
  racesLeft: number,
  sprintsLeft: number
): {
  results: { raceNumber: number; yourTotal: number; rivalTotal: number; isOvertake: boolean; isSprint: boolean }[];
  overtakeAtRace: number;
  finalYourPoints: number;
  finalRivalPoints: number;
} {
  const yp = SCORING_POSITIONS.find(p => p.position === yourPos)!;
  const rp = SCORING_POSITIONS.find(p => p.position === rivalPos)!;
  const raceGain = yp.points - rp.points;
  const sprintGain = yp.sprintPoints - rp.sprintPoints;
  const target = rival.points - yourDriver.points + 1;
  const sprints = Math.min(Math.max(0, sprintsLeft), racesLeft);

  // Quante gare servono (simulazione weekend per weekend, sprint nei primi weekend)
  let cumulative = 0;
  let racesNeeded = racesLeft;
  for (let i = 1; i <= racesLeft; i++) {
    cumulative += raceGain + (i <= sprints ? sprintGain : 0);
    if (cumulative >= target) { racesNeeded = i; break; }
  }

  const results = [];
  let currentYour = yourDriver.points;
  let currentRival = rival.points;
  let overtakeAtRace = -1;

  for (let i = 1; i <= Math.min(racesNeeded, racesLeft); i++) {
    const isSprint = i <= sprints;
    currentYour += yp.points + (isSprint ? yp.sprintPoints : 0);
    currentRival += rp.points + (isSprint ? rp.sprintPoints : 0);
    const isOvertake = overtakeAtRace === -1 && currentYour > currentRival;

    if (isOvertake) {
      overtakeAtRace = i;
    }

    results.push({
      raceNumber: i,
      yourTotal: currentYour,
      rivalTotal: currentRival,
      isOvertake,
      isSprint
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
  const { t } = useI18n();
  if (analysis.isAlreadyChampion) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl p-6 text-center shadow-lg">
        <div className="relative inline-block mb-3">
          <Sparkles className="w-16 h-16 text-yellow-300 animate-pulse" />
          <Trophy className="w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-yellow-400" />
        </div>
        <h3 className="font-bold text-2xl mb-2">{t("sc_champion")}</h3>
        <p className="text-emerald-100 text-sm">
          {t("mc_alreadyWon", { driver: analysis.driver.driver_name })}
        </p>
      </div>
    );
  }

  if (analysis.isMathematicallyOut) {
    return (
      <div className="bg-gradient-to-br from-gray-700 to-gray-900 text-white rounded-2xl p-6 text-center shadow-lg">
        <AlertTriangle className="w-16 h-16 mx-auto mb-3 text-gray-400" />
        <h3 className="font-bold text-2xl mb-2">{t("sc_out")}</h3>
        <p className="text-gray-300 text-sm">
          {t("mc_cantWin", { driver: analysis.driver.driver_name })}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-rose-600 to-rose-800 text-white rounded-2xl p-5 shadow-lg">
      <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 mb-3 backdrop-blur-sm">
        <Target className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{t("sc_objective")}</span>
      </div>

      {analysis.mainRival && (
        <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
          <p className="text-xs text-rose-100 mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {t("sc_mainRival")}
          </p>
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg">{analysis.mainRival.driver.driver_name}</span>
            <span className="text-sm font-mono bg-white/20 px-2 py-0.5 rounded">
              {analysis.mainRival.driver.points} pt
            </span>
          </div>
          <p className="text-xs text-rose-100 mt-1">
            {t("sc_gap")}: -{analysis.mainRival.currentGap} {t("pts")}
          </p>
        </div>
      )}
    </div>
  );
}

// 🔥 COMPONENTE MOSAICO CON COLORI MIGLIORATI
function MosaicDiagram({ 
  cells,
  bestCombination,
  yourDriver,
  rival,
  racesLeft,
  sprintsLeft,
  onCellClick
}: {
  cells: MosaicCell[];
  bestCombination: MosaicCell | null;
  yourDriver: Driver;
  rival: Driver;
  racesLeft: number;
  sprintsLeft: number;
  onCellClick: (yourPos: number, rivalPos: number) => void;
}) {
  const { t } = useI18n();
  const mosaicRef = useRef<HTMLDivElement>(null);
  const matrix: (MosaicCell | null)[][] = Array(10).fill(null).map(() => Array(10).fill(null));

  cells.forEach(cell => {
    matrix[cell.yourPos - 1][cell.rivalPos - 1] = cell;
  });
  
  // Colore piatto in base alla difficoltà (% delle gare necessarie)
  const getCellStyle = (cell: MosaicCell | null) => {
    if (!cell || !cell.isPossible) return "bg-gray-100 text-gray-300";
    const percent = (cell.racesNeeded / racesLeft) * 100;
    if (percent <= 30) return "bg-emerald-500 text-white";
    if (percent <= 50) return "bg-lime-500 text-white";
    if (percent <= 70) return "bg-amber-500 text-white";
    return "bg-orange-500 text-white";
  };

  return (
    <div ref={mosaicRef} className="bg-white rounded-2xl p-3 shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-2 rounded-xl shadow-md shrink-0">
          <Grid3x3 className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-gray-900 text-base leading-tight">{t("sc_mosaic")}</h3>
          <p className="text-[11px] text-gray-500 leading-tight">{t("sc_tapCell")}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-gray-900">{racesLeft}</div>
          <div className="text-[10px] text-gray-500 -mt-0.5">{t("mos_raceMany")}</div>
        </div>
        <button
          data-html2canvas-ignore
          onClick={() => shareElementAsImage(mosaicRef.current, {
            fileName: `gridup-mosaico-${yourDriver.driver_code}-${rival.driver_code}.png`,
            title: "GridUP",
            text: `${yourDriver.driver_name} vs ${rival.driver_name} — ${t("sc_mosaic")}`,
            heading: t("sc_mosaic"),
            sub: `${yourDriver.driver_name} vs ${rival.driver_name}`,
          })}
          title={t("share")}
          className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 active:scale-95 transition-transform shrink-0"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Come si legge */}
      <div className="mb-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
        <p className="text-[11px] text-gray-700 leading-snug">
          {t("mos_howto", { you: yourDriver.driver_name, rival: rival.driver_name })}
        </p>
        <p className="text-[11px] text-gray-500 leading-snug mt-2 pt-2 border-t border-gray-200">
          {t("mos_example", { you: yourDriver.driver_name, rival: rival.driver_name })}
        </p>
        {sprintsLeft > 0 && (
          <p className="text-[11px] text-amber-700 leading-snug mt-2 pt-2 border-t border-gray-200">
            {t("mos_sprintNote", { n: sprintsLeft })}
          </p>
        )}
      </div>

      {/* Scala colori */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-emerald-600 shrink-0">{t("mos_easy")}</span>
          <div
            className="h-2 flex-1 rounded-full"
            style={{ background: "linear-gradient(to right, #10b981, #84cc16, #f59e0b, #f97316)" }}
          />
          <span className="text-[10px] font-bold text-orange-600 shrink-0">{t("mos_hard")}</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">{t("mos_grey")}</p>
      </div>

      {/* Etichetta asse colonne (rivale) */}
      <div className="flex items-center justify-center gap-1 mb-1 text-[11px] font-bold text-gray-600">
        <span className="text-rose-500">→</span> {t("mos_rivalPos", { rival: rival.driver_name })}
      </div>

      {/* Matrice mosaico - adatta alla larghezza dello schermo */}
      <div className="grid grid-cols-[1.4rem_repeat(10,minmax(0,1fr))] gap-[3px]">
        {/* angolo: legenda assi (codici piloti) */}
        <div className="flex flex-col items-center justify-center text-[7px] font-bold leading-none text-gray-400">
          <span>{yourDriver.driver_code}↓</span>
          <span>{rival.driver_code}→</span>
        </div>
        {SCORING_POSITIONS.map(pos => (
          <div
            key={`col-${pos.position}`}
            className="flex items-center justify-center aspect-square rounded bg-gray-100 text-[9px] font-bold text-gray-500"
          >
            {pos.position}
          </div>
        ))}

        {/* righe della matrice */}
        {SCORING_POSITIONS.map(yourPos => (
          <Fragment key={`row-${yourPos.position}`}>
            {/* intestazione riga (tu) */}
            <div className="flex items-center justify-center aspect-square rounded bg-gray-100 text-[9px] font-bold text-gray-500">
              {yourPos.position}
            </div>
            {SCORING_POSITIONS.map(rivalPos => {
              const cell = matrix[yourPos.position - 1][rivalPos.position - 1];
              const isBest = cell && bestCombination &&
                cell.yourPos === bestCombination.yourPos &&
                cell.rivalPos === bestCombination.rivalPos;

              return (
                <motion.button
                  key={`cell-${yourPos.position}-${rivalPos.position}`}
                  whileTap={{ scale: cell?.isPossible ? 0.9 : 1 }}
                  onClick={() => cell?.isPossible && onCellClick(cell.yourPos, cell.rivalPos)}
                  disabled={!cell?.isPossible}
                  className={`
                    relative flex items-center justify-center aspect-square rounded
                    text-[11px] font-black leading-none transition-colors
                    ${getCellStyle(cell)}
                    ${isBest ? "ring-2 ring-rose-500 ring-offset-1 z-10" : ""}
                  `}
                >
                  {cell?.isPossible ? cell.racesNeeded : ""}
                </motion.button>
              );
            })}
          </Fragment>
        ))}
      </div>

      {/* Combinazione ottimale (tappabile) */}
      {bestCombination && (
        <button
          onClick={() => onCellClick(bestCombination.yourPos, bestCombination.rivalPos)}
          className="mt-3 w-full text-left p-3 bg-gradient-to-r from-rose-50 to-orange-50 rounded-xl border border-rose-200 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Trophy className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="text-xs font-bold text-gray-700">{t("mos_fastest")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-gray-900">{yourDriver.driver_code} {bestCombination.yourPos}°</span>
            <span className="text-gray-400">{t("vs")}</span>
            <span className="font-bold text-gray-900">{rival.driver_code} {bestCombination.rivalPos}°</span>
            <span className="ml-auto text-emerald-600 font-bold whitespace-nowrap">
              {bestCombination.racesNeeded} {bestCombination.racesNeeded === 1 ? t("mos_raceOne") : t("mos_raceMany")}
            </span>
          </div>
        </button>
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
  racesLeft,
  sprintsLeft
}: {
  isOpen: boolean;
  onClose: () => void;
  yourDriver: Driver;
  rival: Driver;
  yourPos: number;
  rivalPos: number;
  racesLeft: number;
  sprintsLeft: number;
}) {
  const yourPosData = SCORING_POSITIONS.find(p => p.position === yourPos)!;
  const rivalPosData = SCORING_POSITIONS.find(p => p.position === rivalPos)!;
  const gainPerRace = yourPosData.points - rivalPosData.points;
  const sprintGain = yourPosData.sprintPoints - rivalPosData.sprintPoints;

  const details = generateDetailedCombination(yourDriver, rival, yourPos, rivalPos, racesLeft, sprintsLeft);
  const racesNeeded = details.overtakeAtRace > 0 ? details.overtakeAtRace : null;
  const { t } = useI18n();
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{t("cd_title")}</h2>
                  <div className="flex items-center gap-3 text-rose-100">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{yourPosData.emoji}</span>
                      <span>
                        <strong>{yourDriver.driver_name}</strong> {yourPosData.label} ({yourPosData.points} pt)
                      </span>
                    </div>
                    <span>vs</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{rivalPosData.emoji}</span>
                      <span>
                        <strong>{rival.driver_name}</strong> {rivalPosData.label} ({rivalPosData.points} pt)
                      </span>
                    </div>
                  </div>
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
            <div className="p-6">
              {/* Statistiche */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500">{t("cd_gainPerRace")}</div>
                  <div className="text-xl font-bold text-emerald-600">{gainPerRace >= 0 ? "+" : ""}{gainPerRace} {t("pts")}</div>
                  {sprintsLeft > 0 && (
                    <div className="text-[10px] text-gray-400 mt-0.5">{t("cd_inSprint", { g: `${sprintGain >= 0 ? "+" : ""}${sprintGain}` })}</div>
                  )}
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500">{t("cd_racesNeeded")}</div>
                  <div className="text-xl font-bold text-blue-600">{racesNeeded ?? "—"}</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500">{t("cd_start")}</div>
                  <div className="text-sm font-bold">{yourDriver.points} - {rival.points}</div>
                </div>
                <div className="bg-rose-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500">{t("cd_finish")}</div>
                  <div className="text-sm font-bold">{details.finalYourPoints} - {details.finalRivalPoints}</div>
                </div>
              </div>
              
              {/* Timeline gare */}
              <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-500" />
                {t("cd_timeline")}
              </h4>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {details.results.map(result => (
                  <div 
                    key={result.raceNumber}
                    className={`p-3 rounded-xl transition-all ${
                      result.isOvertake 
                        ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-300 shadow-sm' 
                        : 'bg-gray-50 border border-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          result.isOvertake ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-600'
                        }`}>
                          {result.raceNumber}
                        </div>
                        <span className="font-medium text-gray-700">{t("cd_gp")} {result.raceNumber}</span>
                        {result.isSprint && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wide">
                            {t("cd_sprint")}
                          </span>
                        )}
                      </div>
                      {result.isOvertake && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-white rounded-full text-xs font-bold">
                          <Zap className="w-3 h-3" />
                          {t("cd_overtake")}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">{yourDriver.driver_name}</span>
                        <span className={`font-mono font-bold ${result.yourTotal > result.rivalTotal ? 'text-emerald-600' : 'text-gray-700'}`}>
                          {result.yourTotal} pt
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">{rival.driver_name}</span>
                        <span className={`font-mono font-bold ${result.rivalTotal > result.yourTotal ? 'text-rose-600' : 'text-gray-700'}`}>
                          {result.rivalTotal} pt
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">{t("cd_diff")}</span>
                        <span className={`font-bold ${result.yourTotal - result.rivalTotal > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {result.yourTotal - result.rivalTotal > 0 ? '+' : ''}{result.yourTotal - result.rivalTotal} pt
                        </span>
                      </div>
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
  const { t } = useI18n();
  return (
    <div
      onClick={onCardClick}
      className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${
        isMain ? 'border-rose-300 bg-rose-50/50 hover:bg-rose-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900">{rival.driver.driver_name}</p>
            {isMain && (
              <span className="text-xs bg-gradient-to-r from-rose-500 to-rose-600 text-white px-2 py-0.5 rounded-full shadow-sm">
                {t("rc_main")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{rival.driver.team}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">{rival.driver.points} pt</p>
          <p className="text-xs text-rose-600 font-medium">-{rival.currentGap} pt</p>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-1">
          <Target className="w-3 h-3 text-rose-500" />
          <p className="text-sm font-medium text-gray-700">
            {t("rc_needed", { n: rival.pointsNeeded })}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function ScenariosPage() {
  const { t } = useI18n();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [racesLeft, setRacesLeft] = useState(0);
  const [sprintsLeft, setSprintsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedRival, setSelectedRival] = useState<Driver | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ yourPos: number; rivalPos: number } | null>(null);
  const [rivalsOpen, setRivalsOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        const [standings, seasonStats] = await Promise.all([
          getDriverStandings(),
          getDriverSeasonStats(),
        ]);

        // Gare mancanti dall'intero calendario: tutte le gare della stagione senza risultati
        // (indipendente dalla data odierna). La stagione = l'anno con gare ancora da disputare.
        const { data: calendarData, error: calendarError } = await supabase
          .from("race_calendar_with_results")
          .select("year, date, sprint_race_date, has_results")
          .or("has_results.is.null,has_results.eq.false")
          .order("date", { ascending: true });

        if (calendarError) throw calendarError;

        const processedDrivers: Driver[] = (standings || []).map((d: any, idx: number) => ({
          id: d.id ?? String(idx),
          position: d.position ?? idx + 1,
          driver_name: d.driver_name ?? `Driver ${idx + 1}`,
          driver_code: d.driver_code || (d.id?.toUpperCase().slice(0, 3) ?? "N/A"),
          team: d.team || "—",
          points: Number(d.points ?? 0),
          victories: Number((seasonStats as any)[d.id]?.wins ?? 0),
        }));

        setDrivers(processedDrivers);

        const incomplete = calendarData || [];
        const season = incomplete.reduce((max: number, r: any) => Math.max(max, r.year ?? 0), 0);
        const seasonRemaining = incomplete.filter((r: any) => (r.year ?? 0) === season);
        setRacesLeft(seasonRemaining.length);
        setSprintsLeft(seasonRemaining.filter((r: any) => r.sprint_race_date != null).length);
        
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
    return calculateChampionshipAnalysis(selectedDriver, drivers, racesLeft, Math.min(sprintsLeft, racesLeft));
  }, [selectedDriver, drivers, racesLeft, sprintsLeft]);

  const mosaicData = useMemo(() => {
    if (!selectedDriver || !selectedRival || racesLeft === 0) return null;
    return generateMosaic(selectedDriver, selectedRival, racesLeft, Math.min(sprintsLeft, racesLeft));
  }, [selectedDriver, selectedRival, racesLeft, sprintsLeft]);

  // Scenario contro il rivale principale (per la vista semplice, senza scegliere a mano)
  const mainRivalMosaic = useMemo(() => {
    const mr = analysis?.mainRival?.driver;
    if (!selectedDriver || !mr || racesLeft === 0) return null;
    return generateMosaic(selectedDriver, mr, racesLeft, Math.min(sprintsLeft, racesLeft));
  }, [selectedDriver, analysis, racesLeft, sprintsLeft]);

  // Cambiando pilota azzera il rivale; in vista avanzata pre-seleziona il rivale principale
  useEffect(() => { setSelectedRival(null); }, [selectedDriverId]);
  useEffect(() => {
    if (advanced && !selectedRival && analysis) {
      const active = analysis.allRivals.filter(r => !r.isMathematicallyEliminated);
      const def = analysis.mainRival?.driver || active[0]?.driver || null;
      if (def) setSelectedRival(def);
    }
  }, [advanced, selectedRival, analysis]);

  const maxPossiblePoints = racesLeft * MAX_RACE_PTS + sprintsLeft * MAX_SPRINT_PTS;
  const leader = drivers.length > 0 ? drivers.reduce((a, b) => a.points > b.points ? a : b) : null;

  // Punti per essere sicuri del titolo: per chi insegue usa l'analisi; per il
  // leader (magicNumber=0) calcola la soglia matematica come nella Panoramica.
  const titleNeeded = (analysis && analysis.magicNumber > 0)
    ? analysis.magicNumber
    : (selectedDriver
        ? Math.max(0, drivers.filter(d => d.id !== selectedDriver.id).reduce((m, d) => Math.max(m, d.points), 0)
            + maxPossiblePoints - selectedDriver.points + 1)
        : 0);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">{t("loading_data")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 pb-24">
      <PageHeader
        icon={Grid3x3}
        title={t("nav_scenarios")}
        right={
          <button
            onClick={() => setShowInfo(true)}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors border border-gray-200"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        }
      />

      <div className="max-w-md mx-auto px-4 py-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-red-600 font-medium hover:text-red-700"
            >
              {t("err_retry")}
            </button>
          </div>
        )}

        {/* Driver selector */}
        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {t("sc_selectDriver")}
          </label>
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="w-full h-12 bg-gray-50 border-0 rounded-xl px-4 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
          >
            {drivers.map(d => (
              <option key={d.id} value={d.id}>
                {d.position === 1 ? "👑 " : ""}{d.driver_name} — {d.points} pts
              </option>
            ))}
          </select>
          {leader && (
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Leader: <span className="font-bold">{leader.driver_name}</span> ({leader.points} pt)
            </p>
          )}
        </div>

        {/* (contatore GP rimosso: il numero di gare è automatico dalla stagione) */}

        {/* Analysis results */}
        {selectedDriver && analysis && (
          <motion.div
            key={selectedDriverId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* ─── VISTA SEMPLICE ─── */}
            {!advanced && (
              <>
                {analysis.isAlreadyChampion ? (
                  <div className="bg-white rounded-2xl p-6 shadow-md border border-emerald-200 text-center">
                    <Trophy className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                    <p className="font-heading font-black text-xl text-emerald-600">{t("sc_champion")}</p>
                    <p className="text-sm text-gray-500 mt-1">{selectedDriver.driver_name}</p>
                  </div>
                ) : analysis.isMathematicallyOut ? (
                  <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 text-center">
                    <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="font-heading font-black text-xl text-gray-500">{t("sc_out")}</p>
                    <p className="text-sm text-gray-500 mt-1">{selectedDriver.driver_name}</p>
                  </div>
                ) : (
                  <div className="dark-card rounded-2xl px-5 py-6 text-center">
                    <p className="text-white/70 text-sm font-body">
                      <span className="font-heading font-black text-white">{selectedDriver.driver_name}</span>
                      {selectedDriver.position === 1 ? ` ${t("sc_isLeading")}` : ""}
                    </p>
                    <div className="flex items-baseline justify-center gap-1 mt-2">
                      <span className="font-heading font-black text-primary" style={{ fontSize: "4rem", lineHeight: 1 }}>
                        {titleNeeded}
                      </span>
                      <span className="font-heading font-black text-2xl text-primary/70">PTI</span>
                    </div>
                    <p className="text-white/60 text-sm mt-1">{t("sc_neededShort")}</p>
                  </div>
                )}

                {/* Come superare il rivale principale (in chiaro) */}
                {!analysis.isAlreadyChampion && !analysis.isMathematicallyOut && analysis.mainRival && mainRivalMosaic && (
                  <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      {t("sc_howToBeat", { rival: analysis.mainRival.driver.driver_name })}
                    </p>
                    {mainRivalMosaic.bestCombination ? (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-heading font-black text-white text-xs bg-primary rounded-lg px-2 py-1">{selectedDriver.driver_code}</span>
                            <span className="text-xl font-black text-gray-900">P{mainRivalMosaic.bestCombination.yourPos}</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-300" />
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-heading font-black text-gray-700 text-xs bg-gray-200 rounded-lg px-2 py-1">{analysis.mainRival.driver.driver_code}</span>
                            <span className="text-xl font-black text-gray-900">P{mainRivalMosaic.bestCombination.rivalPos}</span>
                          </div>
                          <div className="ml-auto text-right">
                            <span className="font-heading font-black text-3xl text-emerald-600">{mainRivalMosaic.bestCombination.racesNeeded}</span>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                              {mainRivalMosaic.bestCombination.racesNeeded === 1 ? t("mos_raceOne") : t("mos_raceMany")}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-3 leading-snug">
                          {t("sc_scenario", {
                            a: mainRivalMosaic.bestCombination.yourPos,
                            rival: analysis.mainRival.driver.driver_code,
                            b: mainRivalMosaic.bestCombination.rivalPos,
                            n: mainRivalMosaic.bestCombination.racesNeeded,
                          })}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">{t("sc_hardToBeat")}</p>
                    )}
                  </div>
                )}

                <p className="text-center text-xs text-muted-foreground font-body">
                  {racesLeft} GP{sprintsLeft > 0 ? ` · ${Math.min(sprintsLeft, racesLeft)} sprint` : ""}
                </p>
              </>
            )}

            {/* ─── VISTA AVANZATA ─── */}
            {advanced && (
            <>
            {/* Selettore rivale compatto: il mosaico mostra tutte le combinazioni vs questo pilota */}
            {(() => {
              const activeRivals = analysis.allRivals.filter(r => !r.isMathematicallyEliminated);
              if (activeRivals.length === 0) {
                return (
                  <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 text-center">
                    <Award className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                    <p className="text-gray-600 font-medium">{t("rivals_lead")}</p>
                    <p className="text-xs text-gray-400 mt-1">{t("rivals_noneAhead")}</p>
                  </div>
                );
              }
              const current = selectedRival || activeRivals[0].driver;
              return (
                <div className="bg-white rounded-xl p-3 shadow-md border border-gray-100">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    {t("sc_chooseDriver")}
                  </label>
                  <select
                    value={current.id}
                    onChange={(e) => setSelectedRival(activeRivals.find(r => r.driver.id === e.target.value)?.driver || null)}
                    className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    {activeRivals.map(r => (
                      <option key={r.driver.id} value={r.driver.id}>
                        {r.driver.driver_name} — {r.driver.points} pt
                      </option>
                    ))}
                  </select>
                </div>
              );
            })()}

            {selectedRival && mosaicData && (
              <MosaicDiagram
                cells={mosaicData.cells}
                bestCombination={mosaicData.bestCombination}
                yourDriver={selectedDriver}
                rival={selectedRival}
                racesLeft={racesLeft}
                sprintsLeft={Math.min(sprintsLeft, racesLeft)}
                onCellClick={(yourPos, rivalPos) => setSelectedCell({ yourPos, rivalPos })}
              />
            )}
            </>
            )}

            {/* Toggle vista semplice / avanzata */}
            <button
              onClick={() => setAdvanced(a => !a)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors active:scale-[0.98] border border-rose-200"
            >
              {advanced ? t("sc_simpleView") : t("sc_advanced")}
              <ChevronDown className={`w-4 h-4 transition-transform ${advanced ? "rotate-180" : ""}`} />
            </button>
          </motion.div>
        )}

        {!selectedDriver && drivers.length > 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-md">
            <Calculator className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t("nd_select")}</p>
            <p className="text-xs text-gray-400 mt-2">{t("nd_hint")}</p>
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
          sprintsLeft={Math.min(sprintsLeft, racesLeft)}
        />
      )}

      {/* Info modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-xl bg-gradient-to-r from-rose-600 to-rose-700 bg-clip-text text-transparent">
                  {t("im_title")}
                </h3>
                <button onClick={() => setShowInfo(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                  <X className="w-4 h-4 mx-auto" />
                </button>
              </div>
              <div className="space-y-4 text-sm text-gray-600">
                <p>{t("im_intro")}</p>

                {/* Come leggerlo */}
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                  <p className="font-bold text-gray-800">{t("im_howRead")}</p>
                  <p className="text-xs leading-snug">
                    <span className="inline-block w-5 font-bold text-rose-600">↓</span>
                    {t("im_rows")}
                  </p>
                  <p className="text-xs leading-snug">
                    <span className="inline-block w-5 font-bold text-rose-600">→</span>
                    {t("im_cols")}
                  </p>
                  <p className="text-xs leading-snug">
                    <span className="inline-block w-5">🔢</span>
                    {t("im_number")}
                  </p>
                </div>

                <ul className="space-y-2">
                  <li className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                    <div className="w-4 h-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded shadow-sm"></div>
                    <span>{t("im_green")}</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 bg-lime-50 rounded-lg">
                    <div className="w-4 h-4 bg-gradient-to-br from-lime-500 to-lime-600 rounded shadow-sm"></div>
                    <span>{t("im_lime")}</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                    <div className="w-4 h-4 bg-gradient-to-br from-amber-500 to-amber-600 rounded shadow-sm"></div>
                    <span>{t("im_amber")}</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                    <div className="w-4 h-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded shadow-sm"></div>
                    <span>{t("im_orange")}</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
                    <div className="w-4 h-4 bg-gray-300 rounded"></div>
                    <span>{t("im_grey")}</span>
                  </li>
                </ul>
                <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                  {t("im_clickHint")}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
