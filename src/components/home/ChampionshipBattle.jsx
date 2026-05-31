import { motion } from "framer-motion";
import { getTeamColor, calculateMaxAvailablePoints, isMathematicallyEliminated } from "@/lib/f1Utils";
import { Trophy } from "lucide-react";

function DriverRow({ driver, leader, maxAvailable, index }) {
  const gap        = leader.points - driver.points;
  const isLeader   = index === 0;
  const isTop3     = index < 3;
  const eliminated = !isLeader && isMathematicallyEliminated(driver.points, leader.points, maxAvailable);
  const barWidth   = leader.points > 0 ? (driver.points / leader.points) * 100 : 0;
  const color      = getTeamColor(driver.team);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-center gap-3 py-2.5 ${index > 0 ? "border-t border-border/40" : ""}`}
    >
      {/* Position */}
      <div className="w-7 text-center shrink-0">
        {isTop3
          ? <span className="text-base">{medals[index]}</span>
          : <span className={`font-mono text-xs font-bold ${eliminated ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
              {driver.position}
            </span>
        }
      </div>

      {/* Name + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1 h-3.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className={`font-heading font-bold text-sm truncate leading-none
            ${eliminated ? "text-muted-foreground/50 line-through" : ""}`}>
            {driver.driver_name}
          </span>
          {eliminated && (
            <span className="tag bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
              OUT
            </span>
          )}
        </div>
        <div className="relative h-1 bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(barWidth, 100)}%` }}
            transition={{ duration: 0.7, delay: index * 0.04, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: eliminated ? "#333" : color }}
          />
        </div>
      </div>

      {/* Points + gap */}
      <div className="text-right shrink-0 min-w-[52px]">
        <span className={`font-mono font-bold text-sm block
          ${isLeader ? "text-primary" : eliminated ? "text-muted-foreground/40" : ""}`}>
          {driver.points}
        </span>
        {!isLeader && (
          <span className="font-mono text-[10px] text-muted-foreground/60 block">
            −{gap}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function ChampionshipBattle({ drivers, config }) {
  if (!drivers?.length) return null;
  const leader       = drivers[0];
  const maxAvailable = calculateMaxAvailablePoints(config);

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-black text-lg uppercase tracking-wide">
            Classifica Piloti
          </h2>
        </div>
        <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-lg">
          {config?.races_completed ?? 0}/{config?.total_races ?? 0} GP
        </span>
      </div>
      <div className="px-4 py-1">
        {drivers.slice(0, 10).map((d, i) => (
          <DriverRow key={d.id} driver={d} leader={leader}
                     maxAvailable={maxAvailable} index={i} />
        ))}
      </div>
    </div>
  );
}
