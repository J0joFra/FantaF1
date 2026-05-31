import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  calculateMaxAvailablePoints,
  pointsNeededPerRace,
  isMathematicallyEliminated,
  MAX_POINTS_RACE,
  MAX_POINTS_SPRINT,
  getTeamColor,
} from "@/lib/f1Utils";
import { getDriverStandings, getSeasonConfig } from "@/lib/supabaseData";
import { motion } from "framer-motion";
import { Calculator as CalcIcon, Target, TrendingUp, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

function ScenarioCard({ title, icon: Icon, children, variant = "default" }) {
  const variants = {
    default: "bg-card border-border",
    success: "bg-green-500/5 border-green-500/20",
    warning: "bg-primary/5 border-primary/20",
    danger: "bg-destructive/5 border-destructive/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${variants[variant]}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-heading font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

export default function Calculator() {
  const [selectedDriver, setSelectedDriver] = useState(null);

  const { data: drivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ["driverStandings"],
    queryFn: getDriverStandings,
    staleTime: 5 * 60 * 1000,
  });

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["seasonConfig"],
    queryFn: getSeasonConfig,
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = loadingDrivers || loadingConfig;

  const leader = drivers[0];
  const maxAvailable = calculateMaxAvailablePoints(config);
  const racesLeft = config ? config.total_races - config.races_completed : 0;
  const sprintsLeft = config ? (config.total_sprints || 0) - (config.sprints_completed || 0) : 0;

  const driver = selectedDriver ? drivers.find(d => d.id === selectedDriver) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const gap = driver && leader ? leader.points - driver.points : 0;
  const isLeader = driver && leader && driver.id === leader.id;
  const eliminated =
    driver && leader && !isLeader
      ? isMathematicallyEliminated(driver.points, leader.points, maxAvailable)
      : false;
  const avgNeeded = !isLeader && racesLeft > 0 ? pointsNeededPerRace(gap, racesLeft) : 0;
  const gapToSecond = isLeader && drivers[1] ? leader.points - drivers[1].points : 0;

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="font-heading font-black text-2xl tracking-tight flex items-center gap-2">
          <CalcIcon className="w-6 h-6 text-primary" />
          Championship Calculator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seleziona un pilota per calcolare gli scenari titolo
        </p>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5">
        <label className="text-sm font-medium text-muted-foreground mb-2 block">Pilota</label>
        <Select value={selectedDriver || ""} onValueChange={setSelectedDriver}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Scegli un pilota..." />
          </SelectTrigger>
          <SelectContent>
            {drivers.map(d => (
              <SelectItem key={d.id} value={d.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: getTeamColor(d.team) }}
                  />
                  P{d.position} · {d.driver_name} — {d.points} pts
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {driver && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Punti", value: driver.points },
              { label: "Posizione", value: `P${driver.position}` },
              {
                label: isLeader ? "Vantaggio" : "Gap dal leader",
                value: isLeader ? `+${gapToSecond}` : `-${gap}`,
              },
              { label: "Gare rimaste", value: racesLeft },
            ].map((stat, i) => (
              <div key={i} className="bg-secondary/50 rounded-xl p-3 text-center">
                <span className="text-xl font-mono font-bold">{stat.value}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase">{stat.label}</p>
              </div>
            ))}
          </div>

          {eliminated ? (
            <ScenarioCard title="Stato Campionato" icon={AlertTriangle} variant="danger">
              <p className="text-sm text-destructive font-semibold">
                {driver.driver_name} è matematicamente eliminato dalla lotta per il titolo.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Anche vincendo tutte le {racesLeft} gare rimaste, non può raggiungere{" "}
                {leader.driver_name}.
              </p>
            </ScenarioCard>
          ) : isLeader ? (
            <>
              <ScenarioCard title="Title Clinch" icon={CheckCircle2} variant="success">
                <p className="text-sm">
                  {gapToSecond > maxAvailable
                    ? `${driver.driver_name} ha già vinto il campionato! 🏆`
                    : `Vantaggio: ${gapToSecond} punti. Servono ${
                        maxAvailable - gapToSecond + 1
                      } punti di vantaggio per chiudere il titolo.`}
                </p>
                {gapToSecond <= maxAvailable && (
                  <div className="mt-2 bg-secondary/50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">
                      Punti max ancora disponibili:{" "}
                      <strong className="text-foreground">{maxAvailable}</strong>
                    </p>
                    <div className="relative h-2 bg-secondary rounded-full mt-2 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min((gapToSecond / maxAvailable) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">0</span>
                      <span className="text-[10px] text-green-500 font-mono">{gapToSecond}</span>
                      <span className="text-[10px] text-muted-foreground">{maxAvailable}</span>
                    </div>
                  </div>
                )}
              </ScenarioCard>

              <ScenarioCard title="Chi può ancora raggiungere?" icon={Target}>
                <div className="space-y-2">
                  {drivers.slice(1, 6).map(d => {
                    const dGap = leader.points - d.points;
                    const canCatch = !isMathematicallyEliminated(
                      d.points,
                      leader.points,
                      maxAvailable
                    );
                    return (
                      <div key={d.id} className="flex items-center justify-between text-sm">
                        <span className={!canCatch ? "line-through text-muted-foreground" : ""}>
                          {d.driver_name}
                        </span>
                        <span
                          className={`font-mono text-xs ${
                            canCatch ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          -{dGap} pts {!canCatch && "❌"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScenarioCard>
            </>
          ) : (
            <>
              <ScenarioCard title="Cosa serve per il titolo" icon={Target} variant="warning">
                <p className="text-sm">
                  {driver.driver_name} deve recuperare{" "}
                  <strong>{gap} punti</strong> in {racesLeft} gare.
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Media punti necessaria per gara</span>
                    <span className="font-mono font-bold">{avgNeeded.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Punti massimi disponibili</span>
                    <span className="font-mono font-bold">{maxAvailable}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Margine di errore</span>
                    <span className="font-mono font-bold">{maxAvailable - gap} pts</span>
                  </div>
                </div>
              </ScenarioCard>

              <ScenarioCard title="Scenario Perfetto" icon={TrendingUp}>
                <div className="space-y-2 text-sm">
                  <p>Se {driver.driver_name} vince tutte le gare rimanenti:</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>• {racesLeft} vittorie = {racesLeft * 25} punti</li>
                    {sprintsLeft > 0 && (
                      <li>• {sprintsLeft} sprint vittorie = {sprintsLeft * 8} punti</li>
                    )}
                    <li>• {racesLeft} giri veloci = {racesLeft} punti</li>
                    <li className="text-foreground font-semibold pt-1">
                      Totale massimo: {maxAvailable} punti → {driver.points + maxAvailable} punti
                      totali
                    </li>
                  </ul>
                </div>
              </ScenarioCard>
            </>
          )}
        </div>
      )}
    </div>
  );
}
