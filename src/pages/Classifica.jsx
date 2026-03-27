import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import {
  collection, collectionGroup, query, where,
  getDocs, doc, getDoc, orderBy
} from 'firebase/firestore';
import { Trophy, ChevronLeft, Loader2, Users, Crown, Medal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/AuthContext';

const RANK_CONFIG = [
  { medal: '🥇', bg: 'from-yellow-500/10 to-transparent', border: 'border-yellow-500/20', text: 'text-yellow-400' },
  { medal: '🥈', bg: 'from-zinc-400/10 to-transparent', border: 'border-zinc-500/20', text: 'text-zinc-400' },
  { medal: '🥉', bg: 'from-amber-700/10 to-transparent', border: 'border-amber-700/20', text: 'text-amber-600' },
];

function MemberRow({ member, index, currentEmail }) {
  const isMe = member.user_email === currentEmail;
  const rankCfg = RANK_CONFIG[index];
  const initials = (member.user_name || member.user_email || '?')[0]?.toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className={`relative flex items-center gap-3 rounded-2xl p-4 border transition-all ${
        isMe
          ? 'bg-red-500/5 border-red-500/20'
          : index < 3
          ? `bg-gradient-to-r ${rankCfg.bg} border ${rankCfg.border}`
          : 'bg-[#0f0f17] border-white/[0.04]'
      }`}
    >
      {/* Rank */}
      <div className="w-7 text-center shrink-0">
        {index < 3 ? (
          <span className="text-xl leading-none">{rankCfg.medal}</span>
        ) : (
          <span className="font-black text-sm text-zinc-600">{index + 1}</span>
        )}
      </div>

      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0 ${
        isMe
          ? 'bg-red-500/20 border border-red-500/30 text-red-400'
          : index < 3
          ? `bg-white/[0.06] border ${rankCfg.border} ${rankCfg.text}`
          : 'bg-white/[0.03] border border-white/[0.06] text-zinc-400'
      }`}>
        {initials}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`font-black text-sm uppercase tracking-tight truncate ${
            isMe ? 'text-red-400' : 'text-white'
          }`}>
            {member.user_name || member.user_email?.split('@')[0] || 'Pilota'}
          </p>
          {isMe && (
            <span className="text-[8px] font-black bg-red-500/20 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-widest shrink-0">
              Tu
            </span>
          )}
          {index === 0 && !isMe && (
            <Crown size={10} className="text-yellow-400 shrink-0" />
          )}
        </div>
        {member.user_email && (
          <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{member.user_email}</p>
        )}
      </div>

      {/* Points */}
      <div className="text-right shrink-0">
        <p className={`font-black text-xl tabular-nums leading-none ${
          index === 0 ? 'text-yellow-400' : isMe ? 'text-red-400' : 'text-white'
        }`}>
          {member.total_points || 0}
        </p>
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mt-0.5">pts</p>
      </div>
    </motion.div>
  );
}

export default function Classifica() {
  const { user } = useAuth();
  const [myLeagues, setMyLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [leagueDetails, setLeagueDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    if (user) loadData();
    else setLoading(false);
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const urlParams = new URLSearchParams(window.location.search);
      const leagueIdParam = urlParams.get('league');

      const q = query(collectionGroup(db, 'members'), where('user_email', '==', user.email));
      const snap = await getDocs(q);

      const memberships = snap.docs.map((d) => ({
        id: d.id,
        league_id: d.ref.parent.parent?.id,
        ...d.data(),
      })).filter((m) => Boolean(m.league_id));

      const leaguesData = await Promise.all(
        memberships.map(async (m) => {
          const leagueSnap = await getDoc(doc(db, 'fantaF1Leagues', m.league_id));
          return {
            ...m,
            league: leagueSnap.exists() ? { id: leagueSnap.id, ...leagueSnap.data() } : null,
          };
        })
      );
      const valid = leaguesData.filter((l) => l.league);
      setMyLeagues(valid);

      const first = leagueIdParam
        ? valid.find((l) => l.league_id === leagueIdParam) || valid[0]
        : valid[0];

      if (first) await loadLeagueMembers(first);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeagueMembers(memberObj) {
    setSelectedLeague(memberObj);
    setLeagueDetails(memberObj.league);
    setMembersLoading(true);
    try {
      const q = query(
        collection(db, 'fantaF1Leagues', memberObj.league_id, 'members'),
        orderBy('total_points', 'desc')
      );
      const snap = await getDocs(q);
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setMembersLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-7 h-7 animate-spin text-zinc-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative pt-12 pb-6 px-5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-950/10 to-transparent pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/" className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors text-zinc-500 hover:text-white">
              <ChevronLeft size={18} />
            </Link>
            <p className="text-[10px] font-black tracking-[0.35em] uppercase text-yellow-400/60">
              Classifica
            </p>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight leading-none ml-8">
            {leagueDetails?.name || <span className="text-zinc-500">Nessuna Lega</span>}
          </h1>
          {leagueDetails?.code && (
            <p className="text-xs text-zinc-600 font-mono font-bold ml-8 mt-1">
              Codice: {leagueDetails.code}
            </p>
          )}
        </motion.div>
      </div>

      <div className="px-5 space-y-4 pb-6">

        {/* No user */}
        {!user && (
          <div className="rounded-3xl bg-[#0f0f17] border border-white/[0.06] p-10 text-center">
            <Trophy className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <p className="font-black uppercase text-zinc-500">Accedi per vedere la classifica</p>
          </div>
        )}

        {/* League selector tabs */}
        {user && myLeagues.length > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
          >
            {myLeagues.map((m) =>
              m.league ? (
                <button
                  key={m.league_id}
                  onClick={() => loadLeagueMembers(m)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    selectedLeague?.league_id === m.league_id
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-[#0f0f17] border-white/[0.06] text-zinc-500 hover:text-white hover:border-white/10'
                  }`}
                >
                  {m.league?.name}
                </button>
              ) : null
            )}
          </motion.div>
        )}

        {/* No leagues */}
        {user && myLeagues.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-[#0f0f17] border border-white/[0.06] p-10 text-center"
          >
            <Trophy size={40} className="text-zinc-700 mx-auto mb-3" />
            <p className="font-black text-sm uppercase text-zinc-500 mb-3">Nessuna Lega</p>
            <Link
              to="/leghe"
              className="inline-flex items-center gap-2 bg-red-600 text-white font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-xl hover:bg-red-500 transition-colors"
            >
              <Users size={13} />
              Vai alle Leghe
            </Link>
          </motion.div>
        )}

        {/* Members list */}
        {user && members.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 px-1">
              {members.length} Partecipanti
            </p>
            {membersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-700" />
              </div>
            ) : (
              members.map((member, index) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  index={index}
                  currentEmail={user?.email}
                />
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}