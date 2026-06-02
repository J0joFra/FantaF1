import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { LANGS, useI18n } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const current = LANGS.find(l => l.code === lang) || LANGS[0];

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(o => !o)}
        title="Lingua / Language"
        aria-label="Lingua"
        className="h-9 px-2.5 rounded-full bg-gray-100 flex items-center gap-1 text-muted-foreground border border-gray-200 active:scale-95 transition-transform"
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm leading-none">{current.flag}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-xl bg-card border border-gray-200 shadow-xl overflow-hidden">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors
                ${l.code === lang ? "font-bold text-primary" : "text-gray-700"}`}
            >
              <span className="text-base">{l.flag}</span>
              {l.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
