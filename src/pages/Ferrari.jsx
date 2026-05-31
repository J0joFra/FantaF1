import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";

function StatBox({ label, value, sub }) {
  return (
    <div className="bg-secondary/50 rounded-xl p-3 text-center">
      <span className="text-xl font-mono font-bold">{value}</span>
      <p className="text-[10px] text-muted-foreground mt-0.5 uppercase">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function Ferrari() {
  const { data: ferrariSeasons = [], isLoading } = useQuery({
    queryKey: ["ferrariSeasons"],
    queryFn: () => base44.entities.FerrariSeason.list("-season", 20),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["driverStandings", 2025],
    queryFn: () => base44.entities.DriverStanding.filter({ season: 2025 }, "position", 100),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teamStandings", 2025],
    queryFn: () => base44.entities.TeamStanding.filter({ season: 2025 }, "position", 100),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const sorted = [...ferrariSeasons].sort((a, b) => a.season - b.season);
  const current = sorted[sorted.length - 1];
  const ferrariDrivers = drivers.filter(d => d.team?.toLowerCase().includes("ferrari"));
  const ferrariTeam = teams.find(t => t.team_name?.toLowerCase().includes("ferrari"));

  const chartData = sorted.map(s => ({
    year: s.season,
    punti: s.points,
    posizione: s.position,
    vittorie: s.wins || 0,
  }));

  const bestSeason = sorted.reduce((best, s) => (!best || s.points > best.points) ? s : best, null);

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="font-heading font-black text-2xl tracking-tight flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E8002D" }}>
            <Trophy className="w-4 h-4 text-white" />
          </div>
          Ferrari Watch
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Performance e trend della Scuderia Ferrari</p>
      </div>

      {/* Current season overview */}
      {ferrariTeam && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-[#E8002D]/20 bg-gradient-to-br from-[#E8002D]/5 to-card p-5"
        >
          <h2 className="font-heading font-bold text-lg mb-3">Stagione 2025</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatBox label="Posizione" value={`P${ferrariTeam.position}`} />
            <StatBox label="Punti" value={ferrariTeam.points} />
            <StatBox label="Vittorie" value={ferrariTeam.wins || 0} />
            <StatBox label="Podi" value={ferrariTeam.podiums || 0} />
          </div>
          {ferrariDrivers.length > 0 && (
            <div className="space-y-2">
              {ferrariDrivers.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
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

      {/* Points trend chart */}
      {chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Trend Punti per Stagione
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ferrariGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E8002D" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E8002D" stopOpacity={0} />
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
                    fontSize: "12px"
                  }}
                />
                <Area type="monotone" dataKey="punti" stroke="#E8002D" fill="url(#ferrariGrad)" strokeWidth={2} />
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
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <h2 className="font-heading font-bold text-lg mb-4">Vittorie per Stagione</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 14%, 9%)",
                    border: "1px solid hsl(220, 14%, 16%)",
                    borderRadius: "8px",
 
