import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTeamColor, MAX_POINTS_RACE, MAX_POINTS_SPRINT } from "@/lib/f1Utils";
import { getDriverStandings, getSeasonConfig } from "@/lib/supabaseData";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator as CalcIcon, Loader2, Info, X, Share2, Bookmark, ChevronUp, ChevronDown } from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────
function calcMaxPoints(races, sprints) {
  return races * MAX_POINTS_RACE + sprints * MAX_POINTS_SPRINT;
}

/**
 * How many points does the LEADER need to clinch mathematically over RIVAL?
 * Returns a negative number if already clinched.
 *
 * The rival's theoretical max = rivalPts + races*26 + sprints*8
 * Leader clinches when leaderPts > rivalMax  (strictly greater because ties
 * go to wins — we add a note about that).
 * So leader needs: leaderPts > rivalMax  →  needs rivalMax - leaderPts + 1 more points
 */
function pointsNeededToClinch(leaderPts, rivalPts, racesLeft, sprintsLeft) {
  const rivalMax = rivalPts + calcMaxPoints(racesLeft, sprintsLeft);
  return rivalMax - leaderPts + 1; // ≤ 0 means already clinched
}

// ─── sub-components ─────────────────────────────────────────────────────────
function InfoModal({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="w-full max-w-lg rounded-2xl bg-card border border-border p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-black text-lg uppercase tracking-wide">Come funziona</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Il calcolo si basa sul <strong className="text-foreground">massimo teorico</strong> del rivale:
          </p>
          <div className="bg-secondary/60 rounded-xl p-3 font-mono text-xs space-y-1">
            <p>Max rivale = punti_rivale + (gare × 26) + (sprint × 8)</p>
            <p>Punti mancanti = Max rivale − punti_leader + 1</p>
          </div>
          <p>
            Dove <strong className="text-foreground">26</strong> = vittoria (25) + giro veloce (1)
            e <strong className="text-foreground">8</strong> = vittoria sprint.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-amber-400 font-heading font-bold text-xs uppercase tracking-widest mb-1">
              ⚠ Parità di punti
            </p>
            <p className="text-xs">
              In caso di parità il titolo va al pilota con più vittorie. 
              Questa app considera la parità come "non ancora clinchato" per sicurezza.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stepper({ value, onChange, min = 0 }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center
                   text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
      <span className="font-mono font-black text-xl w-8 text-center tabular-nums">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center
                   text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  );
}

function DriverSelector({ label, value, onChange, drivers, excludeId, color }) {
  const d = drivers.find(x => x.id === value);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <span className="font-heading font-bold text-xs uppercase tracking-widest text-muted-foreground w-14 shrink-0">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className="h-9 font-heading font-bold text-sm border-0 bg-secondary/60 rounded-xl px-3">
            <SelectValue placeholder="Seleziona..." />
          </SelectTrigger>
          <SelectContent>
            {drivers.filter(x => x.id !== excludeId).map(x => (
              <SelectItem key={x.id} value={x.id}>
                <span className="flex items-center gap-2 font-heading text-sm">
                  <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getTeamColor(x.team) }} />
                  {x.driver_name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {d && (
        <span className="font-mono font-black text-base tabular-nums shrink-0"
              style={{ color }}>
          {d.points}
        </span>
      )}
    </div>
  );
}

// ─── main component ─────────────────────────────────────────────────────────
export default function Calculator() {
  const [showInfo,    setShowInfo]    = useState(false);
  const [leaderId,    setLeaderId]    = useState(null);
  const [rivalId,     setRivalId]     = useState(null);
  const [racesLeft,   setRacesLeft]   = useState(null); // null = use live data
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

  // Use live data as defaults when user hasn't overridden
  const liveRacesLeft   = config ? config.total_races   - config.races_completed   : 0;
  const liveSprintsLeft = config ? (config.total_sprints||0) - (config.sprints_completed||0) : 0;
  const effectiveRaces   = racesLeft   ?? liveRacesLeft;
  const effectiveSprints = sprintsLeft ?? liveSprintsLeft;

  const leader = leaderId ? drivers.find(d => d.id === leaderId) : null;
  const rival  = rivalId  ? drivers.find(d => d.id === rivalId)  : null;
  const leaderColor = leader ? getTeamColor(leader.team) : "#E8002D";
  const rivalColor  = rival  ? getTeamColor(rival.team)  : "#6692FF";

  // ── core calculation ──────────────────────────────────────────────────────
  let result = null;
  if (leader && rival) {
    const rivalMax    = rival.points + calcMaxPoints(effectiveRaces, effectiveSprints);
    const needed      = pointsNeededToClinch(leader.points, rival.points, effectiveRaces, effectiveSprints);
    const alreadyDone = needed <= 0;
    const rivalElim   = rival.points + calcMaxPoints(effectiveRaces, effectiveSprints) < leader.points;

    // Quick scenarios
    const scenarioRivalWinsAll = {
      rivalFinal:  rivalMax,
      leaderNeeds: rivalMax - leader.points + 1,
    };
    const leaderFixed2nd = effectiveRaces * 18 + effectiveSprints * 7; // P2 every race
    const scenarioLeader2nd = {
      leaderFinal: leader.points + leaderFixed2nd,
      still: leader.points + leaderFixed2nd > rivalMax,
    };

    result = {
      needed, alreadyDone, rivalElim, rivalMax,
      effectiveRaces, effectiveSprints,
      scenarioRivalWinsAll, scenarioLeader2nd,
    };
  }

  const shareText = result && leader && rival
    ? `🏎 FantaF1\n${leader.driver_name} (${leader.points} pts) vs ${rival.driver_name} (${rival.points} pts)\n` +
      (result.alreadyDone
        ? `${leader.driver_name} è già campione matematicamente! 🏆`
        : `Servono ${result.needed} punti per il titolo matematico`)
    : "";

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <CalcIcon className="w-5 h-5 text-primary" />
          <h1 className="font-heading font-black text-2xl uppercase tracking-wide">Calcolatore</h1>
        </div>
        <button
          onClick={() => setShowInfo(true)}
          className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center
                     text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Driver selectors card */}
      <div className="rounded-2xl bg-card border border-border px-4 py-2">
        <DriverSelector
          label="Pilota"
          value={leaderId}
          onChange={setLeaderId}
          drivers={drivers}
          excludeId={rivalId}
          color={leaderColor}
        />
        <DriverSelector
          label="Rivale"
          value={rivalId}
          onChange={setRivalId}
          drivers={drivers}
          excludeId={leaderId}
          color={rivalColor}
        />
      </div>

      {/* Race / sprint counters */}
      <div className="rounded-2xl bg-card border border-border px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-heading font-bold text-sm">Gare rimanenti</span>
          <Stepper
            value={effectiveRaces}
            onChange={setRacesLeft}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="font-heading font-bold text-sm">Sprint rimanenti</span>
          <Stepper
            value={effectiveSprints}
            onChange={setSprintsLeft}
          />
        </div>
        {(racesLeft !== null || sprintsLeft !== null) && (
          <button
            onClick={() => { setRacesLeft(null); setSprintsLeft(null); }}
            className="text-[10px] font-heading font-bold text-primary/70 uppercase tracking-widest"
          >
            ↺ Ripristina valori live
          </button>
        )}
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && leader && rival && (
          <motion.div
            key={`${leaderId}-${rivalId}-${effectiveRaces}-${effectiveSprints}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {/* Main verdict */}
            <div className={`rounded-2xl border p-4 ${
              result.alreadyDone
                ? "bg-green-500/8 border-green-500/25"
                : result.rivalElim
                ? "bg-destructive/8 border-destructive/20"
                : "bg-primary/6 border-primary/20"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{result.alreadyDone ? "🏆" : result.rivalElim ? "❌" : "📊"}</span>
                <span className="font-heading font-black text-xs uppercase tracking-widest text-muted-foreground">
                  Risultato
                </span>
              </div>

              {result.alreadyDone ? (
                <p className="font-heading font-black text-xl text-green-400">
                  {leader.driver_name} è già campione matematico!
                </p>
              ) : result.rivalElim ? (
                <p className="font-heading font-black text-lg text-destructive">
                  {rival.driver_name} è già eliminato matematicamente
                </p>
              ) : (
                <>
                  <p className="font-heading font-bold text-base leading-snug">
                    <span style={{ color: leaderColor }}>{leader.driver_name}</span>
                    {" "}deve ottenere almeno{" "}
                    <span className="font-black text-white text-xl">{result.needed}</span>
                    {" "}punti per essere campione matematicamente
                  </p>
                  <p className="font-heading text-xs text-muted-foreground mt-1">
                    ⚠ In caso di parità conta il numero di vittorie
                  </p>
                </>
              )}
            </div>

            {/* Breakdown */}
            {!result.alreadyDone && !result.rivalElim && (
              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🔎</span>
                  <span className="font-heading font-black text-xs uppercase tracking-widest text-muted-foreground">
                    Dettaglio calcolo
                  </span>
                </div>

                {/* Rival max breakdown */}
                <div className="bg-secondary/50 rounded-xl p-3 mb-3 font-mono text-xs space-y-1">
                  <p className="text-muted-foreground">
                    Max{" "}
                    <span style={{ color: rivalColor }}>{rival.driver_name}</span>
                    {" "}={" "}
                    <span className="text-foreground font-bold">
                      {rival.points}
                    </span>
                    {" "}+{" "}
                    ({result.effectiveRaces} × 26)
                    {result.effectiveSprints > 0 && ` + (${result.effectiveSprints} × 8)`}
                    {" "}={" "}
                    <span className="text-white font-bold">{result.rivalMax}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Punti mancanti ={" "}
                    <span className="text-foreground">{result.rivalMax}</span>
                    {" "}−{" "}
                    <span style={{ color: leaderColor }}>{leader.points}</span>
                    {" "}+ 1 ={" "}
                    <span className="text-primary font-bold">{result.needed}</span>
                  </p>
                </div>

                {/* Progress bar: how close is leader to clinching */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>Vantaggio attuale: {leader.points - rival.points} pts</span>
                    <span>Serve: {result.needed} pts</span>
                  </div>
                  <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((leader.points - rival.points) / result.needed) * 100, 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ backgroundColor: leaderColor }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quick scenarios */}
            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🎯</span>
                <span className="font-heading font-black text-xs uppercase tracking-widest text-muted-foreground">
                  Scenari rapidi
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Scenario 1: rival wins everything */}
                <div className="rounded-xl bg-secondary/50 p-3 border border-border/60">
                  <p className="font-heading font-bold text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                    {rival.driver_name} vince tutto
                  </p>
                  <p className="font-mono text-xs">
                    Rivale → <strong>{result.scenarioRivalWinsAll.rivalFinal}</strong> pts
                  </p>
                  <p className="font-mono text-xs mt-0.5">
                    Leader serve{" "}
                    <span className={result.scenarioRivalWinsAll.leaderNeeds > 0
                      ? "text-primary font-bold" : "text-green-400 font-bold"}>
                      {Math.max(0, result.scenarioRivalWinsAll.leaderNeeds)} pts
                    </span>
                  </p>
                </div>

                {/* Scenario 2: leader finishes 2nd every race */}
                <div className="rounded-xl bg-secondary/50 p-3 border border-border/60">
                  <p className="font-heading font-bold text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                    {leader.driver_name} sempre P2
                  </p>
                  <p className="font-mono text-xs">
                    Leader → <strong>{result.scenarioLeader2nd.leaderFinal}</strong> pts
                  </p>
                  <p className="font-mono text-xs mt-0.5">
                    {result.scenarioLeader2nd.still
                      ? <span className="text-green-400 font-bold">✓ Titolo comunque</span>
                      : <span className="text-destructive font-bold">✗ Non basta</span>
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Share / save */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigator.share
                  ? navigator.share({ title: "FantaF1", text: shareText })
                  : navigator.clipboard.writeText(shareText)
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-secondary
                           border border-border py-3 font-heading font-bold text-sm
                           hover:bg-secondary/80 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Condividi
              </button>
              <button
                onClick={() => {
                  const saved = JSON.parse(localStorage.getItem("fantaf1_scenarios")||"[]");
                  saved.push({ date: new Date().toISOString(), text: shareText });
                  localStorage.setItem("fantaf1_scenarios", JSON.stringify(saved.slice(-10)));
                  alert("Scenario salvato!");
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary/10
                           border border-primary/25 py-3 font-heading font-bold text-sm text-primary
                           hover:bg-primary/15 transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                Salva
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {(!leader || !rival) && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <CalcIcon className="w-10 h-10 text-muted-foreground/20" />
          <p className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wide">
            Seleziona pilota e rivale
          </p>
          <p className="text-xs text-muted-foreground/60">
            I gare/sprint rimanenti vengono presi automaticamente dal calendario live
          </p>
        </div>
      )}

      {/* Info modal */}
      <AnimatePresence>
        {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      </AnimatePresence>
    </div>
  );
}