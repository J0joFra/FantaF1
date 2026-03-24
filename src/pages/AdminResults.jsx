// pages/AdminResults.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  getAllPicksForRace, 
  updatePickPoints, 
  updateAllMemberTotals 
} from '../lib/firestoreService';
import { CheckCircle, Loader2, AlertTriangle, ChevronDown } from 'lucide-react';

export default function AdminResults() {
  const { user } = useAuth();
  const [gps, setGps] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedGp, setSelectedGp] = useState(null);
  const [positions, setPositions] = useState({});
  const [fastestLap, setFastestLap] = useState('');
  const [pole, setPole] = useState('');
  const [dnfDrivers, setDnfDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const [allGps, allDrivers] = await Promise.all([
          supabase.from('grands_prix').select('*').order('race_date', { ascending: false }),
          supabase.from('drivers').select('*').eq('is_active', true),
        ]);
        
        setGps(allGps.data || []);
        setDrivers(allDrivers.data || []);
      } catch (err) {
        console.error(err);
        setMessage({ type: 'error', text: 'Errore nel caricamento dati' });
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleSave() {
    if (!selectedGp) return;
    setSaving(true);
    setMessage(null);

    const results = {
      positions,
      fastest_lap_driver_id: fastestLap || null,
      pole_driver_id: pole || null,
      dnf_driver_ids: dnfDrivers,
    };

    try {
      // 1. Salva risultati su Supabase
      await supabase
        .from('grands_prix')
        .update({ 
          race_results: results, 
          status: 'completed' 
        })
        .eq('id', selectedGp.id);

      // 2. Recupera tutti i picks per questo GP
      const picks = await getAllPicksForRace(selectedGp.raceId);

      // 3. Calcola punti per ogni pick
      for (const pick of picks) {
        const { total, breakdown } = calculatePickPoints(pick.driverId, results);
        await updatePickPoints(pick.id, total, breakdown);
      }

      // 4. Aggiorna i punti totali in tutte le leghe
      // Recupera tutte le leghe che hanno picks per questo GP
      const leagueIds = [...new Set(picks.map(p => p.leagueId).filter(Boolean))];
      
      for (const leagueId of leagueIds) {
        // Recupera tutti gli ID dei GP completati per questa lega
        const { data: completedRaces } = await supabase
          .from('grands_prix')
          .select('race_id')
          .eq('status', 'completed')
          .order('race_date');
        
        const raceIds = completedRaces?.map(r => r.race_id) || [];
        await updateAllMemberTotals(leagueId, raceIds);
      }

      setMessage({ type: 'success', text: `Risultati salvati! ${picks.length} pick aggiornati.` });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Errore durante il salvataggio' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-ferrari-red" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="text-center">
          <AlertTriangle size={40} className="text-ferrari-red mx-auto mb-3" />
          <p className="font-barlow font-bold text-xl text-foreground">Accesso negato</p>
          <p className="text-muted-foreground text-sm">Solo gli admin possono inserire i risultati.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative bg-gradient-to-b from-[#0e0e1a] via-[#130a0a] to-background px-4 pt-14 pb-6">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ferrari-red/50 to-transparent" />
        <p className="text-[10px] text-muted-foreground font-barlow font-bold uppercase tracking-[0.2em] mb-1">Admin Panel</p>
        <h1 className="font-barlow font-black text-3xl text-foreground uppercase">Inserisci Risultati</h1>
      </div>

      <div className="px-4 space-y-4 pb-8">

        {/* Seleziona GP */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-3">Gran Premio</p>
          <div className="relative">
            <select
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground font-barlow font-bold text-base appearance-none pr-10 focus:outline-none focus:border-ferrari-red"
              value={selectedGp?.id || ''}
              onChange={e => {
                const gp = gps.find(g => g.id === e.target.value);
                setSelectedGp(gp || null);
                setPositions({});
                setFastestLap('');
                setPole('');
                setDnfDrivers([]);
                setMessage(null);
              }}
            >
              <option value="">— Scegli un GP —</option>
              {gps.map(gp => (
                <option key={gp.id} value={gp.id}>
                  {gp.flag_emoji} {gp.name} (R{gp.round})
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {selectedGp && (
          <>
            {/* Posizioni finali */}
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-3">
                Posizioni Finali
              </p>
              <div className="space-y-2">
                {drivers.map(driver => (
                  <div key={driver.id} className="flex items-center gap-3">
                    <span className="text-sm font-barlow font-bold text-foreground w-36 truncate">
                      {driver.surname}
                    </span>
                    <div className="relative flex-1">
                      <select
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground appearance-none focus:outline-none focus:border-ferrari-red"
                        value={positions[driver.id] || ''}
                        onChange={e => setPositions(prev => ({
                          ...prev,
                          [driver.id]: e.target.value ? Number(e.target.value) : undefined,
                        }))}
                      >
                        <option value="">—</option>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(p => (
                          <option key={p} value={p}>P{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bonus */}
            <div className="rounded-2xl bg-card border border-border p-4 space-y-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Bonus / Malus</p>

              {/* Pole */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">🏆 Pole Position (+3 pts)</label>
                <select
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground appearance-none focus:outline-none focus:border-ferrari-red"
                  value={pole}
                  onChange={e => setPole(e.target.value)}
                >
                  <option value="">— Nessuno —</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.surname}</option>)}
                </select>
              </div>

              {/* Fastest lap */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">⚡ Giro Veloce (+5 pts)</label>
                <select
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground appearance-none focus:outline-none focus:border-ferrari-red"
                  value={fastestLap}
                  onChange={e => setFastestLap(e.target.value)}
                >
                  <option value="">— Nessuno —</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.surname}</option>)}
                </select>
              </div>

              {/* DNF */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">💥 DNF (-10 pts) — seleziona multipli</label>
                <div className="grid grid-cols-2 gap-2">
                  {drivers.map(d => (
                    <button
                      key={d.id}
                      onClick={() => toggleDnf(d.id)}
                      className={`text-left px-3 py-2 rounded-lg text-sm font-barlow font-bold border transition-all ${
                        dnfDrivers.includes(d.id)
                          ? 'bg-destructive/20 border-destructive text-red-400'
                          : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {d.surname}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Feedback */}
            {message && (
              <div className={`rounded-xl p-4 flex items-center gap-3 ${
                message.type === 'success' ? 'bg-green-500/10 border border-green-500/30' : 'bg-destructive/10 border border-destructive/30'
              }`}>
                <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                <p className="text-sm text-foreground">{message.text}</p>
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-ferrari-red text-white font-barlow font-black text-base uppercase tracking-wider rounded-2xl py-4 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
              {saving ? 'Calcolo in corso...' : 'Salva Risultati & Calcola Punti'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}