import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Calculator, GitCompare, X, Globe } from "lucide-react";
import { useI18n, LANGS } from "@/lib/i18n";

const STORAGE_KEY = "gridup_onboarded_v1";

// Selettore lingua compatto per il banner rosso
function LangPicker() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  const current = LANGS.find(l => l.code === lang) || LANGS[0];
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Lingua / Language"
        className="h-8 px-2.5 rounded-full bg-white/15 border border-white/25 text-white flex items-center gap-1 text-sm active:scale-95 transition-transform"
      >
        <Globe className="w-4 h-4" />
        <span className="leading-none">{current.flag}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-20 w-36 rounded-xl bg-white text-gray-800 border border-gray-200 shadow-xl overflow-hidden">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors
                ${l.code === lang ? "font-bold text-primary" : "text-gray-700"}`}
            >
              <span className="text-base">{l.flag}</span>{l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SLIDES = [
  { icon: Trophy,     t: "ob1_t", d: "ob1_d" },
  { icon: Calculator, t: "ob2_t", d: "ob2_d" },
  { icon: GitCompare, t: "ob3_t", d: "ob3_d" },
];

export default function Onboarding() {
  const { t } = useI18n();
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem(STORAGE_KEY); } catch { return false; }
  });
  const [step, setStep] = useState(0);

  if (!open) return null;

  const last = step === SLIDES.length - 1;
  const S = SLIDES[step];
  const Icon = S.icon;

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-[400px] bg-card text-card-foreground rounded-3xl shadow-2xl"
      >
        {/* Banner rosso con icona */}
        <div className="relative bg-gradient-to-r from-[#E8002D] to-[#C20028] rounded-t-3xl px-6 pt-8 pb-9 text-center">
          <div className="absolute top-3 left-3">
            <LangPicker />
          </div>
          <button
            onClick={close}
            aria-label={t("ob_skip")}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 border border-white/25 text-white flex items-center justify-center active:scale-90 transition-transform"
          >
            <X className="w-4 h-4" />
          </button>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-16 h-16 mx-auto rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center"
            >
              <Icon className="w-8 h-8 text-white" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Testo */}
        <div className="px-6 py-6 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="font-heading font-black text-xl">{t(S.t)}</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-snug min-h-[3.5rem]">{t(S.d)}</p>
            </motion.div>
          </AnimatePresence>

          {/* Indicatori */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-5 bg-primary" : "w-1.5 bg-muted"}`}
              />
            ))}
          </div>

          {/* Azioni */}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={close}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              {t("ob_skip")}
            </button>
            <button
              onClick={() => (last ? close() : setStep(s => s + 1))}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-primary active:scale-95 transition-transform shadow-sm"
            >
              {last ? t("ob_start") : t("ob_next")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
