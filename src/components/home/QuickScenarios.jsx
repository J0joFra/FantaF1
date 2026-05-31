import { motion } from "framer-motion";
import {
  calculateMaxAvailablePoints, pointsNeededPerRace,
  isMathematicallyEliminated, pointsToClinchVsRival,
} from "@/lib/f1Utils";
import { Zap, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function QuickScenarios({ drivers, config }) {
  if (!drivers?.length || !config) return null;

  const leader       = drivers[0];
  const maxAvailable = calculateMaxAvailablePoints(config);
  const racesLeft    = config.total_races - config.races_completed;
  const sprintsLeft  = (config.total_sprints || 0) - (config.sprints_completed || 0);
  const scenarios    = [];

  drivers.slice(1, 4)
    .filter(d => !isMathematicallyEliminated(d.points, leader.points, maxAvailable))
    .forEach(d => {
      const gap       = leader.points - d.points;
      const avgNeeded = pointsNeededPerRace(gap, racesLeft);
      scenarios.push({
        emoji: "🏆", q: `${d.driver_name} per il titolo`,
        a: `−${gap} pts · media ${avgNeeded.toFixed(1)} pts/GP`,
        hot: avgNeeded > 18,
      });
    });

  if (drivers[1]) {
    const clinch = pointsToClinchVsRival(leader.points, drivers[1].points, racesLeft, sprintsLeft);
    scenarios.push(clinch <= 0 ? {
      emoji: "🏆", q: `${leader.driver_name} campione!`,
      a: "Titolo matematicamente conquistato", hot: true,
    } : {
      emoji: "🎯", q: `${leader.driver_name} per il clinch`,
      a: `Serve +${clinch} pts su ${drivers[1].driver_name}`, hot: false,
    });
  }

  if (!scenarios.length) return null;

  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" strokeWidth={2} />
          <h2 className="font-heading font-black text-base uppercase tracking-wide">Scenari</h2>
        </div>
        <Link to="/calculator"
          className="flex items-center gap-0.5 text-xs text-primary font-body font-semibold">
          Calcola <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="px-4 py-3 space-y-2">
        {scenarios.slice(0, 3).map((s, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.04 }}
            className={`rounded-xl px-3 py-2.5 border
              ${s.hot ? "bg-primary/4 border-primary/15" : "bg-gray-50 border-gray-100"}`}>
            <p className="font-heading font-bold text-sm flex items-center gap-1.5">
              <span>{s.emoji}</span>{s.q}
            </p>
            <p className="font-body text-xs text-muted-foreground mt-0.5">{s.a}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
