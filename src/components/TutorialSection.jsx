import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useBackHandler } from "@/lib/backStack";

/**
 * Header button that opens the page's tutorial steps in a bottom sheet.
 * Goes in PageHeader's `right` slot, so the steps no longer sit as a banner at
 * the top of every tab pushing the content down.
 *
 *   <PageHeader ... right={<TutorialSection items={["tut_home_1", "tut_home_2"]} />} />
 *
 * `items` are i18n keys, not text.
 */
export default function TutorialSection({ items }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  useBackHandler(open, () => setOpen(false));

  if (!items?.length) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("tut_title")}
        title={t("tut_title")}
        className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-primary border border-gray-200 active:scale-95 transition-transform shrink-0"
      >
        <GraduationCap className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-end justify-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="bg-card w-full max-w-md rounded-t-3xl p-6 shadow-2xl safe-bottom"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-primary shrink-0" />
                <h3 className="font-heading font-black text-lg uppercase tracking-wide flex-1 text-foreground">
                  {t("tut_title")}
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  aria-label={t("close")}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-3">
                {items.map((key, i) => (
                  <li key={key} className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-heading font-black text-xs flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm text-muted-foreground font-body leading-snug pt-0.5">
                      {t(key)}
                    </span>
                  </li>
                ))}
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
