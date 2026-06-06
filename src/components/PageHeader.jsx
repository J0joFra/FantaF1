import { Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/**
 * Shared sticky page header — one visual language across all pages.
 * Props:
 *  - icon: lucide icon component
 *  - title: string or node (e.g. a wordmark)
 *  - color: accent color for the logo badge (default F1 red)
 *  - right: optional node rendered on the right (actions/pills)
 */
export default function PageHeader({ icon: Icon, title, color = "#E8002D", right }) {
  return (
    <div className="bg-gradient-to-r from-[#E8002D] to-[#C20028] sticky top-0 z-30 shadow-md text-white">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <div className="p-1.5 rounded-xl bg-white/15 border border-white/25 shadow-sm">
              {Icon && <Icon className="w-5 h-5 text-white" />}
            </div>
            <Sparkles className="w-3 h-3 text-yellow-300 absolute -top-1 -right-1" />
          </div>
          {typeof title === "string"
            ? <h1 className="font-heading font-black text-xl uppercase tracking-wide truncate text-white">{title}</h1>
            : title}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
