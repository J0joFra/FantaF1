// ─── FAVOURITE DRIVER RACE REMINDER ───────────────────────────────────────────
// One managed reminder tied to the "pilota del cuore": fires the day before and
// ~1 hour before the next race, naming the driver. Separate from the per-session
// reminders. Safe no-op on the web build.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const PREF = 'gridup_fav_reminder';
const ID_DAY = 8201;
const ID_HOUR = 8211;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function favReminderSupported() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');
  } catch { return false; }
}

export function isFavReminderOn() {
  try { return localStorage.getItem(PREF) === '1'; } catch { return false; }
}
function setPref(on) {
  try { on ? localStorage.setItem(PREF, '1') : localStorage.removeItem(PREF); } catch { /* ignore */ }
}

async function ensurePermission() {
  const cur = await LocalNotifications.checkPermissions();
  if (cur.display === 'granted') return true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === 'granted';
}

async function cancelAll() {
  try { await LocalNotifications.cancel({ notifications: [{ id: ID_DAY }, { id: ID_HOUR }] }); }
  catch { /* ignore */ }
}

function build(raceIso, gpName, driverName, t) {
  if (!raceIso || !driverName) return [];
  const start = new Date(raceIso).getTime();
  if (!start) return [];
  const time = new Date(raceIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const title = t('notif_fav_title', { driver: driverName });
  const out = [];
  const dayAt = start - DAY_MS;
  if (dayAt > Date.now()) {
    out.push({ id: ID_DAY, title,
      body: t('notif_fav_day', { driver: driverName, gp: gpName || 'F1', time }),
      schedule: { at: new Date(dayAt), allowWhileIdle: true } });
  }
  const hourAt = start - HOUR_MS;
  if (hourAt > Date.now()) {
    out.push({ id: ID_HOUR, title,
      body: t('notif_fav_soon', { driver: driverName, gp: gpName || 'F1', time }),
      schedule: { at: new Date(hourAt), allowWhileIdle: true } });
  }
  return out;
}

// Re-align the reminder with the current favourite + next race. Call on mount
// and whenever the favourite / next race / language changes. Never prompts: a
// passive sync only (re)schedules when permission is already granted.
export async function syncFavReminder(raceIso, gpName, driverName, t) {
  if (!favReminderSupported()) return;
  await cancelAll();
  if (!isFavReminderOn() || !driverName || !raceIso) return;
  try {
    const cur = await LocalNotifications.checkPermissions();
    if (cur.display !== 'granted') return;
  } catch { return; }
  const notifs = build(raceIso, gpName, driverName, t);
  if (notifs.length) { try { await LocalNotifications.schedule({ notifications: notifs }); } catch { /* ignore */ } }
}

// Toggle from the UI (the tap is the consent moment → may prompt for permission).
// Returns 'on' | 'off' | 'denied' | 'unsupported'.
export async function toggleFavReminder(raceIso, gpName, driverName, t) {
  if (!favReminderSupported()) return 'unsupported';
  if (isFavReminderOn()) {
    setPref(false);
    await cancelAll();
    return 'off';
  }
  const granted = await ensurePermission();
  if (!granted) return 'denied';
  setPref(true);
  const notifs = build(raceIso, gpName, driverName, t);
  if (notifs.length) { try { await LocalNotifications.schedule({ notifications: notifs }); } catch { /* ignore */ } }
  return 'on';
}
