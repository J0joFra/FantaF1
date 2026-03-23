import { LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

/**
 * Da mostrare nelle pagine protette quando l'utente non è loggato.
 * Uso: if (!user) return <UserNotRegisteredError />;
 */
export default function UserNotRegisteredError({ message = 'Accedi per continuare' }) {
  const { login } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <div>
        <p className="font-black text-xl uppercase text-white">Accesso richiesto</p>
        <p className="text-zinc-500 text-sm mt-1 max-w-xs">{message}</p>
      </div>
      <button
        onClick={login}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition"
      >
        <LogIn className="w-4 h-4" />
        Accedi con Google
      </button>
    </div>
  );
}
