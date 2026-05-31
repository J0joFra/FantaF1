import { motion } from "framer-motion";
import { getTeamColor } from "@/lib/f1Utils";
import { Building2 } from "lucide-react";

export default function ConstructorsStanding({ teams }) {
  if (!teams?.length) return null;

  const leader = teams[0];

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-bold text-lg">Costruttori</h2>
      </div>
      <div className="space-y-2.5">
        {teams.map((team, i) => {
          const barWidth = leader.points > 0 ? (team.points / leader.points) * 100 : 0;
          const color = team.team_color || getTeamColor(team.team_name);
          const gap = leader.points - team.points;

          return (
            <motion.div
              key={team.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3"
            >
              <span className="w-6 text-center font-mono text-xs text-muted-foreground">
                {team.position}
              </span>
              <div className="w-2 h-6 rounded-sm" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium truncate">{team.team_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{team.points}</span>
                    {i > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono">-{gap}</span>
                    )}
                  </div>
                </div>
                <div className="relative h-1 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(barWidth, 100)}%` }}
                    transition={{ duration: 0.6, delay: i * 0.04 }}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
