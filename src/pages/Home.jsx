import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getDriverStandings,
  getSeasonConfig,
  getUpcomingRaces,
  getNextRaceSessions,
  getLastRaceResults,
  getNextRace,
  getLastRaceDate,
  getAllSeasonRaces,
} from "@/lib/supabaseData";
import {
  getTeamColor,
  calculateMaxAvailablePoints,
  MAX_POINTS_RACE,
  MAX_POINTS_SPRINT,
} from "@/lib/f1Utils";
import { raceFlagUrl, gpIso, flagUrl } from "@/lib/flagUtils";
import GpCountdown from "@/components/GpCountdown";
import { Loader2, ChevronDown, ChevronUp, Info, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import InfoTip from "@/components/InfoTip";
import ErrorScreen from "@/components/ErrorScreen";
import SeasonMapModal from "@/components/SeasonMapModal";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import { it, enGB, fr, es, de } from "date-fns/locale";

const DATE_FNS_LOCALE = { it, en: enGB, fr, es, de };

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

const LOCALE_TAG = { it: "it-IT", en: "en-GB", fr: "fr-FR", es: "es-ES", de: "de-DE" };
const PODIUM_MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

// ── Last completed race — podium recap (collapsible, closed by default) ───────
function LastRaceRecap({ data, t, localeTag }) {
  const [open, setOpen] = useState(false);
  if (!data || !data.podium?.length) return null;
  const winner = data.podium.find(p => p.pos === 1);
  return (
    <div className="app-card overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left active:bg-gray-50 transition-colors">
        <h2 className="font-heading font-black text-base uppercase tracking-wide">{t("recap_title")}</h2>
        {!open && winner && (
          <span className="font-heading font-bold text-sm text-muted-foreground truncate">🥇 {winner.driver}</span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground font-body shrink-0">
          {new Date(data.date).toLocaleDateString(localeTag, { day: "numeric", month: "short" })}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }} className="overflow-hidden">
            <p className="px-4 text-[11px] text-muted-foreground font-body pb-2 truncate">{data.name}</p>
            <div className="px-2 pb-3 space-y-1">
              {data.podium.map(p => {
                const color = getTeamColor(p.team);
                return (
                  <div key={p.pos} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
                    <span className="text-lg w-6 text-center shrink-0">{PODIUM_MEDAL[p.pos] ?? p.pos}</span>
                    <span className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {p.code && <span className="font-heading font-black text-xs text-muted-foreground">{p.code}</span>}
                      <span className="font-heading font-bold text-sm text-foreground truncate">{p.driver}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Weekend session schedule (times converted to the user's timezone) ─────────
function SessionSchedule({ data, t, localeTag }) {
  const [open, setOpen] = useState(false);
  if (!data || !data.sessions?.length) return null;
  const fmtDay  = iso => new Date(iso).toLocaleDateString(localeTag, { weekday: "short", day: "numeric", month: "short" });
  const fmtTime = (iso, hasTime) => hasTime
    ? new Date(iso).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="app-card overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left active:bg-gray-50 transition-colors">
        <h2 className="font-heading font-black text-base uppercase tracking-wide">{t("sess_schedule")}</h2>
        <span className="ml-auto text-[10px] text-muted-foreground font-body shrink-0">{t("sess_yourTime")}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="px-2 pb-2">
              {data.sessions.map(s => {
                const isRace = s.key === "race";
                const isSprint = s.key === "sprint";
                return (
                  <div key={s.key}
                       className={`flex items-center justify-between px-3 py-2 rounded-xl ${isRace ? "bg-primary/5" : ""}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {isRace && <span className="text-sm">🏁</span>}
                      {isSprint && <span className="tag bg-amber-100 text-amber-700 text-[9px]">SPRINT</span>}
                      <span className={`font-heading text-sm ${isRace ? "font-black text-primary" : "font-bold text-foreground"}`}>
                        {t(`sess_${s.key}`)}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-body text-[11px] text-muted-foreground mr-2">{fmtDay(s.iso)}</span>
                      <span className={`font-heading tabular-nums text-sm ${isRace ? "font-black text-primary" : "font-bold"}`}>
                        {fmtTime(s.iso, s.hasTime)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const { t, lang } = useI18n();
  const dfLocale = DATE_FNS_LOCALE[lang] ?? it;
  const [showAllDrivers, setShowAllDrivers] = useState(false);

  const { data: drivers = [], isLoading: ld, error: err, refetch } = useQuery({
    queryKey: ["driverStandings"], queryFn: getDriverStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: config, isLoading: lc } = useQuery({
    queryKey: ["seasonConfig"], queryFn: getSeasonConfig, staleTime: 10 * 60 * 1000,
  });
  const { data: nextSessions } = useQuery({
    queryKey: ["nextRaceSessions"], queryFn: () => getNextRaceSessions(), staleTime: 60 * 60 * 1000,
  });
  const { data: lastRace } = useQuery({
    queryKey: ["lastRaceResults"], queryFn: () => getLastRaceResults(), staleTime: 60 * 60 * 1000,
  });
  const { data: nextRace } = useQuery({
    queryKey: ["nextRace"], queryFn: () => getNextRace(), staleTime: 5 * 60 * 1000,
  });
  const { data: upcomingRaces = [] } = useQuery({
    queryKey: ["upcomingRaces"], queryFn: () => getUpcomingRaces(4), staleTime: 60 * 60 * 1000,
  });
  const { data: lastRaceDate } = useQuery({
    queryKey: ["lastRaceDate"], queryFn: getLastRaceDate, staleTime: 60 * 60 * 1000,
  });
  const { data: allRaces = [], error: allRacesErr } = useQuery({
    queryKey: ["allSeasonRaces"], queryFn: () => getAllSeasonRaces(), staleTime: 60 * 60 * 1000,
    retry: 2,
  });
  const [mapOpen, setMapOpen] = useState(false);

  if (ld || lc) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gradient-to-b from-gray-100 to-gray-200">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground font-body">{t("loading")}</p>
    </div>
  );

  if (err) return <ErrorScreen onRetry={refetch} />;

  const leader         = drivers[0];
  const maxAvailable   = calculateMaxAvailablePoints(config);
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
          <div className="font-heading font-black text-xl leading-none truncate text-white tracking-wide">
            GridUP
          </div>
        }
        right={
          <a href="/privacy.html"
            aria-label="Privacy Policy"
            title="Privacy Policy"
            className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center
                       text-white shrink-0">
            <Info className="w-4 h-4" />
          </a>
        }
      />

      <div className="px-4 py-5 space-y-4">

        {/* ── INTRO + PROSSIMA GARA ── */}
        <div className="app-card p-4">
          <p className="text-xs text-muted-foreground font-body leading-snug mb-3">
            {t("home_tagline")}
          </p>
          {(nextRace?.name || config?.next_race_name) && (
            <div className="flex items-center gap-4 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              {(() => {
                // Bandiera del GP corrente/prossimo: prima da nextRace (allineato al
                // countdown col fuso reale), poi fallback al calendario / nome GP.
                const src = nextRace
                  ? raceFlagUrl({ country_id: nextRace.country_id, official_name: nextRace.official_name, name: nextRace.name }, "h80")
                  : (calRaces[0] ? raceFlagUrl(calRaces[0], "h80") : (nextRaceIso ? flagUrl(nextRaceIso, "h80") : null));
                return src
                  ? <img src={src} alt="" className="h-9 w-auto object-cover rounded-md shrink-0"
                         onError={e => { e.target.style.display = "none"; }} />
                  : <span className="text-xl shrink-0">🏁</span>;
              })()}
              <GpCountdown targetDate={nextRace?.startIso || config?.next_race_date} compact />
              {(nextRace?.has_sprint ?? config?.next_race_has_sprint) && (
                <span className="tag bg-amber-100 text-amber-700 shrink-0 ml-auto">Sprint</span>
              )}
            </div>
          )}
        </div>

        {/* ── RECAP ULTIMA GARA (podio) ── */}
        <LastRaceRecap data={lastRace} t={t} localeTag={LOCALE_TAG[lang] ?? "it-IT"} />

        {/* ── PROGRAMMA WEEKEND (orari sessioni nel fuso locale) ── */}
        <SessionSchedule data={nextSessions} t={t} localeTag={LOCALE_TAG[lang] ?? "it-IT"} />

        {/* ── CLASSIFICA PILOTI ── */}
        <div className="app-card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="font-heading font-black text-base uppercase tracking-wide">
                {t("home_standings")}
              </h2>
              {lastRaceDate && (
                <p className="text-[10px] text-muted-foreground font-body mt-0.5">
                  {t("home_dataAsOf")} {new Date(lastRaceDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
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
              <h2 className="font-heading font-black text-base uppercase tracking-wide flex items-center gap-1.5">
                {t("home_scenario")}
                <InfoTip>{t("home_scenarioHint")}</InfoTip>
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


        {/* ── PROSSIMI GP — 4 boxes, centered grid ── */}
        {calRaces.length > 0 && (
          <button
            className="app-card overflow-hidden w-full text-left active:scale-[0.99] transition-transform"
            onClick={() => setMapOpen(true)}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
              <h2 className="font-heading font-black text-base uppercase tracking-wide">
                {t("home_nextGps")}
              </h2>
              <span className="text-xs text-primary font-body font-semibold flex items-center gap-1">
                {t("map_tap")} →
              </span>
            </div>

            {/* 4-column grid, equal width, centered */}
            <div className="grid grid-cols-4 gap-2 px-3 py-3">
              {calRaces.map((r, i) => {
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
                        {format(new Date(r.date), "d MMM", { locale: dfLocale })}
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
          </button>
        )}

      </div>

      <SeasonMapModal races={allRaces} error={allRacesErr} open={mapOpen} onClose={() => setMapOpen(false)} />
    </div>
  );
}
