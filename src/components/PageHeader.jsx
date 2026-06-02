import { Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

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
    <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <div className="p-1.5 rounded-xl shadow-md"
                 style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
              {Icon && <Icon className="w-5 h-5 text-white" />}
            </div>
            <Sparkles className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1" />
          </div>
          {typeof title === "string"
            ? <h1 className="font-heading font-black text-xl uppercase tracking-wide truncate">{title}</h1>
            : title}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
