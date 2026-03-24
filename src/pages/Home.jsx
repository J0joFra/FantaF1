import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase'; // Tua config Firebase
import { supabase } from '../lib/supabase'; // Tua config Supabase
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Flag, Trophy, Zap, ChevronRight, Star } from 'lucide-react';
import GpCountdown from '../components/GpCountdown';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { motion } from 'framer-motion';

export default function Home() {
  const [user, setUser] = useState(null);
  const [nextGp, setNextGp] = useState(null);
  const [myLeagues, setMyLeagues] = useState([]);
  const [myPick, setMyPick] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
        loadData(u);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  async function loadData(currentUser) {
    try {
      // 1. Recupero GP da Supabase
      const { data: gps, error } = await supabase
        .from('grand_prix')
        .select('*')
        .or('status.eq.upcoming,status.eq.live')
        .order('race_date', { ascending: true })
        .limit(1);

      const gp = gps?.[0] || null;
      setNextGp(gp);

      // 2. Recupero Leghe da Firestore
      const leaguesRef = collectionGroup(db, 'members');
      const q = query(leaguesRef, where('user_email', '==', currentUser.email));
      const querySnapshot = await getDocs(q);
      const members = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        league_id: docSnap.ref.parent.parent?.id,
        ...docSnap.data(),
      })).filter((m) => Boolean(m.league_id));
      setMyLeagues(members);

      // 3. Recupero Pick (se esiste GP e utente ha leghe)
      if (gp && members.length > 0) {
        const pickRef = doc(
          db,
          'fantaF1Leagues',
          members[0].league_id,
          'picks',
          gp.id,
          'userPicks',
          currentUser.uid
        );
        const pickSnap = await getDoc(pickRef);
        setMyPick(pickSnap.exists() ? pickSnap.data() : null);
      }
    } catch (err) {
      console.error("Errore caricamento dati:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-ferrari-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#0e0e1a] via-[#130a0a] to-background px-4 pt-14 pb-8">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ferrari-red/50 to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-ferrari-red animate-pulse" />
            <span className="text-[10px] text-muted-foreground font-barlow font-bold uppercase tracking-[0.2em]">Season 2026 · FantaF1</span>
          </div>
          <h1 className="font-barlow font-black text-5xl text-foreground uppercase leading-none tracking-tight">
            BENVENUTO,<br />
            <span className="text-ferrari-red italic">{user?.displayName?.split(' ')[0]?.toUpperCase() || 'PILOTA'}</span>
          </h1>
        </div>
      </div>

      <motion.div
        className="px-4 space-y-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >

        {/* Next GP Card */}
        {nextGp ? (
          <motion.div
            className="rounded-2xl bg-card border border-border overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          >
            <div className="bg-gradient-to-r from-ferrari-red/20 to-transparent px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag size={14} className="text-ferrari-red" />
                <span className="text-xs font-barlow font-bold uppercase tracking-widest text-ferrari-red">
                  {nextGp.status === 'live' ? '🔴 LIVE' : 'Prossimo GP'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">Round {nextGp.round}</span>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-3xl mb-1">{nextGp.flag_emoji}</p>
                  <h2 className="font-barlow font-black text-2xl text-foreground uppercase">{nextGp.name}</h2>
                  <p className="text-muted-foreground text-sm">{nextGp.circuit}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Data gara</p>
                  <p className="font-barlow font-bold text-sm text-foreground">
                    {format(new Date(nextGp.race_date), 'd MMM', { locale: it })}
                  </p>
                </div>
              </div>

              {nextGp.status !== 'live' && (
                <>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                    Scadenza Pick
                  </p>
                  <GpCountdown targetDate={nextGp.pick_deadline} />
                </>
              )}

              {/* Pick status */}
              {myPick ? (
                <div className="mt-4 flex items-center gap-3 bg-ferrari-red/10 border border-ferrari-red/30 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-full bg-ferrari-red flex items-center justify-center">
                    <Star size={16} className="text-white fill-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Il tuo pick</p>
                    <p className="font-barlow font-bold text-foreground uppercase">{myPick.driver_name}</p>
                  </div>
                </div>
              ) : (
                <Link to="/pick" className="mt-4 flex items-center justify-center gap-2 bg-ferrari-red hover:bg-ferrari-red/90 text-white font-barlow font-bold text-sm uppercase tracking-wider rounded-xl py-3 transition-all">
                  <Zap size={16} />
                  Fai il tuo Pick
                </Link>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="rounded-2xl bg-card border border-border p-6 text-center">
            <Flag size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nessun GP in programma</p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/leghe" className="rounded-xl bg-card border border-border p-4 flex items-center gap-3 hover:border-ferrari-red/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Trophy size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-barlow font-black text-foreground">{myLeagues.length}</p>
              <p className="text-xs text-muted-foreground">Le mie leghe</p>
            </div>
          </Link>

          <Link to="/classifica" className="rounded-xl bg-card border border-border p-4 flex items-center gap-3 hover:border-ferrari-red/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-ferrari-gold/20 flex items-center justify-center">
              <Star size={20} className="text-ferrari-gold" />
            </div>
            <div>
              <p className="text-xl font-barlow font-black text-foreground">
                {myLeagues.reduce((sum, m) => sum + (m.total_points || 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">Punti totali</p>
            </div>
          </Link>
        </div>

        {/* How it works */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <h3 className="font-barlow font-bold text-sm uppercase tracking-widest text-muted-foreground mb-3">
            Come Funziona
          </h3>
          <div className="space-y-3">
            {[
              { n: '01', title: 'Crea o unisciti a una Lega', desc: 'Sfida i tuoi amici con un codice segreto', color: 'text-ferrari-red' },
              { n: '02', title: 'Scegli il tuo Pilota', desc: 'Prima della chiusura del pick (1h prima della gara)', color: 'text-ferrari-gold' },
              { n: '03', title: 'Accumula Punti', desc: 'Vittorie, pole, giri veloci, pit stop leggendari e molto altro', color: 'text-blue-400' },
            ].map(({ n, title, desc, color }) => (
              <div key={n} className="flex items-start gap-3">
                <span className={`font-barlow font-black text-2xl leading-none ${color} w-8`}>{n}</span>
                <div>
                  <p className="font-semibold text-sm text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Link to="/regolamento" className="mt-4 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors">
            <span>Leggi il regolamento completo</span>
            <ChevronRight size={14} />
          </Link>
        </div>

      </motion.div>
    </div>
  );
}