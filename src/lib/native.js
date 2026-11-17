// Thin, safe wrappers around native-only Capacitor features. Every call is
// guarded for the native platform and wrapped in try/catch, so importing and
// calling these from anywhere is a no-op on the web (and never throws).
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { StatusBar, Style } from "@capacitor/status-bar";

const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

// Brand red (matches the PageHeader gradient top) → native status bar that
// blends with the app chrome instead of the default system bar.
export async function initNativeChrome() {
  if (!isNative()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: "#E8002D" });
    await StatusBar.setStyle({ style: Style.Dark }); // light icons on the red bar
  } catch { /* status bar not available (e.g. iOS web) — ignore */ }
}

// ── Haptics ──────────────────────────────────────────────────────────────────
// Light tap: generic button/toggle press.
export function hapticTap() {
  if (!isNative()) return;
  try { Haptics.impact({ style: ImpactStyle.Light }); } catch { /* ignore */ }
}

// Selection: switching tab / picking from a list.
export function hapticSelect() {
  if (!isNative()) return;
  try { Haptics.impact({ style: ImpactStyle.Medium }); } catch { /* ignore */ }
}

// Success buzz: reminder turned on, correct guess, result in.
export function hapticSuccess() {
  if (!isNative()) return;
  try { Haptics.notification({ type: NotificationType.Success }); } catch { /* ignore */ }
}

// Warning/error buzz: wrong guess, jump-start in the reaction game.
export function hapticError() {
  if (!isNative()) return;
  try { Haptics.notification({ type: NotificationType.Warning }); } catch { /* ignore */ }
}
