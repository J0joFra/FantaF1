// ─── LOCAL RACE REMINDERS ─────────────────────────────────────────────────────
// Schedules on-device notifications (no server) before qualifying, the sprint and
// the race, using the session times already fetched for the next Grand Prix.
// Everything is guarded so it is a safe no-op on the web build.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const STORAGE_KEY = 'gridup_reminders';
// Notifications fire this many minutes before each session.
const LEAD_MINUTES = 60;
// Only these sessions get a reminder (skip free practice — too noisy).
const REMINDED_SESSIONS = ['quali', 'sprint', 'race'];
// Stable per-session notification ids so re-scheduling replaces, never duplicates.
const SESSION_ID = { quali: 8101, sprint: 8102, race: 8103 };

export function notificationsSupported() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');
  } catch {
    return false;
  }
}

export function getRemindersEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function persist(on) {
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

// Ask for OS permission; returns true when granted.
export async function requestPermission() {
  if (!notificationsSupported()) return false;
  try {
    const cur = await LocalNotifications.checkPermissions();
    if (cur.display === 'granted') return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch {
    return false;
  }
}

// Build the notification list from the weekend's sessions.
function buildNotifications(sessions, gpName, t) {
  const now = Date.now();
  const out = [];
  for (const s of sessions || []) {
    if (!REMINDED_SESSIONS.includes(s.key) || !s.hasTime) continue;
    const at = new Date(s.iso).getTime() - LEAD_MINUTES * 60 * 1000;
    if (at <= now) continue; // already in the past
    out.push({
      id: SESSION_ID[s.key],
      title: t(`notif_${s.key}_title`, { gp: gpName || 'F1' }),
      body:  t(`notif_${s.key}_body`, { min: LEAD_MINUTES }),
      schedule: { at: new Date(at), allowWhileIdle: true },
    });
  }
  return out;
}

async function clearScheduled() {
  try {
    const pending = await LocalNotifications.getPending();
    const ours = (pending.notifications || []).filter(n =>
      Object.values(SESSION_ID).includes(n.id));
    if (ours.length) await LocalNotifications.cancel({ notifications: ours });
  } catch { /* ignore */ }
}

// Enable + (re)schedule reminders for the given weekend. Returns:
//   'ok' | 'denied' | 'unsupported' | 'empty'
export async function enableRaceReminders(sessions, gpName, t) {
  if (!notificationsSupported()) return 'unsupported';
  const granted = await requestPermission();
  if (!granted) return 'denied';

  const notifications = buildNotifications(sessions, gpName, t);
  await clearScheduled();
  if (!notifications.length) { persist(true); return 'empty'; }

  await LocalNotifications.schedule({ notifications });
  persist(true);
  return 'ok';
}

export async function disableRaceReminders() {
  persist(false);
  if (!notificationsSupported()) return;
  await clearScheduled();
}
