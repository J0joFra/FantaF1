import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ChampionshipBattle from "@/components/home/ChampionshipBattle";
import ThisWeekend from "@/components/home/ThisWeekend";
import QuickScenarios from "@/components/home/QuickScenarios";
import FerrariWatch from "@/components/home/FerrariWatch";
import ConstructorsStanding from "@/components/home/ConstructorsStanding";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { data: drivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ["driverStandings", 2025],
    queryFn: () => base44.entities.DriverStanding.filter({ season: 2025 }, "position", 100),
  });

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ["teamStandings", 2025],
    queryFn: () => base44.entities.TeamStanding.filter({ season: 2025 }, "position", 100),
  });

  const { data: configs = [], isLoading: loadingConfig } = useQuery({
    queryKey: ["seasonConfig", 2025],
    queryFn: () => base44.entities.SeasonConfig.filter({ season: 2025 }),
  });

  const { data: ferrariSeasons = [] } = useQuery({
    queryKey: ["ferrariSeasons"],
    queryFn: () => base44.entities.FerrariSeason.list("-season", 5),
  });

  const config = configs[0];
  const isLoading = loadingDrivers || loadingTeams || loadingConfig;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="mb-2">
        <h1 className="font-heading font-black text-2xl tracking-tight">F1 Scenarios</h1>
        <p className="text-sm text-muted-foreground">Stagione 2025 · Scenari campionato in tempo reale</p>
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
