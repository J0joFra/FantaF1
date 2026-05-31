import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const RED = "#E8002D";

export default function FerrariWatch({ teamStandings, ferrariSeasons, drivers }) {
  const ferrari        = teamStandings?.find(t => t.team_name?.toLowerCase().includes("ferrari"));
  const ferrariDrivers = drivers?.filter(d => d.team?.toLowerCase().includes("ferrari")) || [];
  if (!ferrari) return null;

  const sorted = [...(ferrariSeasons || [])].sort((a, b) => b.season - a.season);
  const curr   = sorted[0];
  const prev   = sorted[1];
  const trend  = curr && prev
    ? curr.points > prev.points ? "up" : curr.points < prev.points ? "down" : "flat"
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl overflow-hidden border"
      style={{ borderColor: `${RED}33` }}
    >
      {/* Header stripe */}
      <div className="flex items-center justify-between px-4 py-3"
           style={{ background: `linear-gradient(90deg, ${RED}22 0%, transparent 100%)` }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: RED }} />
          <h2 className="font-heading font-black text-lg uppercase tracking-wide">
            Ferrari Watch
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {trend && (
            <span className={`flex items-center gap-1 text-xs font-heading font-bold
              ${trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-muted-foreground"}`}>
              {trend === "up" ? <TrendingUp className="w-3.5 h-3.5" />
               : trend === "down" ? <TrendingDown className="w-3.5 h-3.5" />
               : <Minus className="w-3.5 h-3.5" />}
              vs {prev?.season}
            </span>
          )}
          <span className="font-heading font-black text-xl" style={{ color: RED }}>
            P{ferrari.position}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px bg-border/40 mx-4 mb-4 rounded-xl overflow-hidden">
        {[
          { v: ferrari.points,        l: "PTS"      },
          { v: ferrari.wins    || 0,  l: "VITTORIE" },
          { v: ferrari.podiums || 0,  l: "PODI"     },
        ].map(({ v, l }) => (
          <div key={l} className="bg-card py-3 text-center">
            <span className="font-heading font-black text-2xl">{v}</span>
            <p className="font-heading text-[10px] text-muted-foreground tracking-widest mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Drivers */}
      {ferrariDrivers.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          {ferrariDrivers.map(d => (
            <div key={d.id}
              className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2.5">
              <div>
                <p className="font-heading font-bold text-sm">{d.driver_name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">P{d.position} mondiale</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-sm">{d.points} pts</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {d.wins||0}V · {d.podiums||0}P
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
