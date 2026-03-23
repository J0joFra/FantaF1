import { useEffect, useState } from 'react';
import { Plus, LogIn, ChevronRight, Trophy, Copy, Check, ChevronLeft } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { createLeague, joinLeague, getUserLeagues, getLeagueStandings } from '../lib/leagues';

export default function Leghe() {
  const { user, login } = useAuth();
  const [leagues,  setLeagues]  = useState([]);
  const [mode,     setMode]     = useState(null); // 'create' | 'join'
  const [name,     setName]     = useState('');
  const [code,     setCode]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [active,   setActive]   = useState(null);
  const [standings, setStandings] = useState([]);
  const [copied,   setCopied]   = useState(false);

  useEffect(() => {
    if (user) getUserLeagues(user).then(setLeagues);
  }, [user]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true); setError('');
    try {
      const { inviteCode } = await createLeague(user, name.trim());
      const updated = await getUserLeagues(user);
      setLeagues(updated);
      setSuccess(`Lega creata! Codice: ${inviteCode}`);
      setMode(null); setName('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (code.length < 6) return;
    setLoading(true); setError('');
    try {
      const { leagueName } = await joinLeague(user, code.trim());
      const updated = await getUserLeagues(user);
      setLeagues(updated);
      setSuccess(`Sei entrato in "${leagueName}"!`);
      setMode(null); setCode('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const openLeague = async (league) => {
    setActive(league);
    const s = await getLeagueStandings(league.id);
    setStandings(s);
  };

  const copyCode = (c) => {
    navigator.clipboard.writeText(c);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-4">
        <p className="font-black text-xl uppercase">Accesso richiesto</p>
        <button onClick={login}
          className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest">
          <LogIn className="w-4 h-4" /> Accedi
        </button>
      </div>
    );
  }

  // ── Vista dettaglio lega ──────────────────────────────────────────────────
  if (active) {
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <div className="px-4 pt-10 pb-6">
        <button onClick={() => setActive(null)}
          className="flex items-center gap-2 text-zinc-600 hover:text-white transition mb-6 text-[10px] font-black uppercase tracking-widest">
          <ChevronLeft className="w-4 h-4" /> Leghe
        </button>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Lega</p>
            <h2 className="font-black text-2xl uppercase">{active.name}</h2>
            <p className="text-zinc-500 text-sm">Codice: {active.inviteCode}</p>
          </div>
          <button onClick={() => copyCode(active.inviteCode)}
            className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiato' : 'Copia'}
          </button>
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
          Classifica · {standings.length} partecipanti
        </p>
        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
          {standings.length === 0 && (
            <p className="text-center text-zinc-600 text-sm py-8">Nessun punteggio ancora</p>
          )}
          {standings.map((m, i) => {
            const isYou = m.userId === user.uid;
            const init  = (m.displayName || '?')[0].toUpperCase();
            return (
              <div key={m.userId}
                className={`flex items-center gap-3 px-4 py-4 border-b border-white/5 last:border-0 ${isYou ? 'bg-red-500/5' : ''}`}>
                <span className="w-7 text-center text-base">{i < 3 ? medals[i] : `#${i + 1}`}</span>
                {m.avatar
                  ? <img src={m.avatar} className="w-9 h-9 rounded-full border border-white/10" alt="" />
                  : <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center font-black text-sm">{init}</div>
                }
                <span className="flex-1 font-bold text-sm">
                  {m.displayName}
                  {isYou && <span className="ml-2 text-[9px] text-yellow-400 font-black uppercase">(tu)</span>}
                </span>
                <span className="text-yellow-400 font-black text-lg tabular-nums">{m.fantaScore}</span>
                <span className="text-[10px] text-zinc-600 font-bold uppercase">PTS</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Vista lista leghe ─────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-10 pb-6 space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 mb-1">Gestione</p>
        <h1 className="text-3xl font-black uppercase">Le mie leghe</h1>
      </div>

      {/* CTA buttons */}
      <div className="flex gap-3">
        <button onClick={() => setMode(mode === 'create' ? null : 'create')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition
            ${mode === 'create' ? 'bg-red-700 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}>
          <Plus className="w-4 h-4" /> Crea lega
        </button>
        <button onClick={() => setMode(mode === 'join' ? null : 'join')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm uppercase tracking-widest border transition
            ${mode === 'join' ? 'bg-white/10 border-white/30 text-white' : 'border-white/10 text-zinc-400 hover:border-white/30 hover:text-white'}`}>
          <LogIn className="w-4 h-4" /> Unisciti
        </button>
      </div>

      {/* Form crea */}
      {mode === 'create' && (
        <div className="bg-[#1a1a1a] border border-red-500/20 rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Nuova lega</p>
          <input
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Nome della lega..."
            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50"
          />
          <button onClick={handleCreate} disabled={loading || !name.trim()}
            className="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl font-black text-sm uppercase tracking-widest disabled:opacity-50 transition">
            {loading ? 'Creazione...' : 'Crea'}
          </button>
        </div>
      )}

      {/* Form unisciti */}
      {mode === 'join' && (
        <div className="bg-[#1a1a1a] border border-blue-500/20 rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Codice invito</p>
          <input
            value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="XXXXXX" maxLength={6}
            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 font-mono tracking-widest uppercase"
          />
          <button onClick={handleJoin} disabled={loading || code.length < 6}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-sm uppercase tracking-widest disabled:opacity-50 transition">
            {loading ? 'Accesso...' : 'Entra'}
          </button>
        </div>
      )}

      {/* Feedback */}
      {success && <p className="text-green-400 text-sm font-bold">{success}</p>}
      {error   && <p className="text-red-400 text-sm font-bold">{error}</p>}

      {/* Lista leghe */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Le tue leghe</p>
        {leagues.length === 0
          ? <p className="text-zinc-600 text-sm">Nessuna lega ancora. Creane una o unisciti con un codice.</p>
          : leagues.map(l => (
            <button key={l.id} onClick={() => openLeague(l)}
              className="w-full flex items-center gap-4 bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 mb-3 hover:border-white/10 transition text-left">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black uppercase truncate">{l.name}</p>
                <p className="text-xs text-zinc-600">{l.memberCount || 1} partecipanti · Codice: {l.inviteCode}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-yellow-400 font-black text-lg">{l.myScore ?? 0}</p>
                <p className="text-[10px] text-zinc-600 font-bold uppercase">punti</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0" />
            </button>
          ))
        }
      </div>
    </div>
  );
}
