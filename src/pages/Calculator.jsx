import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  calculateMaxAvailablePoints, pointsNeededPerRace,
  isMathematicallyEliminated, pointsToClinch,
  MAX_POINTS_RACE, MAX_POINTS_SPRINT, getTeamColor,
} from "@/lib/f1Utils";
import { getDriverStandings, getSeasonConfig } from "@/lib/supabaseData";
import { motion } from "framer-motion";
import { Calculator as CalcIcon, Loader2, Zap } from "lucide-react";

function Stat({ label, value, accent = false }) {
  return (
    <div className="bg-secondary/60 rounded-xl p-3 text-center">
      <span className={`font-heading font-black text-2xl block leading-none
        ${accent ? "text-primary" : ""}`}>{value}</span>
      <span className="font-heading text-[10px] text-muted-foreground tracking-widest uppercase mt-1 block">
        {label}
      </span>
    </div>
  );
}

function Section({ title, children, variant = "default" }) {
  const styles = {
    default: "bg-card border-border",
    warn:    "bg-primary/5 border-primary/25",
    danger:  "bg-destructive/5 border-destructive/20",
    success: "bg-green-500/5 border-green-500/25",
  };
  return (
    <div className={`rounded-2xl border p-4 ${styles[variant]}`}>
      <p className="font-heading font-black text-xs uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </p>
      {children}
    </div>
  );
}

export default function Calculator() {
  const [selected, setSelected] = useState(null);

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

  const leader       = drivers[0];
  const maxAvailable = calculateMaxAvailablePoints(config);
  const racesLeft    = config ? config.total_races - config.races_completed : 0;
  const sprintsLeft  = config ? (config.total_sprints||0) - (config.sprints_completed||0) : 0;

  const driver     = selected ? drivers.find(d => d.id === selected) : null;
  const isLeader   = driver && leader && driver.id === leader.id;
  const gap        = driver && !isLeader ? leader.points - driver.points : 0;
  const eliminated = driver && !isLeader
    ? isMathematicallyEliminated(driver.points, leader.points, maxAvailable) : false;
  const avgNeeded  = !isLeader && racesLeft > 0 ? pointsNeededPerRace(gap, racesLeft) : 0;
  const gapToP2    = isLeader && drivers[1] ? leader.points - drivers[1].points : 0;
  const clinch     = isLeader && drivers[1]
    ? pointsToClinch(leader.points, drivers[1].points, maxAvailable) : null;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2 pt-1">
        <CalcIcon className="w-5 h-5 text-primary" />
        <h1 className="font-heading font-black text-2xl uppercase tracking-wide">Calcolatore</h1>
      </div>

      {/* Driver picker */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <p className="font-heading font-bold text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Seleziona pilota
        </p>
        <Select value={selected || ""} onValueChange={setSelected}>
          <SelectTrigger className="w-full font-heading font-bold">
            <SelectValue placeholder="Scegli un pilota..." />
          </SelectTrigger>
          <SelectContent>
            {drivers.map(d => (
              <SelectItem key={d.id} value={d.id}>
                <span className="flex items-center gap-2 font-heading">
                  <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getTeamColor(d.team) }} />
                  P{d.position} · {d.driver_name} · {d.points} pts
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {driver && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Punti"    value={driver.points}              accent />
            <Stat label="Pos"      value={`P${driver.position}`}             />
            <Stat label={isLeader ? "Vantaggio" : "Gap"} value={isLeader ? `+${gapToP2}` : `−${gap}`} />
            <Stat label="Gare"     value={racesLeft}                         />
          </div>

          {eliminated ? (
            <Section title="Stato Titolo" variant="danger">
              <p className="font-heading font-bold text-base text-destructive">
                {driver.driver_name} è eliminato dalla lotta titolo
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Anche vincendo tutte le {racesLeft} gare rimanenti non può raggiungere {leader.driver_name}.
              </p>
            </Section>
          ) : isLeader ? (
            <>
              <Section title="Clinch Titolo" variant={clinch !== null && clinch <= 0 ? "success" : "warn"}>
                {clinch !== null && clinch <= 0 ? (
                  <p className="font-heading font-black text-xl text-green-400">
                    🏆 Campione matematico!
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm">Serve ancora <strong>+{clinch}</strong> punti su {drivers[1]?.driver_name}</p>
                    </div>
                    <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((gapToP2 / maxAvailable) * 100, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute inset-y-0 left-0 bg-primary rounded-full"
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="font-mono text-[10px] text-muted-foreground">0</span>
                      <span className="font-mono text-[10px] text-primary font-bold">{gapToP2} / {maxAvailable}</span>
                    </div>
                  </>
                )}
              </Section>

              <Section title="Chi può ancora raggiungere">
                <div className="space-y-2">
                  {drivers.slice(1, 7).map(d => {
                    const canCatch = !isMathematicallyEliminated(d.points, leader.points, maxAvailable);
                    return (
                      <div key={d.id} className="flex items-center justify-between text-sm">
                        <span className={!canCatch ? "text-muted-foreground/40 line-through" : "font-medium"}>
                          {d.driver_name}
                        </span>
                        <span className={`font-mono text-xs ${canCatch ? "" : "text-muted-foreground/40"}`}>
                          −{leader.points - d.points} pts {!canCatch && "❌"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </>
          ) : (
            <>
              <Section title="Cosa serve" variant="warn">
                <p className="font-heading font-bold text-base mb-3">
                  Recuperare <span className="text-primary">{gap} punti</span> in {racesLeft} GP
                </p>
                <div className="space-y-2">
                  {[
                    { l: "Media punti / gara",   v: avgNeeded.toFixed(1)     },
                    { l: "Punti max disponibili", v: maxAvailable             },
                    { l: "Margine di errore",     v: `${maxAvailable - gap} pts` },
                  ].map(({ l, v }) => (
                    <div key={l} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="font-mono font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Scenario perfetto (vince tutto)">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{racesLeft} vittorie</span>
                    <span className="font-mono font-bold">+{racesLeft * MAX_POINTS_RACE} pts</span>
                  </div>
                  {sprintsLeft > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{sprintsLeft} sprint</span>
                      <span className="font-mono font-bold">+{sprintsLeft * MAX_POINTS_SPRINT} pts</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border/60 pt-1.5 mt-1.5">
                    <span className="font-heading font-bold">Totale finale max</span>
                    <span className="font-mono font-black text-primary">
                      {driver.points + maxAvailable} pts
                    </span>
                  </div>
                </div>
              </Section>
            </>
          )}
        </motion.div>
      )}

      {!driver && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Zap className="w-10 h-10 text-muted-foreground/30" />
          <p className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wide">
            Seleziona un pilota per vedere gli scenari
          </p>
        </div>
      )}
    </div>
  );
}
