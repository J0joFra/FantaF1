import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Circle, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { flagUrl, gpIso } from "@/lib/flagUtils";

// "Formula 1 Qatar Airways Australian Grand Prix 2026" → "Australian Grand Prix"
function shortName(official) {
  const m = official.match(/([A-Z][a-záàäâãåæçéèëêíìïîóòöôõøúùüûýÿñ\s-]+Grand Prix(?:\s+de\s+\S+)?)/u);
  if (m) return m[1].trim();
  return official.replace(/^Formula 1\s+/i, "").replace(/\s+\d{4}$/, "").trim();
}

function formatRaceDate(dateStr) {
  if (!dateStr) return "";
  // Parse YYYY-MM-DD safely (avoid timezone shifts)
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  return `${d} ${months[m - 1]} ${y}`;
}

export default function SeasonCalendarModal({ races = [], error, open, onClose }) {
  const { t } = useI18n();
  const nextRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && nextRef.current) {
      setTimeout(() => nextRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
    }
  }, [open, races]);

  const completed = races.filter(r => r.isPast).length;
  const next = races.find(r => !r.isPast);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 320 }}
          className="fixed inset-0 z-[200] flex flex-col bg-background max-w-[430px] mx-auto"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#E8002D] to-[#C20028] px-4 shrink-0"
               style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 12px)" }}>
            <div className="flex items-center justify-between py-3">
              <div>
                <h2 className="font-heading font-black text-white text-lg uppercase tracking-wide leading-none">
                  {t("map_title")}
                </h2>
                <p className="text-white/70 text-[11px] font-body mt-0.5">
                  {races.length > 0 ? `${completed} / ${races.length} GP` : "Caricamento…"}
                </p>
              </div>
              <button onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white active:scale-95 transition-transform">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Progress bar */}
            <div className="h-1 bg-white/20 rounded-full mb-3 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-700"
                   style={{ width: races.length ? `${(completed / races.length) * 100}%` : "0%" }} />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* Error state */}
            {error && (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
                <AlertTriangle className="w-10 h-10 text-red-400" />
                <p className="font-heading font-black text-base text-foreground">Errore caricamento</p>
                <p className="text-xs text-muted-foreground font-body">{error.message}</p>
              </div>
            )}

            {/* Empty + no error = loading */}
            {!error && races.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-body">Caricamento calendario…</p>
              </div>
            )}

            {/* Race list */}
            {races.length > 0 && (
              <div className="px-4 py-3 space-y-2 pb-8">
                {races.map((race, i) => {
                  const isNext = race.id === next?.id;
                  const label = shortName(race.name);
                  const iso = gpIso(race.name);
                  const flagSrc = iso ? flagUrl(iso, "h40") : null;

                  return (
                    <motion.div
                      key={race.id}
                      ref={isNext ? nextRef : null}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.015 }}
                      className={`flex items-center gap-3 px-3 py-3 rounded-2xl border
                        ${isNext
                          ? "border-primary/30 bg-primary/5"
                          : race.isPast
                            ? "border-gray-100 bg-gray-50 opacity-55"
                            : "border-gray-100 bg-card"
                        }`}
                    >
                      {/* Round */}
                      <span className={`font-mono text-[11px] font-bold w-5 text-center shrink-0
                        ${isNext ? "text-primary" : "text-muted-foreground"}`}>
                        {race.round}
                      </span>

                      {/* Flag */}
                      {flagSrc ? (
                        <img src={flagSrc} alt="" className="w-7 h-5 object-cover rounded-[3px] shrink-0"
                             style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.12)" }}
                             onError={e => { e.target.style.display = "none"; }} />
                      ) : (
                        <span className="w-7 h-5 flex items-center justify-center text-sm shrink-0">🏁</span>
                      )}

                      {/* Name + date */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-heading font-black text-sm leading-tight truncate
                          ${isNext ? "text-primary" : race.isPast ? "text-muted-foreground" : "text-foreground"}`}>
                          {label}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                          {formatRaceDate(race.date)}
                        </p>
                      </div>

                      {/* Sprint tag + status icon */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {race.hasSprint && (
                          <span className="tag bg-amber-100 text-amber-700 text-[9px]">Sprint</span>
                        )}
                        {isNext
                          ? <ChevronRight className="w-4 h-4 text-primary" />
                          : race.isPast
                            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                            : <Circle className="w-3.5 h-3.5 text-muted-foreground/25" />
                        }
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
