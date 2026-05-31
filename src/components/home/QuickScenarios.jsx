import { motion } from "framer-motion";
import {
  calculateMaxAvailablePoints,
  pointsNeededPerRace,
  isMathematicallyEliminated,
  pointsToClinch,
} from "@/lib/f1Utils";
import { ChevronRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export default function QuickScenarios({ drivers, config }) {
  if (!drivers?.length || !config) return null;

  const leader      = drivers[0];
  const maxAvailable = calculateMaxAvailablePoints(config);
  const racesLeft   = config.total_races - config.races_completed;

  const scenarios = [];

  // Title contender scenarios
  const contenders = drivers
    .slice(1, 5)
    .filter(d => !isMathematicallyEliminated(d.points, leader.points, maxAvailable));

  contenders.forEach(d => {
    const gap       = leader.points - d.points;
    const avgNeeded = pointsNeededPerRace(gap, racesLeft);
    scenarios.push({
      emoji:   "🏆",
      question: `Cosa serve a ${d.driver_name} per il titolo?`,
      answer:   `Deve recuperare ${gap} punti in ${racesLeft} GP (media ${avgNeeded.toFixed(1)} pts/gara)`,
      urgency:  avgNeeded > 15 ? "high" : avgNeeded > 8 ? "medium" : "low",
    });
  });

  // Drivers close to the mathematical elimination threshold
  const almostEliminated = drivers.filter(d => {
    const gap = leader.points - d.points;
    return gap > maxAvailable * 0.8 && gap <= maxAvailable;
  });

  almostEliminated.forEach(d => {
    scenarios.push({
      emoji:   "⚠️",
      question: `${d.driver_name} rischia l'eliminazione?`,
      answer:   `A ${Math.round(((leader.points - d.points) / maxAvailable) * 100)}% dal limite matematico`,
      urgency:  "high",
    });
  });

  // Title clinch tracker — uses the fixed pointsToClinch helper
  if (maxAvailable > 0 && drivers[1]) {
    const p2Points        = drivers[1].points;
    const clinchThreshold = pointsToClinch(leader.points, p2Points, maxAvailable);
    const gapToSecond     = leader.points - p2Points;
    const clinchPct       = Math.round((gapToSecond / maxAvailable) * 100);

    if (clinchPct > 50) {
      scenarios.push({
        emoji:   "🎯",
        question: `${leader.driver_name} può chiudere il titolo presto?`,
        answer:
          clinchThreshold <= 0
            ? `${leader.driver_name} ha già vinto il campionato matematicamente! 🏆`
            : `Mancano ${clinchThreshold} punti di vantaggio per il titolo matematico (${clinchPct}% del massimo)`,
        urgency: "medium",
      });
    }
  }

  if (scenarios.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl bg-card border border-border p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-bold text-lg">Scenari</h2>
        </div>
        <Link to="/calculator" className="text-xs text-primary flex items-center gap-1 hover:underline">
          Calcola <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {scenarios.slice(0, 4).map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className={`rounded-xl p-3 border ${
              s.urgency === "high"   ? "border-destructive/20 bg-destructive/5" :
              s.urgency === "medium" ? "border-primary/20 bg-primary/5" :
                                       "border-border bg-secondary/30"
            }`}
          >
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <span>{s.emoji}</span>
              {s.question}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{s.answer}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
