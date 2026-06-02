import { Outlet, useLocation, Link } from "react-router-dom";
import { BarChart2, Calculator, GitCompare, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const tabs = [
  { path: "/",           key: "nav_overview",  icon: BarChart2  },
  { path: "/calculator", key: "nav_scenarios", icon: Calculator },
  { path: "/compare",    key: "nav_compare",   icon: GitCompare },
  { path: "/ferrari",    key: "nav_teams",     icon: Shield     },
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-[430px] mx-auto">
      <main className="flex-1 overflow-y-auto pb-nav">
        <Outlet />
      </main>

      {/* Bottom nav — iOS/Android style */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50
                      bg-white border-t border-border safe-bottom"
           style={{ boxShadow: "0 -1px 0 rgba(0,0,0,0.06), 0 -4px 16px rgba(0,0,0,0.06)" }}>
        <div className="grid grid-cols-4 h-16">
          {tabs.map(({ path, key, icon: Icon }) => {
            const active = pathname === path;
            return (
              <Link key={path} to={path}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors
                  ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon style={{ width: 20, height: 20 }}
                      strokeWidth={active ? 2.2 : 1.8} />
                <span className={`text-[10px] font-body font-semibold mt-0.5
                  ${active ? "text-primary" : "text-muted-foreground/70"}`}
                      style={{ fontFamily: "var(--font-body)" }}>
                  {t(key)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
