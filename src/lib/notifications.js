// ─── LOCAL RACE REMINDERS ─────────────────────────────────────────────────────
// On-device notifications (no server) that fire ONE DAY before a session, per
// session (qualifying / sprint / race can be toggled independently).
// Everything is guarded so it is a safe no-op on the web build.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Stores the enabled session keys as a JSON array, e.g. ["quali","race"].
const STORAGE_KEY = 'gridup_reminders';
// Notifications fire this long before each session.
const LEAD_MS = 24 * 60 * 60 * 1000; // 1 day
// Sessions that can have a reminder (skip free practice — too noisy).
const REMINDABLE = ['quali', 'sprint', 'race'];
// Stable per-session notification ids so re-scheduling replaces, never duplicates.
const SESSION_ID = { quali: 8101, sprint: 8102, race: 8103 };

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

// Build the "1 day before" notification for a session, or null if that instant
// is already in the past (event is less than a day away).
function notifFor(session, gpName, t) {
  if (!session?.iso) return null;
  const when = new Date(session.iso).getTime() - LEAD_MS;
  if (when <= Date.now()) return null;
  const time = new Date(session.iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return {
    id: SESSION_ID[session.key],
    title: t('notif_reminder_title', { gp: gpName || 'F1' }),
    body:  t('notif_reminder_body', { time, session: t(`sess_${session.key}`) }),
    schedule: { at: new Date(when), allowWhileIdle: true },
  };
}

async function cancelSession(key) {
  try { await LocalNotifications.cancel({ notifications: [{ id: SESSION_ID[key] }] }); }
  catch { /* ignore */ }
}

// Toggle a single session's reminder. Returns:
//   'on' | 'off' | 'denied' | 'unsupported'
// ('on' is returned even when the event is <1 day away: the choice is saved and
//  will apply to the next weekend via syncReminders, it just isn't scheduled now.)
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

  const notif = notifFor(session, gpName, t);
  if (notif) {
    try { await LocalNotifications.schedule({ notifications: [notif] }); }
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
    const n = byKey[key] && notifFor(byKey[key], gpName, t);
    if (n) notifs.push(n);
  }

  try {
    await LocalNotifications.cancel({ notifications: enabled.map(k => ({ id: SESSION_ID[k] })) });
    if (notifs.length) await LocalNotifications.schedule({ notifications: notifs });
  } catch { /* ignore */ }
}
