import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft, Loader2, Crown, Trophy, Medal, Target, Timer,
  Star, Award, TrendingUp, Gauge, Zap, Flag,
} from "lucide-react";
import {
  getDriverStandings, getDriverSeasonStats, getDriverRecentResults,
} from "@/lib/supabaseData";
import { getDriverColor } from "@/lib/f1Utils";
import { flagUrl, raceFlagUrl } from "@/lib/flagUtils";
import PageHeader from "@/components/PageHeader";
import { useI18n } from "@/lib/i18n";

function ageFrom(dob) {
  if (!dob) return null;
  const b = new Date(dob), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

// Colour of a finishing-position chip.
function resultStyle(r) {
  if (r.dnf || r.position == null) return "bg-gray-200 text-gray-500";
  if (r.position <= 3)  return "bg-emerald-100 text-emerald-700";
  if (r.position <= 10) return "bg-sky-100 text-sky-700";
  return "bg-gray-100 text-gray-500";
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 px-2 py-3 text-center">
      <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
        {Icon && <Icon className="w-3 h-3" />}
      </div>
      <p className="font-heading font-black text-2xl leading-none tabular-nums">
        {value ?? "–"}
      </p>
      <p className="text-[9px] text-muted-foreground font-body uppercase tracking-widest mt-1 leading-tight">
        {label}
      </p>
    </div>
  );
}

export default function DriverDetail() {
  const { t, lang } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["driverStandings"], queryFn: getDriverStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: seasonStats = {} } = useQuery({
    queryKey: ["driverSeasonStats"], queryFn: () => getDriverSeasonStats(), staleTime: 5 * 60 * 1000,
  });
  const { data: form = [] } = useQuery({
    queryKey: ["driverRecent", id], queryFn: () => getDriverRecentResults(id, 5), staleTime: 30 * 60 * 1000,
    enabled: !!id,
  });

  const d = drivers.find(x => x.id === id);
  const s = seasonStats[id] || {};
  const localeTag = { it: "it-IT", en: "en-GB", fr: "fr-FR", es: "es-ES", de: "de-DE" }[lang] || "it-IT";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-100 to-gray-200">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const backBtn = (
    <button onClick={() => navigate(-1)} aria-label="Back"
      className="w-9 h-9 -ml-1 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white shrink-0 active:scale-95 transition-transform">
      <ChevronLeft className="w-5 h-5" />
    </button>
  );

  if (!d) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200">
        <PageHeader title={<div className="flex items-center gap-2">{backBtn}<span className="font-heading font-black text-lg text-white truncate">—</span></div>} />
        <div className="px-4 py-20 text-center text-muted-foreground font-body">{t("dd_notFound")}</div>
      </div>
    );
  }

  const color = getDriverColor(d.driver_code, d.driver_name, d.team);
  const age = ageFrom(d.date_of_birth);
  const career = d.career || {};

  const seasonTiles = [
    { icon: Trophy,      label: t("st_wins"),            v: s.wins ?? 0 },
    { icon: Medal,       label: t("st_podiums"),         v: s.podiums ?? 0 },
    { icon: Target,      label: t("st_poles"),           v: s.poles ?? 0 },
    { icon: Timer,       label: t("st_fastestLaps"),     v: s.fastest_laps ?? 0 },
    { icon: Star,        label: t("st_pointsFinishes"),  v: s.points_finishes ?? 0 },
    { icon: Award,       label: t("st_dotd"),            v: s.dotd ?? 0 },
    { icon: TrendingUp,  label: t("st_positionsGained"), v: s.positions_gained ?? 0 },
    { icon: Crown,       label: t("st_bestFinish"),      v: s.best_finish ?? "–" },
    { icon: Gauge,       label: t("st_avgFinish"),       v: s.avg_finish ?? "–" },
  ];

  const careerTiles = [
    { icon: Crown,  label: t("st_titles"),       v: career.titles ?? 0 },
    { icon: Trophy, label: t("st_wins"),         v: career.wins ?? 0 },
    { icon: Medal,  label: t("st_podiums"),      v: career.podiums ?? 0 },
    { icon: Target, label: t("st_poles"),        v: career.poles ?? 0 },
    { icon: Timer,  label: t("st_fastestLaps"),  v: career.fastest_laps ?? 0 },
    { icon: Zap,    label: t("st_careerPoints"), v: (career.points ?? 0).toLocaleString(localeTag) },
    { icon: Flag,   label: t("st_racesEntered"), v: career.starts ?? 0 },
    { icon: Star,   label: t("st_bestFinish"),   v: career.best_finish ?? "–" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 pb-6">
      <PageHeader
        title={
          <div className="flex items-center gap-2 min-w-0">
            {backBtn}
            <span className="font-heading font-black text-lg uppercase tracking-wide truncate text-white">
              {d.driver_name}
            </span>
          </div>
        }
      />

      <div className="px-4 py-5 space-y-4">
        {/* ── HERO ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden p-4 text-white shadow-md"
          style={{ background: `linear-gradient(160deg, ${color}, ${color}cc 55%, ${color}99)` }}
        >
          {d.position === 1 && (
            <Crown className="absolute top-3 right-3 w-5 h-5 text-yellow-300 drop-shadow" />
          )}
          <div className="flex items-center gap-2 mb-1">
            {d.nationality_iso && (
              <img src={flagUrl(d.nationality_iso, "h20")} alt=""
                className="w-5 h-3.5 object-cover rounded-[2px]"
                style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.4)" }}
                onError={e => { e.target.style.display = "none"; }} />
            )}
            {d.permanent_number && (
              <span className="font-heading font-black text-xs text-white/70">#{d.permanent_number}</span>
            )}
          </div>
          <p className="font-heading font-black text-4xl leading-none tracking-tight">{d.driver_code || "—"}</p>
          <p className="font-heading font-bold text-base leading-tight mt-1 truncate">{d.driver_name}</p>
          <p className="font-body text-xs text-white/80 truncate">{d.team}</p>

          <div className="flex items-end justify-between mt-3">
            <div className="flex items-end gap-1">
              <span className="font-heading font-black text-3xl leading-none">{d.points}</span>
              <span className="font-body text-[11px] text-white/70 mb-0.5">{t("pts")} · P{d.position}</span>
            </div>
            {age && <span className="font-body text-[11px] text-white/70">{age} {t("dd_years")}</span>}
          </div>
        </motion.div>

        {/* ── FORM (last results) ── */}
        <div className="app-card px-4 py-4">
          <h2 className="font-heading font-black text-sm uppercase tracking-wide mb-3">{t("dd_form")}</h2>
          {form.length === 0 ? (
            <p className="text-xs text-muted-foreground font-body">{t("dd_noResults")}</p>
          ) : (
            <div className="flex gap-2">
              {[...form].reverse().map(r => {
                const flag = raceFlagUrl(r, "h20");
                return (
                  <div key={r.race_id} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                    {flag
                      ? <img src={flag} alt="" className="h-4 w-auto object-cover rounded-[2px]"
                          style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.12)" }}
                          onError={e => { e.target.style.display = "none"; }} />
                      : <span className="text-xs">🏁</span>}
                    <div className={`w-full rounded-lg py-1.5 text-center font-heading font-black text-sm ${resultStyle(r)}`}>
                      {r.dnf ? t("dd_dnf") : r.position != null ? `P${r.position}` : "–"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SEASON STATS ── */}
        <div className="app-card px-4 py-4">
          <h2 className="font-heading font-black text-sm uppercase tracking-wide mb-3">{t("dd_seasonTitle")}</h2>
          <div className="grid grid-cols-3 gap-2">
            {seasonTiles.map(x => <StatTile key={x.label} icon={x.icon} label={x.label} value={x.v} />)}
          </div>
        </div>

        {/* ── CAREER STATS ── */}
        <div className="app-card px-4 py-4">
          <h2 className="font-heading font-black text-sm uppercase tracking-wide mb-3">{t("career")}</h2>
          <div className="grid grid-cols-3 gap-2">
            {careerTiles.map(x => <StatTile key={x.label} icon={x.icon} label={x.label} value={x.v} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
