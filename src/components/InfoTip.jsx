import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Mobile-first tap tooltip. Tap the (?) to toggle a small popover; tap outside to close.
 * No hover dependency — works on touch.
 *   <InfoTip>Spiegazione del termine…</InfoTip>
 */
export default function InfoTip({ children, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-flex items-center align-middle ${className}`}>
      <button
        type="button"
        aria-label="Informazioni"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o); }}
        className="inline-flex items-center justify-center text-gray-400 active:text-gray-700"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
                     w-max max-w-[72vw] rounded-lg bg-gray-900 text-white
                     text-[11px] leading-snug font-body normal-case tracking-normal
                     px-2.5 py-1.5 shadow-xl"
          style={{ textAlign: "left" }}
        >
          {children}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px
                           border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}
