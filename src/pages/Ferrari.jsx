import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Trophy, TrendingUp, Loader2, Users, Flag, Crown,
  Target, Timer, Star, ShieldAlert, Zap, Medal, Share2, ChevronDown,
} from "lucide-react";
import { shareElementAsImage } from "@/lib/shareImage";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import PageHeader from "@/components/PageHeader";
import InfoTip from "@/components/InfoTip";
import { useI18n } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getConstructorStandings, getConstructorSeasonStats,
  getConstructorPointsByYear, getDriverStandings, getSeasonConfig,
} from "@/lib/supabaseData";
import { getTeamColor } from "@/lib/f1Utils";
import { flagUrl } from "@/lib/flagUtils";

// Constructor max points per weekend (two cars): race 25+18, sprint 8+7
const MAX_C_RACE = 43;
const MAX_C_SPRINT = 15;

// ── helpers ─────────────────────────────────────────────────────────────────
const fmtNum = (v) =>
  v === null || v === undefined ? "–"
  : typeof v === "number" ? v.toLocaleString("it-IT") : v;

function cmp(v1, v2, lower) {
  const a = v1 ?? null, b = v2 ?? null;
  if (a === null && b === null) return 0;
  if (a === null) return 2;
  if (b === null) return 1;
  if (a === b) return 0;
  if (lower) return a < b ? 1 : 2;
  return a > b ? 1 : 2;
}

function FlagImg({ iso, className = "w-5 h-3.5" }) {
  if (!iso) return null;
  return (
    <img src={flagUrl(iso, "h20")} alt={iso}
      className={`${className} object-cover rounded-[2px] shrink-0`}
      style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.12)" }}
      onError={e => { e.target.style.display = "none"; }} />
  );
}

// ── head-to-head stat row ─────────────────────────────────────────────────────
function StatRow({ icon: Icon, label, val1, val2, color1, color2, lowerBetter = false, tip }) {
  const winner = cmp(val1, val2, lowerBetter);
  const raw1 = typeof val1 === "number" ? val1 : 0;
  const raw2 = typeof val2 === "number" ? val2 : 0;
  let g1, g2;
  if (lowerBetter) { const m = Math.max(raw1, raw2); g1 = m - raw1; g2 = m - raw2; }
  else { g1 = Math.max(raw1, 0); g2 = Math.max(raw2, 0); }
  const gmax = Math.max(g1, g2, 1);

  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        {Icon && <Icon className="w-3 h-3 text-gray-400" />}
        <p className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">{label}</p>
        {tip && <InfoTip>{tip}</InfoTip>}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-heading font-black text-base w-14 text-right tabular-nums"
              style={{ color: winner === 1 ? color1 : "#d1d5db" }}>{fmtNum(val1)}</span>
        <div className="flex-1 flex gap-1 h-2">
          <div className="flex-1 flex justify-end">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(g1 / gmax) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-l-full" style={{ backgroundColor: color1, opacity: winner === 2 ? 0.4 : 1 }} />
          </div>
          <div className="flex-1">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(g2 / gmax) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-r-full" style={{ backgroundColor: color2, opacity: winner === 1 ? 0.4 : 1 }} />
          </div>
        </div>
        <span className="font-heading font-black text-base w-14 tabular-nums"
              style={{ color: winner === 2 ? color2 : "#d1d5db" }}>{fmtNum(val2)}</span>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "white", border: "1px solid #e5e7eb",
  borderRadius: "10px", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace",
};

// ── main ───────────────────────────────────────────────────────────────────────
export default function Ferrari() {
  const { t: tr } = useI18n();
  const [selectedId, setSelectedId] = useState(null);
  const [compareId, setCompareId] = useState(null);
  const [mode, setMode] = useState("season");
  const cmpRef = useRef(null);
  const [showMore, setShowMore] = useState(false);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["constructorStandings"], queryFn: getConstructorStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: cstats = {} } = useQuery({
    queryKey: ["constructorSeasonStats"], queryFn: () => getConstructorSeasonStats(), staleTime: 5 * 60 * 1000,
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["driverStandings"], queryFn: getDriverStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: config } = useQuery({
    queryKey: ["seasonConfig"], queryFn: getSeasonConfig, staleTime: 10 * 60 * 1000,
  });

  // default to Ferrari once data loads
  useEffect(() => {
    if (!selectedId && teams.length) {
      const ferrari = teams.find(t => /ferrari/i.test(t.team_name));
      setSelectedId((ferrari || teams[0]).id);
    }
  }, [teams, selectedId]);

  const selected = teams.find(t => t.id === selectedId);
  const leader   = teams[0];
  const compare  = teams.find(t => t.id === compareId);

  // default compare opponent = leader (or P2 if leader is selected)
  useEffect(() => {
    if (selected && !compareId && teams.length > 1) {
      const opp = selected.id === leader?.id ? teams[1] : leader;
      setCompareId(opp?.id ?? null);
    }
  }, [selected, compareId, teams, leader]);

  const color   = selected ? getTeamColor(selected.team_name) : "#888";
  const cColor  = compare ? getTeamColor(compare.team_name) : "#bbb";
  const sStats  = cstats[selectedId] || {};
  const oStats  = cstats[compareId] || {};
  const lineup  = selected ? drivers.filter(d => d.team && d.team.toLowerCase() === selected.team_name.toLowerCase()) : [];

  const { data: history = [] } = useQuery({
    queryKey: ["constructorPointsByYear", selectedId],
    queryFn: () => getConstructorPointsByYear(selectedId),
    enabled: !!selectedId, staleTime: 30 * 60 * 1000,
  });

  // ── constructors' title race ──
  const titleRace = useMemo(() => {
    if (!selected || !leader || !config) return null;
    const racesLeft   = Math.max(0, (config.total_races   || 0) - (config.races_completed   || 0));
    const sprintsLeft = Math.max(0, (config.total_sprints || 0) - (config.sprints_completed || 0));
    const maxAvail    = racesLeft * MAX_C_RACE + sprintsLeft * MAX_C_SPRINT;

    if (selected.id === leader.id) {
      let needed = 0;
      teams.slice(1).forEach(r => { needed = Math.max(needed, (r.points + maxAvail) - selected.points + 1); });
      return { isLeader: true, racesLeft, maxAvail, alreadyChampion: needed <= 0, magic: Math.max(0, needed) };
    }
    const teamMax = selected.points + maxAvail;
    return {
      isLeader: false, racesLeft, maxAvail,
      out: teamMax < leader.points,
      gap: leader.points - selected.points,
      toCatch: leader.points - selected.points + 1,
    };
  }, [selected, leader, teams, config]);

  const seasonRows = [
    { icon: Zap,         label: tr("st_points"),         get: (t) => t.points },
    { icon: Trophy,      label: tr("st_wins"),           get: (t, s) => s.wins ?? 0, tip: tr("tip_wins") },
    { icon: Medal,       label: tr("st_podiums"),        get: (t, s) => s.podiums ?? 0, tip: tr("tip_podiums") },
    { icon: Target,      label: tr("st_poles"),          get: (t, s) => s.poles ?? 0, tip: tr("tip_poles") },
    { icon: Timer,       label: tr("st_fastestLaps"),    get: (t, s) => s.fastest_laps ?? 0, tip: tr("tip_fastest") },
    { icon: Star,        label: tr("st_pointsFinishes"), get: (t, s) => s.points_finishes ?? 0, tip: tr("tip_pointsFin") },
    { icon: ShieldAlert, label: tr("st_dnf"),            get: (t, s) => s.dnf ?? 0, lowerBetter: true, tip: tr("tip_dnf") },
  ];
  const careerRows = [
    { icon: Crown,  label: tr("st_constructorTitles"), get: (t) => t.career?.titles ?? 0 },
    { icon: Trophy, label: tr("st_wins"),              get: (t) => t.career?.wins ?? 0 },
    { icon: Medal,  label: tr("st_podiums"),           get: (t) => t.career?.podiums ?? 0 },
    { icon: Target, label: tr("st_poles"),             get: (t) => t.career?.poles ?? 0 },
    { icon: Zap,    label: tr("st_totalPoints"),       get: (t) => t.career?.points ?? 0 },
    { icon: Flag,   label: tr("st_gpEntered"),         get: (t) => t.career?.entries ?? 0 },
  ];
  const rows = mode === "season" ? seasonRows : careerRows;

  const chartData = useMemo(
    () => history.slice(-20).map(h => ({ year: String(h.year), punti: h.points })),
    [history]
  );

  if (isLoading || !selected) return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-100 to-gray-200">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 pb-4">
      <PageHeader icon={Shield} title={tr("nav_teams")} color={color} />

      <div className="px-4 py-5 space-y-4">
        {/* ── TEAM SELECTOR ── */}
        <div className="bg-white rounded-2xl p-3 shadow-md border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />
          <p className="font-body text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{tr("tm_team")}</p>
          <Select value={selectedId || ""} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full text-sm font-heading font-black h-10 px-3 border-gray-200 rounded-xl">
              <SelectValue placeholder={tr("tm_team")} />
            </SelectTrigger>
            <SelectContent>
              {teams.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-2 font-heading text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getTeamColor(t.team_name) }} />
                    {t.team_name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── HERO ── */}
        <motion.div key={selectedId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden text-white shadow-md"
          style={{ background: `linear-gradient(160deg, ${color}, ${color}cc 55%, ${color}99)` }}>
          <div className="px-4 pt-4 pb-3 flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FlagImg iso={selected.nationality_iso} />
                <span className="font-body text-[11px] text-white/80 uppercase tracking-widest">
                  Stagione {config?.season ?? new Date().getFullYear()}
                </span>
              </div>
              <h2 className="font-heading font-black text-3xl leading-none truncate">{selected.team_name}</h2>
            </div>
            <div className="text-right shrink-0">
              <div className="font-heading font-black text-4xl leading-none">P{selected.position}</div>
              {selected.championship_won && <Crown className="w-5 h-5 text-yellow-300 inline mt-1" />}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-px bg-white/15 mx-4 mb-3 rounded-xl overflow-hidden">
            {[
              { v: selected.points,      l: tr("lbl_points") },
              { v: sStats.wins ?? 0,     l: tr("lbl_wins") },
              { v: sStats.podiums ?? 0,  l: tr("lbl_podiums") },
              { v: sStats.poles ?? 0,    l: tr("lbl_poles") },
            ].map(({ v, l }) => (
              <div key={l} className="py-2.5 text-center" style={{ background: `${color}` }}>
                <span className="font-heading font-black text-xl">{v}</span>
                <p className="font-heading text-[9px] text-white/75 tracking-widest mt-0.5">{l}</p>
              </div>
            ))}
          </div>

          {/* drivers lineup */}
          {lineup.length > 0 && (
            <div className="px-4 pb-4 space-y-2">
              {lineup.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-black/15 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-heading font-black text-xs bg-white/20 rounded px-1.5 py-0.5">{d.driver_code}</span>
                    <span className="font-heading font-bold text-sm truncate">{d.driver_name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-heading font-black text-sm">{d.points}</span>
                    <span className="font-body text-[10px] text-white/70 ml-1">P{d.position}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── TITLE RACE (constructors' championship calc) ── */}
        {titleRace && (
          <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4" style={{ color }} />
              <h3 className="font-heading font-black text-sm uppercase tracking-wide">{tr("tm_title")}</h3>
              <InfoTip>{tr("tm_titleTip")}</InfoTip>
              <span className="ml-auto text-[11px] font-body text-muted-foreground">{titleRace.racesLeft} {tr("tm_gpLeft")}</span>
            </div>

            {titleRace.isLeader ? (
              titleRace.alreadyChampion ? (
                <p className="font-heading font-bold text-emerald-600 text-center py-2">🏆 {tr("tm_mathChampion")}</p>
              ) : (
                <div className="text-center">
                  <p className="font-heading font-black text-5xl leading-none" style={{ color }}>{titleRace.magic}</p>
                  <p className="font-body text-xs text-muted-foreground mt-1">{tr("tm_toClinchLeader")}</p>
                </div>
              )
            ) : titleRace.out ? (
              <p className="font-heading font-bold text-gray-500 text-center py-2">❌ {tr("tm_outOfTitle")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-gray-50 rounded-xl py-3">
                  <p className="font-heading font-black text-3xl" style={{ color }}>−{titleRace.gap}</p>
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{tr("tm_fromLeader")}</p>
                </div>
                <div className="bg-gray-50 rounded-xl py-3">
                  <p className="font-heading font-black text-3xl text-gray-800">{titleRace.maxAvail}</p>
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{tr("tm_pointsAtStake")}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONSTRUCTOR STANDINGS (tap to switch) ── */}
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <h3 className="font-heading font-black text-sm uppercase tracking-wide">{tr("tm_standings")}</h3>
          </div>
          <div className="space-y-1">
            {teams.map(t => {
              const tc = getTeamColor(t.team_name);
              const pct = leader.points > 0 ? (t.points / leader.points) * 100 : 0;
              const active = t.id === selectedId;
              return (
                <button key={t.id} onClick={() => setSelectedId(t.id)}
                  className={`w-full flex items-center gap-3 py-2 px-2 rounded-xl transition-colors ${active ? "bg-gray-50" : "hover:bg-gray-50"}`}>
                  <span className="font-heading font-black text-sm w-5 text-center"
                        style={{ color: active ? tc : "#9ca3af" }}>{t.position}</span>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <span className={`font-heading font-bold text-sm truncate ${active ? "" : "text-gray-700"}`}>{t.team_name}</span>
                      <span className="font-heading font-black text-sm tabular-nums">{t.points}</span>
                    </div>
                    <div className="relative h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full"
                           style={{ width: `${pct}%`, backgroundColor: tc, boxShadow: `0 0 6px ${tc}66` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggle: confronto + storico nascosti di default per alleggerire la pagina */}
        <button
          onClick={() => setShowMore(s => !s)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors active:scale-[0.98] border border-rose-200"
        >
          {showMore ? tr("sc_simpleView") : tr("sc_advanced")}
          <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
        </button>

        {showMore && (
        <>
        {/* ── HEAD-TO-HEAD COMPARE ── */}
        <div ref={cmpRef} className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <h3 className="font-heading font-black text-sm uppercase tracking-wide">{tr("tm_compare")}</h3>
            {compare && (
              <button
                onClick={() => shareElementAsImage(cmpRef.current, {
                  fileName: `gridup-scuderie-${selected.team_name}-vs-${compare.team_name}.png`.replace(/\s+/g, "-"),
                  title: "GridUP",
                  text: `${selected.team_name} vs ${compare.team_name} — ${tr("tm_compare")}`,
                  heading: tr("tm_compare"),
                  sub: `${selected.team_name} vs ${compare.team_name}`,
                })}
                title={tr("share")}
                data-html2canvas-ignore
                className="ml-auto w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 active:scale-95 transition-transform shrink-0"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* opponent selector */}
          <div className="flex items-center gap-2 mb-3">
            <span className="font-heading font-black text-sm px-2 py-1 rounded-lg text-white shrink-0" style={{ backgroundColor: color }}>
              {selected.team_name}
            </span>
            <span className="text-gray-400 font-heading text-xs">VS</span>
            <Select value={compareId || ""} onValueChange={setCompareId}>
              <SelectTrigger className="flex-1 text-xs font-heading font-bold h-8 px-2.5 border-gray-200 rounded-lg">
                <SelectValue placeholder={tr("tm_chooseOpponent")} />
              </SelectTrigger>
              <SelectContent>
                {teams.filter(t => t.id !== selectedId).map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2 font-heading text-sm">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getTeamColor(t.team_name) }} />
                      {t.team_name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {compare && (
            <>
              {/* toggle */}
              <div className="grid grid-cols-2 gap-1 bg-gray-200/70 p-1 rounded-xl mb-3">
                {[{ k: "season", label: tr("season") }, { k: "career", label: tr("career") }].map(m => (
                  <button key={m.k} onClick={() => setMode(m.k)}
                    className={`py-1.5 rounded-lg font-heading font-bold text-xs uppercase tracking-wide transition-all
                      ${mode === m.k ? "bg-white shadow-sm text-primary" : "text-gray-500"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={mode + compareId}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}>
                  {rows.map(r => (
                    <StatRow key={r.label} icon={r.icon} label={r.label}
                      val1={r.get(selected, sStats)} val2={r.get(compare, oStats)}
                      color1={color} color2={cColor} lowerBetter={r.lowerBetter} />
                  ))}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>

        {/* ── HISTORY (career + chart) ── */}
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4" style={{ color }} />
            <h3 className="font-heading font-black text-sm uppercase tracking-wide">{tr("tm_history")}</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { v: selected.career?.titles ?? 0, l: tr("lbl_titles") },
              { v: selected.career?.wins ?? 0, l: tr("lbl_winsFull") },
              { v: selected.career?.podiums ?? 0, l: tr("lbl_podiums") },
              { v: selected.career?.poles ?? 0, l: tr("lbl_poles") },
              { v: fmtNum(selected.career?.points ?? 0), l: tr("lbl_points") },
              { v: selected.career?.entries ?? 0, l: tr("lbl_gp") },
            ].map(({ v, l }) => (
              <div key={l} className="bg-gray-50 rounded-xl p-2.5 text-center">
                <span className="font-heading font-black text-xl block leading-none">{v}</span>
                <p className="font-heading text-[9px] text-muted-foreground uppercase tracking-widest mt-1">{l}</p>
              </div>
            ))}
          </div>

          {chartData.length > 1 ? (
            <>
              <p className="font-body text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
                {tr("tm_pointsPerSeason", { n: chartData.length })}
              </p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" tick={{ fontSize: 9, fill: "#9ca3af" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={28} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="punti" stroke={color} fill="url(#cg)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="text-center text-xs text-muted-foreground font-body py-3">
              {tr("tm_noHistory")}
            </p>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
