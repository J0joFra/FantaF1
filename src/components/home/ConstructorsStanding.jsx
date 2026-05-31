import { motion } from "framer-motion";
import { getTeamColor } from "@/lib/f1Utils";
import { Building2 } from "lucide-react";

export default function ConstructorsStanding({ teams }) {
  if (!teams?.length) return null;
  const leader = teams[0];

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/60">
        <Building2 className="w-4 h-4 text-primary" />
        <h2 className="font-heading font-black text-lg uppercase tracking-wide">Costruttori</h2>
      </div>
      <div className="p-4 space-y-3">
        {teams.map((team, i) => {
          const color    = team.team_color || getTeamColor(team.team_name);
          const barWidth = leader.points > 0 ? (team.points / leader.points) * 100 : 0;
          const gap      = leader.points - team.points;

          return (
            <motion.div
              key={team.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.035 }}
              className="flex items-center gap-3"
            >
              <span className="font-mono text-xs text-muted-foreground/60 w-4 text-center shrink-0">
                {team.position}
              </span>

              {/* Color strip */}
              <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-heading font-bold text-sm truncate">{team.team_name}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-mono text-sm font-bold">{team.points}</span>
                    {i > 0 && (
                      <span className="font-mono text-[10px] text-muted-foreground/60">−{gap}</span>
                    )}
                  </div>
                </div>
                <div className="relative h-1 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(barWidth, 100)}%` }}
                    transition={{ duration: 0.6, delay: i * 0.035, ease: "easeOut" }}
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
