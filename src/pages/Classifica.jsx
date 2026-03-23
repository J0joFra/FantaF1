import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getFantaLeaderboard } from '../lib/fantaF1';

export default function Classifica() {
  const { user } = useAuth();
  const [board,   setBoard]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFantaLeaderboard(50).then(data => { setBoard(data); setLoading(false); });
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="px-4 pt-10 pb-6 space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 mb-1">Stagione 2026</p>
        <h1 className="text-3xl font-black uppercase">Classifica</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : board.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Trophy className="w-10 h-10 text-zinc-700" />
          <p className="text-zinc-600 text-sm">Nessun punteggio ancora — aspetta il primo GP!</p>
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
          {board.map((member, i) => {
            const isYou = member.userId === user?.uid;
            const init  = (member.name || '?')[0].toUpperCase();
            return (
              <div key={member.userId}
                className={`flex items-center gap-3 px-4 py-4 border-b border-white/5 last:border-0 ${isYou ? 'bg-red-500/5' : ''}`}>
                <span className="w-7 text-center text-base shrink-0">
                  {i < 3 ? medals[i] : <span className="text-zinc-600 font-bold text-sm">#{i + 1}</span>}
                </span>
                {member.avatar
                  ? <img src={member.avatar} className="w-9 h-9 rounded-full border border-white/10 shrink-0" alt="" />
                  : <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center font-black text-sm shrink-0">{init}</div>
                }
                <span className="flex-1 font-bold text-sm min-w-0 truncate">
                  {member.name}
                  {isYou && <span className="ml-2 text-[9px] text-yellow-400 font-black uppercase">(tu)</span>}
                </span>
                <div className="text-right shrink-0">
                  <p className="text-yellow-400 font-black text-lg tabular-nums">{member.totalPoints}</p>
                  <p className="text-[9px] text-zinc-600 font-bold uppercase">PTS</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
