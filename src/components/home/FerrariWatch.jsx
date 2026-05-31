import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getTeamColor } from "@/lib/f1Utils";

export default function FerrariWatch({ teamStandings, ferrariSeasons, drivers }) {
  const ferrari = teamStandings?.find(t => t.team_name?.toLowerCase().includes("ferrari"));
  const ferrariDrivers = drivers?.filter(d => d.team?.toLowerCase().includes("ferrari")) || [];

  if (!ferrari) return null;

  // Find recent Ferrari seasons for comparison
  const sortedSeasons = [...(ferrariSeasons || [])].sort((a, b) => b.season - a.season);
  const currentSeason = sortedSeasons[0];
  const lastSeason = sortedSeasons[1];

  const trend = currentSeason && lastSeason
    ? currentSeason.points > lastSeason.points ? "up" : currentSeason.points < lastSeason.points ? "down" : "flat"
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border-2 border-[#E8002D]/20 bg-gradient-to-br from-[#E8002D]/5 to-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded" style={{ backgroundColor: "#E8002D" }} />
          <h2 className="font-heading font-bold text-lg">Ferrari Watch</h2>
        </div>
        <span className="font-mono text-sm font-bold" style={{ color: "#E8002D" }}>
          P{ferrari.position}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-secondary/50 rounded-xl p-3 text-center">
          <span className="text-2xl font-mono font-bold">{ferrari.points}</span>
          <p className="text-[10px] text-muted-foreground mt-0.5">PUNTI</p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3 text-center">
          <span className="text-2xl font-mono font-bold">{ferrari.wins || 0}</span>
          <p className="text-[10px] text-muted-foreground mt-0.5">VITTORIE</p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3 text-center">
          <span className="text-2xl font-mono font-bold">{ferrari.podiums || 0}</span>
          <p className="text-[10px] text-muted-foreground mt-0.5">PODI</p>
        </div>
      </div>

      {ferrariDrivers.length > 0 && (
        <div className="space-y-2">
          {ferrariDrivers.map(d => (
            <div key={d.id} className="flex items-center justify-between text-sm">
              <span className="font-medium">{d.driver_name}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold">{d.points} pts</span>
                <span className="text-xs text-muted-foreground">P{d.position}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {trend && (
        <div className={`flex items-center gap-1 mt-3 text-xs ${
          trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
        }`}>
          {trend === "up" ? <TrendingUp className="w-3.5 h-3.5" /> :
           trend === "down" ? <TrendingDown className="w-3.5 h-3.5" /> :
           <Minus className="w-3.5 h-3.5" />}
          <span>vs stagione precedente</span>
        </div>
      )}
    </motion.div>
  );
}
