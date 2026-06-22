import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import { flagUrl } from "@/lib/flagUtils";

export default function SeasonMapModal({ races = [], open, onClose }) {
  const { t } = useI18n();
  const nextRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Scroll to next race when modal opens
  useEffect(() => {
    if (open && nextRef.current) {
      setTimeout(() => nextRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    }
  }, [open]);

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
          className="fixed inset-0 z-[200] flex flex-col bg-background"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#E8002D] to-[#C20028] px-4 pt-safe-top shrink-0"
               style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
            <div className="flex items-center justify-between py-3">
              <div>
                <h2 className="font-heading font-black text-white text-lg uppercase tracking-wide leading-none">
                  {t("map_title")}
                </h2>
                <p className="text-white/70 text-[11px] font-body mt-0.5">
                  {completed}/{races.length} {t("map_past").toLowerCase()}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white active:scale-95 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-white/20 rounded-full mb-3 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${races.length ? (completed / races.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Race list */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3 space-y-2">
              {races.map((race) => {
                const isNext = race.id === next?.id;
                return (
                  <motion.div
                    key={race.id}
                    ref={isNext ? nextRef : null}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: race.round * 0.02 }}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl border transition-colors
                      ${isNext
                        ? "border-primary/30 bg-primary/5"
                        : race.isPast
                          ? "border-gray-100 bg-gray-50 opacity-60"
                          : "border-gray-100 bg-card"
                      }`}
                  >
                    {/* Round number */}
                    <span className={`font-heading font-black text-xs w-5 text-center shrink-0
                      ${isNext ? "text-primary" : "text-muted-foreground"}`}>
                      {race.round}
                    </span>

                    {/* Flag */}
                    {race.countryIso ? (
                      <img
                        src={flagUrl(race.countryIso.toLowerCase(), "h40")}
                        alt={race.name}
                        className="h-5 w-auto object-cover rounded-[3px] shrink-0"
                        style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.12)" }}
                        onError={e => { e.target.style.display = "none"; }}
                      />
                    ) : (
                      <span className="text-base shrink-0">🏁</span>
                    )}

                    {/* Name + date */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-heading font-black text-sm leading-tight truncate
                        ${isNext ? "text-primary" : race.isPast ? "text-muted-foreground" : "text-foreground"}`}>
                        {race.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-body mt-0.5">
                        {format(new Date(race.date), "d MMM yyyy")}
                      </p>
                    </div>

                    {/* Tags / status */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {race.hasSprint && (
                        <span className="tag bg-amber-100 text-amber-700 text-[9px]">Sprint</span>
                      )}
                      {isNext && (
                        <span className="tag bg-primary/10 text-primary text-[9px]">{t("map_next")}</span>
                      )}
                      {race.isPast
                        ? <CheckCircle2 className="w-4 h-4 text-muted-foreground/50" />
                        : isNext
                          ? <ChevronRight className="w-4 h-4 text-primary" />
                          : <Circle className="w-4 h-4 text-muted-foreground/30" />
                      }
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
