import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function PageHeader({ icon: Icon, title, color = "#E8002D", right }) {
  return (
    <div className="bg-gradient-to-r from-[#E8002D] to-[#C20028] sticky top-0 z-30 shadow-md text-white">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0">
            <div className="p-1.5 rounded-xl bg-white/15 border border-white/25 shadow-sm">
              {Icon && <Icon className="w-5 h-5 text-white" />}
            </div>
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
