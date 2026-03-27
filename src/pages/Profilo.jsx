import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { User, LogIn, LogOut, Trophy, Zap, Star, Loader2, Shield, Flag } from 'lucide-react';
import { toast } from 'sonner';

export default function Profilo() {
  const { user, loading: authLoading, loginWithGoogle, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    if (user) loadStats();
  }, [user]);

  async function loadStats() {
    setLoading(true);
    try {
      const q = query(collectionGroup(db, 'members'), where('user_email', '==', user.email));
      const snap = await getDocs(q);
      const memberships = snap.docs.map(d => d.data());
      const totalPts = memberships.reduce((s, m) => s + (m.total_points || 0), 0);
      const best = Math.max(0, ...memberships.map(m => m.total_points || 0));
      setStats({
        leagues: memberships.length,
        totalPoints: totalPts,
        bestScore: best,
      });
    } catch {
      setStats({ leagues: 0, totalPoints: 0, bestScore: 0 });
    } finally {
      setLoading(false);
    }
  }

  const handleAuth = async () => {
    setAuthBusy(true);
    try {
      if (user) {
        await logout();
        toast.success('Disconnesso');
      } else {
        await loginWithGoogle();
        toast.success('Benvenuto!');
      }
    } catch {
      toast.error('Errore di autenticazione');
    } finally {
      setAuthBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative pt-12 pb-6 px-5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-950/10 to-transparent pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[10px] font-black tracking-[0.35em] uppercase text-purple-400/60 mb-2">
            Account
          </p>
          <h1 className="text-4xl font-black uppercase tracking-tight leading-none">
            {user ? user.displayName?.split(' ')[0] || 'Pilota' : 'Profilo'}
          </h1>
        </motion.div>
      </div>

      <div className="px-5 space-y-4 pb-6">
        {user ? (
          <>
            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl bg-[#0f0f17] border border-white/[0.06] p-6"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl" />
              <div className="flex items-center gap-4">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="avatar"
                    className="w-16 h-16 rounded-2xl border-2 border-white/10 shadow-lg"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                    <User className="w-7 h-7 text-zinc-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-lg uppercase tracking-tight text-white truncate">
                    {user.displayName || 'Pilota'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[10px] font-bold text-green-500/80 uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Stats */}
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-700" />
              </div>
            ) : stats && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-3 gap-2.5"
              >
                {[
                  { label: 'Leghe', value: stats.leagues, icon: Trophy, color: 'text-yellow-400' },
                  { label: 'Punti', value: stats.totalPoints, icon: Zap, color: 'text-red-400' },
                  { label: 'Best', value: stats.bestScore, icon: Star, color: 'text-purple-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-[#0f0f17] border border-white/[0.06] rounded-2xl p-4 text-center">
                    <Icon className={`w-4 h-4 ${color} mx-auto mb-2`} />
                    <p className="font-black text-xl text-white tabular-nums">{value}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mt-0.5">{label}</p>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Logout */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <button
                onClick={handleAuth}
                disabled={authBusy}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/[0.06] bg-[#0f0f17] text-zinc-500 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all text-xs font-black uppercase tracking-widest"
              >
                {authBusy ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <LogOut size={13} />
                )}
                Disconnetti
              </button>
            </motion.div>
          </>
        ) : (
          /* Not logged in */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-[#0f0f17] border border-white/[0.06] p-8 text-center"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <Flag className="w-7 h-7 text-zinc-600" />
            </div>
            <h3 className="font-black text-xl uppercase tracking-tight text-white mb-2">Entra nel Box</h3>
            <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
              Accedi con il tuo account Google per vedere le statistiche e gestire il profilo.
            </p>
            <button
              onClick={handleAuth}
              disabled={authBusy}
              className="flex items-center justify-center gap-3 bg-white text-black font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-xl hover:bg-zinc-100 transition-all mx-auto"
            >
              {authBusy ? (
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
      </div>
    </div>
  );
}