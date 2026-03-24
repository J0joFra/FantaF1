import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy, Medal, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const medals = ['🥇', '🥈', '🥉'];

export default function Classifica() {
  const [user, setUser] = useState(null);
  const [myLeagues, setMyLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [leagueDetails, setLeagueDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const u = await base44.auth.me();
    setUser(u);

    const urlParams = new URLSearchParams(window.location.search);
    const leagueIdParam = urlParams.get('league');

    const myMemberships = await base44.entities.LeagueMember.filter({ user_email: u.email });
    const leaguesData = await Promise.all(
      myMemberships.map(async m => {
        const l = await base44.entities.League.filter({ id: m.league_id });
        return { ...m, league: l[0] };
      })
    );
    setMyLeagues(leaguesData);

    const firstLeague = leagueIdParam
      ? leaguesData.find(l => l.league_id === leagueIdParam) || leaguesData[0]
      : leaguesData[0];

    if (firstLeague) {
      setSelectedLeague(firstLeague);
      await loadLeagueMembers(firstLeague);
    }

    setLoading(false);
  }

  async function loadLeagueMembers(memberObj) {
    setSelectedLeague(memberObj);
    const allMembers = await base44.entities.LeagueMember.filter(
      { league_id: memberObj.league_id },
      '-total_points',
      50
    );
    setMembers(allMembers);
    if (memberObj.league) setLeagueDetails(memberObj.league);
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
        <div className="flex items-center gap-3 mb-1">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft size={22} />
          </Link>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Lega</p>
        </div>
        <h1 className="font-barlow font-black text-3xl text-foreground uppercase pl-9">
          {leagueDetails?.name || 'Classifica'}
        </h1>
        {leagueDetails && (
          <p className="text-xs text-muted-foreground pl-9">Codice: {leagueDetails.code}</p>
        )}
      </div>

      <div className="px-4 space-y-4">

        {/* League selector */}
        {myLeagues.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {myLeagues.map(m => (
              m.league && (
                <button
                  key={m.league_id}
                  onClick={() => loadLeagueMembers(m)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-barlow font-bold uppercase tracking-wide border transition-all ${
                    selectedLeague?.league_id === m.league_id
                      ? 'bg-ferrari-red border-ferrari-red text-white'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m.league?.name}
                </button>
              )
            ))}
          </div>
        )}

        {/* No league */}
        {myLeagues.length === 0 && (
          <div className="rounded-2xl bg-card border border-border p-8 text-center">
            <Trophy size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="font-barlow font-bold text-foreground mb-2">Nessuna Lega</p>
            <Link to="/leghe" className="inline-flex items-center gap-2 bg-ferrari-red text-white font-barlow font-bold text-sm uppercase px-5 py-2.5 rounded-xl">
              Vai alle Leghe
            </Link>
          </div>
        )}

        {/* Leaderboard */}
        {members.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
              Classifica · {members.length} partecipanti
            </p>
            {members.map((member, index) => {
              const isMe = member.user_email === user?.email;
              const isTop3 = index < 3;
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-4 rounded-2xl p-4 border transition-all ${
                    isMe
                      ? 'bg-ferrari-red/10 border-ferrari-red/40'
                      : 'bg-card border-border'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center flex-shrink-0">
                    {isTop3 ? (
                      <span className="text-xl">{medals[index]}</span>
                    ) : (
                      <span className="font-barlow font-black text-lg text-muted-foreground">{index + 1}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-barlow font-black text-lg ${
                    isMe ? 'bg-ferrari-red text-white' : 'bg-secondary text-foreground'
                  }`}>
                    {(member.user_name || member.user_email)?.[0]?.toUpperCase() || '?'}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-barlow font-bold text-sm uppercase truncate ${isMe ? 'text-ferrari-red' : 'text-foreground'}`}>
                      {member.user_name || member.user_email}
                      {isMe && <span className="text-xs ml-2 text-muted-foreground normal-case font-inter font-normal">(tu)</span>}
                    </p>
                  </div>

                  {/* Points */}
                  <div className="text-right">
                    <p className={`font-barlow font-black text-xl ${isTop3 && index === 0 ? 'text-ferrari-gold' : isMe ? 'text-ferrari-red' : 'text-foreground'}`}>
                      {member.total_points || 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">PTS</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}