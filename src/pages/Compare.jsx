import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTeamColor } from "@/lib/f1Utils";
import { getDriverStandings } from "@/lib/supabaseData";
import { motion } from "framer-motion";
import { Users, Loader2 } from "lucide-react";

function StatRow({ label, val1, val2, color1, color2, lowerBetter = false }) {
  const max    = Math.max(val1 || 0, val2 || 0, 1);
  const winner = lowerBetter
    ? (val1 < val2 ? 1 : val2 < val1 ? 2 : 0)
    : (val1 > val2 ? 1 : val2 > val1 ? 2 : 0);
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <p className="font-body text-[10px] text-muted-foreground text-center uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-center gap-3">
        <span className={`font-heading font-black text-base w-10 text-right
          ${winner === 1 ? "text-foreground" : "text-gray-300"}`}>{val1 ?? "–"}</span>
        <div className="flex-1 flex gap-0.5 h-2">
          <div className="flex-1 flex justify-end">
            <motion.div initial={{ width: 0 }}
              animate={{ width: `${((val1||0)/max)*100}%` }}
              transition={{ duration: 0.5 }}
              className="h-full rounded-l-full"
              style={{ backgroundColor: color1 }} />
          </div>
          <div className="flex-1">
            <motion.div initial={{ width: 0 }}
              animate={{ width: `${((val2||0)/max)*100}%` }}
              transition={{ duration: 0.5 }}
              className="h-full rounded-r-full"
              style={{ backgroundColor: color2 }} />
          </div>
        </div>
        <span className={`font-heading font-black text-base w-10
          ${winner === 2 ? "text-foreground" : "text-gray-300"}`}>{val2 ?? "–"}</span>
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
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const d1 = drivers.find(d => d.id === id1);
  const d2 = drivers.find(d => d.id === id2);
  const c1 = d1 ? getTeamColor(d1.team) : "#ccc";
  const c2 = d2 ? getTeamColor(d2.team) : "#ccc";

  return (
    <div className="space-y-4 px-4 pt-14 pb-4">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-primary max-w-[430px] mx-auto" />
      <div className="flex items-center gap-2 pt-2">
        <Users className="w-5 h-5 text-primary" strokeWidth={2} />
        <h1 className="font-heading font-black text-2xl uppercase tracking-wide">Confronta</h1>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: id1, setId: setId1, other: id2, label: "Pilota 1", color: c1, d: d1 },
          { id: id2, setId: setId2, other: id1, label: "Pilota 2", color: c2, d: d2 },
        ].map(({ id, setId, other, label, color, d }) => (
          <div key={label} className="app-card p-3 relative overflow-hidden">
            {d && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: color }} />}
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
            <Select value={id || ""} onValueChange={setId}>
              <SelectTrigger className="w-full text-xs font-heading font-bold h-8 px-2 border-gray-200 rounded-lg">
                <SelectValue placeholder="Seleziona..." />
              </SelectTrigger>
              <SelectContent>
                {drivers.filter(x => x.id !== other).map(x => (
                  <SelectItem key={x.id} value={x.id}>
                    <span className="flex items-center gap-1.5 font-heading text-sm">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: getTeamColor(x.team) }} />
                      {x.driver_name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {d && <p className="font-body text-xs text-muted-foreground mt-2 truncate">{d.team}</p>}
          </div>
        ))}
      </div>

      {d1 && d2 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* VS header */}
          <div className="flex items-center">
            <div className="flex-1 flex items-center gap-2">
              <div className="w-3 h-8 rounded-sm" style={{ backgroundColor: c1 }} />
              <div>
                <p className="font-heading font-black text-base leading-tight">{d1.driver_name}</p>
                <p className="font-body text-[10px] text-muted-foreground">{d1.driver_code}</p>
              </div>
            </div>
            <span className="tag bg-gray-100 text-gray-400 mx-3">VS</span>
            <div className="flex-1 flex items-center gap-2 justify-end text-right">
              <div>
                <p className="font-heading font-black text-base leading-tight">{d2.driver_name}</p>
                <p className="font-body text-[10px] text-muted-foreground">{d2.driver_code}</p>
              </div>
              <div className="w-3 h-8 rounded-sm" style={{ backgroundColor: c2 }} />
            </div>
          </div>

          <div className="app-card p-4">
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
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Users className="w-10 h-10 text-gray-200" />
          <p className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wide">
            Seleziona due piloti
          </p>
        </div>
      )}
    </div>
  );
}
