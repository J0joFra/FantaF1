import { useState, useEffect } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  notificationsSupported, getRemindersEnabled,
  enableRaceReminders, disableRaceReminders,
} from "@/lib/notifications";
import {
  webPushSupported, webPushEnabled,
  subscribeWebPush, unsubscribeWebPush,
} from "@/lib/webpush";

// Toggle that schedules race-session reminders.
//  • Native build (Capacitor): on-device local notifications, scheduled from `sessions`.
//  • Web build: Web Push — a scheduled Supabase Edge Function sends the reminder,
//    so it works even when the tab is closed.
// Renders nothing when neither channel is available.
export default function RaceReminderToggle({ sessions, gpName }) {
  const { t } = useI18n();
  const native = notificationsSupported();
  const web = !native && webPushSupported();
  const available = native || web;

  const [on, setOn] = useState(() =>
    native ? getRemindersEnabled() : web ? webPushEnabled() : false
  );
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  // Native only: keep on-device reminders aligned with the latest session data.
  useEffect(() => {
    if (native && on && sessions?.length) {
      enableRaceReminders(sessions, gpName, t).catch(() => {});
    }
  }, [sessions, gpName]);

  if (!available) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setHint("");
    try {
      if (on) {
        if (native) await disableRaceReminders();
        else await unsubscribeWebPush();
        setOn(false);
      } else if (native) {
        const res = await enableRaceReminders(sessions, gpName, t);
        if (res === "denied") setHint(t("rem_denied"));
        else { setOn(true); if (res === "empty") setHint(t("rem_empty")); }
      } else {
        const res = await subscribeWebPush();
        if (res === "ok") setOn(true);
        else if (res === "denied") setHint(t("rem_denied"));
        else if (res === "unconfigured") setHint(t("rem_unconfigured"));
        else setHint(t("rem_error"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-card px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
        ${on ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"}`}>
        {on ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading font-black text-sm uppercase tracking-wide leading-none">
          {t("rem_title")}
        </p>
        <p className="text-[11px] text-muted-foreground font-body mt-1 leading-snug">
          {hint || t("rem_desc")}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        className={`shrink-0 h-8 px-3 rounded-full text-xs font-heading font-bold uppercase tracking-wide
          flex items-center gap-1.5 transition-colors active:scale-95
          ${on ? "bg-primary text-white" : "bg-gray-100 text-gray-600 border border-gray-200"}`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {on ? t("rem_on") : t("rem_off")}
      </button>
    </div>
  );
}
