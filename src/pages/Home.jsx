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
import { raceFlagUrl, gpIso, flagUrl } from "@/lib/flagUtils";
import GpCountdown from "@/components/GpCountdown";
import { Loader2, AlertCircle, ChevronDown, ChevronUp, Info, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import InfoTip from "@/components/InfoTip";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// ── Flag image component ──────────────────────────────────────────────────────
function FlagImg({ iso, size = "h40", className = "w-8 h-5 object-cover rounded-sm" }) {
  if (!iso) return <span className="text-xl">🏁</span>;
  return (
    <img
      src={flagUrl(iso, size)}
      alt={iso.toUpperCase()}
      className={className}
      onError={e => { e.target.style.display = "none"; }}
    />
  );
}

// ── Arc gauge — fixed layout, properly centered ───────────────────────────────
function ArcGauge({ current, needed, possible }) {
  const W = 200, H = 120;
  const cx = W / 2, cy = 106;
  const R = 80;
  const toRad = d => (d * Math.PI) / 180;
  const startA = -180, endA = 0; // clean semicircle

  const arc = (pct) => {
    const clamped = Math.min(Math.max(pct, 0.001), 0.9999);
    const a = toRad(startA + (endA - startA) * clamped);
    const x1 = cx + R * Math.cos(toRad(startA));
    const y1 = cy + R * Math.sin(toRad(startA));
    const x2 = cx + R * Math.cos(a);
    const y2 = cy + R * Math.sin(a);
    const large = (endA - startA) * clamped > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
  };

  const currPct   = possible > 0 ? Math.min(current / possible, 1) : 0;
  // "needed" here means the target the leader must reach — shown as where the arc ends
  const targetPct = possible > 0 ? Math.min((current + needed) / possible, 1) : 1;

  // Dot position at current
  const dotA = toRad(startA + (endA - startA) * Math.min(currPct, 0.9999));
  const dotX = cx + R * Math.cos(dotA);
  const dotY = cy + R * Math.sin(dotA);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Full track (grey) */}
      <path d={arc(1)} fill="none" stroke="rgba(255,255,255,0.12)"
            strokeWidth="10" strokeLinecap="round" />
      {/* Target arc (dim white — shows what's still needed) */}
      <path d={arc(targetPct)} fill="none" stroke="rgba(255,255,255,0.22)"
            strokeWidth="10" strokeLinecap="round" />
      {/* Current points (red) */}
      <path d={arc(currPct)} fill="none" stroke="#E8002D"
            strokeWidth="10" strokeLinecap="round" />
      {/* White dot at current */}
      {currPct > 0.02 && (
        <circle cx={dotX} cy={dotY} r="6" fill="white"
                style={{ filter: "drop-shadow(0 0 3px rgba(0,0,0,0.4))" }} />
      )}
      {/* Center label: needed points */}
      <text x={cx} y={cy - 22} textAnchor="middle" fill="white"
            fontSize="26" fontWeight="800"
            fontFamily="'JetBrains Mono',monospace">{needed}</text>
      <text x={cx} y={cy - 8} textAnchor="middle"
            fill="rgba(255,255,255,0.4)" fontSize="9"
            fontFamily="'DM Sans',sans-serif" letterSpacing="2">PUNTI</text>
      {/* Left label: current */}
      <text x="18" y={cy + 14} textAnchor="middle"
            fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="700"
            fontFamily="'JetBrains Mono',monospace">{current}</text>
      <text x="18" y={cy + 24} textAnchor="middle"
            fill="rgba(255,255,255,0.3)" fontSize="7"
            fontFamily="'DM Sans',sans-serif" letterSpacing="1.5">ATTUALI</text>
      {/* Right label: possible */}
      <text x={W - 18} y={cy + 14} textAnchor="middle"
            fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="700"
            fontFamily="'JetBrains Mono',monospace">{possible}</text>
      <text x={W - 18} y={cy + 24} textAnchor="middle"
            fill="rgba(255,255,255,0.3)" fontSize="7"
            fontFamily="'DM Sans',sans-serif" letterSpacing="1.5">POSSIBILI</text>
    </svg>
  );
}

// ── Driver row ────────────────────────────────────────────────────────────────
function DriverRow({ driver, leader, index }) {
  const isLeader = index === 0;
  const color    = getTeamColor(driver.team);
  const gap      = leader.points - driver.points;
  const barPct   = leader.points > 0 ? (driver.points / leader.points) * 100 : 0;

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
        <p className="text-xs text-muted-foreground font-body truncate mt-0.5">{driver.team}</p>
        {/* Points bar in team colour */}
        <div className="relative h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barPct}%` }}
            transition={{ duration: 0.7, delay: index * 0.04, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
          />
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
  const { t } = useI18n();
  const [showAllDrivers, setShowAllDrivers] = useState(false);

  const { data: drivers = [], isLoading: ld, error: err } = useQuery({
    queryKey: ["driverStandings"], queryFn: getDriverStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: config, isLoading: lc } = useQuery({
    queryKey: ["seasonConfig"], queryFn: getSeasonConfig, staleTime: 10 * 60 * 1000,
  });
  const { data: upcomingRaces = [] } = useQuery({
    queryKey: ["upcomingRaces"], queryFn: () => getUpcomingRaces(4), staleTime: 60 * 60 * 1000,
  });

  if (ld || lc) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gradient-to-b from-gray-100 to-gray-200">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground font-body">{t("loading")}</p>
    </div>
  );

  if (err) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-6 text-center bg-gradient-to-b from-gray-100 to-gray-200">
      <AlertCircle className="w-10 h-10 text-destructive" />
      <p className="font-heading font-black text-xl uppercase">Errore connessione</p>
      <p className="text-sm text-muted-foreground font-body">{err.message}</p>
    </div>
  );

  const leader         = drivers[0];
  const p2             = drivers[1];
  const maxAvailable   = calculateMaxAvailablePoints(config);
  const neededForTitle = p2
    ? Math.max(0, p2.points + maxAvailable - (leader?.points ?? 0) + 1)
    : 0;
  const possible       = (leader?.points ?? 0) + maxAvailable;
  const visibleDrivers = showAllDrivers ? drivers : drivers.slice(0, 5);

  // Next race flag iso
  const nextRaceIso = config?.next_race_name ? gpIso(config.next_race_name) : null;

  // Calendar races: use DB data (4 races), fallback to config single race
  const calRaces = upcomingRaces.length > 0
    ? upcomingRaces.slice(0, 4)
    : config?.next_race_name
      ? [{ name: config.next_race_name, date: config.next_race_date, has_sprint: config.next_race_has_sprint }]
      : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 pb-4">

      <PageHeader
        icon={Trophy}
        title={
          <div className="font-heading font-black text-lg leading-none truncate text-white">
            F1 CHAMP <span className="text-white/75">POINTS</span>
          </div>
        }
        right={
          <>
            <div className="flex items-center gap-1.5 bg-white/90 rounded-full px-2.5 py-1 border border-white/40 text-gray-800">
              <span className="text-xs">🗓</span>
              <span className="font-heading font-bold text-sm">
                {config?.season ?? new Date().getFullYear()}
              </span>
            </div>
            <a href="/privacy.html"
              aria-label="Privacy Policy"
              title="Privacy Policy"
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center
                         text-muted-foreground border border-gray-200 shrink-0">
              <Info className="w-4 h-4" />
            </a>
          </>
        }
      />

      <div className="px-4 py-5 space-y-4">

        {/* ── INTRO + PROSSIMA GARA ── */}
        <div className="app-card p-4">
          <p className="text-xs text-muted-foreground font-body leading-snug mb-3">
            {t("home_tagline")}
          </p>
          {config?.next_race_name && (
            <div className="flex items-center gap-4 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <FlagImg iso={nextRaceIso} size="h80"
                className="h-9 w-auto object-cover rounded-md shrink-0" />
              <GpCountdown targetDate={config.next_race_date} compact />
              {config.next_race_has_sprint && (
                <span className="tag bg-amber-100 text-amber-700 shrink-0 ml-auto">Sprint</span>
              )}
            </div>
          )}
        </div>

        {/* ── CLASSIFICA PILOTI ── */}
        <div className="app-card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
            <h2 className="font-heading font-black text-base uppercase tracking-wide">
              {t("home_standings")}
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
          {drivers.length > 5 && (
            <button
              onClick={() => setShowAllDrivers(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-gray-100
                         text-xs font-body font-semibold text-primary hover:bg-gray-50 transition-colors"
            >
              {showAllDrivers
                ? <><ChevronUp className="w-3.5 h-3.5" /> {t("showLess")}</>
                : <><ChevronDown className="w-3.5 h-3.5" /> {t("showAll")} ({drivers.length})</>}
            </button>
          )}
        </div>

        {/* ── SCENARIO ATTUALE ── */}
        {config && (
          <div className="app-card px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-black text-base uppercase tracking-wide">
                {t("home_scenario")}
              </h2>
              <Link to="/calculator"
                className="flex items-center gap-1 border border-primary/30 rounded-full
                           px-3 py-1 text-xs text-primary font-body font-semibold">
                ✏ {t("home_edit")}
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { v: (config.total_races||0) - (config.races_completed||0), l: t("home_racesRemaining") },
                { v: maxAvailable,                                           l: t("home_maxAvailable") },
                { v: config.next_race_has_sprint
                    ? MAX_POINTS_RACE + MAX_POINTS_SPRINT
                    : MAX_POINTS_RACE,                                       l: t("home_maxNext") },
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

        {/* ── PUNTI NECESSARI (dark card) ── */}
        {leader && p2 && (
          <div className="dark-card px-5 pt-4 pb-5">
            {/* Header */}
            <h2 className="font-heading font-black text-xs uppercase tracking-widest
                           text-white/50 mb-3 flex items-center gap-1.5">
              {t("home_needed")}
              <InfoTip>{t("home_neededHint")}</InfoTip>
            </h2>

            {/* Two-column layout: left = text, right = gauge */}
            <div className="flex items-center gap-2">

              {/* Left column */}
              <div className="flex-1 min-w-0">
                <p className="text-white/65 text-sm font-body leading-snug">
                  <span className="font-heading font-black text-white">
                    {leader.driver_name}
                  </span>
                  {" "}{t("home_canWin")}
                </p>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="font-heading font-black leading-none text-primary"
                        style={{ fontSize: "3.5rem" }}>
                    {neededForTitle}
                  </span>
                  <span className="font-heading font-black text-2xl text-primary/70 mb-1">
                    PTI
                  </span>
                </div>
                {/* P2 info */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-white/30 text-xs font-body">vs</span>
                  <span className="font-heading font-bold text-sm text-white/60">
                    {p2.driver_name}
                  </span>
                  <span className="font-mono text-xs text-white/35">
                    ({p2.points} pts)
                  </span>
                </div>
              </div>

              {/* Right column — gauge, fixed width */}
              <div className="w-[160px] shrink-0">
                <ArcGauge
                  current={leader.points}
                  needed={neededForTitle}
                  possible={possible}
                />
              </div>

            </div>
          </div>
        )}

        {/* ── PROSSIMI GP — 4 boxes, centered grid ── */}
        {calRaces.length > 0 && (
          <div className="app-card overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
              <h2 className="font-heading font-black text-base uppercase tracking-wide">
                {t("home_nextGps")}
              </h2>
              <span className="text-xs text-muted-foreground font-body">
                {config?.races_completed ?? 0}/{config?.total_races ?? 0}
              </span>
            </div>

            {/* 4-column grid, equal width, centered */}
            <div className="grid grid-cols-4 gap-2 px-3 py-3">
              {calRaces.map((r, i) => {
                const iso = raceFlagUrl(r) ? null : null; // use raceFlagUrl directly
                const flagSrc = raceFlagUrl(r, "h40");
                return (
                  <div key={i}
                    className={`flex flex-col items-center rounded-xl border py-3 px-1
                      ${i === 0
                        ? "border-primary/25 bg-primary/4"
                        : "border-gray-100 bg-gray-50"}`}
                  >
                    {/* Flag image */}
                    {flagSrc ? (
                      <img
                        src={flagSrc}
                        alt={r.name}
                        className="h-6 w-auto object-cover rounded-sm mb-2" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.12)" }}
                        onError={e => { e.target.style.display = "none"; }}
                      />
                    ) : (
                      <span className="text-xl mb-2">🏁</span>
                    )}
                    {/* Date */}
                    {r.date && (
                      <p className={`font-heading font-bold text-[11px] text-center leading-tight
                        ${i === 0 ? "text-primary" : "text-foreground"}`}>
                        {format(new Date(r.date), "d MMM", { locale: it })}
                      </p>
                    )}
                    {/* Sprint tag */}
                    {r.has_sprint && (
                      <span className="tag bg-amber-100 text-amber-700 mt-1.5 text-[9px]">
                        Sprint
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
