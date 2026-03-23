import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Star, ChevronRight, Flag } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getCurrentRace } from '../lib/fantaF1';
import { getUserLeagues } from '../lib/leagues';
import GpCountdown from '../components/GpCountdown';

export default function Home() {
  const { user } = useAuth();
  const [nextRace, setNextRace]   = useState(null);
  const [leagues, setLeagues]     = useState([]);
  const [totalPts, setTotalPts]   = useState(0);

  useEffect(() => {
    setNextRace(getCurrentRace());
  }, []);

  useEffect(() => {
    if (!user) return;
    getUserLeagues(user).then(l => {
      setLeagues(l);
      setTotalPts(l.reduce((s, lg) => s + (lg.myScore || 0), 0));
    });
  }, [user]);

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || '';

  return (
    <div className="px-4 pt-10 pb-6 space-y-5">
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-500 mb-1">
          Season 2026 · FantaF1
        </p>
        <h1 className="text-4xl font-black uppercase leading-tight">
          Benvenuto,<br />
          <span className="text-red-500">{firstName || '—'}</span>
        </h1>
      </div>

      {/* Prossimo GP */}
      {nextRace && (
        <div className="bg-[#1a0a0a] border border-red-900/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Prossimo GP</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-bold">Round {nextRace.round}</span>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-zinc-500 font-bold text-sm">{nextRace.flag}</p>
              <p className="font-black text-xl uppercase leading-tight">{nextRace.name}</p>
              <p className="text-zinc-500 text-sm">{nextRace.circuit}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-zinc-600 font-bold uppercase">Data gara</p>
              <p className="font-black text-white">
                {new Date(nextRace.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Scadenza Pick</p>
            <GpCountdown targetDate={nextRace.lockDate + 'T23:59:00'} />
          </div>

          {/* Pick attuale placeholder — da popolare da Firestore */}
          <Link to="/pick"
            className="flex items-center gap-3 bg-red-600/20 border border-red-500/30 rounded-xl px-4 py-3 mt-1">
            <Star className="w-4 h-4 text-red-400 fill-red-400" />
            <div className="flex-1">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">Il tuo pick</p>
              <p className="font-black text-white text-sm uppercase">Vai a scegliere →</p>
            </div>
          </Link>
        </div>
      )}

      {/* Stats rapide */}
      {user && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
            <Trophy className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-2xl font-black">{leagues.length}</p>
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wide">Le mie leghe</p>
            </div>
          </div>
          <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
            <Star className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-2xl font-black">{totalPts}</p>
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wide">Punti totali</p>
            </div>
          </div>
        </div>
      )}

      {/* Come funziona */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Come funziona</p>

        {[
          { num: '01', title: 'Crea o unisciti a una Lega', desc: 'Sfida i tuoi amici con un codice segreto' },
          { num: '02', title: 'Scegli il tuo Pilota',       desc: 'Prima della chiusura del pick (1h prima della gara)' },
          { num: '03', title: 'Accumula Punti',             desc: 'Vittorie, pole, giri veloci, pit stop leggendari e molto altro' },
        ].map(item => (
          <div key={item.num} className="flex items-start gap-4 py-2">
            <span className="text-red-500 font-black text-lg w-8 shrink-0">{item.num}</span>
            <div>
              <p className="font-bold text-white">{item.title}</p>
              <p className="text-sm text-zinc-600">{item.desc}</p>
            </div>
          </div>
        ))}

        <Link to="/regolamento"
          className="flex items-center justify-between text-sm text-zinc-500 hover:text-white transition py-2 border-t border-white/5">
          <span>Leggi il regolamento completo</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
