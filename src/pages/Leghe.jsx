import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Users, LogIn, Copy, ChevronRight, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function Leghe() {
  const [user, setUser] = useState(null);
  const [myLeagues, setMyLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const u = await base44.auth.me();
    setUser(u);
    const members = await base44.entities.LeagueMember.filter({ user_email: u.email });
    const leagueDetails = await Promise.all(
      members.map(async m => {
        const leagues = await base44.entities.League.filter({ id: m.league_id });
        const allMembers = await base44.entities.LeagueMember.filter({ league_id: m.league_id });
        return { ...m, league: leagues[0], memberCount: allMembers.length };
      })
    );
    setMyLeagues(leagueDetails);
    setLoading(false);
  }

  async function createLeague() {
    if (!newName.trim()) return;
    setSaving(true);
    const code = generateCode();
    const league = await base44.entities.League.create({
      name: newName.trim(),
      code,
      season: 2026,
      is_public: false,
    });
    await base44.entities.LeagueMember.create({
      league_id: league.id,
      user_email: user.email,
      user_name: user.full_name,
      total_points: 0,
      rank: 1,
    });
    toast.success(`Lega "${newName}" creata! Codice: ${code}`);
    setNewName('');
    setShowCreate(false);
    setSaving(false);
    loadData();
  }

  async function joinLeague() {
    if (!joinCode.trim()) return;
    setSaving(true);
    const leagues = await base44.entities.League.filter({ code: joinCode.trim().toUpperCase() });
    if (!leagues[0]) {
      toast.error('Codice non valido');
      setSaving(false);
      return;
    }
    const league = leagues[0];
    const existing = await base44.entities.LeagueMember.filter({ league_id: league.id, user_email: user.email });
    if (existing[0]) {
      toast.error('Sei già in questa lega!');
      setSaving(false);
      return;
    }
    await base44.entities.LeagueMember.create({
      league_id: league.id,
      user_email: user.email,
      user_name: user.full_name,
      total_points: 0,
      rank: 999,
    });
    toast.success(`Hai aderito a "${league.name}"! 🏎️`);
    setJoinCode('');
    setShowJoin(false);
    setSaving(false);
    loadData();
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-ferrari-red border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="relative bg-gradient-to-b from-[#0e0e1a] via-[#130a0a] to-background px-4 pt-14 pb-6">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ferrari-red/50 to-transparent" />
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-1">Gestione</p>
        <h1 className="font-barlow font-black text-3xl text-foreground uppercase">Le Mie Leghe</h1>
      </div>

      <div className="px-4 space-y-4">

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); }}
            className="flex items-center justify-center gap-2 bg-ferrari-red text-white font-barlow font-bold text-sm uppercase tracking-wide rounded-xl py-3 transition-all hover:bg-ferrari-red/90"
          >
            <Plus size={16} />
            Crea Lega
          </button>
          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); }}
            className="flex items-center justify-center gap-2 bg-secondary text-foreground font-barlow font-bold text-sm uppercase tracking-wide rounded-xl py-3 border border-border transition-all hover:bg-secondary/70"
          >
            <LogIn size={16} />
            Unisciti
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-barlow font-bold text-sm uppercase tracking-widest text-ferrari-red">Nuova Lega</h3>
            <input
              type="text"
              placeholder="Nome della lega..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ferrari-red"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground font-medium">
                Annulla
              </button>
              <button onClick={createLeague} disabled={saving || !newName.trim()} className="flex-1 py-2.5 rounded-xl bg-ferrari-red text-white font-barlow font-bold text-sm uppercase disabled:opacity-50">
                {saving ? '...' : 'Crea'}
              </button>
            </div>
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-barlow font-bold text-sm uppercase tracking-widest text-ferrari-gold">Unisciti a una Lega</h3>
            <input
              type="text"
              placeholder="Codice invito (es. AB12CD)..."
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ferrari-gold font-barlow font-bold tracking-widest text-center uppercase"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowJoin(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground font-medium">
                Annulla
              </button>
              <button onClick={joinLeague} disabled={saving || !joinCode.trim()} className="flex-1 py-2.5 rounded-xl bg-ferrari-gold text-accent-foreground font-barlow font-bold text-sm uppercase disabled:opacity-50">
                {saving ? '...' : 'Entra'}
              </button>
            </div>
          </div>
        )}

        {/* My leagues */}
        {myLeagues.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-8 text-center">
            <Users size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="font-barlow font-bold text-foreground mb-1">Nessuna Lega</p>
            <p className="text-sm text-muted-foreground">Crea la tua prima lega o unisciti a una esistente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Le tue leghe</p>
            {myLeagues.map(({ league, memberCount, total_points, rank }) => (
              league && (
                <Link
                  key={league.id}
                  to={`/classifica?league=${league.id}`}
                  className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:border-ferrari-red/40 transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-ferrari-red/10 border border-ferrari-red/30 flex items-center justify-center">
                    <Trophy size={22} className="text-ferrari-red" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-barlow font-bold text-foreground uppercase truncate">{league.name}</p>
                    <p className="text-xs text-muted-foreground">{memberCount} partecipanti · Codice: {league.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-barlow font-black text-lg text-ferrari-gold">{total_points || 0}</p>
                    <p className="text-xs text-muted-foreground">punti</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                </Link>
              )
            ))}
          </div>
        )}

      </div>
    </div>
  );
}