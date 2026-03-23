import { useEffect, useState } from 'react';
import { Trophy, Flag, Star, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getUserStats } from '../lib/fantaF1';
import { getUserLeagues } from '../lib/leagues';

export default function Profilo() {
  const { user, login, logout } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [leagues, setLeagues] = useState([]);

  useEffect(() => {
    if (!user) return;
    getUserStats(user.uid).then(setStats);
    getUserLeagues(user).then(setLeagues);
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4">
        <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center">
          <Star className="w-8 h-8 text-zinc-600" />
        </div>
        <div className="text-center">
          <p className="font-black text-xl uppercase">Accesso richiesto</p>
          <p className="text-zinc-600 text-sm mt-1">Fai login per vedere il tuo profilo</p>
        </div>
        <button onClick={login}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition">
          <LogIn className="w-4 h-4" /> Accedi con Google
        </button>
      </div>
    );
  }

  const initial = (user.name || user.email || '?')[0].toUpperCase();

  return (
    <div className="px-4 pt-10 pb-6 space-y-6">
      {/* Avatar + info */}
      <div className="flex flex-col items-center gap-3 py-4">
        {user.avatar
          ? <img src={user.avatar} className="w-20 h-20 rounded-full border-2 border-red-500" alt="" />
          : <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-3xl font-black">{initial}</div>
        }
        <div className="text-center">
          <p className="font-black text-xl">{user.name}</p>
          <p className="text-zinc-500 text-sm">{user.email}</p>
          <span className="inline-block mt-2 px-3 py-1 rounded-full border border-red-500/40 text-red-400 text-[10px] font-bold uppercase tracking-widest">
            Season 2026
          </span>
        </div>
      </div>

      {/* Stats 3 colonne */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Trophy, color: 'text-blue-400',   val: leagues.length,       label: 'Leghe'  },
          { icon: Flag,   color: 'text-red-400',    val: stats?.racesPlayed ?? 0, label: 'Pick'   },
          { icon: Star,   color: 'text-yellow-400', val: stats?.totalPoints ?? 0, label: 'Punti'  },
        ].map(({ icon: Icon, color, val, label }) => (
          <div key={label} className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-1">
            <Icon className={`w-5 h-5 ${color}`} />
            <p className="text-2xl font-black">{val}</p>
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Profilo info */}
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
          <Star className="w-4 h-4 text-zinc-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Profilo</span>
        </div>
        {[
          { label: 'Nome',  value: user.name },
          { label: 'Email', value: user.email },
          { label: 'Ruolo', value: user.role === 'admin' ? 'Admin' : 'Utente' },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0">
            <span className="text-zinc-500 text-sm">{label}</span>
            <span className={`text-sm font-bold ${label === 'Ruolo' && user.role === 'admin' ? 'text-red-400' : 'text-white'}`}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Logout */}
      <button onClick={logout}
        className="w-full flex items-center justify-center gap-2 border border-white/10 text-zinc-500 hover:text-white hover:border-white/30 py-3 rounded-2xl font-bold text-sm uppercase tracking-widest transition">
        <LogOut className="w-4 h-4" /> Esci
      </button>
    </div>
  );
}
