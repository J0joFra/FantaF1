import { motion } from "framer-motion";
import { WrenchIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ErrorScreen({ onRetry }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-3">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-[400px] bg-card text-card-foreground rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Banner rosso */}
        <div className="bg-gradient-to-r from-[#E8002D] to-[#C20028] px-6 pt-8 pb-9 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
            <WrenchIcon className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Testo */}
        <div className="px-6 py-6 text-center">
          <h2 className="font-heading font-black text-xl">{t("err_title")}</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-snug min-h-[3.5rem]">
            {t("err_msg")}
          </p>
          <div className="mt-5">
            <button
              onClick={onRetry}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-primary active:scale-95 transition-transform shadow-sm"
            >
              {t("err_retry")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
