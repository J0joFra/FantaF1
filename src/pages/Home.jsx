import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getDriverStandings,
  getSeasonConfig,
  getUpcomingRaces,
} from "@/lib/supabaseData";
import {
  getTeamColor,
  calculateMaxAvailablePoints,
  MAX_POINTS_RACE,
  MAX_POINTS_SPRINT,
} from "@/lib/f1Utils";
import GpCountdown from "@/components/GpCountdown";
import { Loader2, AlertCircle, ChevronDown, ChevronUp, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// ── Flag map ──────────────────────────────────────────────────────────────────
const GP_FLAGS = {
  australia: "🇦🇺", bahrain: "🇧🇭", saudi: "🇸🇦", jeddah: "🇸🇦",
  japan: "🇯🇵", china: "🇨🇳", miami: "🇺🇸", imola: "🇮🇹",
  monaco: "🇲🇨", canada: "🇨🇦", spain: "🇪🇸", austria: "🇦🇹",
  britain: "🇬🇧", silverstone: "🇬🇧", hungary: "🇭🇺", belgium: "🇧🇪",
  netherlands: "🇳🇱", zandvoort: "🇳🇱", italy: "🇮🇹", monza: "🇮🇹",
  singapore: "🇸🇬", usa: "🇺🇸", "united states": "🇺🇸", mexico: "🇲🇽",
  brazil: "🇧🇷", "las vegas": "🇺🇸", qatar: "🇶🇦", "abu dhabi": "🇦🇪",
};
function gpFlag(name = "") {
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(GP_FLAGS)) if (n.includes(k)) return v;
  return "🏁";
}

// ── Arc gauge ─────────────────────────────────────────────────────────────────
function ArcGauge({ current, needed, possible }) {
  const R = 72, cx = 90, cy = 90;
  const toRad = d => (d * Math.PI) / 180;
  const startA = -210, endA = 30;
  const arc = pct => {
    const a = toRad(startA + (endA - startA) * Math.min(Math.max(pct, 0.001), 1));
    const large = (endA - startA) * pct > 180 ? 1 : 0;
    return `M ${cx + R * Math.cos(toRad(startA))} ${cy + R * Math.sin(toRad(startA))}
            A ${R} ${R} 0 ${large} 1
            ${cx + R * Math.cos(a)} ${cy + R * Math.sin(a)}`;
  };
  const currPct   = possible > 0 ? current / possible : 0;
  const neededPct = possible > 0 ? Math.min((current + needed) / possible, 1) : 0;
  const dotA      = toRad(startA + (endA - startA) * Math.min(currPct, 1));

  return (
    <svg viewBox="0 0 180 118" className="w-full max-w-[190px]">
      <path d={arc(1)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" strokeLinecap="round" />
      <path d={arc(neededPct)} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="9" strokeLinecap="round" />
      <path d={arc(currPct)} fill="none" stroke="#E8002D" strokeWidth="9" strokeLinecap="round" />
      {currPct > 0.02 && (
        <circle cx={cx + R * Math.cos(dotA)} cy={cy + R * Math.sin(dotA)} r="5.5" fill="white" />
      )}
      <text x="16" y="104" textAnchor="middle" fill="rgba(255,255,255,0.45)"
            fontSize="10" fontWeight="700" fontFamily="'JetBrains Mono',monospace">{current}</text>
      <text x="16" y="114" textAnchor="middle" fill="rgba(255,255,255,0.3)"
            fontSize="7" fontFamily="'DM Sans',sans-serif">ATTUALI</text>
      <text x="90" y="76" textAnchor="middle" fill="white"
            fontSize="22" fontWeight="700" fontFamily="'JetBrains Mono',monospace">{needed}</text>
      <text x="90" y="88" textAnchor="middle" fill="rgba(255,255,255,0.45)"
            fontSize="8" fontFamily="'DM Sans',sans-serif">PUNTI</text>
      <text x="164" y="104" textAnchor="middle" fill="rgba(255,255,255,0.45)"
            fontSize="10" fontWeight="700" fontFamily="'JetBrains Mono',monospace">{possible}</text>
      <text x="164" y="114" textAnchor="middle" fill="rgba(255,255,255,0.3)"
            fontSize="7" fontFamily="'DM Sans',sans-serif">POSSIBILI</text>
    </svg>
  );
}

// ── Driver row ────────────────────────────────────────────────────────────────
function DriverRow({ driver, leader, index }) {
  const isLeader = index === 0;
  const color    = getTeamColor(driver.team);
  const gap      = leader.points - driver.points;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-center gap-4 py-3.5
        ${index > 0 ? "border-t border-gray-100" : ""}
        ${isLeader ? "accent-bar" : ""}`}
    >
      <span className={`w-6 text-center font-heading font-black text-lg shrink-0
        ${isLeader ? "text-primary" : "text-gray-300"}`}>
        {driver.position}
      </span>

      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center
                      font-heading font-black text-sm text-white select-none"
           style={{ background: `linear-gradient(135deg, ${color}99, ${color})` }}>
        {(driver.driver_code || driver.driver_name).slice(0, 3).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-heading font-black text-base leading-tight truncate">
          {driver.driver_name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <p className="text-xs text-muted-foreground font-body truncate">{driver.team}</p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <span className="font-heading font-black text-xl leading-none">{driver.points}</span>
        <p className="text-[10px] text-muted-foreground font-body mt-0.5">
          {isLeader ? "PTI" : `−${gap}`}
        </p>
      </div>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [showAllDrivers, setShowAllDrivers] = useState(false);

  const { data: drivers = [], isLoading: ld, error: err } = useQuery({
    queryKey: ["driverStandings"], queryFn: getDriverStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: config, isLoading: lc } = useQuery({
    queryKey: ["seasonConfig"], queryFn: getSeasonConfig, staleTime: 10 * 60 * 1000,
  });
  const { data: upcomingRaces = [], isLoading: lr } = useQuery({
    queryKey: ["upcomingRaces"], queryFn: () => getUpcomingRaces(5), staleTime: 60 * 60 * 1000,
  });

  if (ld || lc) return (
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
  const p2           = drivers[1];
  const maxAvailable = calculateMaxAvailablePoints(config);
  const neededForTitle = p2
    ? Math.max(0, p2.points + maxAvailable - (leader?.points ?? 0) + 1)
    : 0;
  const possible = (leader?.points ?? 0) + maxAvailable;

  const visibleDrivers = showAllDrivers ? drivers : drivers.slice(0, 5);

  return (
    <div className="space-y-0 pb-4">

      {/* ── HERO ── */}
      <div className="relative bg-white px-5 pt-12 pb-5">
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />

        {/* Title row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-heading font-black leading-none">
              <span className="text-3xl text-primary">F1</span>
              <span className="text-3xl text-foreground"> CHAMP</span>
            </div>
            <div className="font-heading font-black text-3xl text-foreground leading-none">POINTS</div>
            <p className="text-[11px] text-muted-foreground font-body mt-1.5 leading-snug max-w-[180px]">
              Calcola i punti necessari per vincere il Campionato del Mondo di F1
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5 border border-gray-200">
              <span className="text-sm">🗓</span>
              <span className="font-heading font-bold text-sm">
                {config?.season ?? new Date().getFullYear()}
              </span>
            </div>
            <Link to="/calculator"
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center
                         text-muted-foreground border border-gray-200">
              <Info className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* ── Next race: flag + countdown only ── */}
        {config?.next_race_name && (
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            {/* Flag — large */}
            <span className="text-3xl leading-none shrink-0">
              {gpFlag(config.next_race_name)}
            </span>
            {/* Countdown in red */}
            <GpCountdown targetDate={config.next_race_date} light compact />
            {config.next_race_has_sprint && (
              <span className="tag bg-amber-100 text-amber-700 shrink-0 ml-auto">Sprint</span>
            )}
          </div>
        )}
      </div>

      <div className="px-4 space-y-4 pt-4">

        {/* ── CLASSIFICA PILOTI ── */}
        <div className="app-card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
            <h2 className="font-heading font-black text-base uppercase tracking-wide">
              Classifica Piloti
            </h2>
            <span className="text-xs text-muted-foreground font-body">
              {config?.races_completed ?? 0}/{config?.total_races ?? 0} GP
            </span>
          </div>

          <div className="px-4">
            <AnimatePresence initial={false}>
              {visibleDrivers.map((d, i) => (
                <DriverRow key={d.id} driver={d} leader={leader} index={i} />
              ))}
            </AnimatePresence>
          </div>

          {/* Expand / collapse toggle */}
          {drivers.length > 5 && (
            <button
              onClick={() => setShowAllDrivers(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-gray-100
                         text-xs font-body font-semibold text-primary hover:bg-gray-50 transition-colors"
            >
              {showAllDrivers ? (
                <><ChevronUp className="w-3.5 h-3.5" /> Mostra meno</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5" /> Vedi tutti ({drivers.length})</>
              )}
            </button>
          )}
        </div>

        {/* ── SCENARIO ATTUALE ── */}
        {config && (
          <div className="app-card px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-black text-base uppercase tracking-wide">
                Scenario Attuale
              </h2>
              <Link to="/calculator"
                className="flex items-center gap-1 border border-primary/30 rounded-full
                           px-3 py-1 text-xs text-primary font-body font-semibold">
                ✏ Modifica
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { v: (config.total_races||0) - (config.races_completed||0), l: "GARE\nRIMANENTI" },
                { v: maxAvailable, l: "PUNTI MAX\nDISPONIBILI" },
                { v: config.next_race_has_sprint
                    ? MAX_POINTS_RACE + MAX_POINTS_SPRINT
                    : MAX_POINTS_RACE,              l: "MAX\nPROSSIMO GP" },
              ].map(({ v, l }) => (
                <div key={l}>
                  <p className="font-heading font-black text-3xl leading-none">{v}</p>
                  <p className="text-[9px] text-muted-foreground font-body uppercase
                                tracking-widest mt-1 whitespace-pre-line leading-tight">{l}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PUNTI NECESSARI (dark card + arc gauge) ── */}
        {leader && p2 && (
          <div className="dark-card px-5 py-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-2">
                <h2 className="font-heading font-black text-sm uppercase tracking-wide
                               text-white/60 mb-2">
                  Punti necessari per vincere
                </h2>
                <p className="text-white/70 text-sm font-body leading-snug">
                  {leader.driver_name} può vincere il campionato con
                </p>
                <div className="flex items-baseline gap-1.5 mt-2 mb-1">
                  <span className="font-heading font-black text-5xl leading-none text-primary">
                    {neededForTitle}
                  </span>
                  <span className="font-heading font-black text-xl text-primary/70">PTI</span>
                </div>
                <p className="text-white/35 text-xs font-body">
                  vs {p2.driver_name} ({p2.points} pts)
                </p>
              </div>
              <ArcGauge current={leader.points} needed={neededForTitle} possible={possible} />
            </div>
          </div>
        )}

        {/* ── CALENDARIO (next 5, flag + date only) ── */}
        {(upcomingRaces.length > 0 || config?.next_race_name) && (
          <div className="app-card overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
              <h2 className="font-heading font-black text-base uppercase tracking-wide">
                Prossimi GP
              </h2>
              <span className="text-xs text-muted-foreground font-body">
                {config?.races_completed ?? 0}/{config?.total_races ?? 0}
              </span>
            </div>

            <div className="flex gap-2 px-4 py-3 overflow-x-auto scroll-snap-x"
                 style={{ scrollbarWidth: "none" }}>
              {/* Use DB races if available, else fallback to config single race */}
              {(upcomingRaces.length > 0
                ? upcomingRaces
                : [{
                    name: config.next_race_name,
                    date: config.next_race_date,
                    has_sprint: config.next_race_has_sprint,
                  }]
              ).map((r, i) => (
                <div key={i}
                  className={`snap-start shrink-0 rounded-xl border p-3 min-w-[80px] text-center
                    ${i === 0
                      ? "border-primary/25 bg-primary/4"
                      : "border-gray-100 bg-gray-50"}`}
                >
                  {/* Flag — big */}
                  <div className="text-2xl mb-1.5">{gpFlag(r.name)}</div>
                  {/* Date only */}
                  {r.date && (
                    <p className={`font-heading font-bold text-xs
                      ${i === 0 ? "text-primary" : "text-foreground"}`}>
                      {format(new Date(r.date), "d MMM", { locale: it })}
                    </p>
                  )}
                  {/* Sprint tag */}
                  {r.has_sprint && (
                    <span className="tag bg-amber-100 text-amber-700 mt-1.5 inline-block">
                      Sprint
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
