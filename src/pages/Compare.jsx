import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTeamColor } from "@/lib/f1Utils";
import { motion } from "framer-motion";
import { Users, Loader2 } from "lucide-react";

function StatCompare({ label, val1, val2, color1, color2 }) {
  const max = Math.max(val1 || 0, val2 || 0, 1);
  const w1 = ((val1 || 0) / max) * 100;
  const w2 = ((val2 || 0) / max) * 100;
  const winner = val1 > val2 ? 1 : val2 > val1 ? 2 : 0;

  return (
    <div className="py-3 border-b border-border/50 last:border-0">
      <p className="text-xs text-muted-foreground text-center mb-2 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-3">
        <span className={`font-mono text-sm font-bold w-12 text-right ${winner === 1 ? "text-foreground" : "text-muted-foreground"}`}>
          {val1 ?? "-"}
        </span>
        <div className="flex-1 flex gap-1 h-3">
          <div className="flex-1 flex justify-end">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${w1}%` }}
              transition={{ duration: 0.6 }}
              className="h-full rounded-l-full"
              style={{ backgroundColor: color1 }}
            />
          </div>
          <div className="flex-1">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${w2}%` }}
              transition={{ duration: 0.6 }}
              className="h-full rounded-r-full"
              style={{ backgroundColor: color2 }}
            />
          </div>
        </div>
        <span className={`font-mono text-sm font-bold w-12 ${winner === 2 ? "text-foreground" : "text-muted-foreground"}`}>
          {val2 ?? "-"}
        </span>
      </div>
    </div>
  );
}

export default function Compare() {
  const [driver1Id, setDriver1Id] = useState(null);
  const [driver2Id, setDriver2Id] = useState(null);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["driverStandings", 2025],
    queryFn: () => base44.entities.DriverStanding.filter({ season: 2025 }, "position", 100),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const d1 = drivers.find(d => d.id === driver1Id);
  const d2 = drivers.find(d => d.id === driver2Id);
  const c1 = d1 ? getTeamColor(d1.team) : "#888";
  const c2 = d2 ? getTeamColor(d2.team) : "#888";

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="font-heading font-black text-2xl tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Driver Comparison
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Confronta due piloti testa a testa</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card border border-border p-4">
          <label className="text-xs text-muted-foreground mb-1.5 block">Pilota 1</label>
          <Select value={driver1Id || ""} onValueChange={setDriver1Id}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona..." />
            </SelectTrigger>
            <SelectContent>
              {drivers.filter(d => d.id !== driver2Id).map(d => (
                <SelectItem key={d.id} value={d.id}>{d.driver_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {d1 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c1 }} />
              <span className="text-sm font-semibold">{d1.team}</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-card border border-border p-4">
          <label className="text-xs text-muted-foreground mb-1.5 block">Pilota 2</label>
          <Select value={driver2Id || ""} onValueChange={setDriver2Id}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona..." />
            </SelectTrigger>
            <SelectContent>
              {drivers.filter(d => d.id !== driver1Id).map(d => (
                <SelectItem key={d.id} value={d.id}>{d.driver_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {d2 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c2 }} />
              <span className="text-sm font-semibold">{d2.team}</span>
            </div>
          )}
        </div>
      </div>

      {d1 && d2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          {/* Driver headers */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-6 rounded-sm" style={{ backgroundColor: c1 }} />
              <div>
                <p className="font-heading font-bold text-sm">{d1.driver_name}</p>
                <p className="text-[10px] text-muted-foreground">{d1.driver_code}</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground font-heading font-semibold">VS</span>
            <div className="flex items-center gap-2 text-right">
              <div>
                <p className="font-heading font-bold text-sm">{d2.driver_name}</p>
                <p className="text-[10px] text-muted-foreground">{d2.driver_code}</p>
              </div>
              <div className="w-2 h-6 rounded-sm" style={{ backgroundColor: c2 }} />
            </div>
          </div>

          {/* Stats */}
          <StatCompare label="Punti" val1={d1.points} val2={d2.points} color1={c1} color2={c2} />
          <StatCompare label="Posizione" val1={d1.position} val2={d2.position} color1={c1} color2={c2} />
          <StatCompare label="Vittorie" val1={d1.wins} val2={d2.wins} color1={c1} color2={c2} />
          <StatCompare label="Podi" val1={d1.podiums} val2={d2.podiums} color1={c1} color2={c2} />
          <StatCompare label="Pole Position" val1={d1.poles} val2={d2.poles} color1={c1} color2={c2} />
          <StatCompare label="Giri Veloci" val1={d1.fastest_laps} val2={d2.fastest_laps} color1={c1} color2={c2} />
          <StatCompare label="DNF" val1={d1.dnfs} val2={d2.dnfs} color1={c1} color2={c2} />
        </motion.div>
      )}
    </div>
  );
}
