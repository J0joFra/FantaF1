import { useState, useEffect } from "react";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  purchasesSupported, isAdFree, onAdFreeChange,
  buyRemoveAds, restorePurchases, getRemoveAdsPrice,
} from "@/lib/purchases";

// "Remove ads" upsell — native build only, and only until purchased.
export default function RemoveAdsCard() {
  const { t } = useI18n();
  const supported = purchasesSupported();
  const [adFree, setAdFree] = useState(() => isAdFree());
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [price, setPrice] = useState(null);

  useEffect(() => {
    if (!supported) return;
    onAdFreeChange(setAdFree);
    // The store price loads a moment after init; poll briefly for it.
    const id = setInterval(() => {
      const p = getRemoveAdsPrice();
      if (p) { setPrice(p); clearInterval(id); }
    }, 800);
    setTimeout(() => clearInterval(id), 8000);
    return () => clearInterval(id);
  }, [supported]);

  if (!supported || adFree) return null;

  const buy = async () => {
    if (busy) return;
    setBusy(true); setHint("");
    const res = await buyRemoveAds();
    if (res === "ok") setHint(t("rmads_thanks"));
    else if (res !== "ok") setHint(t("rmads_error"));
    setBusy(false);
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true); setHint("");
    const res = await restorePurchases();
    if (res === "none") setHint(t("rmads_none"));
    setBusy(false);
  };

  return (
    <div className="app-card px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading font-black text-sm uppercase tracking-wide leading-none">
          {t("rmads_title")}
        </p>
        <p className="text-[11px] text-muted-foreground font-body mt-1 leading-snug">
          {hint || t("rmads_desc")}
        </p>
        <button
          onClick={restore}
          disabled={busy}
          className="mt-1 inline-flex items-center gap-1 text-[10px] font-body text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> {t("rmads_restore")}
        </button>
      </div>
      <button
        onClick={buy}
        disabled={busy}
        className="shrink-0 h-9 px-3 rounded-full bg-primary text-white font-heading font-bold text-xs uppercase tracking-wide
                   flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {price || "0,99 €"}
      </button>
    </div>
  );
}
