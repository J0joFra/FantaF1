import { useQuery } from "@tanstack/react-query";
import {
  getDriverStandings,
  getConstructorStandings,
  getSeasonConfig,
  getFerrariSeasonSummary,
} from "@/lib/supabaseData";
import ChampionshipBattle from "@/components/home/ChampionshipBattle";
import ThisWeekend from "@/components/home/ThisWeekend";
import QuickScenarios from "@/components/home/QuickScenarios";
import FerrariWatch from "@/components/home/FerrariWatch";
import ConstructorsStanding from "@/components/home/ConstructorsStanding";
import { Loader2, AlertCircle } from "lucide-react";

export default function Home() {
  const { data: drivers = [], isLoading: loadingDrivers, error: driversError } = useQuery({
    queryKey: ["driverStandings"],
    queryFn: getDriverStandings,
    staleTime: 5 * 60 * 1000,
  });

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ["constructorStandings"],
    queryFn: getConstructorStandings,
    staleTime: 5 * 60 * 1000,
  });

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["seasonConfig"],
    queryFn: getSeasonConfig,
    staleTime: 10 * 60 * 1000,
  });

  const { data: ferrariSeasons = [] } = useQuery({
    queryKey: ["ferrariSeasons"],
    queryFn: getFerrariSeasonSummary,
    staleTime: 30 * 60 * 1000,
  });

  const isLoading = loadingDrivers || loadingTeams || loadingConfig;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (driversError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground max-w-xs">
          Errore nel caricamento dei dati. Controlla la connessione a Supabase.
        </p>
        <p className="text-xs text-muted-foreground/60">{driversError.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="mb-2">
        <h1 className="font-heading font-black text-2xl tracking-tight">F1 Scenarios</h1>
        <p className="text-sm text-muted-foreground">
          Stagione {config?.season || new Date().getFullYear()} · Scenari campionato in tempo reale
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <ChampionshipBattle drivers={drivers} config={config} />
          <QuickScenarios drivers={drivers} config={config} />
        </div>
        <div className="space-y-5">
          <ThisWeekend config={config} drivers={drivers} />
          <FerrariWatch teamStandings={teams} ferrariSeasons={ferrariSeasons} drivers={drivers} />
          <ConstructorsStanding teams={teams} />
        </div>
      </div>
    </div>
  );
}
