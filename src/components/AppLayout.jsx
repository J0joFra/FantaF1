import { Outlet, NavLink } from 'react-router-dom';
import { Home, Flag, Users, Trophy, User } from 'lucide-react';

const NAV = [
  { to: '/',           label: 'Home',       icon: Home   },
  { to: '/pick',       label: 'Pick GP',    icon: Flag   },
  { to: '/leghe',      label: 'Leghe',      icon: Users  },
  { to: '/classifica', label: 'Classifica', icon: Trophy },
  { to: '/profilo',    label: 'Profilo',    icon: User   },
];

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col max-w-md mx-auto relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#3f0f17_0%,transparent_45%),radial-gradient(circle_at_bottom,#0d1a2e_0%,transparent_40%)] opacity-60" />
      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24 relative z-10">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0c0c12]/90 backdrop-blur-md border-t border-white/10 flex z-50">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-bold uppercase tracking-widest transition-all ${
                isActive ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-5 h-5 ${isActive ? 'text-red-500' : ''}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
