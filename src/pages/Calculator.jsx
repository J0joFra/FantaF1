import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getTeamColor, MAX_POINTS_RACE, MAX_POINTS_SPRINT,
  clinchAnalysis,
} from "@/lib/f1Utils";
import { getDriverStandings, getSeasonConfig } from "@/lib/supabaseData";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator as CalcIcon, Loader2, Info, X,
  Share2, Bookmark, ChevronUp, ChevronDown,
} from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtPts(n) { return n === Infinity ? "∞" : String(n); }

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
        className="w-full max-w-lg rounded-2xl bg-card border border-border p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-black text-lg uppercase tracking-wide">Formula</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="bg-secondary/60 rounded-xl p-3 font-mono text-xs space-y-1.5">
            <p>Max rivale = punti + (gare × <strong className="text-white">25</strong>) + (sprint × 8)</p>
            <p>Punti mancanti = Max rivale − punti_pilota + 1</p>
          </div>
          <p>
            Il giro veloce è stato <strong className="text-white">abolito dal 2025</strong>.
            Il massimo per gara è ora <strong className="text-white">25 punti</strong> (solo vittoria).
          </p>
          <p>
            Il calcolo viene ripetuto per <strong className="text-white">ogni rivale</strong> con
            punti ≥ al pilota selezionato. Il valore più alto determina quanti punti servono.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-amber-400 font-heading font-bold text-xs uppercase tracking-widest mb-1">
              ⚠ Parità
            </p>
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
        className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center
                   text-muted-foreground hover:text-foreground transition-colors active:scale-95">
        <ChevronDown className="w-4 h-4" />
      </button>
      <span className="font-mono font-black text-xl w-8 text-center tabular-nums select-none">
        {value}
      </span>
      <button onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center
                   text-muted-foreground hover:text-foreground transition-colors active:scale-95">
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── rivals table ─────────────────────────────────────────────────────────────
function RivalsTable({ driver, allRivals, driverColor }) {
  if (!allRivals?.length) return null;

  // Sort by hardest first (highest "needed")
  const sorted = [...allRivals].sort((a, b) => b.needed - a.needed);

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/60">
        <span className="text-base">📋</span>
        <span className="font-heading font-black text-xs uppercase tracking-widest text-muted-foreground">
          Tabella scenari vs tutti i rivali
        </span>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[1fr_52px_60px_56px] gap-x-2 px-4 py-2 border-b border-border/40">
        {["Rivale", "Max", "Serve", ""].map((h, i) => (
          <span key={i} className="font-heading font-bold text-[10px] uppercase tracking-widest
                                   text-muted-foreground/60 text-right first:text-left">
            {h}
          </span>
        ))}
      </div>

      <div className="divide-y divide-border/30">
        {sorted.map((r, i) => {
          const eliminated = r.needed <= 0;
          const rivalColor = getTeamColor(r.rival.team);

          return (
            <motion.div
              key={r.rival.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`grid grid-cols-[1fr_52px_60px_56px] gap-x-2 items-center px-4 py-2.5
                ${eliminated ? "opacity-40" : ""}`}
            >
              {/* Rival name */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: rivalColor }} />
                <div className="min-w-0">
                  <p className={`font-heading font-bold text-sm truncate leading-tight
                    ${eliminated ? "line-through" : ""}`}>
                    {r.rival.driver_name}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {r.rival.points} pts · P{r.rival.position}
                  </p>
                </div>
              </div>

              {/* Rival max */}
              <span className="font-mono text-xs text-muted-foreground text-right tabular-nums">
                {r.rivalMax}
              </span>

              {/* Points needed */}
              <span className={`font-mono font-black text-sm text-right tabular-nums
                ${eliminated
                  ? "text-green-400"
                  : r.needed > 200
                  ? "text-muted-foreground"
                  : "text-primary"}`}>
                {eliminated ? "✓" : `+${r.needed}`}
              </span>

              {/* Status badge */}
              <div className="flex justify-end">
                {eliminated ? (
                  <span className="tag bg-green-500/10 text-green-400 border border-green-500/20">
                    GIÀ
                  </span>
                ) : r.needed <= 25 ? (
                  <span className="tag bg-primary/10 text-primary border border-primary/20">
                    HOT
                  </span>
                ) : (
                  <span className="tag bg-secondary text-muted-foreground">
                    —
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <span className="tag bg-green-500/10 text-green-400 border border-green-500/20">GIÀ</span>
          <span className="text-[10px] text-muted-foreground">clinchato vs questo</span>
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
  const [showInfo,    setShowInfo]    = useState(false);
  const [driverId,    setDriverId]    = useState(null);
  const [racesLeft,   setRacesLeft]   = useState(null);
  const [sprintsLeft, setSprintsLeft] = useState(null);

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

  const liveRaces   = config ? config.total_races  - config.races_completed   : 0;
  const liveSprints = config ? (config.total_sprints||0) - (config.sprints_completed||0) : 0;
  const effRaces    = racesLeft   ?? liveRaces;
  const effSprints  = sprintsLeft ?? liveSprints;

  const driver      = driverId ? drivers.find(d => d.id === driverId) : null;
  const driverColor = driver ? getTeamColor(driver.team) : "#E8002D";

  const analysis = driver ? clinchAnalysis(driver, drivers, effRaces, effSprints) : null;

  // Summary text for share
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
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <CalcIcon className="w-5 h-5 text-primary" />
          <h1 className="font-heading font-black text-2xl uppercase tracking-wide">Calcolatore</h1>
        </div>
        <button onClick={() => setShowInfo(true)}
          className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center
                     text-muted-foreground hover:text-foreground transition-colors">
          <Info style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Driver selector */}
      <div className="rounded-2xl bg-card border border-border px-4 py-3">
        <p className="font-heading font-bold text-[10px] uppercase tracking-widest
                      text-muted-foreground mb-2">Pilota</p>
        <Select value={driverId || ""} onValueChange={setDriverId}>
          <SelectTrigger className="w-full font-heading font-bold h-10 rounded-xl bg-secondary/60 border-0 px-3">
            <SelectValue placeholder="Seleziona un pilota..." />
          </SelectTrigger>
          <SelectContent>
            {drivers.map(d => (
              <SelectItem key={d.id} value={d.id}>
                <span className="flex items-center gap-2 font-heading text-sm">
                  <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getTeamColor(d.team) }} />
                  P{d.position} · {d.driver_name}
                  <span className="font-mono text-muted-foreground text-xs ml-1">
                    {d.points} pts
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Driver info pill when selected */}
        {driver && (
          <div className="flex items-center gap-3 mt-3 px-1">
            <div className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: driverColor }} />
            <div>
              <p className="font-heading font-black text-base leading-tight">{driver.driver_name}</p>
              <p className="font-mono text-xs text-muted-foreground">{driver.team} · P{driver.position}</p>
            </div>
            <span className="ml-auto font-mono font-black text-2xl tabular-nums"
                  style={{ color: driverColor }}>
              {driver.points}
            </span>
          </div>
        )}
      </div>

      {/* Counters */}
      <div className="rounded-2xl bg-card border border-border px-4 py-3 space-y-3">
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
          <button
            onClick={() => { setRacesLeft(null); setSprintsLeft(null); }}
            className="text-[10px] font-heading font-bold text-primary/70 hover:text-primary
                       uppercase tracking-widest transition-colors"
          >
            ↺ Ripristina valori live
          </button>
        )}
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {analysis && driver && (
          <motion.div
            key={`${driverId}-${effRaces}-${effSprints}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* ── Main verdict ── */}
            <div className={`rounded-2xl border p-4 ${
              analysis.alreadyClinched
                ? "bg-green-500/8 border-green-500/25"
                : analysis.mathematicallyOut
                ? "bg-destructive/8 border-destructive/20"
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
                    Non può più raggiungere {analysis.hardest?.rival.driver_name} nemmeno vincendo tutto.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-heading font-bold text-base leading-snug">
                    <span style={{ color: driverColor }}>{driver.driver_name}</span>
                    {" "}deve ottenere almeno{" "}
                    <span className="font-black text-white text-2xl">
                      {analysis.hardest.needed}
                    </span>
                    {" "}punti
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per battere{" "}
                    <strong style={{ color: getTeamColor(analysis.hardest.rival.team) }}>
                      {analysis.hardest.rival.driver_name}
                    </strong>
                    {" "}({analysis.hardest.rival.points} pts · massimo teorico {analysis.hardest.rivalMax})
                  </p>
                  <p className="font-heading text-[10px] text-amber-400/80 mt-2">
                    ⚠ In caso di parità conta il numero di vittorie
                  </p>
                </>
              )}
            </div>

            {/* ── Breakdown for the hardest rival ── */}
            {!analysis.alreadyClinched && !analysis.mathematicallyOut && analysis.hardest && (
              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🔎</span>
                  <span className="font-heading font-black text-xs uppercase tracking-widest text-muted-foreground">
                    Dettaglio — rivale più difficile
                  </span>
                </div>

                <div className="bg-secondary/50 rounded-xl p-3 font-mono text-xs space-y-1.5 mb-3">
                  <p className="text-muted-foreground">
                    Max{" "}
                    <span style={{ color: getTeamColor(analysis.hardest.rival.team) }}>
                      {analysis.hardest.rival.driver_name}
                    </span>
                    {" "}= <span className="text-foreground">{analysis.hardest.rival.points}</span>
                    {" "}+ ({effRaces} × 25)
                    {effSprints > 0 && ` + (${effSprints} × 8)`}
                    {" "}= <strong className="text-white">{analysis.hardest.rivalMax}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    Punti mancanti = <span className="text-foreground">{analysis.hardest.rivalMax}</span>
                    {" "}− <span style={{ color: driverColor }}>{driver.points}</span>
                    {" "}+ 1 = <strong className="text-primary">{analysis.hardest.needed}</strong>
                  </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                    <span>Vantaggio attuale su P1: {driver.points - analysis.hardest.rival.points >= 0 ? "+" : ""}{driver.points - analysis.hardest.rival.points}</span>
                    <span>Serve ancora: {analysis.hardest.needed} pts</span>
                  </div>
                  <div className="relative h-2.5 bg-secondary rounded-full overflow-hidden">
                    {/* Background = rival's max */}
                    <div className="absolute inset-0 rounded-full"
                         style={{ backgroundColor: getTeamColor(analysis.hardest.rival.team), opacity: 0.2 }} />
                    {/* Driver's current points / rival max */}
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((driver.points / analysis.hardest.rivalMax) * 100, 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ backgroundColor: driverColor }}
                    />
                  </div>
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-muted-foreground">0</span>
                    <span style={{ color: driverColor }}>{driver.points}</span>
                    <span className="text-muted-foreground">{analysis.hardest.rivalMax}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Full rivals table ── */}
            <RivalsTable
              driver={driver}
              allRivals={analysis.allRivals}
              driverColor={driverColor}
            />

            {/* ── Quick scenarios ── */}
            {!analysis.alreadyClinched && !analysis.mathematicallyOut && (
              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🎯</span>
                  <span className="font-heading font-black text-xs uppercase tracking-widest text-muted-foreground">
                    Scenari rapidi
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Hardest rival wins everything */}
                  <div className="rounded-xl bg-secondary/50 p-3 border border-border/60">
                    <p className="font-heading font-bold text-xs text-muted-foreground mb-2 uppercase leading-tight">
                      {analysis.hardest.rival.driver_name} vince tutto
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">Rivale arriva a</p>
                    <p className="font-mono font-black text-base">{analysis.hardest.rivalMax}</p>
                    <p className="font-mono text-xs mt-1">
                      Serve{" "}
                      <span className="text-primary font-bold">
                        +{Math.max(0, analysis.hardest.rivalMax - driver.points + 1)}
                      </span>
                    </p>
                  </div>

                  {/* Driver wins everything */}
                  <div className="rounded-xl bg-secondary/50 p-3 border border-border/60">
                    <p className="font-heading font-bold text-xs text-muted-foreground mb-2 uppercase leading-tight">
                      {driver.driver_name} vince tutto
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">Arriva a</p>
                    <p className="font-mono font-black text-base" style={{ color: driverColor }}>
                      {driver.points + effRaces * MAX_POINTS_RACE + effSprints * MAX_POINTS_SPRINT}
                    </p>
                    <p className="font-mono text-xs mt-1">
                      {driver.points + effRaces * MAX_POINTS_RACE + effSprints * MAX_POINTS_SPRINT
                        > analysis.hardest.rivalMax
                        ? <span className="text-green-400 font-bold">✓ Campione</span>
                        : <span className="text-destructive font-bold">✗ Non basta</span>
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Share / Save ── */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() =>
                  navigator.share
                    ? navigator.share({ title: "FantaF1", text: shareText })
                    : navigator.clipboard.writeText(shareText)
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-secondary
                           border border-border py-3 font-heading font-bold text-sm
                           hover:bg-secondary/80 transition-colors active:scale-95"
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
          <p className="text-xs text-muted-foreground/60 max-w-[240px]">
            Verranno calcolati i punti necessari vs tutti i rivali con punteggio ≥
          </p>
        </div>
      )}

      <AnimatePresence>
        {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      </AnimatePresence>
    </div>
  );
}