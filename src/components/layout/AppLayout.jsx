import { Outlet, useLocation, Link } from "react-router-dom";
import { Flag, Calculator, Users, Trophy } from "lucide-react";

const tabs = [
  { path: "/",           label: "Home",     icon: Flag       },
  { path: "/calculator", label: "Calcolo",  icon: Calculator },
  { path: "/compare",    label: "Confronta",icon: Users      },
  { path: "/ferrari",    label: "Ferrari",  icon: Trophy     },
];

export default function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 h-14
                         bg-background/90 backdrop-blur-xl border-b border-border/60">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Flag className="w-4 h-4 text-white" />
          </div>
          <span className="font-heading font-black text-xl tracking-wide uppercase">
            Fanta<span className="text-primary">F1</span>
          </span>
        </Link>
        <div className="tag bg-primary/10 text-primary border border-primary/20">
          2026
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-safe">
        <Outlet />
      </main>

      {/* Bottom nav — app-style */}
      <nav className="sticky bottom-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/60 safe-bottom">
        <div className="grid grid-cols-4 h-16">
          {tabs.map(({ path, label, icon: Icon }) => {
            const active = pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center justify-center gap-0.5 transition-all
                  ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <div className={`relative flex items-center justify-center w-10 h-6 rounded-full transition-all
                  ${active ? "bg-primary/15" : ""}`}>
                  <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                  {active && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1
                                     rounded-full bg-primary" />
                  )}
                </div>
                <span className={`text-[10px] font-heading font-bold tracking-wide uppercase transition-all
                  ${active ? "text-primary" : "text-muted-foreground/60"}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
