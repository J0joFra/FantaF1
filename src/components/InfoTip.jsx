import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { useBackHandler } from "@/lib/backStack";
import { useI18n } from "@/lib/i18n";

/**
 * Mobile-first tap tooltip. Tap the (?) to toggle a small popover; tap outside to close.
 * Opens below the icon when it's near the top of the screen (so it doesn't cover
 * the content above), above it otherwise.
 *   <InfoTip>Spiegazione del termine…</InfoTip>
 */
export default function InfoTip({ children, className = "" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState("top"); // "top" = above | "bottom" = below
  useBackHandler(open, () => setOpen(false));
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation(); e.preventDefault();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPlace(rect.top < window.innerHeight * 0.4 ? "bottom" : "top");
    }
    setOpen(o => !o);
  };

  const below = place === "bottom";

  return (
    <span ref={ref} className={`relative inline-flex items-center align-middle ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-label={t("aria_info")}
        onClick={toggle}
        className="inline-flex items-center justify-center text-muted-foreground active:text-foreground"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute left-1/2 -translate-x-1/2 z-50 w-max max-w-[72vw] rounded-lg
                     bg-foreground text-background text-[11px] leading-snug font-body
                     normal-case tracking-normal px-2.5 py-1.5 shadow-xl
                     ${below ? "top-full mt-1.5" : "bottom-full mb-1.5"}`}
          style={{ textAlign: "left" }}
        >
          {children}
          <span className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent
                           ${below ? "bottom-full -mb-px border-b-foreground" : "top-full -mt-px border-t-foreground"}`} />
        </span>
      )}
    </span>
  );
}
