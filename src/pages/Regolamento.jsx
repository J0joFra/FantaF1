import { Zap, Flame, Shield } from 'lucide-react';
import { SCORING_RULES } from '../lib/scoring';

export default function Regolamento() {
  const autoRules   = Object.entries(SCORING_RULES).filter(([, v]) => v.type === 'auto');
  const manualRules = Object.entries(SCORING_RULES).filter(([, v]) => v.type === 'manual');

  return (
    <div className="px-4 pt-10 pb-8 space-y-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 mb-1">FantaF1 2026</p>
        <h1 className="text-3xl font-black uppercase">Regolamento</h1>
      </div>

      {/* Punti automatici */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-black uppercase italic">Punti automatici</h2>
        </div>
        <p className="text-zinc-500 text-sm mb-4">Calcolati dopo ogni gara. Nessuna discrezionalità.</p>
        <div className="space-y-2">
          {autoRules.map(([key, rule]) => (
            <div key={key} className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-[#1a1a1a]">
              <span className="text-sm font-bold text-zinc-300">{rule.label}</span>
              <span className="text-sm font-black text-green-400 tabular-nums">+{rule.points}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bonus manuali */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-black uppercase italic">Bonus gara</h2>
        </div>
        <p className="text-zinc-500 text-sm mb-4">Inseriti dall'admin dopo ogni gara.</p>
        <div className="space-y-2">
          {manualRules.map(([key, rule]) => (
            <div key={key} className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-[#1a1a1a]">
              <span className="text-sm font-bold text-zinc-300">{rule.label}</span>
              <span className="text-sm font-black text-green-400 tabular-nums">+{rule.points}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Regole generali */}
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-black uppercase italic">Regole generali</h2>
        </div>
        <ul className="space-y-3 text-sm text-zinc-500 leading-relaxed">
          {[
            'Il pick si chiude alle 23:59 del giorno prima della gara.',
            'La predizione include la griglia completa 1–22, il giro veloce, la safety car e i DNF previsti.',
            'I punteggi vengono elaborati entro 24 ore dalla fine della gara.',
            'In caso di errori nei dati, l\'admin può correggere manualmente i punteggi.',
            'I token SFT della Fan Zone sono separati dal punteggio FantaF1.',
          ].map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-red-500 font-black shrink-0">·</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
