import { Zap, Flame, Shield, ChevronLeft } from 'lucide-react';
import { SCORING_RULES } from '../lib/scoring';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

function RuleRow({ label, points, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0"
    >
      <span className="text-sm text-zinc-400 pr-4 leading-snug">{label}</span>
      <span className="font-black text-base text-green-400 tabular-nums shrink-0">
        +{points}
      </span>
    </motion.div>
  );
}

export default function Regolamento() {
  const autoRules = Object.entries(SCORING_RULES).filter(([, v]) => v.type === 'auto');
  const manualRules = Object.entries(SCORING_RULES).filter(([, v]) => v.type === 'manual');

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative pt-12 pb-6 px-5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/10 to-transparent pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[10px] font-black tracking-[0.35em] uppercase text-blue-400/60 mb-2">
            FantaF1 2026
          </p>
          <h1 className="text-4xl font-black uppercase tracking-tight leading-none">
            Regolamento
          </h1>
        </motion.div>
      </div>

      <div className="px-5 space-y-4 pb-8">

        {/* Intro */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-[#0f0f17] border border-white/[0.06] p-5"
        >
          <p className="text-sm text-zinc-400 leading-relaxed">
            <span className="text-red-400 font-black">FantaF1</span> è un fantasy basato sulla Formula 1.
            Prima di ogni Gran Premio, pronostica la griglia completa, il giro veloce, la safety car e i DNF.
            Più sei preciso, più punti guadagni.
          </p>
        </motion.div>

        {/* Punti automatici */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-[#0f0f17] border border-white/[0.06] overflow-hidden"
        >
          <div className="flex items-center gap-3 p-5 border-b border-white/[0.05]">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h2 className="font-black text-sm uppercase tracking-widest text-white">Punti automatici</h2>
              <p className="text-[10px] text-zinc-500">Calcolati dopo ogni gara</p>
            </div>
          </div>
          <div className="px-5">
            {autoRules.map(([key, rule], i) => (
              <RuleRow key={key} label={rule.label} points={rule.points} index={i} />
            ))}
          </div>
        </motion.div>

        {/* Bonus gara */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-[#0f0f17] border border-white/[0.06] overflow-hidden"
        >
          <div className="flex items-center gap-3 p-5 border-b border-white/[0.05]">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h2 className="font-black text-sm uppercase tracking-widest text-white">Bonus gara</h2>
              <p className="text-[10px] text-zinc-500">Inseriti dall'admin dopo ogni gara</p>
            </div>
          </div>
          <div className="px-5">
            {manualRules.map(([key, rule], i) => (
              <RuleRow key={key} label={rule.label} points={rule.points} index={i} />
            ))}
          </div>
        </motion.div>

        {/* Regole generali */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-[#0f0f17] border border-white/[0.06] overflow-hidden"
        >
          <div className="flex items-center gap-3 p-5 border-b border-white/[0.05]">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="font-black text-sm uppercase tracking-widest text-white">Regole generali</h2>
          </div>
          <ul className="p-5 space-y-3">
            {[
              'Il pick si chiude alle 23:59 del giorno prima della gara.',
              'La predizione include la griglia completa 1–22, il giro veloce, la safety car e i DNF previsti.',
              'I punteggi vengono elaborati entro 24 ore dalla fine della gara.',
              "In caso di errori nei dati, l'admin può correggere manualmente i punteggi.",
              'I token SFT della Fan Zone sono separati dal punteggio FantaF1.',
            ].map((rule, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-zinc-400 leading-snug">
                <span className="text-red-500 font-black text-base leading-none mt-0.5 shrink-0">·</span>
                {rule}
              </li>
            ))}
          </ul>
        </motion.div>

      </div>
    </div>
  );
}