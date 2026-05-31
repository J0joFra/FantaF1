import { Calendar, MapPin, Zap } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  calculateMaxAvailablePoints,
  MAX_POINTS_WEEKEND_WITH_SPRINT,
  MAX_POINTS_WEEKEND_NO_SPRINT,
} from "@/lib/f1Utils";

export default function ThisWeekend({ config, drivers }) {
  if (!config?.next_race_name) return null;

  const maxWeekendPoints = config.next_race_has_sprint
    ? MAX_POINTS_WEEKEND_WITH_SPRINT
    : MAX_POINTS_WEEKEND_NO_SPRINT;

  const leader = drivers?.[0];
  const eliminationRisks = (leader && drivers?.length > 1)
    ? drivers.slice(1).filter(d => {
        const remaining = calculateMaxAvailablePoints({
          ...config,
          races_completed:   (config.races_completed  || 0) + 1,
          sprints_completed: (config.sprints_completed || 0) + (config.next_race_has_sprint ? 1 : 0),
        });
        return d.points + maxWeekendPoints + remaining < leader.points;
      })
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="rounded-2xl bg-card border border-border overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/60">
        <Calendar className="w-4 h-4 text-primary" />
        <h2 className="font-heading font-black text-lg uppercase tracking-wide">Questo Weekend</h2>
      </div>

      <div className="p-4 space-y-3">
        {/* Race name + date */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-heading font-black text-xl uppercase leading-tight">
              {config.next_race_name}
            </h3>
            {config.next_race_circuit && (
              <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span className="text-xs">{config.next_race_circuit}</span>
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            {config.next_race_date && (
              <span className="font-heading font-bold text-sm">
                {format(new Date(config.next_race_date), "d MMM", { locale: it })}
              </span>
            )}
            {config.next_race_has_sprint && (
              <div className="flex items-center gap-1 mt-1 text-amber-400">
                <Zap className="w-3 h-3" />
                <span className="font-heading font-bold text-xs tracking-widest">SPRINT</span>
              </div>
            )}
          </div>
        </div>

        {/* Max points */}
        <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2.5">
          <span className="font-heading text-sm text-muted-foreground">Punti max weekend</span>
          <span className="font-mono font-bold text-sm">{maxWeekendPoints} pts</span>
        </div>

        {/* Elimination risk */}
        {eliminationRisks.length > 0 && (
          <div className="rounded-xl bg-destructive/8 border border-destructive/15 px-3 py-2.5">
            <p className="font-heading font-bold text-xs text-destructive tracking-widest uppercase mb-1">
              ⚠ Rischio eliminazione
            </p>
            <p className="text-xs text-muted-foreground">
              {eliminationRisks.map(d => d.driver_name).join(", ")} potrebbero uscire
              dalla lotta titolo dopo questo GP
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
