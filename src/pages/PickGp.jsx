import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Flag, Lock, CheckCircle, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import DriverCard from '../components/DriverCard';
import GpCountdown from '../components/GpCountdown';
import { toast } from 'sonner';

export default function PickGp() {
  const [user, setUser] = useState(null);
  const [nextGp, setNextGp] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [existingPick, setExistingPick] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickClosed, setPickClosed] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const u = await base44.auth.me();
    setUser(u);

    const [liveGps, upcomingGps, driversData] = await Promise.all([
      base44.entities.GrandPrix.filter({ status: 'live' }, 'race_date', 1),
      base44.entities.GrandPrix.filter({ status: 'upcoming' }, 'race_date', 1),
      base44.entities.Driver.filter({ season: 2026, is_active: true }, 'number', 20),
    ]);

    const gp = liveGps[0] || upcomingGps[0] || null;
    setNextGp(gp);
    setDrivers(driversData);

    if (gp) {
      const closed = new Date(gp.pick_deadline) <= new Date();
      setPickClosed(closed);
    }

    const members = await base44.entities.LeagueMember.filter({ user_email: u.email });
    setMyLeagues(members);
    if (members.length > 0) {
      setSelectedLeague(members[0]);
      if (gp) {
        const picks = await base44.entities.Pick.filter({ user_email: u.email, gp_id: gp.id, league_id: members[0].league_id });
        if (picks[0]) setExistingPick(picks[0]);
      }
    }

    setLoading(false);
  }

  async function handleLeagueChange(member) {
    setSelectedLeague(member);
    setExistingPick(null);
    if (nextGp) {
      const picks = await base44.entities.Pick.filter({ user_email: user.email, gp_id: nextGp.id, league_id: member.league_id });
      setExistingPick(picks[0] || null);
    }
  }

  async function savePick() {
    if (!selectedDriver || !selectedLeague || !nextGp) return;
    setSaving(true);
    const data = {
      user_email: user.email,
      user_name: user.full_name,
      league_id: selectedLeague.league_id,
      gp_id: nextGp.id,
      driver_id: selectedDriver.id,
      driver_name: `${selectedDriver.name} ${selectedDriver.surname}`,
      driver_team: selectedDriver.team,
      points: 0,
      is_locked: false,
    };
    if (existingPick) {
      await base44.entities.Pick.update(existingPick.id, data);
      toast.success('Pick aggiornato!');
    } else {
      await base44.entities.Pick.create(data);
      toast.success('Pick salvato! Buona fortuna! 🏎️');
    }
    setExistingPick(data);
    setSaving(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-ferrari-red border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative bg-gradient-to-b from-[#0e0e1a] via-[#130a0a] to-background px-4 pt-14 pb-6">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ferrari-red/50 to-transparent" />
        <div className="flex items-center gap-3 mb-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft size={22} />
          </Link>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Pick GP</p>
            <h1 className="font-barlow font-black text-2xl text-foreground uppercase">
              {nextGp ? nextGp.name : 'Nessun GP'}
            </h1>
          </div>
        </div>

        {nextGp && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{nextGp.flag_emoji}</span>
                <div>
                  <p className="font-barlow font-bold text-sm text-foreground uppercase">{nextGp.circuit}</p>
                  <p className="text-xs text-muted-foreground">{nextGp.country}</p>
                </div>
              </div>
              {pickClosed ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary rounded-full px-3 py-1">
                  <Lock size={10} />
                  <span>Pick Chiuso</span>
                </div>
              ) : (
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
            {!pickClosed && <GpCountdown deadline={nextGp.pick_deadline} />}
          </div>
        )}
      </div>

      <div className="px-4 space-y-4">

        {/* No GP */}
        {!nextGp && (
          <div className="rounded-2xl bg-card border border-border p-8 text-center">
            <Flag size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="font-barlow font-bold text-foreground">Nessun GP disponibile</p>
            <p className="text-sm text-muted-foreground mt-1">Il prossimo GP non è ancora stato programmato.</p>
          </div>
        )}

        {/* No leagues */}
        {nextGp && myLeagues.length === 0 && (
          <div className="rounded-2xl bg-card border border-border p-8 text-center">
            <p className="font-barlow font-bold text-foreground mb-2">Nessuna Lega</p>
            <p className="text-sm text-muted-foreground mb-4">Entra in una lega per poter fare il pick.</p>
            <Link to="/leghe" className="inline-flex items-center gap-2 bg-ferrari-red text-white font-barlow font-bold text-sm uppercase px-5 py-2.5 rounded-xl">
              Vai alle Leghe
            </Link>
          </div>
        )}

        {/* League selector */}
        {nextGp && myLeagues.length > 1 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-2">Selezione Lega</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {myLeagues.map(m => (
                <button
                  key={m.league_id}
                  onClick={() => handleLeagueChange(m)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-barlow font-bold uppercase tracking-wide border transition-all ${
                    selectedLeague?.league_id === m.league_id
                      ? 'bg-ferrari-red border-ferrari-red text-white'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m.user_name || m.league_id}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current pick banner */}
        {existingPick && (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
            <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Pick attuale</p>
              <p className="font-barlow font-bold text-foreground uppercase">{existingPick.driver_name}</p>
            </div>
            {!pickClosed && <span className="ml-auto text-xs text-muted-foreground">Puoi cambiarlo</span>}
          </div>
        )}

        {/* Drivers list */}
        {nextGp && myLeagues.length > 0 && !pickClosed && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-3">
              Scegli il tuo Pilota
            </p>
            {drivers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nessun pilota disponibile per questa stagione.
              </div>
            ) : (
              <div className="space-y-2">
                {drivers.map(driver => (
                  <DriverCard
                    key={driver.id}
                    driver={driver}
                    isSelected={selectedDriver?.id === driver.id}
                    onSelect={setSelectedDriver}
                    disabled={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Save button */}
        {selectedDriver && !pickClosed && (
          <div className="sticky bottom-24 pt-2">
            <button
              onClick={savePick}
              disabled={saving}
              className="w-full bg-ferrari-red hover:bg-ferrari-red/90 text-white font-barlow font-black text-lg uppercase tracking-wider rounded-2xl py-4 shadow-lg shadow-ferrari-red/30 transition-all disabled:opacity-70"
            >
              {saving ? 'Salvataggio...' : `Conferma ${selectedDriver.surname} 🏎️`}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}