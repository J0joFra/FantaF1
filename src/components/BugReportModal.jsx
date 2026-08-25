import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// URL del Google Apps Script Web App (vedi istruzioni di deploy).
// Va impostata come variabile d'ambiente Vite in fase di build.
const WEBHOOK_URL = import.meta.env.VITE_BUG_REPORT_WEBHOOK_URL;

export default function BugReportModal({ open, onClose }) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | success | error

  function handleClose() {
    if (status === "sending") return;
    onClose();
    // reset dopo la chiusura (piccolo delay per non far "sfarfallare" l'animazione)
    setTimeout(() => { setMessage(""); setStatus("idle"); }, 300);
  }

  async function handleSubmit() {
    if (!message.trim()) { setStatus("empty"); return; }
    if (!WEBHOOK_URL) {
      console.error("VITE_BUG_REPORT_WEBHOOK_URL non configurata");
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        // niente header custom: evita la preflight CORS, l'Apps Script legge comunque il body
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          message: message.trim(),
          page: window.location.pathname,
          appVersion: import.meta.env.VITE_APP_VERSION || "",
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });
      setStatus("success");
      setTimeout(handleClose, 1400);
    } catch (err) {
      console.error("Bug report send failed", err);
      setStatus("error");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl bg-background shadow-xl max-w-[430px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#E8002D] to-[#C20028] px-4"
                 style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 14px)" }}>
              <div className="flex items-center justify-between py-3">
                <h2 className="font-heading font-black text-white text-lg uppercase tracking-wide leading-none">
                  {t("bug_report_title")}
                </h2>
                <button onClick={handleClose}
                  className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white active:scale-95 transition-transform">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {status === "success" ? (
                <div className="flex flex-col items-center justify-center text-center gap-2 py-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  <p className="font-body text-sm text-foreground">{t("bug_report_success")}</p>
                </div>
              ) : (
                <>
                  <p className="font-body text-xs text-muted-foreground leading-snug">
                    {t("bug_report_subtitle")}
                  </p>
                  <textarea
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); if (status !== "sending") setStatus("idle"); }}
                    placeholder={t("bug_report_placeholder")}
                    rows={5}
                    disabled={status === "sending"}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-body
                               text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-[#E8002D]/40"
                  />

                  {status === "empty" && (
                    <p className="text-xs text-amber-600 font-body flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {t("bug_report_empty")}
                    </p>
                  )}
                  {status === "error" && (
                    <p className="text-xs text-red-600 font-body flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {t("bug_report_error")}
                    </p>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={status === "sending"}
                    className="w-full rounded-xl bg-[#E8002D] text-white font-heading font-bold text-sm py-3
                               flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
                  >
                    {status === "sending"
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("bug_report_sending")}</>
                      : <><Send className="w-4 h-4" /> {t("bug_report_send")}</>}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}