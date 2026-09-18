import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Tendina "Tutorial" in fondo a una pagina: chiusa di default, occupa una riga
 * sola finché non serve, e spiega a passi cosa si può fare lì.
 *
 *   <TutorialSection items={["tut_home_1", "tut_home_2"]} />
 *
 * `items` sono chiavi i18n, non testo: la traduzione la fa il componente, così
 * ogni pagina dichiara solo il proprio elenco di passi.
 */
export default function TutorialSection({ items }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (!items?.length) return null;

  return (
    <div className="app-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 text-left active:scale-[0.99] transition-transform"
      >
        <GraduationCap className="w-4 h-4 text-primary shrink-0" />
        <span className="font-heading font-black text-sm uppercase tracking-wide flex-1 text-foreground">
          {t("tut_title")}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <ol className="px-4 pb-4 pt-3 space-y-2.5 border-t border-border">
              {items.map((key, i) => (
                <li key={key} className="flex gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary font-heading font-black text-[11px] flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-[13px] text-muted-foreground font-body leading-snug">
                    {t(key)}
                  </span>
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
