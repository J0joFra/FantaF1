import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronDown, Zap, Shield, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { DRIVERS_2026, FANTA_CALENDAR, getCurrentRace, isRaceLocked, savePrediction, getUserPrediction } from '../lib/fantaF1';

// ─── Select pilota ────────────────────────────────────────────────────────────
function DriverSelect({ value, onChange, placeholder, exclude = [] }) {
  const available = DRIVERS_2026.filter(d => !exclude.includes(d.id) || d.id === value);
  const sel = DRIVERS_2026.find(d => d.id === value);
  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white pr-10
          focus:outline-none focus:border-red-500/50 transition"
        style={sel ? { borderColor: sel.color + '60' } : {}}
      >
        <option value="">{placeholder}</option>
        {available.map(d => (
          <option key={d.id} value={d.id}>{d.name} — {d.team}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
      {sel && <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: sel.color }} />}
    </div>
  );
}

// ─── Card sezione ─────────────────────────────────────────────────────────────
function SCard({ title, color = 'text-zinc-500', children }) {
  return (
    <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4">
      <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${color}`}>{title}</p>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PickGp() {
  const { user, login } = useAuth();
  const race    = getCurrentRace();
  const locked  = isRaceLocked(race);

  const [fullGrid, setFullGrid] = useState(Array(10).fill(''));   // pos 1-10
  const [lastTail, setLastTail] = useState(Array(12).fill(''));   // pos 11-22
  const [fl,       setFl]       = useState('');
  const [sc,       setSc]       = useState(null);
  const [dnfs,     setDnfs]     = useState(['', '', '']);

  const [loading,  setLoading]  = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');
  const [existing, setExisting] = useState(null);

  // Carica predizione esistente
  useEffect(() => {
    if (!user || !race) return;
    getUserPrediction(user, race.raceId).then(pred => {
      if (!pred) return;
      setExisting(pred);
      if (pred.fullGrid) setFullGrid(pred.fullGrid.map(e => e.driverId));
      if (pred.lastTail) setLastTail([...pred.lastTail.map(e => e.driverId), ...Array(12).fill('')].slice(0, 12));
      if (pred.bonuses?.fastestLap) setFl(pred.bonuses.fastestLap);
      if (pred.bonuses?.safetyCar !== undefined) setSc(pred.bonuses.safetyCar);
      if (pred.bonuses?.dnfDrivers) setDnfs([...pred.bonuses.dnfDrivers, '', ''].slice(0, 3));
    });
  }, [user, race]);

  const usedDrivers = [...fullGrid, ...lastTail, fl, ...dnfs].filter(Boolean);

  const handleSubmit = async () => {
    setError(''); setSaved(false);
    if (fullGrid.some(d => !d)) return setError('Completa tutti i 10 piloti nella griglia principale');
    if (!fl)       return setError('Inserisci il giro veloce');
    if (sc === null) return setError('Specifica se ci sarà Safety Car / VSC');

    setLoading(true);
    try {
      await savePrediction(user, race.raceId, {
        fullGrid: fullGrid.map((driverId, i) => ({ pos: i + 1, driverId })),
        lastTail: lastTail.filter(Boolean).map((driverId, i) => ({ pos: 11 + i, driverId })),
        bonuses: { fastestLap: fl, safetyCar: sc, dnfDrivers: dnfs.filter(Boolean) },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-4">
        <p className="font-black text-xl uppercase">Accesso richiesto</p>
        <button onClick={login}
          className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest">
          Accedi con Google
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-10 pb-8 space-y-4">
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 mb-1">Pick GP</p>
        <h1 className="text-3xl font-black uppercase">{race?.name}</h1>
        <p className="text-zinc-500 text-sm">{race?.circuit}</p>
      </div>

      {locked && (
        <div className="flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-zinc-400 font-bold">🔒 Pick chiusi per questa gara</p>
        </div>
      )}

      {existing && !locked && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-sm text-green-300 font-bold">Predizione già inviata — puoi aggiornarla</p>
        </div>
      )}

      {/* Griglia top 10 */}
      <SCard title="Classifica · Posizioni 1 – 10" color="text-blue-400">
        <div className="space-y-2">
          {fullGrid.map((val, i) => {
            const accent = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#6b7280';
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-black w-6 text-center shrink-0 tabular-nums" style={{ color: accent }}>
                  {i + 1}°
                </span>
                <DriverSelect
                  value={val}
                  onChange={v => setFullGrid(g => { const n = [...g]; n[i] = v; return n; })}
                  placeholder={`Posizione ${i + 1}`}
                  exclude={usedDrivers.filter(d => d !== val)}
                />
              </div>
            );
          })}
        </div>
      </SCard>

      {/* Zona coda */}
      <SCard title="Zona coda · Posizioni 11 – 22">
        <p className="text-[11px] text-zinc-600 mb-3">Opzionale ma vale punti — inserisci i piloti rimanenti in ordine.</p>
        <div className="space-y-2">
          {lastTail.map((val, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-black w-6 text-center shrink-0 tabular-nums" style={{ color: i >= 7 ? '#a855f7' : '#52525b' }}>
                {11 + i}°
              </span>
              <DriverSelect
                value={val}
                onChange={v => setLastTail(t => { const n = [...t]; n[i] = v; return n; })}
                placeholder={`Pos. ${11 + i} (opzionale)`}
                exclude={usedDrivers.filter(d => d !== val)}
              />
            </div>
          ))}
        </div>
      </SCard>

      {/* Bonus */}
      <SCard title="Bonus gara" color="text-yellow-500">
        <div className="space-y-4">

          {/* Giro veloce */}
          <div>
            <p className="text-[11px] text-zinc-500 font-bold mb-2 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-orange-400" /> Giro veloce *
            </p>
            <DriverSelect value={fl} onChange={setFl} placeholder="Chi farà il giro veloce?" />
          </div>

          {/* Safety Car */}
          <div>
            <p className="text-[11px] text-zinc-500 font-bold mb-2 flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-cyan-400" /> Safety Car / VSC *
            </p>
            <div className="flex gap-3">
              {[true, false].map(v => (
                <button key={String(v)} onClick={() => setSc(v)}
                  className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest border transition
                    ${sc === v
                      ? v ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-zinc-800 border-zinc-600 text-zinc-300'
                      : 'bg-transparent border-white/10 text-zinc-600 hover:text-zinc-300'}`}>
                  {v ? '✅ Sì' : '❌ No'}
                </button>
              ))}
            </div>
          </div>

          {/* DNF */}
          <div>
            <p className="text-[11px] text-zinc-500 font-bold mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 text-red-400" /> DNF / DNS previsti
            </p>
            <div className="space-y-2">
              {dnfs.map((val, i) => (
                <DriverSelect key={i}
                  value={val}
                  onChange={v => setDnfs(d => { const n = [...d]; n[i] = v; return n; })}
                  placeholder={`Ritiro ${i + 1} (opzionale)`}
                  exclude={usedDrivers.filter(d => d !== val)}
                />
              ))}
            </div>
          </div>
        </div>
      </SCard>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Submit */}
      {!locked && (
        <button onClick={handleSubmit} disabled={loading}
          className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all
            ${saved    ? 'bg-green-600 text-white' :
              loading  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' :
              'bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/20'}`}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvataggio...</>
           : saved   ? <><CheckCircle2 className="w-4 h-4" /> Predizione salvata!</>
           : existing ? <><Zap className="w-4 h-4" /> Aggiorna predizione</>
           :            <><Zap className="w-4 h-4" /> Invia predizione</>}
        </button>
      )}
    </div>
  );
}
