import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Slim bar shown only while the device is offline. Uses the standard browser
// online/offline events, which also fire inside the Capacitor WebView, so no
// extra native plugin is needed.
export default function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(() => {
    try { return typeof navigator !== "undefined" && navigator.onLine === false; }
    catch { return false; }
  });

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed top-0 left-1/2 -translate-x-1/2 app-column z-[70] safe-top
                     bg-gray-900 text-white shadow-lg"
          role="status"
        >
          <div className="flex items-center justify-center gap-2 px-4 py-1.5">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px] font-body font-semibold">{t("offline_msg")}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
