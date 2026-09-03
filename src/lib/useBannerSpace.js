import { useEffect } from 'react';
import { blockBanner, unblockBanner } from '@/lib/ads';

/**
 * Keeps the AdMob banner out of the way while a full-screen overlay is open.
 *
 * The banner is a native view painted over the webview, so it wins against
 * every `z-index` in the app. Any overlay that puts a button near the bottom
 * of the screen has to ask for that space, or the ad lands on the button.
 *
 *   useBannerSpace('onboarding', open);
 *
 * `reason` is a name, not a flag: two overlays open at once each hold their
 * own claim, and the banner comes back only when both are gone. It also has to
 * be stable across renders — a name built inline (`` `modal-${id}` ``) would
 * claim and release on every render.
 *
 * The release runs on unmount too, so an overlay that disappears without
 * setting its flag to false doesn't leave the banner blocked forever.
 */
export function useBannerSpace(reason, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    blockBanner(reason);
    return () => unblockBanner(reason);
  }, [reason, active]);
}

export default useBannerSpace;
