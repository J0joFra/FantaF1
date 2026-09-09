// ─── IN-APP PURCHASE — "Remove ads" (one-time, non-consumable) ────────────────
// Wraps cordova-plugin-purchase (window.CdvPurchase), available only in the
// native Android build. Everything is a safe no-op on the web build.
//
// The purchased entitlement is cached in localStorage ('gridup_no_ads') so the
// banner stays hidden instantly on every launch; the plugin re-validates
// ownership with Google Play on init and corrects the flag if needed.
//
// Play Console setup: create a managed in-app product with ID `remove_ads`
// (non-consumable) priced at €0,99. See docs/remove-ads-iap.md.
import { Capacitor } from '@capacitor/core';
import { hideBanner, showBanner } from '@/lib/ads';

export const REMOVE_ADS_ID = 'remove_ads';
const AD_FREE_KEY = 'gridup_no_ads';

export function purchasesSupported() {
  try {
    return Capacitor.isNativePlatform() && !!window.CdvPurchase;
  } catch {
    return false;
  }
}

export function isAdFree() {
  try {
    return localStorage.getItem(AD_FREE_KEY) === '1';
  } catch {
    return false;
  }
}

function setAdFree(on) {
  try { localStorage.setItem(AD_FREE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

let initialized = false;
let changeCb = null;

// Let the UI react when ownership changes (purchase completes / is restored).
export function onAdFreeChange(cb) { changeCb = cb; }

function applyOwned(owned) {
  const was = isAdFree();
  setAdFree(owned);
  if (owned) hideBanner();
  else if (was && !owned) showBanner();
  if (changeCb) changeCb(owned);
}

function refreshOwned() {
  try {
    const { store } = window.CdvPurchase;
    applyOwned(!!store.owned(REMOVE_ADS_ID));
  } catch { /* ignore */ }
}

export async function initPurchases() {
  if (!purchasesSupported() || initialized) return;
  initialized = true;
  try {
    const { store, ProductType, Platform, LogLevel } = window.CdvPurchase;
    store.verbosity = LogLevel.WARNING;

    store.register([{
      id: REMOVE_ADS_ID,
      type: ProductType.NON_CONSUMABLE,
      platform: Platform.GOOGLE_PLAY,
    }]);

    store.when()
      .approved(t => t.verify())
      .verified(r => r.finish())
      .receiptUpdated(() => refreshOwned())
      .finished(() => refreshOwned());

    await store.initialize([Platform.GOOGLE_PLAY]);
    refreshOwned();
  } catch (err) {
    console.error('Purchases init failed', err);
  }
}

// Localized store price, e.g. "0,99 €" — null until the store has loaded.
export function getRemoveAdsPrice() {
  try {
    const { store, Platform } = window.CdvPurchase;
    const p = store.get(REMOVE_ADS_ID, Platform.GOOGLE_PLAY);
    return p?.getOffer()?.pricingPhases?.[0]?.price || null;
  } catch {
    return null;
  }
}

// Returns: 'ok' | 'unsupported' | 'unavailable' | 'error'
export async function buyRemoveAds() {
  if (!purchasesSupported()) return 'unsupported';
  try {
    const { store, Platform } = window.CdvPurchase;
    const product = store.get(REMOVE_ADS_ID, Platform.GOOGLE_PLAY);
    const offer = product && product.getOffer();
    if (!offer) return 'unavailable';
    const err = await offer.order();
    if (err) return 'error';
    return 'ok';
  } catch (e) {
    console.error('buyRemoveAds failed', e);
    return 'error';
  }
}

// Returns: 'restored' | 'none' | 'unsupported'
export async function restorePurchases() {
  if (!purchasesSupported()) return 'unsupported';
  try {
    const { store } = window.CdvPurchase;
    await store.restorePurchases();
    refreshOwned();
    return isAdFree() ? 'restored' : 'none';
  } catch (e) {
    console.error('restorePurchases failed', e);
    return 'none';
  }
}
