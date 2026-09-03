// ─── ADMOB BANNER ─────────────────────────────────────────────────────────────
// Shows a Google AdMob banner in the native Android build. Everything is a safe
// no-op on the web build (the plugin is native-only). The plugin module is
// dynamically imported so the web bundle never touches the native bridge.
import { Capacitor } from '@capacitor/core';

// Production ad unit (banner). App ID lives in AndroidManifest.xml.
const BANNER_AD_ID = 'ca-app-pub-8762257220044998/4894923352';

// The banner floats over the webview; lift it above the ~64px bottom nav.
// Tune on-device if the banner overlaps the tab bar.
const BOTTOM_NAV_PX = 64;

/* ─── BANNER BLOCKERS ────────────────────────────────────────────────────────
   The AdMob banner is a NATIVE view drawn on top of the webview. No CSS can
   put anything above it: `z-index: 9999` on a modal loses to a view that is
   not in the DOM at all. So a full-screen overlay whose buttons sit near the
   bottom — the onboarding, the bug report form, the error screen — gets its
   primary action covered by the ad, and the user is stuck.

   The fix is to take the banner away while such an overlay is up. A single
   `hideBanner()` call is not enough, because several overlays can be open at
   once and whichever closes first would bring the ad back over the other:
   each one claims a named block, and the banner returns only when the last
   claim is released. */
const blockers = new Set();

/** Is any overlay currently claiming the space the banner would occupy? */
export function bannerBlocked() {
  return blockers.size > 0;
}

/**
 * Claim/release the banner space. Returns nothing; the banner catches up on
 * its own. Safe to call on the web build, where it is all a no-op.
 */
export function blockBanner(reason) {
  if (blockers.has(reason)) return;
  blockers.add(reason);
  hideBanner();
}

export function unblockBanner(reason) {
  if (!blockers.delete(reason)) return;
  if (blockers.size === 0) showBanner();
}

export function adsSupported() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AdMob');
  } catch {
    return false;
  }
}

let initPromise = null;

// Initialize the SDK once: ATT (iOS), UMP consent (GDPR), then initialize.
async function ensureInit() {
  if (!adsSupported()) return false;
  if (!initPromise) {
    initPromise = (async () => {
      const { AdMob } = await import('@capacitor-community/admob');

      // iOS App Tracking Transparency — no-op on Android.
      try { await AdMob.requestTrackingAuthorization(); } catch { /* ignore */ }

      // GDPR consent (UMP). Best-effort: show the form only when required.
      try {
        const consent = await AdMob.requestConsentInfo();
        if (consent?.isConsentFormAvailable && consent.status === 'REQUIRED') {
          await AdMob.showConsentForm();
        }
      } catch { /* ignore */ }

      await AdMob.initialize();
    })();
  }
  await initPromise;
  return true;
}

export async function showBanner() {
  if (bannerBlocked()) return;
  if (!(await ensureInit())) return;
  /* Re-checked after the await: initialisation takes a moment, and in that
     moment an overlay may have opened. Without this the banner shows up on
     top of it anyway — which is the whole bug. */
  if (bannerBlocked()) return;
  const { AdMob, BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
  try {
    await AdMob.showBanner({
      adId: BANNER_AD_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: BOTTOM_NAV_PX,
    });
  } catch (err) {
    console.error('AdMob banner failed', err);
  }
}

export async function hideBanner() {
  if (!adsSupported()) return;
  const { AdMob } = await import('@capacitor-community/admob');
  try {
    await AdMob.hideBanner();
    await AdMob.removeBanner();
  } catch { /* ignore */ }
}
