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
  if (!(await ensureInit())) return;
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
