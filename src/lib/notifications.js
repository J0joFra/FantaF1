// ─── LOCAL RACE REMINDERS ─────────────────────────────────────────────────────
// On-device notifications (no server) that fire the DAY BEFORE and 1 HOUR BEFORE
// a session, per session (qualifying / sprint / race can be toggled independently).
// Everything is guarded so it is a safe no-op on the web build.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Stores the enabled session keys as a JSON array, e.g. ["quali","race"].
const STORAGE_KEY = 'gridup_reminders';
// Notifications fire at these lead times before each session.
const DAY_LEAD_MS  = 24 * 60 * 60 * 1000; // 1 day before
const HOUR_LEAD_MS = 60 * 60 * 1000;      // 1 hour before
// Sessions that can have a reminder (skip free practice — too noisy).
const REMINDABLE = ['quali', 'sprint', 'race'];
// Stable per-session notification ids so re-scheduling replaces, never duplicates.
// One id for the day-before reminder, one for the 1-hour-before reminder.
const SESSION_ID    = { quali: 8101, sprint: 8102, race: 8103 };
const SESSION_ID_1H = { quali: 8111, sprint: 8112, race: 8113 };
const idsFor = (key) => [{ id: SESSION_ID[key] }, { id: SESSION_ID_1H[key] }];

export function notificationsSupported() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');
  } catch {
    return false;
  }
}

// ── Persistence (a set of enabled session keys) ───────────────────────────────
function readEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    if (raw === '1') return [...REMINDABLE]; // migrate old boolean-on value
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(k => REMINDABLE.includes(k)) : [];
  } catch {
    return [];
  }
}

function writeEnabled(keys) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(keys)); } catch { /* ignore */ }
}

export function getEnabledReminders() { return readEnabled(); }
export function isReminderOn(key) { return readEnabled().includes(key); }

// ── Permission ────────────────────────────────────────────────────────────────
async function ensurePermission() {
  const cur = await LocalNotifications.checkPermissions();
  if (cur.display === 'granted') return true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === 'granted';
}

// Build the reminders for a session: one a day before and one an hour before.
// Skips any lead time already in the past.
function notifsFor(session, gpName, t) {
  if (!session?.iso) return [];
  const start = new Date(session.iso).getTime();
  const time = new Date(session.iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sess = t(`sess_${session.key}`);
  const title = t('notif_reminder_title', { gp: gpName || 'F1' });
  const out = [];
  const dayAt = start - DAY_LEAD_MS;
  if (dayAt > Date.now()) {
    out.push({ id: SESSION_ID[session.key], title,
      body: t('notif_reminder_body', { time, session: sess }),
      schedule: { at: new Date(dayAt), allowWhileIdle: true } });
  }
  const hourAt = start - HOUR_LEAD_MS;
  if (hourAt > Date.now()) {
    out.push({ id: SESSION_ID_1H[session.key], title,
      body: t('notif_reminder_soon_body', { time, session: sess }),
      schedule: { at: new Date(hourAt), allowWhileIdle: true } });
  }
  return out;
}

async function cancelSession(key) {
  try { await LocalNotifications.cancel({ notifications: idsFor(key) }); }
  catch { /* ignore */ }
}

// Toggle a single session's reminder. Returns:
//   'on' | 'off' | 'denied' | 'unsupported'
// ('on' is returned even when both lead times are already past: the choice is
//  saved and applies to the next weekend via syncReminders.)
export async function toggleReminder(key, session, gpName, t) {
  if (!notificationsSupported()) return 'unsupported';
  const enabled = readEnabled();

  if (enabled.includes(key)) {
    await cancelSession(key);
    writeEnabled(enabled.filter(k => k !== key));
    return 'off';
  }

  const granted = await ensurePermission();
  if (!granted) return 'denied';

  const notifs = notifsFor(session, gpName, t);
  if (notifs.length) {
    try { await LocalNotifications.schedule({ notifications: notifs }); }
    catch { /* ignore */ }
  }
  writeEnabled([...enabled, key]);
  return 'on';
}

// Re-align all enabled reminders with the latest session data (call on mount).
export async function syncReminders(sessions, gpName, t) {
  if (!notificationsSupported()) return;
  const enabled = readEnabled();
  if (!enabled.length) return;

  const byKey = {};
  (sessions || []).forEach(s => { byKey[s.key] = s; });

  const notifs = [];
  for (const key of enabled) {
    if (byKey[key]) notifs.push(...notifsFor(byKey[key], gpName, t));
  }

  try {
    await LocalNotifications.cancel({ notifications: enabled.flatMap(idsFor) });
    if (notifs.length) await LocalNotifications.schedule({ notifications: notifs });
  } catch { /* ignore */ }
}
