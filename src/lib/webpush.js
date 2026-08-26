// ─── WEB PUSH — race reminders for the web build ──────────────────────────────
// Subscribes the browser to push notifications and stores the subscription in
// Supabase. A scheduled Edge Function (see supabase/functions/send-race-reminders)
// is what actually sends the reminder before each session, so this works even
// when the app/tab is closed. Everything is a safe no-op when unsupported.
import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const ENABLED_KEY = 'fantaf1_webpush';

export function webPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function webPushEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function setEnabledFlag(on) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

// VAPID public key (base64url) → Uint8Array, required by pushManager.subscribe.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function registerServiceWorker() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

// Is there already an active push subscription in this browser?
export async function isWebPushSubscribed() {
  if (!webPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

// Returns: 'ok' | 'denied' | 'unsupported' | 'unconfigured' | 'error'
export async function subscribeWebPush() {
  if (!webPushSupported()) return 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'unconfigured';

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const reg = await registerServiceWorker();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    let lang = 'it';
    try {
      lang = localStorage.getItem('lang') || 'it';
    } catch {
      /* ignore */
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        lang,
        user_agent: navigator.userAgent,
      },
      { onConflict: 'endpoint' }
    );
    if (error) {
      console.error('Push subscription save failed', error);
      return 'error';
    }

    setEnabledFlag(true);
    return 'ok';
  } catch (err) {
    console.error('Web push subscribe failed', err);
    return 'error';
  }
}

export async function unsubscribeWebPush() {
  setEnabledFlag(false);
  if (!webPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (err) {
    console.error('Web push unsubscribe failed', err);
  }
}
