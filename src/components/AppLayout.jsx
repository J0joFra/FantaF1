import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, Trophy, User, LogIn, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useState } from 'react';
import { toast } from 'sonner';

const NAV = [
  { to: '/',           label: 'Home',       icon: Home   },
  { to: '/leghe',      label: 'Leghe',      icon: Users  },
  { to: '/classifica', label: 'Classifica', icon: Trophy },
  { to: '/regolamento',label: 'Regole',     icon: null   },
];

function AuthButton() {
  const { user, loading, loginWithGoogle, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleAuth = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (user) {
        await logout();
        toast.success('Disconnesso');
      } else {
        await loginWithGoogle();
        toast.success('Benvenuto!');
      }
    } catch {
      toast.error('Errore di autenticazione');
    } finally {
      setBusy(false);
    }
  };

  if (loading || busy) {
    return (
      <div className="flex flex-col items-center justify-center py-3 px-2 gap-1">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">...</span>
      </div>
    );
  }

  if (user) {
    return (
      <button
        onClick={handleAuth}
        className="flex flex-col items-center justify-center py-3 px-2 gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-all"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="avatar" className="w-5 h-5 rounded-full border border-red-500/50" />
        ) : (
          <User className="w-5 h-5 text-red-500" />
        )}
        <span className="truncate max-w-[50px]">
          {user.displayName?.split(' ')[0] || 'Profilo'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={handleAuth}
      className="flex flex-col items-center justify-center py-3 px-2 gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-all"
    >
      <LogIn className="w-5 h-5" />
      <span>Accedi</span>
    </button>
  );
}

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#060608] text-white flex flex-col max-w-md mx-auto relative overflow-hidden">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0 max-w-md mx-auto">
        <div className="absolute top-0 left-0 right-0 h-[40vh] bg-gradient-to-b from-red-950/20 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-[30vh] bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <main className="flex-1 overflow-y-auto pb-24 relative z-10">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
        {/* Nav blur background */}
        <div className="absolute inset-0 bg-[#0a0a10]/90 backdrop-blur-xl border-t border-white/[0.06]" />
        {/* Red accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />

        <div className="relative flex items-stretch">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-3 gap-[3px] text-[9px] font-black uppercase tracking-[0.15em] transition-all relative ${
                  isActive ? 'text-red-500' : 'text-zinc-600 hover:text-zinc-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-red-500 rounded-b-full" />
                  )}
                  {Icon && <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-red-500' : ''}`} strokeWidth={isActive ? 2.5 : 1.8} />}
                  {!Icon && (
                    <svg viewBox="0 0 20 20" className={`w-[18px] h-[18px] ${isActive ? 'text-red-500' : ''}`} fill="none" stroke="currentColor" strokeWidth={isActive ? 2.5 : 1.8}>
                      <path d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
          {/* Auth button as last nav item */}
          <div className="flex-1 flex items-center justify-center">
            <AuthButton />
          </div>
        </div>
      </nav>
    </div>
  );
}