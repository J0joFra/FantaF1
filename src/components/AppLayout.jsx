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
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col max-w-md mx-auto relative">
      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#111] border-t border-white/5 flex z-50">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                isActive ? 'text-red-500' : 'text-zinc-600 hover:text-zinc-400'
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
