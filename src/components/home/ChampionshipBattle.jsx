import { motion } from "framer-motion";
import { getTeamColor, calculateMaxAvailablePoints, isMathematicallyEliminated } from "@/lib/f1Utils";
import { TrendingUp, AlertTriangle, Trophy } from "lucide-react";

function DriverRow({ driver, leader, maxAvailable, index }) {
  const gap = leader.points - driver.points;
  const isLeader = index === 0;
  const eliminated = !isLeader && isMathematicallyEliminated(driver.points, leader.points, maxAvailable);
  const barWidth = leader.points > 0 ? (driver.points / leader.points) * 100 : 0;
  const teamColor = getTeamColor(driver.team);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-center gap-3 py-3 ${index > 0 ? "border-t border-border/50" : ""}`}
    >
      <div className="w-8 text-center">
        <span className={`font-mono font-bold text-sm ${isLeader ? "text-primary" : "text-muted-foreground"}`}>
          P{driver.position}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: teamColor }} />
          <span className="font-heading font-semibold text-sm truncate">{driver.driver_name}</span>
          <span className="text-xs text-muted-foreground">{driver.driver_code}</span>
          {eliminated && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
              ELIMINATO
            </span>
          )}
        </div>
        <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(barWidth, 100)}%` }}
            transition={{ duration: 0.8, delay: index * 0.05 }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: teamColor }}
          />
        </div>
      </div>
      <div className="text-right min-w-[60px]">
        <span className="font-mono font-bold text-sm">{driver.points}</span>
        {!isLeader && (
          <span className="block text-[10px] text-muted-foreground font-mono">-{gap}</span>
        )}
      </div>
    </motion.div>
  );
}

export default function ChampionshipBattle({ drivers, config }) {
  if (!drivers?.length) return null;

  const leader = drivers[0];
  const maxAvailable = calculateMaxAvailablePoints(config);
  const topDrivers = drivers.slice(0, 10);

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-bold text-lg">Championship Battle</h2>
        </div>
        <span className="text-xs text-muted-foreground font-mono bg-secondary px-2 py-1 rounded-md">
          {config?.races_completed || 0}/{config?.total_races || 0} GP
        </span>
      </div>
      <div>
        {topDrivers.map((driver, i) => (
          <DriverRow
            key={driver.id}
            driver={driver}
            leader={leader}
            maxAvailable={maxAvailable}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
