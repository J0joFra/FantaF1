import { useState } from "react";
import { Bug } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import BugReportModal from "@/components/BugReportModal";

export default function BugReportButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t("bug_report_title")}
        aria-label={t("bug_report_title")}
        className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center
                   text-white shrink-0 active:scale-95 transition-transform"
      >
        <Bug className="w-4 h-4" />
      </button>
      <BugReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}