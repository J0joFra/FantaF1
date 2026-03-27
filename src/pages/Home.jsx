// pages/Home.jsx
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getUserLeagues, savePick, getUserPick } from '../lib/firestoreService';
import { getNextGrandPrix } from '../lib/supabaseData';
import { Trophy, Zap, ChevronRight, Flag, Star, Loader2, Lock, CheckCircle2, ArrowRight, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GpCountdown from '../components/GpCountdown';
import PickModal from '../components/PickModal';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function Home() {
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const [nextGp, setNextGp] = useState(null);
  const [myPick, setMyPick] = useState(null);
  const [myLeagues, setMyLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPickModalOpen, setIsPickModalOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    loadGp();
    if (user) loadUserData();
    else setLoading(false);
  }, [user]);

  async function loadGp() {
    try {
      const gp = await getNextGrandPrix();
      setNextGp(gp);
    } catch (err) {
      console.error('Errore GP:', err);
    }
  }

  async function loadUserData() {
    try {
      setLoading(true);
      const [leagues, gp] = await Promise.all([
        getUserLeagues(user.uid),
        getNextGrandPrix(),
      ]);
      setMyLeagues(leagues);
      setNextGp(gp);
      if (gp) {
        const pick = await getUserPick(user.uid, gp.id || gp.raceId);
        setMyPick(pick);
      }
    } catch (err) {
      console.error('Errore caricamento:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePickConfirm(selectedDriver) {
    if (!nextGp || !user) return;
    try {
      await savePick(user.uid, nextGp.id || nextGp.raceId, selectedDriver.id, selectedDriver.name);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#dc2626', '#ffffff', '#f59e0b'],
      });
      toast.success(`Pick confermato: ${selectedDriver.name}! 🏎️`);
      setMyPick({ driverId: selectedDriver.id, driverName: selectedDriver.name });
    } catch (err) {
      console.error(err);
      toast.error("Errore durante il salvataggio");
      throw err;
    }
  }

  const handleLogin = async () => {
    setLoginBusy(true);
    try {
      await loginWithGoogle();
    } catch {
      toast.error('Errore login');
    } finally {
      setLoginBusy(false);
    }
  };

  const isPickLocked = nextGp
    ? new Date(nextGp.pick_deadline || nextGp.lockDate) <= new Date()
    : false;

  const firstName = user?.displayName?.split(' ')[0] || 'Pilota';
  const totalPoints = myLeagues.reduce((sum, l) => sum + (l.myPoints || l.myScore || 0), 0);

  return (
    <div className="min-h-screen">
      {/* ─── HERO HEADER ─── */}
      <div className="relative pt-12 pb-6 px-5 overflow-hidden">
        {/* Decorative speed lines */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent"
              style={{ top: `${15 + i * 18}%`, left: 0, right: 0 }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.8, ease: 'easeOut' }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <p className="text-[10px] font-black tracking-[0.35em] uppercase text-red-500/70 mb-2">
            FantaF1 · Stagione 2026
          </p>

          {user ? (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-black uppercase leading-none tracking-tight">
                  Ciao,{' '}
                  <span className="relative">
                    <span className="text-red-500">{firstName}</span>
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-red-500/30 rounded" />
                  </span>
                </h1>
                <p className="text-zinc-500 text-sm mt-1 font-medium">
                  {myLeagues.length > 0
                    ? `${myLeagues.length} ${myLeagues.length === 1 ? 'lega attiva' : 'leghe attive'}`
                    : 'Nessuna lega — creane una!'}
                </p>
              </div>
              {user.photoURL && (
                <motion.img
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  src={user.photoURL}
                  alt="avatar"
                  className="w-14 h-14 rounded-2xl border-2 border-red-500/30 shadow-lg shadow-red-900/30"
                />
              )}
            </div>
          ) : (
            <div>
              <h1 className="text-4xl font-black uppercase leading-none tracking-tight">
                FantaF1
              </h1>
              <p className="text-zinc-400 text-sm mt-1">Il fantasy della Formula 1</p>
            </div>
          )}
        </motion.div>
      </div>

      <div className="px-5 space-y-4 pb-6">

        {/* ─── NEXT GP CARD ─── */}
        {nextGp && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl"
          >
            {/* Card background with gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a0a] via-[#120808] to-[#0d0d14] rounded-3xl" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            {/* Glow */}
            <div className="absolute top-0 left-1/4 w-1/2 h-px bg-red-500/40 blur-sm" />

            <div className="relative p-6">
              {/* GP Header */}
              <div className="flex justify-between items-start mb-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500/80">
                      Prossimo GP
                    </span>
                  </div>
                  <h2 className="text-2xl font-black uppercase leading-tight tracking-tight text-white">
                    {nextGp.name}
                  </h2>
                  {nextGp.circuit && (
                    <p className="text-xs text-zinc-500 mt-0.5 font-medium">{nextGp.circuit}</p>
                  )}
                </div>
                <div className="text-5xl ml-4 select-none">{nextGp.flag_emoji || '🏁'}</div>
              </div>

              {/* Countdown */}
              <div className="bg-black/30 border border-white/[0.06] rounded-2xl p-4 mb-5 backdrop-blur-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2 text-center">
                  {isPickLocked ? '🔒 Pick chiusi' : '⏱ Chiusura pick'}
                </p>
                <GpCountdown targetDate={nextGp.pick_deadline || nextGp.lockDate} />
              </div>

              {/* Pick Button */}
              {user ? (
                <button
                  onClick={() => !isPickLocked && setIsPickModalOpen(true)}
                  disabled={isPickLocked && !myPick}
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all duration-300 flex items-center justify-center gap-2.5 ${
                    myPick
                      ? isPickLocked
                        ? 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/40 cursor-default'
                        : 'bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/60'
                      : isPickLocked
                      ? 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed border border-zinc-800'
                      : 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/40 hover:shadow-red-900/60'
                  }`}
                >
                  {myPick ? (
                    <>
                      <CheckCircle2 size={15} className={isPickLocked ? 'text-zinc-500' : 'text-green-400'} />
                      {isPickLocked ? `Pick: ${myPick.driverName}` : `Modifica: ${myPick.driverName}`}
                    </>
                  ) : isPickLocked ? (
                    <>
                      <Lock size={14} />
                      Pick Chiusi
                    </>
                  ) : (
                    <>
                      <Flag size={14} />
                      Scegli il tuo Pilota
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  disabled={loginBusy}
                  className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/40 flex items-center justify-center gap-2.5 transition-all"
                >
                  {loginBusy ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
                  Accedi per fare il tuo Pick
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── STATS ROW ─── */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-3"
          >
            <Link to="/leghe" className="group relative overflow-hidden rounded-2xl bg-[#0f0f17] border border-white/[0.06] p-5 hover:border-white/10 transition-all">
              <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 rounded-full blur-2xl group-hover:bg-yellow-500/10 transition-all" />
              <Users className="w-6 h-6 text-yellow-500/70 mb-3" />
              <p className="text-3xl font-black text-white">{myLeagues.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">
                {myLeagues.length === 1 ? 'Lega' : 'Leghe'}
              </p>
            </Link>

            <Link to="/classifica" className="group relative overflow-hidden rounded-2xl bg-[#0f0f17] border border-white/[0.06] p-5 hover:border-white/10 transition-all">
              <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all" />
              <Zap className="w-6 h-6 text-red-500/70 mb-3" />
              <p className="text-3xl font-black text-white">{loading ? '—' : totalPoints}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">Punti Totali</p>
            </Link>
          </motion.div>
        )}

        {/* ─── LOGIN PROMPT (if not logged) ─── */}
        {!user && !authLoading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-3xl bg-[#0f0f17] border border-white/[0.06] p-6"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl" />
            <h3 className="font-black text-lg uppercase tracking-tight mb-1">Entra nel Paddock</h3>
            <p className="text-zinc-500 text-sm mb-4">Accedi con Google per fare i pick e sfidare i tuoi amici.</p>
            <button
              onClick={handleLogin}
              disabled={loginBusy}
              className="flex items-center gap-3 bg-white text-black font-black text-xs uppercase tracking-widest px-5 py-3 rounded-xl hover:bg-zinc-100 transition-all"
            >
              {loginBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Accedi con Google
            </button>
          </motion.div>
        )}

        {/* ─── HOW IT WORKS ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl bg-[#0f0f17] border border-white/[0.06] overflow-hidden"
        >
          <div className="px-5 pt-5 pb-2 border-b border-white/[0.05]">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">Come Funziona</p>
          </div>
          <div className="p-5 space-y-0 divide-y divide-white/[0.04]">
            {[
              { n: '01', title: 'Unisciti a una Lega', desc: 'Sfida i tuoi amici con codice segreto', icon: Users, color: 'text-blue-400' },
              { n: '02', title: 'Scegli il Pilota', desc: 'Prima della chiusura dei pick', icon: Flag, color: 'text-red-400' },
              { n: '03', title: 'Accumula Punti', desc: 'Vittorie, pole e giro veloce', icon: Trophy, color: 'text-yellow-400' },
            ].map(({ n, title, desc, icon: Icon, color }) => (
              <div key={n} className="flex items-center gap-4 py-4">
                <div className={`w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-white uppercase tracking-tight">{title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                </div>
                <span className="text-2xl font-black text-zinc-800 tabular-nums">{n}</span>
              </div>
            ))}
          </div>
          <Link
            to="/regolamento"
            className="flex items-center justify-between px-5 py-4 border-t border-white/[0.05] text-xs text-zinc-500 hover:text-zinc-300 transition-colors group"
          >
            <span className="font-bold uppercase tracking-wider">Leggi il regolamento completo</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

      </div>

      {/* ─── PICK MODAL ─── */}
      {user && (
        <PickModal
          isOpen={isPickModalOpen}
          onClose={() => setIsPickModalOpen(false)}
          onConfirm={handlePickConfirm}
          currentPick={myPick}
          raceName={nextGp?.name}
          raceFlag={nextGp?.flag_emoji || '🏁'}
          deadline={nextGp?.pick_deadline || nextGp?.lockDate}
        />
      )}
    </div>
  );
}