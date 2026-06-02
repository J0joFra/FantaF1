import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTeamColor } from "@/lib/f1Utils";
import { getDriverStandings, getDriverSeasonStats } from "@/lib/supabaseData";
import { flagUrl } from "@/lib/flagUtils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Loader2, ArrowLeftRight, Shuffle, Share2, Crown,
  Trophy, Medal, Target, Timer, Star, Award, TrendingUp, Gauge,
  ShieldAlert, Zap, Flag, GitCompare,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import InfoTip from "@/components/InfoTip";

// ── helpers ───────────────────────────────────────────────────────────────────
function ageFrom(dob) {
  if (!dob) return null;
  const b = new Date(dob), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

// winner: 1 → left, 2 → right, 0 → tie. Treats null as worst.
function cmp(v1, v2, lower) {
  const a = v1 ?? null, b = v2 ?? null;
  if (a === null && b === null) return 0;
  if (a === null) return 2;
  if (b === null) return 1;
  if (a === b) return 0;
  if (lower) return a < b ? 1 : 2;
  return a > b ? 1 : 2;
}

const fmtNum = (v) =>
  v === null || v === undefined ? "–"
  : typeof v === "number" ? v.toLocaleString("it-IT")
  : v;

function FlagImg({ iso, className = "w-5 h-3.5" }) {
  if (!iso) return null;
  return (
    <img src={flagUrl(iso, "h20")} alt={iso}
      className={`${className} object-cover rounded-[2px] shrink-0`}
      style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.12)" }}
      onError={e => { e.target.style.display = "none"; }} />
  );
}

// ── stat comparison row ─────────────────────────────────────────────────────────
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
        <p className="font-body text-[10px] text-muted-foreground text-center uppercase tracking-widest">{label}</p>
        {tip && <InfoTip>{tip}</InfoTip>}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-heading font-black text-base w-12 text-right tabular-nums"
              style={{ color: winner === 1 ? color1 : "#d1d5db" }}>
          {fmtNum(val1)}
        </span>
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
        <span className="font-heading font-black text-base w-12 tabular-nums"
              style={{ color: winner === 2 ? color2 : "#d1d5db" }}>
          {fmtNum(val2)}
        </span>
      </div>
    </div>
  );
}

// ── driver hero panel ─────────────────────────────────────────────────────────
function DriverPanel({ d, color, lead }) {
  const age = ageFrom(d.date_of_birth);
  return (
    <div className="relative rounded-2xl overflow-hidden p-3 pt-4 text-white shadow-md"
         style={{ background: `linear-gradient(160deg, ${color}, ${color}cc 60%, ${color}99)` }}>
      {lead && (
        <div className="absolute top-2 right-2">
          <Crown className="w-4 h-4 text-yellow-300 drop-shadow" />
        </div>
      )}
      <div className="flex items-center gap-1.5 mb-1">
        <FlagImg iso={d.nationality_iso} />
        {d.permanent_number && (
          <span className="font-heading font-black text-xs text-white/70">#{d.permanent_number}</span>
        )}
      </div>
      <p className="font-heading font-black text-3xl leading-none tracking-tight">{d.driver_code || "—"}</p>
      <p className="font-heading font-bold text-sm leading-tight mt-1 truncate">{d.driver_name}</p>
      <p className="font-body text-[11px] text-white/80 truncate">{d.team}</p>
      <div className="flex items-end gap-1 mt-2">
        <span className="font-heading font-black text-2xl leading-none">{d.points}</span>
        <span className="font-body text-[10px] text-white/70 mb-0.5">pti · P{d.position}</span>
      </div>
      {age && <p className="font-body text-[10px] text-white/70 mt-0.5">{age} anni</p>}
    </div>
  );
}

// ── selector card ─────────────────────────────────────────────────────────────
function DriverSelect({ label, value, onChange, options, color, d }) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-md border border-gray-100 relative overflow-hidden">
      {d && <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />}
      <p className="font-body text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="w-full text-xs font-heading font-bold h-9 px-2.5 border-gray-200 rounded-xl">
          <SelectValue placeholder="Seleziona pilota…" />
        </SelectTrigger>
        <SelectContent>
          {options.map(x => (
            <SelectItem key={x.id} value={x.id}>
              <span className="flex items-center gap-2 font-heading text-sm">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getTeamColor(x.team) }} />
                <span className="font-black w-9 text-muted-foreground">{x.driver_code}</span>
                {x.driver_name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── main ────────────────────────────────────────────────────────────────────────
export default function Compare() {
  const [id1, setId1] = useState(null);
  const [id2, setId2] = useState(null);
  const [mode, setMode] = useState("season"); // 'season' | 'career'

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["driverStandings"], queryFn: getDriverStandings, staleTime: 5 * 60 * 1000,
  });
  const { data: seasonStats = {} } = useQuery({
    queryKey: ["driverSeasonStats"], queryFn: () => getDriverSeasonStats(), staleTime: 5 * 60 * 1000,
  });

  const d1 = drivers.find(d => d.id === id1);
  const d2 = drivers.find(d => d.id === id2);
  const c1 = d1 ? getTeamColor(d1.team) : "#ccc";
  const c2 = d2 ? getTeamColor(d2.team) : "#ccc";
  const s1 = seasonStats[id1] || {};
  const s2 = seasonStats[id2] || {};

  const seasonRows = [
    { icon: Zap,         label: "Punti",                get: (d) => d.points },
    { icon: Trophy,      label: "Vittorie",             get: (_, s) => s.wins ?? 0 },
    { icon: Medal,       label: "Podi",                 get: (_, s) => s.podiums ?? 0, tip: "Arrivi nei primi 3 (1°, 2° o 3°)." },
    { icon: Target,      label: "Pole position",        get: (_, s) => s.poles ?? 0, tip: "Volte in cui ha segnato il giro più veloce in qualifica, partendo 1°." },
    { icon: Timer,       label: "Giri veloci",          get: (_, s) => s.fastest_laps ?? 0, tip: "Giro più veloce in gara." },
    { icon: Star,        label: "Arrivi a punti",       get: (_, s) => s.points_finishes ?? 0, tip: "Gare concluse nei primi 10 (zona punti)." },
    { icon: Award,       label: "Driver of the Day",    get: (_, s) => s.dotd ?? 0, tip: "Premio \"pilota del giorno\" votato dai tifosi a fine gara." },
    { icon: TrendingUp,  label: "Posizioni guadagnate", get: (_, s) => s.positions_gained ?? 0, tip: "Posizioni recuperate dalla griglia di partenza al traguardo, sommate nella stagione." },
    { icon: Crown,       label: "Miglior arrivo",       get: (_, s) => s.best_finish, lowerBetter: true, tip: "Miglior piazzamento ottenuto in gara (1 = vittoria)." },
    { icon: Gauge,       label: "Arrivo medio",         get: (_, s) => s.avg_finish, lowerBetter: true, tip: "Posizione media al traguardo: più bassa è meglio." },
    { icon: ShieldAlert, label: "Ritiri (DNF)",         get: (_, s) => s.dnf ?? 0, lowerBetter: true, tip: "DNF = Did Not Finish: gare non concluse (ritiri)." },
  ];

  const careerRows = [
    { icon: Crown,   label: "Titoli mondiali", get: (d) => d.career?.titles ?? 0 },
    { icon: Trophy,  label: "Vittorie",        get: (d) => d.career?.wins ?? 0 },
    { icon: Medal,   label: "Podi",            get: (d) => d.career?.podiums ?? 0 },
    { icon: Target,  label: "Pole position",   get: (d) => d.career?.poles ?? 0 },
    { icon: Timer,   label: "Giri veloci",     get: (d) => d.career?.fastest_laps ?? 0 },
    { icon: Zap,     label: "Punti carriera",  get: (d) => d.career?.points ?? 0 },
    { icon: Flag,    label: "Gare disputate",  get: (d) => d.career?.starts ?? 0 },
    { icon: Star,    label: "Miglior arrivo",  get: (d) => d.career?.best_finish, lowerBetter: true },
  ];

  const rows = mode === "season" ? seasonRows : careerRows;

  // Head-to-head tally
  const h2h = useMemo(() => {
    if (!d1 || !d2) return { w1: 0, w2: 0 };
    let w1 = 0, w2 = 0;
    rows.forEach(r => {
      const w = cmp(r.get(d1, s1), r.get(d2, s2), r.lowerBetter);
      if (w === 1) w1++; else if (w === 2) w2++;
    });
    return { w1, w2 };
  }, [d1, d2, s1, s2, mode]); // eslint-disable-line

  const lead = h2h.w1 > h2h.w2 ? 1 : h2h.w2 > h2h.w1 ? 2 : 0;

  const swap = () => { setId1(id2); setId2(id1); };
  const shuffle = () => {
    if (drivers.length < 2) return;
    const i = Math.floor(Math.random() * drivers.length);
    let j = Math.floor(Math.random() * drivers.length);
    while (j === i) j = Math.floor(Math.random() * drivers.length);
    setId1(drivers[i].id); setId2(drivers[j].id);
  };
  const share = () => {
    if (!d1 || !d2) return;
    const winner = lead === 1 ? d1.driver_name : lead === 2 ? d2.driver_name : "Pareggio";
    const text = `🏎️ ${d1.driver_name} vs ${d2.driver_name} — ${mode === "season" ? "Stagione" : "Carriera"}: ${h2h.w1}–${h2h.w2} (${winner})`;
    if (navigator.share) navigator.share({ title: "Confronto F1", text });
    else { navigator.clipboard.writeText(text); alert("📋 Copiato negli appunti!"); }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-100 to-gray-200">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 pb-4">
      <PageHeader icon={GitCompare} title="Confronta" right={
        <>
          <button onClick={shuffle} title="Pescaggio casuale"
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-muted-foreground border border-gray-200 active:scale-95 transition-transform">
            <Shuffle className="w-4 h-4" />
          </button>
          {d1 && d2 && (
            <button onClick={share} title="Condividi"
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-muted-foreground border border-gray-200 active:scale-95 transition-transform">
              <Share2 className="w-4 h-4" />
            </button>
          )}
        </>
      } />

      <div className="px-4 py-5 space-y-4">
        {/* ── SELECTORS + swap ── */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
          <DriverSelect label="Pilota 1" value={id1} onChange={setId1} color={c1} d={d1}
            options={drivers.filter(x => x.id !== id2)} />
          <button onClick={swap} disabled={!id1 && !id2} title="Scambia"
            className="mb-3 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-primary disabled:opacity-30 active:scale-90 transition-transform">
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <DriverSelect label="Pilota 2" value={id2} onChange={setId2} color={c2} d={d2}
            options={drivers.filter(x => x.id !== id1)} />
        </div>

        {d1 && d2 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* ── VS HERO ── */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
              <DriverPanel d={d1} color={c1} lead={lead === 1} />
              <span className="font-heading font-black text-xs text-gray-400 bg-white border border-gray-200 rounded-full w-9 h-9 flex items-center justify-center shadow-sm">
                VS
              </span>
              <DriverPanel d={d2} color={c2} lead={lead === 2} />
            </div>

            {/* ── HEAD-TO-HEAD banner ── */}
            <div className="bg-white rounded-2xl p-3 shadow-md border border-gray-100">
              <div className="flex items-center justify-between">
                <span className="font-heading font-black text-2xl tabular-nums"
                      style={{ color: lead === 1 ? c1 : "#9ca3af" }}>{h2h.w1}</span>
                <div className="text-center">
                  <p className="font-body text-[9px] text-muted-foreground uppercase tracking-widest">Testa a testa</p>
                  <p className="font-heading font-black text-xs text-gray-700">
                    {lead === 0 ? "In equilibrio" : `${(lead === 1 ? d1 : d2).driver_name} avanti`}
                  </p>
                </div>
                <span className="font-heading font-black text-2xl tabular-nums"
                      style={{ color: lead === 2 ? c2 : "#9ca3af" }}>{h2h.w2}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden mt-2 bg-gray-100">
                <div style={{ width: `${(h2h.w1 / Math.max(h2h.w1 + h2h.w2, 1)) * 100}%`, backgroundColor: c1 }} />
                <div style={{ width: `${(h2h.w2 / Math.max(h2h.w1 + h2h.w2, 1)) * 100}%`, backgroundColor: c2 }} />
              </div>
            </div>

            {/* ── MODE toggle ── */}
            <div className="grid grid-cols-2 gap-1 bg-gray-200/70 p-1 rounded-xl">
              {[
                { k: "season", label: "Stagione" },
                { k: "career", label: "Carriera" },
              ].map(m => (
                <button key={m.k} onClick={() => setMode(m.k)}
                  className={`py-2 rounded-lg font-heading font-bold text-sm uppercase tracking-wide transition-all
                    ${mode === m.k ? "bg-white shadow-sm text-primary" : "text-gray-500"}`}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* ── STAT ROWS ── */}
            <AnimatePresence mode="wait">
              <motion.div key={mode}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
                {rows.map(r => (
                  <StatRow key={r.label} icon={r.icon} label={r.label} tip={r.tip}
                    val1={r.get(d1, s1)} val2={r.get(d2, s2)}
                    color1={c1} color2={c2} lowerBetter={r.lowerBetter} />
                ))}
              </motion.div>
            </AnimatePresence>

            <p className="text-[10px] text-muted-foreground text-center font-body">
              {mode === "season"
                ? "Statistiche della stagione in corso"
                : "Statistiche di carriera (tutte le stagioni)"}
            </p>
          </motion.div>
        )}

        {/* ── EMPTY STATE ── */}
        {(!d1 || !d2) && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 flex flex-col items-center gap-3">
              <Users className="w-10 h-10 text-gray-300" />
              <p className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wide">
                Seleziona due piloti
              </p>
              <button onClick={shuffle}
                className="flex items-center gap-1.5 text-xs font-heading font-bold text-primary border border-primary/30 rounded-full px-3 py-1.5 active:scale-95 transition-transform">
                <Shuffle className="w-3.5 h-3.5" /> Pescaggio casuale
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
