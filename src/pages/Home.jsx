import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getUserLeagues, savePick, getUserPick } from '../lib/firestoreService';
import { getNextGrandPrix } from '../lib/supabaseData';
import { Flag, Lock, CheckCircle2, Loader2, Users, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
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
  const [pickModalOpen, setPickModalOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    loadGp();
    if (user) loadUserData();
    else setLoading(false);
  }, [user]);

  async function loadGp() {
    try { setNextGp(await getNextGrandPrix()); } catch {}
  }

  async function loadUserData() {
    setLoading(true);
    try {
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePickConfirm(driver) {
    if (!nextGp || !user) return;
    await savePick(user.uid, nextGp.id || nextGp.raceId, driver.id, driver.name);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 }, colors: ['#dc2626', '#fff', '#f59e0b'] });
    toast.success(`Pick: ${driver.name} 🏎️`);
    setMyPick({ driverId: driver.id, driverName: driver.name });
  }

  const handleLogin = async () => {
    setLoginBusy(true);
    try { await loginWithGoogle(); } catch { toast.error('Errore login'); } finally { setLoginBusy(false); }
  };

  const isLocked = nextGp ? new Date(nextGp.pick_deadline || nextGp.lockDate) <= new Date() : false;
  const firstName = user?.displayName?.split(' ')[0] || 'Pilota';
  const totalPoints = myLeagues.reduce((s, l) => s + (l.myPoints || l.myScore || 0), 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative pt-12 pb-4 px-5">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/15 to-transparent pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[9px] font-black tracking-[0.35em] uppercase text-red-500/60 mb-1.5">FantaF1 · 2026</p>
          {user ? (
            <div className="flex items-center justify-between">
              <h1 className="text-4xl font-black uppercase leading-none tracking-tight">
                Ciao, <span className="text-red-500">{firstName}</span>
              </h1>
              {user.photoURL && (
                <img src={user.photoURL} alt="avatar" className="w-12 h-12 rounded-2xl border-2 border-red-500/25" />
              )}
            </div>
          ) : (
            <h1 className="text-4xl font-black uppercase leading-none tracking-tight">FantaF1</h1>
          )}
        </motion.div>
      </div>

      <div className="px-4 pb-8 space-y-3">

        {/* GP Card — protagonista */}
        {nextGp && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="relative overflow-hidden rounded-3xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a0808] via-[#110808] to-[#0d0d14]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

            <div className="relative p-5">
              {/* GP info */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500/70">Prossimo GP</span>
                  </div>
                  <h2 className="text-2xl font-black uppercase leading-none text-white">{nextGp.name}</h2>
                  {nextGp.circuit && <p className="text-[11px] text-zinc-500 mt-0.5">{nextGp.circuit}</p>}
                </div>
                <span className="text-5xl select-none">{nextGp.flag_emoji || '🏁'}</span>
              </div>

              {/* Countdown */}
              <div className="bg-black/25 border border-white/[0.05] rounded-2xl p-3.5 mb-4">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2 text-center">
                  {isLocked ? '🔒 Pick chiusi' : 'Chiusura pick'}
                </p>
                <GpCountdown targetDate={nextGp.pick_deadline || nextGp.lockDate} />
              </div>

              {/* Pick CTA */}
              {user ? (
                <button
                  onClick={() => !isLocked && setPickModalOpen(true)}
                  className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all ${
                    myPick
                      ? isLocked
                        ? 'bg-white/[0.04] border border-white/[0.06] text-zinc-500 cursor-default'
                        : 'bg-green-500/10 border border-green-500/25 text-green-400 hover:bg-green-500/15'
                      : isLocked
                      ? 'bg-white/[0.03] border border-white/[0.05] text-zinc-700 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-950/50'
                  }`}
                >
                  {myPick ? (
                    <><CheckCircle2 size={14} />{isLocked ? `Pick: ${myPick.driverName}` : `Modifica — ${myPick.driverName}`}</>
                  ) : isLocked ? (
                    <><Lock size={13} />Pick chiusi</>
                  ) : (
                    <><Flag size={13} />Scegli il pilota</>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  disabled={loginBusy}
                  className="w-full py-4 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:bg-red-500 transition-all"
                >
                  {loginBusy ? <Loader2 size={13} className="animate-spin" /> : <Flag size={13} />}
                  Accedi per il pick
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Stats — solo se loggato */}
        {user && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 gap-3"
          >
            <Link to="/leghe" className="group bg-[#0f0f17] border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-all">
              <Users className="w-5 h-5 text-yellow-500/60 mb-3" />
              <p className="text-3xl font-black text-white">{myLeagues.length}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mt-0.5">
                {myLeagues.length === 1 ? 'Lega' : 'Leghe'}
              </p>
            </Link>
            <div className="bg-[#0f0f17] border border-white/[0.06] rounded-2xl p-5">
              <Zap className="w-5 h-5 text-red-500/60 mb-3" />
              <p className="text-3xl font-black text-white">{totalPoints}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mt-0.5">Punti totali</p>
            </div>
          </motion.div>
        )}

        {/* Login prompt — solo se non loggato */}
        {!user && !authLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative overflow-hidden rounded-2xl bg-[#0f0f17] border border-white/[0.06] p-5"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
            <p className="font-black text-base uppercase tracking-tight text-white mb-1">Entra nel paddock</p>
            <p className="text-zinc-500 text-xs mb-4">Sfida i tuoi amici ogni Gran Premio</p>
            <button
              onClick={handleLogin}
              disabled={loginBusy}
              className="flex items-center gap-2.5 bg-white text-black font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-xl hover:bg-zinc-100 transition-all"
            >
              {loginBusy ? <Loader2 size={12} className="animate-spin" /> : (
                <svg width="13" height="13" viewBox="0 0 24 24">
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

        {/* Quick nav — regolamento */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Link
            to="/regolamento"
            className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#0f0f17] border border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/10 transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-widest">Come funziona i punti</span>
            <span className="text-zinc-700">›</span>
          </Link>
        </motion.div>

      </div>

      {user && (
        <PickModal
          isOpen={pickModalOpen}
          onClose={() => setPickModalOpen(false)}
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
