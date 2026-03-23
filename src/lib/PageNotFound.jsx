import { Link } from 'react-router-dom';
import { Flag } from 'lucide-react';

export default function PageNotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-6 px-4 text-white text-center">
      <Flag className="w-12 h-12 text-red-500" />
      <div>
        <p className="text-6xl font-black text-red-500">404</p>
        <p className="text-xl font-black uppercase mt-2">Pagina non trovata</p>
        <p className="text-zinc-600 text-sm mt-2">Hai sbagliato curva.</p>
      </div>
      <Link to="/"
        className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition">
        Torna ai box
      </Link>
    </div>
  );
}
