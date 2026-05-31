import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, Loader2, Users, Flag, Zap } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import {
  getFerrariSeasonSummary,
  getFerrariArchiveStats,
  getFerrariDriverStats,
  getConstructorStandings,
  getDriverStandings,
} from "@/lib/supabaseData";

function StatBox({ label, value, sub }) {
  return (
    <div className="bg-secondary/50 rounded-xl p-3 text-center">
      <span className="text-xl font-mono font-bold">{value}</span>
      <p className="text-[10px] text-muted-foreground mt-0.5 uppercase">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

const FERRARI_RED = "#E8002D";

export default function Ferrari() {
  const { data: ferrariSeasons = [], isLoading } = useQuery({
    queryKey: ["ferrariSeasons"],
    queryFn: getFerrariSeasonSummary,
    staleTime: 30 * 60 * 1000,
  });

  const { data: archiveStats } = useQuery({
    queryKey: ["ferrariArchiveStats"],
    queryFn: getFerrariArchiveStats,
    staleTime: 60 * 60 * 1000,
  });

  const { data: topDrivers = [] } = useQuery({
    queryKey: ["ferrariDriverStats"],
    queryFn: getFerrariDriverStats,
    staleTime: 60 * 60 * 1000,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["constructorStandings"],
    queryFn: getConstructorStandings,
    staleTime: 5 * 60 * 1000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["driverStandings"],
    queryFn: getDriverStandings,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const sorted = [...ferrariSeasons].sort((a, b) => a.season - b.season);
  const ferrariTeam = teams.find(t => t.team_name?.toLowerCase().includes("ferrari"));
  const ferrariDrivers = drivers.filter(d => d.team?.toLowerCase().includes("ferrari"));

  const chartData = sorted.map(s => ({
    year: s.season,
    punti: s.points,
    posizione: s.position,
    vittorie: s.wins || 0,
  }));

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="font-heading font-black text-2xl tracking-tight flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: FERRARI_RED }}
          >
            <Trophy className="w-4 h-4 text-white" />
          </div>
          Ferrari Watch
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Performance e trend della Scuderia Ferrari
        </p>
      </div>

      {/* Current season */}
      {ferrariTeam && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 p-5"
          style={{ borderColor: `${FERRARI_RED}33`, background: `${FERRARI_RED}08` }}
        >
          <h2 className="font-heading font-bold text-lg mb-3">
            Stagione {new Date().getFullYear()}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatBox label="Posizione" value={`P${ferrariTeam.position}`} />
            <StatBox label="Punti" value={ferrariTeam.points} />
            <StatBox label="Vittorie" value={ferrariTeam.wins || 0} />
            <StatBox label="Podi" value={ferrariTeam.podiums || 0} />
          </div>
          {ferrariDrivers.length > 0 && (
            <div className="space-y-2">
              {ferrariDrivers.map(d => (
                <div
                  key={d.id}
                  className="flex items-center justify-between bg-secondary/30 rounded-lg p-3"
                >
                  <div>
                    <p className="font-semibold text-sm">{d.driver_name}</p>
                    <p className="text-xs text-muted-foreground">P{d.position} nel mondiale</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold">{d.points} pts</p>
                    <p className="text-xs text-muted-foreground">
                      {d.wins || 0}V · {d.podiums || 0}P · {d.poles || 0}PP
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Archive totals */}
      {archiveStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Flag className="w-5 h-5 text-primary" />
            <h2 className="font-heading font-bold text-lg">Statistiche storiche</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Titoli costruttori", value: archiveStats.constructors_titles ?? archiveStats.constructor_championships ?? "–" },
              { label: "Titoli piloti", value: archiveStats.drivers_titles ?? archiveStats.driver_championships ?? "–" },
              { label: "Vittorie totali", value: archiveStats.total_wins ?? archiveStats.wins ?? "–" },
              { label: "Stagioni in F1", value: archiveStats.seasons ?? archiveStats.total_seasons ?? "–" },
            ].map((s, i) => (
              <StatBox key={i} label={s.label} value={s.value} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Points trend */}
      {chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Trend punti per stagione
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ferrariGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={FERRARI_RED} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={FERRARI_RED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 14%, 9%)",
                    border: "1px solid hsl(220, 14%, 16%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="punti"
                  stroke={FERRARI_RED}
                  fill="url(#ferrariGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Wins per season */}
      {chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <h2 className="font-heading font-bold text-lg mb-4">Vittorie per stagione</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 14%, 9%)",
                    border: "1px solid hsl(220, 14%, 16%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="vittorie" fill={FERRARI_RED} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Top Ferrari drivers */}
      {topDrivers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-heading font-bold text-lg">Piloti Ferrari (storia)</h2>
          </div>
          <div className="space-y-2">
            {topDrivers.slice(0, 10).map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono w-5">{i + 1}</span>
                  <span className="text-sm font-medium">
                    {d.driver_name || d.name || `${d.first_name || ""} ${d.last_name || ""}`.trim()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{d.wins ?? 0} vittorie</span>
                  <span className="font-mono font-bold text-foreground">{d.points ?? 0} pts</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {ferrariSeasons.length === 0 && !isLoading && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Nessun dato Ferrari disponibile.
        </div>
      )}
    </div>
  );
}
