// ─── PROMEMORIA «PILOTA DEL GIORNO» ──────────────────────────────────────────
// Una notifica locale al giorno (nessun server), alle 10:00 ora del telefono.
//
// Non è una notifica ripetuta con testo fisso: ogni giorno ha il suo numero
// (#12, #13…) e, se c'è una serie in corso, la ricorda. Per questo se ne
// programmano DAYS_AHEAD alla volta, una per giorno, e si riallineano a ogni
// apertura dell'app e a ogni partita finita: chi ha già giocato oggi non
// riceve quella di oggi. Se l'app non viene aperta per DAYS_AHEAD giorni le
// notifiche finiscono, ed è giusto così: non si insiste con chi ha smesso.
//
// Tutto è un no-op sul web.
import { LocalNotifications } from '@capacitor/local-notifications';
import { notificationsSupported } from '@/lib/notifications';
import { dayNumber, liveStreak, playedToday } from '@/lib/driverGame';

const STORAGE_KEY = 'gridup_daily_reminder';
const HOUR = 10;
const DAYS_AHEAD = 14;
// Id stabili, lontani da quelli dei promemoria gara (8101–8103).
const BASE_ID = 8200;
const ALL_IDS = Array.from({ length: DAYS_AHEAD }, (_, k) => ({ id: BASE_ID + k }));

export function dailyReminderSupported() {
  return notificationsSupported();
}

export function isDailyReminderOn() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function buildNotifications(t) {
  const now = new Date();
  const today = dayNumber(now);
  const streak = liveStreak();
  const skipToday = playedToday();
  const out = [];

  for (let k = 0; k < DAYS_AHEAD; k++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, HOUR, 0, 0);
    if (at <= now || (k === 0 && skipToday)) continue;
    // La serie si può ancora salvare solo oggi o domani: più avanti è già persa.
    const atRisk = streak > 0 && k <= 1;
    out.push({
      id: BASE_ID + k,
      title: t('notif_daily_title', { n: today + k }),
      body: atRisk ? t('notif_daily_streak', { n: streak }) : t('notif_daily_body'),
      schedule: { at, allowWhileIdle: true },
    });
  }
  return out;
}

/** Riprogramma le notifiche dei prossimi giorni (all'avvio e a fine partita). */
export async function syncDailyReminder(t) {
  if (!dailyReminderSupported() || !isDailyReminderOn()) return;
  try {
    await LocalNotifications.cancel({ notifications: ALL_IDS });
    const notifications = buildNotifications(t);
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch { /* ignore */ }
}

/** Accende/spegne il promemoria. Restituisce 'on' | 'off' | 'denied' | 'unsupported'. */
export async function toggleDailyReminder(t) {
  if (!dailyReminderSupported()) return 'unsupported';

  if (isDailyReminderOn()) {
    try { localStorage.setItem(STORAGE_KEY, '0'); } catch { /* ignore */ }
    try { await LocalNotifications.cancel({ notifications: ALL_IDS }); } catch { /* ignore */ }
    return 'off';
  }

  let granted = false;
  try {
    const cur = await LocalNotifications.checkPermissions();
    granted = cur.display === 'granted'
      || (await LocalNotifications.requestPermissions()).display === 'granted';
  } catch { /* ignore */ }
  if (!granted) return 'denied';

  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
  await syncDailyReminder(t);
  return 'on';
}
