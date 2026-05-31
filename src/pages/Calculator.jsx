import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getTeamColor, MAX_POINTS_RACE, MAX_POINTS_SPRINT, RACE_POINTS, SPRINT_POINTS,
  clinchAnalysis,
} from "@/lib/f1Utils";
import { getDriverStandings, getSeasonConfig } from "@/lib/supabaseData";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator as CalcIcon, Loader2, Info, X,
  Share2, Bookmark, ChevronUp, ChevronDown, ChevronRight,
} from "lucide-react";

// ─── finish-position helpers ──────────────────────────────────────────────────
const FINISH_LABELS = ["1°","2°","3°","4°","5°","6°","7°","8°","9°","10°","11°+"];
const FINISH_EMOJI  = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","💤"];

/**
 * Given a points target, how many races at each position are needed?
 * Returns the greediest combo: fill with victories, then 2nds, etc.
 * e.g. needed=43, races=3 → [1V, 1×2°(18), 1×(43-25-18=0 → done)]
 */
function finishCombo(needed, racesLeft) {
  if (needed <= 0) return { label: "Già clinchato ✓", rows: [], total: 0 };
  if (racesLeft <= 0) return { label: "Impossibile — gare esaurite", rows: [], total: 0, impossible: true };

  let remaining = needed;
  let racesUsed = 0;
  const rows = []; // { pos, count, pts }

  for (let pi = 0; pi < RACE_POINTS.length && remaining > 0 && racesUsed < racesLeft; pi++) {
    const pts = RACE_POINTS[pi];
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

  return { rows, total, impossible,
    label: impossible
      ? "Impossibile matematicamente"
      : rows.map(r => `${r.count}×${r.label}`).join(" + ") };
}

/**
 * Build a comparison grid: for each finishing position (1–11+),
 * what's the driver's total if he always finishes there?
 * And what's the rival's total if they always finish there?
 * Returns array of { pos, label, driverTotal, rivalTotal, driverWins }
 */
function buildGrid(driverPts, rivalPts, racesLeft, sprintsLeft) {
  const grid = [];
  for (let pi = 0; pi <= 10; pi++) {
    const ptsPerRace   = RACE_POINTS[pi] ?? 0;
    const ptsPerSprint = SPRINT_POINTS[pi] ?? 0;
    const driverTotal  = driverPts + racesLeft * ptsPerRace + sprintsLeft * ptsPerSprint;
    // rival: best case (wins everything) — to show worst case for driver
    const rivalTotal   = rivalPts + racesLeft * MAX_POINTS_RACE + sprintsLeft * MAX_POINTS_SPRINT;
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

// ─── sub-components ──────────────────────────────────────────────────────────
function InfoModal({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", damping: 20 }}
        className="w-full max-w-lg app-card p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-black text-lg uppercase tracking-wide">Formula</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="bg-gray-100 rounded-xl p-3 font-mono text-xs space-y-1.5">
            <p>Max rivale  = punti + (gare × <b className="text-white">25</b>) + (sprint × 8)</p>
            <p>Serve       = Max rivale − punti_pilota + 1</p>
          </div>
          <p>Il giro veloce è stato <b className="text-white">abolito dal 2025</b>. Max per gara: <b className="text-white">25 pts</b>.</p>
          <p>Il calcolo è ripetuto vs <b className="text-white">ogni rivale</b> con punti ≥. Il caso peggiore determina il risultato finale.</p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-amber-400 font-heading font-bold text-[10px] uppercase tracking-widest mb-1">⚠ Parità</p>
            <p className="text-xs">In caso di parità il titolo va al pilota con più vittorie.</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stepper({ value, onChange, min = 0 }) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center
                   text-muted-foreground hover:text-foreground transition-colors active:scale-95">
        <ChevronDown className="w-4 h-4" />
      </button>
      <span className="font-mono font-black text-xl w-8 text-center tabular-nums select-none">{value}</span>
      <button onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center
                   text-muted-foreground hover:text-foreground transition-colors active:scale-95">
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Finish-position breakdown card ───────────────────────────────────────────
function FinishBreakdown({ needed, racesLeft, driverName, driverColor }) {
  const combo = finishCombo(needed, racesLeft);
  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-100">
        <span className="text-base">🏁</span>
        <span className="font-heading font-black text-xs uppercase tracking-widest text-muted-foreground">
          Combinazione minima di risultati
        </span>
      </div>
      <div className="p-4">
        {combo.impossible ? (
          <p className="font-heading font-bold text-destructive text-sm">
            Impossibile raccogliere {needed} pts in {racesLeft} gare
          </p>
        ) : (
          <>
            <p className="font-mono text-xs text-muted-foreground mb-3">
              Per ottenere <span className="text-white font-bold">{needed} pts</span> in {racesLeft} gare:
            </p>
            <div className="space-y-2">
              {combo.rows.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3"
                >
                  {/* Position pill */}
                  <div className="w-12 shrink-0 flex items-center gap-1">
                    <span className="text-base">{r.emoji}</span>
                    <span className="font-heading font-black text-sm">{r.label}</span>
                  </div>
                  {/* Count bar */}
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(r.count, 8) }).map((_, j) => (
                        <div key={j}
                          className="w-5 h-5 rounded-md flex items-center justify-center
                                     text-[10px] font-mono font-bold text-white"
                          style={{ backgroundColor: driverColor, opacity: 0.85 + j * 0.02 }}
                        >
                          {r.pts}
                        </div>
                      ))}
                      {r.count > 8 && (
                        <div className="w-5 h-5 rounded-md flex items-center justify-center
                                        text-[9px] font-mono font-bold bg-gray-100 text-muted-foreground">
                          +{r.count - 8}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Total */}
                  <span className="font-mono font-bold text-sm tabular-nums shrink-0"
                        style={{ color: driverColor }}>
                    +{r.earned}
                  </span>
                </motion.div>
              ))}
            </div>
            {/* Summary line */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="font-heading font-bold text-xs text-muted-foreground uppercase tracking-wide">
                {combo.rows.map(r => `${r.count}×${r.label}`).join(", ")}
              </span>
              <span className="font-mono font-black text-sm" style={{ color: driverColor }}>
                +{combo.total} pts
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── "Always finish X" comparison grid ────────────────────────────────────────
function FinishGrid({ driver, rival, racesLeft, sprintsLeft, driverColor, rivalColor }) {
  const grid = buildGrid(driver.points, rival.points, racesLeft, sprintsLeft);
  // Find the cutoff: first position where driver wins
  const cutoff = grid.findIndex(r => r.driverWins);

  return (
    <div className="app-card overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">📊</span>
          <span className="font-heading font-black text-xs uppercase tracking-widest text-muted-foreground">
            Se finisce sempre in posizione X
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono">
          Rivale ipotetico: <b style={{ color: rivalColor }}>{rival.driver_name}</b> vince tutto
        </p>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[44px_1fr_1fr_52px] gap-x-2 px-4 py-2 border-b border-gray-100">
        <span className="font-heading font-bold text-[10px] uppercase tracking-widest text-gray-300">Pos</span>
        <span className="font-heading font-bold text-[10px] uppercase tracking-widest text-right"
              style={{ color: driverColor }}>{driver.driver_code || driver.driver_name.split(" ")[1]}</span>
        <span className="font-heading font-bold text-[10px] uppercase tracking-widest text-right"
              style={{ color: rivalColor }}>{rival.driver_code || rival.driver_name.split(" ")[1]}</span>
        <span className="font-heading font-bold text-[10px] uppercase tracking-widest text-gray-300 text-right">Esito</span>
      </div>

      <div className="divide-y divide-gray-100">
        {grid.map((row, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.025 }}
            className={`grid grid-cols-[44px_1fr_1fr_52px] gap-x-2 items-center px-4 py-2.5
              ${row.driverWins ? "bg-green-500/4" : ""}`}
          >
            {/* Position */}
            <div className="flex items-center gap-1">
              <span className="text-sm">{row.emoji}</span>
              <span className="font-heading font-bold text-xs text-muted-foreground">{row.label}</span>
            </div>
            {/* Driver total */}
            <span className={`font-mono font-bold text-sm text-right tabular-nums
              ${row.driverWins ? "text-green-400" : "text-foreground"}`}>
              {row.driverTotal}
            </span>
            {/* Rival total (always max) */}
            <span className="font-mono text-sm text-right tabular-nums text-muted-foreground">
              {row.rivalTotal}
            </span>
            {/* Outcome */}
            <div className="flex justify-end">
              {row.driverWins ? (
                <span className="tag bg-green-500/12 text-green-400 border border-green-500/20">✓ WIN</span>
              ) : (
                <span className="tag bg-gray-100 text-muted-foreground">✗</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {cutoff >= 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 bg-green-500/4">
          <p className="text-xs font-heading font-bold text-green-400">
            ✓ Basta finire {grid[cutoff].label} o meglio in ogni gara
          </p>
        </div>
      )}
    </div>
  );
}

// ── Rivals overview table ────────────────────────────────────────────────────
function RivalsTable({ allRivals, driverColor, driver, racesLeft, sprintsLeft, onSelectRival, selectedRivalId }) {
  if (!allRivals?.length) return null;
  const sorted = [...allRivals].sort((a, b) => b.needed - a.needed);

  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-100">
        <span className="text-base">📋</span>
        <span className="font-heading font-black text-xs uppercase tracking-widest text-muted-foreground">
          Tutti i rivali · tocca per dettaglio
        </span>
      </div>

      <div className="grid grid-cols-[1fr_52px_64px_44px] gap-x-2 px-4 py-2 border-b border-gray-100">
        {["Rivale", "Max", "Serve", ""].map((h, i) => (
          <span key={i} className="font-heading font-bold text-[10px] uppercase tracking-widest
                                   text-gray-300 text-right first:text-left">{h}</span>
        ))}
      </div>

      <div className="divide-y divide-gray-100">
        {sorted.map((r, i) => {
          const done        = r.needed <= 0;
          const rivalColor  = getTeamColor(r.rival.team);
          const isSelected  = r.rival.id === selectedRivalId;
          const combo       = done ? null : finishCombo(r.needed, racesLeft);

          return (
            <motion.div key={r.rival.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <button
                onClick={() => onSelectRival(isSelected ? null : r.rival.id)}
                className={`w-full grid grid-cols-[1fr_52px_64px_44px] gap-x-2 items-center px-4 py-2.5
                  transition-colors text-left
                  ${done ? "opacity-40" : ""}
                  ${isSelected ? "bg-gray-100" : "hover:bg-gray-50"}`}
              >
                {/* Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: rivalColor }} />
                  <div className="min-w-0">
                    <p className={`font-heading font-bold text-sm truncate leading-tight ${done ? "line-through" : ""}`}>
                      {r.rival.driver_name}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {r.rival.points} pts · P{r.rival.position}
                    </p>
                  </div>
                </div>
                {/* Max */}
                <span className="font-mono text-xs text-muted-foreground text-right tabular-nums">{r.rivalMax}</span>
                {/* Needed */}
                <span className={`font-mono font-black text-sm text-right tabular-nums
                  ${done ? "text-green-400" : r.needed <= 25 ? "text-primary" : ""}`}>
                  {done ? "✓" : `+${r.needed}`}
                </span>
                {/* Arrow / badge */}
                <div className="flex justify-end items-center gap-1">
                  {done ? (
                    <span className="tag bg-green-500/10 text-green-400 border border-green-500/20">GIÀ</span>
                  ) : r.needed <= 25 ? (
                    <span className="tag bg-primary/10 text-primary border border-primary/20">HOT</span>
                  ) : (
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform text-gray-300
                      ${isSelected ? "rotate-90" : ""}`} />
                  )}
                </div>
              </button>

              {/* Expandable detail for this rival */}
              <AnimatePresence>
                {isSelected && !done && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 pt-1 space-y-2 border-t border-gray-100 bg-gray-100/20">
                      {/* Finish combo */}
                      {combo && !combo.impossible && (
                        <div>
                          <p className="font-heading font-bold text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                            Combinazione minima
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {combo.rows.map((cr, j) => (
                              <div key={j}
                                className="flex items-center gap-1 bg-card rounded-lg px-2 py-1 border border-gray-100">
                                <span className="text-xs">{cr.emoji}</span>
                                <span className="font-heading font-bold text-xs">{cr.label}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">×{cr.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {combo?.impossible && (
                        <p className="font-heading font-bold text-xs text-destructive">
                          Impossibile: servono {r.needed} pts in {racesLeft} gare (max {racesLeft * MAX_POINTS_RACE})
                        </p>
                      )}
                      {/* Grid: if driver always finishes X */}
                      <div className="mt-2">
                        <p className="font-heading font-bold text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                          Se finisce sempre in posizione…
                        </p>
                        <div className="grid grid-cols-5 gap-1">
                          {buildGrid(driver.points, r.rival.points, racesLeft, sprintsLeft)
                            .slice(0, 10)
                            .map((row) => (
                              <div key={row.pos}
                                className={`rounded-lg p-1.5 text-center border
                                  ${row.driverWins
                                    ? "bg-green-500/10 border-green-500/20"
                                    : "bg-card border-gray-100"}`}
                              >
                                <p className="text-sm">{row.emoji}</p>
                                <p className={`font-mono font-bold text-xs
                                  ${row.driverWins ? "text-green-400" : "text-muted-foreground"}`}>
                                  {row.driverTotal}
                                </p>
                                <p className={`font-heading text-[9px] font-bold
                                  ${row.driverWins ? "text-green-400" : "text-muted-foreground/50"}`}>
                                  {row.driverWins ? "WIN" : "NO"}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="tag bg-green-500/10 text-green-400 border border-green-500/20">GIÀ</span>
          <span className="text-[10px] text-muted-foreground">clinchato</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="tag bg-primary/10 text-primary border border-primary/20">HOT</span>
          <span className="text-[10px] text-muted-foreground">≤ 1 vittoria</span>
        </div>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function Calculator() {
  const [showInfo,       setShowInfo]       = useState(false);
  const [driverId,       setDriverId]       = useState(null);
  const [racesLeft,      setRacesLeft]      = useState(null);
  const [sprintsLeft,    setSprintsLeft]    = useState(null);
  const [selectedRivalId, setSelectedRivalId] = useState(null);

  const { data: drivers = [], isLoading: ld } = useQuery({
    queryKey: ["driverStandings"], queryFn: getDriverStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: config, isLoading: lc } = useQuery({
    queryKey: ["seasonConfig"], queryFn: getSeasonConfig, staleTime: 10 * 60 * 1000,
  });

  if (ld || lc) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const liveRaces   = config ? config.total_races - config.races_completed : 0;
  const liveSprints = config ? (config.total_sprints||0) - (config.sprints_completed||0) : 0;
  const effRaces    = racesLeft   ?? liveRaces;
  const effSprints  = sprintsLeft ?? liveSprints;

  const driver      = driverId ? drivers.find(d => d.id === driverId) : null;
  const driverColor = driver ? getTeamColor(driver.team) : "#E8002D";
  const analysis    = driver ? clinchAnalysis(driver, drivers, effRaces, effSprints) : null;

  // The rival shown in the detail FinishGrid — default to hardest
  const detailRival = analysis && (
    selectedRivalId
      ? analysis.allRivals.find(r => r.rival.id === selectedRivalId)
      : analysis.hardest
  );

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

  return (
    <div className="space-y-4 px-4 pt-14 pb-4 relative">
      <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <CalcIcon className="w-5 h-5 text-primary" />
          <h1 className="font-heading font-black text-2xl uppercase tracking-wide">Calcolatore</h1>
        </div>
        <button onClick={() => setShowInfo(true)}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center
                     text-muted-foreground hover:text-foreground transition-colors">
          <Info style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* ── Driver selector ── */}
      <div className="app-card px-4 py-3">
        <p className="font-heading font-bold text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          Pilota
        </p>
        <Select value={driverId || ""} onValueChange={v => { setDriverId(v); setSelectedRivalId(null); }}>
          <SelectTrigger className="w-full font-heading font-bold h-10 rounded-xl bg-gray-100 border-0 px-3">
            <SelectValue placeholder="Seleziona un pilota..." />
          </SelectTrigger>
          <SelectContent>
            {drivers.map(d => (
              <SelectItem key={d.id} value={d.id}>
                <span className="flex items-center gap-2 font-heading text-sm">
                  <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getTeamColor(d.team) }} />
                  P{d.position} · {d.driver_name}
                  <span className="font-mono text-muted-foreground text-xs ml-1">{d.points} pts</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {driver && (
          <div className="flex items-center gap-3 mt-3 px-1">
            <div className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: driverColor }} />
            <div>
              <p className="font-heading font-black text-base leading-tight">{driver.driver_name}</p>
              <p className="font-mono text-xs text-muted-foreground">{driver.team} · P{driver.position}</p>
            </div>
            <span className="ml-auto font-mono font-black text-2xl tabular-nums" style={{ color: driverColor }}>
              {driver.points}
            </span>
          </div>
        )}
      </div>

      {/* ── Counters ── */}
      <div className="app-card px-4 py-3 space-y-3">
        {[
          { label: "Gare rimanenti",   value: effRaces,   set: setRacesLeft   },
          { label: "Sprint rimanenti", value: effSprints, set: setSprintsLeft },
        ].map(({ label, value, set }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="font-heading font-bold text-sm">{label}</span>
            <Stepper value={value} onChange={set} />
          </div>
        ))}
        {(racesLeft !== null || sprintsLeft !== null) && (
          <button onClick={() => { setRacesLeft(null); setSprintsLeft(null); }}
            className="text-[10px] font-heading font-bold text-primary/70 hover:text-primary
                       uppercase tracking-widest transition-colors">
            ↺ Ripristina valori live
          </button>
        )}
      </div>

      {/* ── Results ── */}
      <AnimatePresence mode="wait">
        {analysis && driver && (
          <motion.div
            key={`${driverId}-${effRaces}-${effSprints}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* Verdict */}
            <div className={`rounded-2xl border p-4 ${
              analysis.alreadyClinched  ? "bg-green-500/8 border-green-500/25"
              : analysis.mathematicallyOut ? "bg-destructive/8 border-destructive/20"
              : "bg-primary/6 border-primary/20"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">
                  {analysis.alreadyClinched ? "🏆" : analysis.mathematicallyOut ? "❌" : "📊"}
                </span>
                <span className="font-heading font-black text-xs uppercase tracking-widest text-muted-foreground">
                  Risultato
                </span>
              </div>

              {analysis.alreadyClinched ? (
                <p className="font-heading font-black text-xl text-green-400">
                  {driver.driver_name} è già campione matematico!
                </p>
              ) : analysis.mathematicallyOut ? (
                <>
                  <p className="font-heading font-black text-lg text-destructive">
                    {driver.driver_name} è matematicamente eliminato
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Non può raggiungere {analysis.hardest?.rival.driver_name} nemmeno vincendo tutto.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-heading font-bold text-base leading-snug">
                    <span style={{ color: driverColor }}>{driver.driver_name}</span>
                    {" "}deve ottenere almeno{" "}
                    <span className="font-black text-white text-2xl">{analysis.hardest.needed}</span>
                    {" "}punti
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per battere{" "}
                    <strong style={{ color: getTeamColor(analysis.hardest.rival.team) }}>
                      {analysis.hardest.rival.driver_name}
                    </strong>
                    {" "}(max teorico {analysis.hardest.rivalMax})
                  </p>
                  <p className="font-heading text-[10px] text-amber-400/80 mt-2">
                    ⚠ Parità: conta il numero di vittorie
                  </p>
                </>
              )}
            </div>

            {/* Finish breakdown — vs hardest rival */}
            {!analysis.alreadyClinched && !analysis.mathematicallyOut && (
              <FinishBreakdown
                needed={analysis.hardest.needed}
                racesLeft={effRaces}
                driverName={driver.driver_name}
                driverColor={driverColor}
              />
            )}

            {/* Rivals table — expandable rows */}
            <RivalsTable
              allRivals={analysis.allRivals}
              driverColor={driverColor}
              driver={driver}
              racesLeft={effRaces}
              sprintsLeft={effSprints}
              onSelectRival={setSelectedRivalId}
              selectedRivalId={selectedRivalId}
            />

            {/* Share / Save */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() =>
                  navigator.share
                    ? navigator.share({ title: "FantaF1", text: shareText })
                    : navigator.clipboard.writeText(shareText)
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-gray-100
                           border border-gray-200 py-3 font-heading font-bold text-sm
                           hover:bg-gray-100/80 transition-colors active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                Condividi
              </button>
              <button
                onClick={() => {
                  const saved = JSON.parse(localStorage.getItem("fantaf1_scenarios") || "[]");
                  saved.push({ date: new Date().toISOString(), text: shareText });
                  localStorage.setItem("fantaf1_scenarios", JSON.stringify(saved.slice(-10)));
                  alert("Scenario salvato!");
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary/10
                           border border-primary/25 py-3 font-heading font-bold text-sm text-primary
                           hover:bg-primary/15 transition-colors active:scale-95"
              >
                <Bookmark className="w-4 h-4" />
                Salva
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!driver && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <CalcIcon className="w-10 h-10 text-muted-foreground/20" />
          <p className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wide">
            Seleziona un pilota
          </p>
          <p className="text-xs text-gray-300 max-w-[240px]">
            Calcola i punti necessari e i risultati minimi vs ogni rivale in classifica
          </p>
        </div>
      )}

      <AnimatePresence>
        {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      </AnimatePresence>
    </div>
  );
}
