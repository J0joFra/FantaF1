import { useQuery } from "@tanstack/react-query";
import {
  getDriverStandings, getConstructorStandings,
  getSeasonConfig, getFerrariSeasonSummary,
} from "@/lib/supabaseData";
import { getTeamColor, calculateMaxAvailablePoints, MAX_POINTS_RACE, MAX_POINTS_SPRINT } from "@/lib/f1Utils";
import GpCountdown from "@/components/GpCountdown";
import ConstructorsStanding from "@/components/home/ConstructorsStanding";
import FerrariWatch from "@/components/home/FerrariWatch";
import { Loader2, AlertCircle, ChevronRight, Info } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// ── Arc gauge SVG ─────────────────────────────────────────────────────────────
function ArcGauge({ current, needed, possible }) {
  const R = 72, cx = 90, cy = 88;
  const startAngle = -200, endAngle = 20; // degrees
  const toRad = d => (d * Math.PI) / 180;
  const arc = (pct, r) => {
    const a = toRad(startAngle + (endAngle - startAngle) * Math.min(pct, 1));
    return `M ${cx + r * Math.cos(toRad(startAngle))} ${cy + r * Math.sin(toRad(startAngle))}
            A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1
            ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  };
  const pct = possible > 0 ? Math.min(current / possible, 1) : 0;
  const neededPct = possible > 0 ? Math.min(needed / possible, 1) : 0;

  return (
    <svg viewBox="0 0 180 110" className="w-full max-w-[180px]">
      {/* Track */}
      <path d={arc(1, R)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10"
            strokeLinecap="round" />
      {/* Progress to needed */}
      <path d={arc(neededPct, R)} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="10"
            strokeLinecap="round" />
      {/* Current */}
      <path d={arc(pct, R)} fill="none" stroke="#E8002D" strokeWidth="10"
            strokeLinecap="round" />
      {/* Dot at current */}
      {pct > 0 && (() => {
        const a = toRad(startAngle + (endAngle - startAngle) * pct);
        return <circle cx={cx + R * Math.cos(a)} cy={cy + R * Math.sin(a)}
                       r="6" fill="white" />;
      })()}
      {/* Labels */}
      <text x="18" y="102" textAnchor="middle" fill="rgba(255,255,255,0.5)"
            fontSize="9" fontFamily="JetBrains Mono, monospace">{current}</text>
      <text x="18" y="112" textAnchor="middle" fill="rgba(255,255,255,0.35)"
            fontSize="7" fontFamily="DM Sans, sans-serif">ATTUALI</text>
      <text x="90" y="72" textAnchor="middle" fill="white"
            fontSize="20" fontWeight="700" fontFamily="JetBrains Mono, monospace">{needed}</text>
      <text x="90" y="84" textAnchor="middle" fill="rgba(255,255,255,0.5)"
            fontSize="8" fontFamily="DM Sans, sans-serif">PUNTI</text>
      <text x="162" y="102" textAnchor="middle" fill="rgba(255,255,255,0.5)"
            fontSize="9" fontFamily="JetBrains Mono, monospace">{possible}</text>
      <text x="162" y="112" textAnchor="middle" fill="rgba(255,255,255,0.35)"
            fontSize="7" fontFamily="DM Sans, sans-serif">POSSIBILI</text>
    </svg>
  );
}

// ── Driver row (from mockup style) ────────────────────────────────────────────
function DriverRow({ driver, leader, index, maxAvailable }) {
  const isLeader = index === 0;
  const color    = getTeamColor(driver.team);
  const gap      = leader.points - driver.points;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-center gap-4 py-3.5
        ${index > 0 ? "border-t border-gray-100" : ""}
        ${isLeader ? "accent-bar" : ""}`}
    >
      {/* Position number */}
      <span className={`w-6 text-center font-heading font-black text-lg shrink-0
        ${isLeader ? "text-primary" : "text-gray-300"}`}>
        {driver.position}
      </span>

      {/* Avatar placeholder — circular with team color */}
      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center
                      font-heading font-black text-sm text-white"
           style={{ background: `linear-gradient(135deg, ${color}cc, ${color})` }}>
        {driver.driver_code?.slice(0,3) || driver.driver_name.slice(0,2).toUpperCase()}
      </div>

      {/* Name + team */}
      <div className="flex-1 min-w-0">
        <p className="font-heading font-black text-base leading-tight truncate">
          {driver.driver_name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <p className="text-xs text-muted-foreground font-body truncate">{driver.team}</p>
        </div>
      </div>

      {/* Points */}
      <div className="text-right shrink-0">
        <span className="font-heading font-black text-xl leading-none">{driver.points}</span>
        <p className="text-[10px] text-muted-foreground font-body mt-0.5">
          {isLeader ? "PTI" : `−${gap}`}
        </p>
      </div>
    </motion.div>
  );
}

// ── Calendar strip ─────────────────────────────────────────────────────────────
const GP_FLAGS = {
  australia: "🇦🇺", bahrain: "🇧🇭", saudi: "🇸🇦", japan: "🇯🇵", china: "🇨🇳",
  miami: "🇺🇸", imola: "🇮🇹", monaco: "🇲🇨", canada: "🇨🇦", spain: "🇪🇸",
  austria: "🇦🇹", britain: "🇬🇧", hungary: "🇭🇺", belgium: "🇧🇪", netherlands: "🇳🇱",
  italy: "🇮🇹", monza: "🇮🇹", singapore: "🇸🇬", usa: "🇺🇸", mexico: "🇲🇽",
  brazil: "🇧🇷", "las vegas": "🇺🇸", qatar: "🇶🇦", "abu dhabi": "🇦🇪",
  default: "🏁",
};
function gpFlag(name = "") {
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(GP_FLAGS)) if (n.includes(k)) return v;
  return GP_FLAGS.default;
}

function CalendarStrip({ config }) {
  if (!config?.next_race_name) return null;
  // Show a few upcoming slots (we only have next_race from DB, fill rest as placeholders)
  const races = [
    { name: config.next_race_name, date: config.next_race_date, sprint: config.next_race_has_sprint, current: true },
  ];
  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <h2 className="font-heading font-black text-base uppercase tracking-wide">
          Calendario
        </h2>
        <span className="text-xs text-muted-foreground font-body">
          {config.races_completed}/{config.total_races} GP
        </span>
      </div>
      <div className="flex gap-3 px-4 py-3 overflow-x-auto scroll-snap-x">
        {races.map((r, i) => (
          <div key={i}
            className={`snap-start shrink-0 rounded-xl border p-3 min-w-[100px]
              ${r.current ? "border-primary/30 bg-primary/4" : "border-gray-100 bg-gray-50"}`}>
            <div className="text-xl mb-1">{gpFlag(r.name)}</div>
            <p className="font-heading font-black text-xs leading-tight">{r.name.replace("Gran Premio", "GP")}</p>
            {r.date && (
              <p className="text-[10px] text-muted-foreground font-body mt-1">
                {format(new Date(r.date), "d MMM", { locale: it })}
              </p>
            )}
            <div className={`mt-2 tag inline-block
              ${r.sprint ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
              {r.sprint ? "34 pti" : `${MAX_POINTS_RACE} pti`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main home page ─────────────────────────────────────────────────────────────
export default function Home() {
  const { data: drivers = [], isLoading: ld, error: err } = useQuery({
    queryKey: ["driverStandings"], queryFn: getDriverStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: teams = [], isLoading: lt } = useQuery({
    queryKey: ["constructorStandings"], queryFn: getConstructorStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: config, isLoading: lc } = useQuery({
    queryKey: ["seasonConfig"], queryFn: getSeasonConfig, staleTime: 10 * 60 * 1000,
  });
  const { data: ferrariSeasons = [] } = useQuery({
    queryKey: ["ferrariSeasons"], queryFn: getFerrariSeasonSummary, staleTime: 30 * 60 * 1000,
  });

  if (ld || lt || lc) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground font-body">Caricamento...</p>
    </div>
  );

  if (err) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-6 text-center">
      <AlertCircle className="w-10 h-10 text-destructive" />
      <p className="font-heading font-black text-xl uppercase">Errore connessione</p>
      <p className="text-sm text-muted-foreground font-body">{err.message}</p>
    </div>
  );

  const leader       = drivers[0];
  const maxAvailable = calculateMaxAvailablePoints(config);
  const leaderColor  = leader ? getTeamColor(leader.team) : "#E8002D";
  // Points leader needs to clinch vs P2
  const p2           = drivers[1];
  const neededForTitle = p2
    ? Math.max(0, p2.points + maxAvailable - (leader?.points ?? 0) + 1)
    : 0;
  const possible = (leader?.points ?? 0) + maxAvailable;

  return (
    <div className="space-y-0">
      {/* ── Hero header ── */}
      <div className="relative bg-white overflow-hidden px-5 pt-14 pb-6">
        {/* Red accent line at very top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-1 mb-1">
              <span className="font-heading font-black text-3xl text-primary leading-none">F1</span>
              <span className="font-heading font-black text-3xl text-foreground leading-none"> CHAMP</span>
            </div>
            <div className="font-heading font-black text-3xl text-foreground leading-none mb-2">POINTS</div>
            <p className="text-xs text-muted-foreground font-body leading-snug max-w-[180px]">
              Calcola i punti necessari per vincere il Campionato del Mondo di F1
            </p>
          </div>

          {/* Season badge */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5 border border-gray-200">
              <span className="text-sm">🗓</span>
              <span className="font-heading font-bold text-sm">
                Stagione {config?.season ?? new Date().getFullYear()}
              </span>
            </div>
            <Link to="/calculator"
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center
                         text-muted-foreground border border-gray-200">
              <Info className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Next race countdown */}
        {config?.next_race_name && (
          <div className="mt-4 flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3
                           border border-gray-100">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm">{gpFlag(config.next_race_name)}</span>
                <span className="font-heading font-black text-sm uppercase">
                  Prossimo GP: {config.next_race_name.replace("Gran Premio d", "").replace("Gran Premio ", "")}
                </span>
                {config.next_race_has_sprint && (
                  <span className="tag bg-amber-100 text-amber-700">Sprint</span>
                )}
              </div>
              <GpCountdown targetDate={config.next_race_date} light />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 space-y-4 pt-4">
        {/* ── Driver standings card ── */}
        <div className="app-card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
            <h2 className="font-heading font-black text-base uppercase tracking-wide">
              Classifica Piloti
            </h2>
            <Link to="/calculator"
              className="flex items-center gap-1 text-xs text-primary font-body font-semibold">
              Vedi tutto <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="px-4">
            {drivers.slice(0, 5).map((d, i) => (
              <DriverRow key={d.id} driver={d} leader={leader}
                         index={i} maxAvailable={maxAvailable} />
            ))}
          </div>
        </div>

        {/* ── Scenario / stats card ── */}
        {config && (
          <div className="app-card px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-black text-base uppercase tracking-wide">
                Scenario Attuale
              </h2>
              <Link to="/calculator"
                className="flex items-center gap-1 border border-primary/30 rounded-full px-3 py-1
                           text-xs text-primary font-body font-semibold">
                ✏ Modifica
              </Link>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{gpFlag(config.next_race_name || "")}</span>
              <span className="font-heading font-bold text-sm">
                {config.next_race_name
                  ? `Prossimo GP: ${config.next_race_name.replace("Gran Premio d", "").replace("Gran Premio ","")}`
                  : "Stagione in corso"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "GARE\nRIMANENTI",   value: (config.total_races||0) - (config.races_completed||0) },
                { label: "PUNTI MASSIMI\nDISPONIBILI", value: maxAvailable },
                { label: "MAX CON\nSPRINT",    value: config.next_race_has_sprint ? MAX_POINTS_RACE + MAX_POINTS_SPRINT : MAX_POINTS_RACE },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="font-heading font-black text-3xl leading-none">{value}</p>
                  <p className="text-[9px] text-muted-foreground font-body uppercase tracking-widest mt-1 whitespace-pre-line leading-tight">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Dark "Punti necessari" card ── */}
        {leader && p2 && (
          <div className="dark-card px-5 py-5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="font-heading font-black text-base uppercase tracking-wide text-white/80 mb-1">
                  Punti necessari per vincere
                </h2>
                <p className="text-white/70 text-sm font-body leading-snug">
                  {leader.driver_name} può vincere il campionato con
                </p>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="font-heading font-black text-5xl leading-none text-primary">
                    {neededForTitle}
                  </span>
                  <span className="font-heading font-black text-xl text-primary/80">PTI</span>
                </div>
                <p className="text-white/40 text-xs font-body mt-1">
                  vs {p2.driver_name} ({p2.points} pts)
                </p>
              </div>
              <div className="-mt-2">
                <ArcGauge current={leader.points} needed={neededForTitle} possible={possible} />
              </div>
            </div>
          </div>
        )}

        {/* ── Calendar strip ── */}
        <CalendarStrip config={config} />

        {/* ── Constructors ── */}
        <ConstructorsStanding teams={teams} />

        {/* ── Ferrari ── */}
        <FerrariWatch teamStandings={teams} ferrariSeasons={ferrariSeasons} drivers={drivers} />
      </div>
    </div>
  );
}
