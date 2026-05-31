import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, Loader2, Users, Flag } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import {
  getFerrariSeasonSummary, getFerrariArchiveStats,
  getFerrariDriverStats, getConstructorStandings, getDriverStandings,
} from "@/lib/supabaseData";

const RED = "#E8002D";

function StatBox({ label, value }) {
  return (
    <div className="bg-card rounded-xl p-3 text-center">
      <span className="font-heading font-black text-2xl block leading-none">{value}</span>
      <p className="font-heading text-[10px] text-muted-foreground/70 uppercase tracking-widest mt-1">
        {label}
      </p>
    </div>
  );
}

const tooltipStyle = {
  background: "white",
  border: "1px solid hsl(20 8% 15%)",
  borderRadius: "10px",
  fontSize: "12px",
  fontFamily: "'JetBrains Mono', monospace",
};

export default function Ferrari() {
  const { data: ferrariSeasons = [], isLoading } = useQuery({
    queryKey: ["ferrariSeasons"], queryFn: getFerrariSeasonSummary, staleTime: 30 * 60 * 1000,
  });
  const { data: archiveStats } = useQuery({
    queryKey: ["ferrariArchiveStats"], queryFn: getFerrariArchiveStats, staleTime: 60 * 60 * 1000,
  });
  const { data: topDrivers = [] } = useQuery({
    queryKey: ["ferrariDriverStats"], queryFn: getFerrariDriverStats, staleTime: 60 * 60 * 1000,
  });
  const { data: teams   = [] } = useQuery({
    queryKey: ["constructorStandings"], queryFn: getConstructorStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["driverStandings"], queryFn: getDriverStandings, staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: RED }} />
    </div>
  );

  const ferrariTeam    = teams.find(t   => t.team_name?.toLowerCase().includes("ferrari"));
  const ferrariDrivers = drivers.filter(d => d.team?.toLowerCase().includes("ferrari"));
  const chartData      = [...ferrariSeasons].sort((a, b) => a.season - b.season).map(s => ({
    year: String(s.season), punti: s.points, vittorie: s.wins || 0,
  }));

  return (
    <div className="space-y-4 px-4 pt-14 pb-4 relative">
      <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
      <div className="flex items-center gap-2 pt-1">
        <div className="w-6 h-6 rounded flex items-center justify-center"
             style={{ backgroundColor: RED }}>
          <Trophy className="w-3.5 h-3.5 text-white" />
        </div>
        <h1 className="font-heading font-black text-2xl uppercase tracking-wide">Ferrari</h1>
      </div>

      {/* Current season card */}
      {ferrariTeam && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden border"
          style={{ borderColor: `${RED}40` }}>
          <div className="px-4 py-3 flex items-center justify-between"
               style={{ background: `linear-gradient(90deg, ${RED}20, transparent)` }}>
            <h2 className="font-heading font-black text-lg uppercase">
              Stagione {new Date().getFullYear()}
            </h2>
            <span className="font-heading font-black text-2xl" style={{ color: RED }}>
              P{ferrariTeam.position}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-px bg-border/40 mx-4 mb-4 rounded-xl overflow-hidden">
            {[
              { v: ferrariTeam.points,        l: "PTS"      },
              { v: ferrariTeam.wins    || 0,  l: "VITTORIE" },
              { v: ferrariTeam.podiums || 0,  l: "PODI"     },
            ].map(({ v, l }) => (
              <div key={l} className="bg-background/80 py-3 text-center">
                <span className="font-heading font-black text-2xl">{v}</span>
                <p className="font-heading text-[10px] text-muted-foreground tracking-widest mt-0.5">{l}</p>
              </div>
            ))}
          </div>

          {ferrariDrivers.map(d => (
            <div key={d.id}
              className="mx-4 mb-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
              <div>
                <p className="font-heading font-bold text-sm">{d.driver_name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">P{d.position} mondiale</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-sm">{d.points} pts</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {d.wins||0}V · {d.podiums||0}P · {d.poles||0}PP
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Archive stats */}
      {archiveStats && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="app-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flag className="w-4 h-4 text-primary" />
            <h2 className="font-heading font-black text-lg uppercase tracking-wide">Storia</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Titoli costruttori" value={archiveStats.constructors_titles ?? "–"} />
            <StatBox label="Titoli piloti"       value={archiveStats.drivers_titles       ?? "–"} />
            <StatBox label="Vittorie totali"     value={archiveStats.total_wins           ?? "–"} />
            <StatBox label="Stagioni in F1"      value={archiveStats.seasons              ?? "–"} />
          </div>
        </motion.div>
      )}

      {/* Points trend chart */}
      {chartData.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="app-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-heading font-black text-lg uppercase tracking-wide">Punti per stagione</h2>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={RED} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={RED} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 94%)" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(20 8% 40%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(20 8% 40%)" }} width={30} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="punti" stroke={RED}
                      fill="url(#fg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Wins bar chart */}
      {chartData.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="app-card p-4">
          <h2 className="font-heading font-black text-lg uppercase tracking-wide mb-4">Vittorie per stagione</h2>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 94%)" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(20 8% 40%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(20 8% 40%)" }} allowDecimals={false} width={20} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="vittorie" fill={RED} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Top Ferrari drivers */}
      {topDrivers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="app-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-heading font-black text-lg uppercase tracking-wide">Piloti storici</h2>
          </div>
          <div className="space-y-1.5">
            {topDrivers.slice(0, 10).map((d, i) => (
              <div key={i}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground/50 w-4">{i + 1}</span>
                  <span className="font-heading font-bold text-sm">
                    {d.driver_name || `${d.first_name||""} ${d.last_name||""}`.trim()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">{d.wins ?? 0} vitt.</span>
                  <span className="font-mono font-bold">{d.points ?? 0} pts</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {!ferrariTeam && !isLoading && (
        <div className="text-center py-12 text-muted-foreground font-heading text-sm uppercase tracking-wide">
          Nessun dato Ferrari disponibile
        </div>
      )}
    </div>
  );
}
