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

  // Calculate elimination risks AFTER this weekend.
  // A driver is at risk if — even assuming they score max points this weekend
  // AND max points in all remaining rounds after it — they still can't beat
  // the leader who scores the minimum (0) this weekend and onwards.
  //
  // Previous logic was wrong: it added maxWeekendPoints to the leader's score
  // (best case for leader) while also adding it to the driver's score
  // (best case for driver), making the threshold way too strict and showing
  // false eliminations.
  const eliminationRisks = (leader && drivers?.length > 1)
    ? drivers.slice(1).filter(d => {
        // Remaining points AFTER this race weekend
        const remainingAfterThis = calculateMaxAvailablePoints({
          ...config,
          races_completed:  (config.races_completed  || 0) + 1,
          sprints_completed: (config.sprints_completed || 0) + (config.next_race_has_sprint ? 1 : 0),
        });

        // Best possible total for the challenger: max this weekend + max all remaining
        const challengerBestCase = d.points + maxWeekendPoints + remainingAfterThis;

        // Minimum total the leader could finish the season with (scores 0 from here)
        const leaderCurrentPoints = leader.points;

        return challengerBestCase < leaderCurrentPoints;
      })
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl bg-card border border-border p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-bold text-lg">Questo Weekend</h2>
      </div>

      <div className="bg-secondary/50 rounded-xl p-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-heading font-bold text-base">{config.next_race_name}</h3>
            <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-sm">{config.next_race_circuit}</span>
            </div>
          </div>
          <div className="text-right">
            {config.next_race_date && (
              <span className="text-sm font-medium">
                {format(new Date(config.next_race_date), "d MMM", { locale: it })}
              </span>
            )}
            {config.next_race_has_sprint && (
              <div className="flex items-center gap-1 mt-1 text-primary">
                <Zap className="w-3 h-3" />
                <span className="text-xs font-semibold">SPRINT</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Punti max disponibili</span>
          <span className="font-mono font-bold">{maxWeekendPoints}</span>
        </div>

        {eliminationRisks.length > 0 && (
          <div className="bg-destructive/5 rounded-lg p-3 border border-destructive/10">
            <p className="text-xs font-semibold text-destructive mb-1">Rischio eliminazione</p>
            <p className="text-xs text-muted-foreground">
              {eliminationRisks.map(d => d.driver_name).join(", ")} potrebbero essere
              matematicamente eliminati dopo questo weekend
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
