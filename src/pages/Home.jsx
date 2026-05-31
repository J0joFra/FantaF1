import { useQuery } from "@tanstack/react-query";
import {
  getDriverStandings, getConstructorStandings,
  getSeasonConfig, getFerrariSeasonSummary,
} from "@/lib/supabaseData";
import ChampionshipBattle   from "@/components/home/ChampionshipBattle";
import ThisWeekend          from "@/components/home/ThisWeekend";
import QuickScenarios       from "@/components/home/QuickScenarios";
import FerrariWatch         from "@/components/home/FerrariWatch";
import ConstructorsStanding from "@/components/home/ConstructorsStanding";
import GpCountdown          from "@/components/GpCountdown";
import { Loader2, AlertCircle, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { data: drivers = [], isLoading: ld, error: driversError } = useQuery({
    queryKey: ["driverStandings"], queryFn: getDriverStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: teams = [],   isLoading: lt } = useQuery({
    queryKey: ["constructorStandings"], queryFn: getConstructorStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: config,       isLoading: lc } = useQuery({
    queryKey: ["seasonConfig"], queryFn: getSeasonConfig, staleTime: 10 * 60 * 1000,
  });
  const { data: ferrariSeasons = [] } = useQuery({
    queryKey: ["ferrariSeasons"], queryFn: getFerrariSeasonSummary, staleTime: 30 * 60 * 1000,
  });

  if (ld || lt || lc) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
      <div className="relative">
        <div className="w-14 h-14 rounded-full border-2 border-primary/20 flex items-center justify-center">
          <Zap className="w-6 h-6 text-primary animate-pulse" />
        </div>
        <Loader2 className="absolute inset-0 m-auto w-14 h-14 animate-spin text-primary/30" />
      </div>
      <p className="text-sm text-muted-foreground font-heading tracking-widest uppercase">
        Caricamento...
      </p>
    </div>
  );

  if (driversError) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
      <AlertCircle className="w-10 h-10 text-destructive" />
      <p className="font-heading font-bold text-lg uppercase">Errore connessione</p>
      <p className="text-sm text-muted-foreground">{driversError.message}</p>
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      {/* Hero — next race countdown */}
      {config?.next_race_name && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden glow-border p-4 speed-lines"
          style={{ background: "linear-gradient(135deg, hsl(20 8% 11%) 0%, hsl(3 90% 52% / 0.12) 100%)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="tag bg-primary text-white">PROSSIMO GP</div>
            {config.next_race_has_sprint && (
              <div className="tag bg-amber-500/15 text-amber-400 border border-amber-500/20">
                ⚡ SPRINT
              </div>
            )}
          </div>
          <h2 className="font-heading font-black text-2xl uppercase tracking-wide leading-tight mb-3">
            {config.next_race_name}
          </h2>
          <GpCountdown targetDate={config.next_race_date} />
          <div className="mt-3 flex items-center gap-1 text-muted-foreground">
            <span className="text-xs font-heading">
              {config.races_completed}/{config.total_races} GP completati
            </span>
          </div>
        </motion.div>
      )}

      <ChampionshipBattle   drivers={drivers} config={config} />
      <QuickScenarios       drivers={drivers} config={config} />
      <ThisWeekend          config={config}   drivers={drivers} />
      <ConstructorsStanding teams={teams} />
      <FerrariWatch         teamStandings={teams} ferrariSeasons={ferrariSeasons} drivers={drivers} />
    </div>
  );
}
