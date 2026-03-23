import { useState, useEffect } from 'react';
import { ChevronDown, Plus, X, Loader2, Trophy, Zap, Shield, AlertCircle, CheckCircle2, Flag } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { DRIVERS_2026, FANTA_CALENDAR, saveRaceResult, awardPredictionTokens } from '../lib/fantaF1';

function DriverSelect({ value, onChange, placeholder = 'Seleziona pilota', exclude = [] }) {
  const available = DRIVERS_2026.filter(d => !exclude.includes(d.id) || d.id === value);
  const sel = DRIVERS_2026.find(d => d.id === value);
  return (
    <div className="relative">
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white pr-10
          focus:outline-none focus:border-red-500/50 transition"
        style={sel ? { borderColor: sel.color + '40' } : {}}>
        <option value="">{placeholder}</option>
        {available.map(d => <option key={d.id} value={d.id}>{d.name} — {d.team}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
      {sel && <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: sel.color }} />}
    </div>
  );
}

export default function AdminResults() {
  const { user } = useAuth();

  const [raceId,    setRaceId]    = useState('');
  const [gpStatus,  setGpStatus]  = useState('provisional');
  const [fullGrid,  setFullGrid]  = useState(Array(10).fill(''));
  const [lastTail,  setLastTail]  = useState(Array(12).fill(''));
  const [fl,        setFl]        = useState('');
  const [sc,        setSc]        = useState(null);
  const [dnfs,      setDnfs]      = useState(['', '', '']);
  const [winTeam,   setWinTeam]   = useState('');
  const [doublePod, setDoublePod] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState(null);

  // Auto-fill costruttore dal 1° posto
  useEffect(() => {
    if (!fullGrid[0]) return;
    const d = DRIVERS_2026.find(d => d.id === fullGrid[0]);
    if (d) setWinTeam(d.team.toLowerCase().replace(/\s+/g, '-'));
  }, [fullGrid[0]]);

  // Auto-detect doppietta podio
  useEffect(() => {
    const [p1, p2, p3] = fullGrid;
    if (!p1 || !p2 || !p3) { setDoublePod(''); return; }
    const d = (id) => DRIVERS_2026.find(d => d.id === id);
    const teamId = t => t?.toLowerCase().replace(/\s+/g, '-');
    if (d(p1)?.team === d(p2)?.team) setDoublePod(teamId(d(p1)?.team));
    else if (d(p1)?.team === d(p3)?.team) setDoublePod(teamId(d(p1)?.team));
    else if (d(p2)?.team === d(p3)?.team) setDoublePod(teamId(d(p2)?.team));
    else setDoublePod('');
  }, [fullGrid[0], fullGrid[1], fullGrid[2]]);

  const usedDrivers = [...fullGrid, ...lastTail, fl, ...dnfs].filter(Boolean);

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 px-4 text-center">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="font-black text-xl uppercase">Accesso negato</p>
        <p className="text-zinc-500 text-sm">Questa pagina è riservata agli admin.</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    setError(null); setResult(null);
    if (!raceId) return setError('Seleziona la gara');
    if (fullGrid.some(d => !d)) return setError('Completa tutti i 10 piloti');
    if (!fl) return setError('Inserisci il giro veloce');
    if (sc === null) return setError('Specifica Safety Car');

    setLoading(true);
    try {
      await saveRaceResult(raceId, {
        status: gpStatus,
        fullGrid: fullGrid.map((driverId, i) => ({ pos: i + 1, driverId })),
        lastTail: lastTail.filter(Boolean).map((driverId, i) => ({ pos: 11 + i, driverId })),
        bonuses: { fastestLap: fl, safetyCar: sc, dnfDrivers: dnfs.filter(Boolean), winningConstructor: winTeam, teamDoublePodium: doublePod || null },
      });
      const awarded = await awardPredictionTokens(raceId);
      setResult({ ok: true, awarded });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="px-4 pt-10 pb-8 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-500 mb-1">Admin</p>
        <h1 className="text-3xl font-black uppercase">Risultati GP</h1>
      </div>

      {/* Selezione gara */}
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Gara</p>
        <div className="relative">
          <select value={raceId} onChange={e => setRaceId(e.target.value)}
            className="w-full appearance-none bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white pr-10 focus:outline-none focus:border-red-500/50">
            <option value="">Seleziona gara...</option>
            {FANTA_CALENDAR.map(r => <option key={r.raceId} value={r.raceId}>R{r.round} — {r.name}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>
        {raceId && (
          <div className="flex gap-2 mt-3">
            {['provisional', 'official'].map(s => (
              <button key={s} onClick={() => setGpStatus(s)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition
                  ${gpStatus === s ? 'bg-red-600/20 border-red-500/40 text-red-400' : 'border-white/10 text-zinc-600'}`}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Top 10 */}
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3">Top 10</p>
        <div className="space-y-2">
          {fullGrid.map((val, i) => {
            const accent = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#6b7280';
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-black w-6 text-center shrink-0" style={{ color: accent }}>{i + 1}°</span>
                <DriverSelect value={val} onChange={v => setFullGrid(g => { const n = [...g]; n[i] = v; return n; })} placeholder={`Pos. ${i + 1}`} exclude={usedDrivers.filter(d => d !== val)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Zona coda */}
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Pos. 11 – 22</p>
        <div className="space-y-2">
          {lastTail.map((val, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-black w-6 text-center shrink-0" style={{ color: i >= 7 ? '#a855f7' : '#52525b' }}>{11 + i}°</span>
              <DriverSelect value={val} onChange={v => setLastTail(t => { const n = [...t]; n[i] = v; return n; })} placeholder={`Pos. ${11 + i}`} exclude={usedDrivers.filter(d => d !== val)} />
            </div>
          ))}
        </div>
      </div>

      {/* Bonus */}
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Bonus gara</p>
        <div>
          <p className="text-[11px] text-zinc-500 font-bold mb-2 flex items-center gap-1.5"><Zap className="w-3 h-3 text-orange-400" /> Giro veloce</p>
          <DriverSelect value={fl} onChange={setFl} placeholder="Giro veloce" />
        </div>
        <div>
          <p className="text-[11px] text-zinc-500 font-bold mb-2 flex items-center gap-1.5"><Shield className="w-3 h-3 text-cyan-400" /> Safety Car / VSC</p>
          <div className="flex gap-3">
            {[true, false].map(v => (
              <button key={String(v)} onClick={() => setSc(v)}
                className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest border transition
                  ${sc === v ? v ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-zinc-800 border-zinc-600 text-zinc-300' : 'border-white/10 text-zinc-600'}`}>
                {v ? '✅ Sì' : '❌ No'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] text-zinc-500 font-bold mb-2 flex items-center gap-1.5"><AlertCircle className="w-3 h-3 text-red-400" /> DNF / DNS</p>
          <div className="space-y-2">
            {dnfs.map((val, i) => (
              <DriverSelect key={i} value={val} onChange={v => setDnfs(d => { const n = [...d]; n[i] = v; return n; })} placeholder={`Ritiro ${i + 1}`} exclude={usedDrivers.filter(d => d !== val)} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
          <div>
            <p className="text-[10px] text-zinc-600 font-bold uppercase mb-1 flex items-center gap-1"><Trophy className="w-3 h-3 text-green-400" /> Costruttore</p>
            <div className="px-4 py-3 rounded-xl bg-white/5 text-sm font-bold text-white">{winTeam || <span className="text-zinc-600">Auto dal 1°</span>}</div>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 font-bold uppercase mb-1 flex items-center gap-1"><Flag className="w-3 h-3 text-purple-400" /> Doppietta</p>
            <div className="px-4 py-3 rounded-xl bg-white/5 text-sm font-bold text-white">{doublePod || <span className="text-zinc-600">Nessuna</span>}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {result?.ok && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-sm text-green-300 font-bold">Risultati salvati · {result.awarded.length} token assegnati</p>
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading}
        className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition
          ${loading ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/20'}`}>
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Elaborazione...</> : <><Trophy className="w-4 h-4" /> Salva & Assegna punti</>}
      </button>
      <p className="text-center text-[10px] text-zinc-700 font-bold uppercase tracking-widest">Operazione irreversibile</p>
    </div>
  );
}
