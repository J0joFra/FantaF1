import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTeamColor } from "@/lib/f1Utils";
import { getDriverStandings } from "@/lib/supabaseData";
import { motion } from "framer-motion";
import { Users, Loader2 } from "lucide-react";

function Bar({ value, max, color, right = false }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={`flex-1 flex h-2 ${right ? "justify-end" : ""}`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`h-full ${right ? "rounded-l-full" : "rounded-r-full"}`}
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function StatRow({ label, val1, val2, color1, color2, lowerBetter = false }) {
  const max     = Math.max(val1 || 0, val2 || 0, 1);
  const winner  = lowerBetter
    ? (val1 < val2 ? 1 : val2 < val1 ? 2 : 0)
    : (val1 > val2 ? 1 : val2 > val1 ? 2 : 0);

  return (
    <div className="py-2.5 border-b border-border/40 last:border-0">
      <p className="font-heading text-[10px] text-muted-foreground/60 text-center
                    uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-sm font-bold w-10 text-right
          ${winner === 1 ? "text-foreground" : "text-muted-foreground/50"}`}>
          {val1 ?? "–"}
        </span>
        <div className="flex-1 flex gap-0.5 h-2">
          <Bar value={val1||0} max={max} color={color1} right />
          <Bar value={val2||0} max={max} color={color2} />
        </div>
        <span className={`font-mono text-sm font-bold w-10
          ${winner === 2 ? "text-foreground" : "text-muted-foreground/50"}`}>
          {val2 ?? "–"}
        </span>
      </div>
    </div>
  );
}

export default function Compare() {
  const [id1, setId1] = useState(null);
  const [id2, setId2] = useState(null);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["driverStandings"], queryFn: getDriverStandings, staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const d1 = drivers.find(d => d.id === id1);
  const d2 = drivers.find(d => d.id === id2);
  const c1 = d1 ? getTeamColor(d1.team) : "#555";
  const c2 = d2 ? getTeamColor(d2.team) : "#555";

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2 pt-1">
        <Users className="w-5 h-5 text-primary" />
        <h1 className="font-heading font-black text-2xl uppercase tracking-wide">Confronta</h1>
      </div>

      {/* Two selectors side by side */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: id1, setId: setId1, other: id2, label: "Pilota 1", color: c1 },
          { id: id2, setId: setId2, other: id1, label: "Pilota 2", color: c2 },
        ].map(({ id, setId, other, label, color }, idx) => {
          const d = [d1, d2][idx];
          return (
            <div key={label}
              className="rounded-2xl bg-card border border-border p-3 overflow-hidden relative">
              {d && (
                <div className="absolute top-0 left-0 right-0 h-0.5"
                     style={{ backgroundColor: color }} />
              )}
              <p className="font-heading font-bold text-[10px] uppercase tracking-widest
                            text-muted-foreground mb-2">{label}</p>
              <Select value={id || ""} onValueChange={setId}>
                <SelectTrigger className="w-full text-xs font-heading font-bold h-8 px-2">
                  <SelectValue placeholder="Seleziona..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.filter(d => d.id !== other).map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center gap-1.5 font-heading text-xs">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: getTeamColor(d.team) }} />
                        {d.driver_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {d && (
                <p className="font-heading text-xs text-muted-foreground mt-2 truncate">{d.team}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* VS header when both selected */}
      {d1 && d2 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Names */}
          <div className="flex items-center mb-3">
            <div className="flex-1 flex items-center gap-2">
              <div className="w-3 h-8 rounded-sm" style={{ backgroundColor: c1 }} />
              <div>
                <p className="font-heading font-black text-base leading-tight">{d1.driver_name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{d1.driver_code}</p>
              </div>
            </div>
            <div className="tag bg-secondary text-muted-foreground border border-border mx-2">VS</div>
            <div className="flex-1 flex items-center gap-2 justify-end text-right">
              <div>
                <p className="font-heading font-black text-base leading-tight">{d2.driver_name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{d2.driver_code}</p>
              </div>
              <div className="w-3 h-8 rounded-sm" style={{ backgroundColor: c2 }} />
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-4">
            <StatRow label="Punti"         val1={d1.points}       val2={d2.points}       color1={c1} color2={c2} />
            <StatRow label="Posizione"     val1={d1.position}     val2={d2.position}     color1={c1} color2={c2} lowerBetter />
            <StatRow label="Vittorie"      val1={d1.wins}         val2={d2.wins}         color1={c1} color2={c2} />
            <StatRow label="Podi"          val1={d1.podiums}      val2={d2.podiums}      color1={c1} color2={c2} />
            <StatRow label="Pole Position" val1={d1.poles}        val2={d2.poles}        color1={c1} color2={c2} />
            <StatRow label="Giri veloci"   val1={d1.fastest_laps} val2={d2.fastest_laps} color1={c1} color2={c2} />
            <StatRow label="DNF"           val1={d1.dnfs}         val2={d2.dnfs}         color1={c1} color2={c2} lowerBetter />
          </div>
        </motion.div>
      )}

      {!d1 && !d2 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30" />
          <p className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wide">
            Seleziona due piloti da confrontare
          </p>
        </div>
      )}
    </div>
  );
}
