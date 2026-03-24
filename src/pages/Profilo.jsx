import { ChevronLeft, Zap, TrendingDown, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const bonuses = [
  { label: 'Vittoria GP', pts: '+25', color: 'text-ferrari-gold' },
  { label: '2° posto', pts: '+18', color: 'text-gray-300' },
  { label: '3° posto', pts: '+15', color: 'text-amber-600' },
  { label: 'Pole Position', pts: '+10', color: 'text-blue-400' },
  { label: 'Giro Veloce', pts: '+5', color: 'text-purple-400' },
  { label: 'Hat Trick (Pole+Vittoria+FL)', pts: '+15', color: 'text-ferrari-gold' },
  { label: 'Sorpasso del giro (>5 pos)', pts: '+10', color: 'text-green-400' },
  { label: 'Pit Stop < 2.5s', pts: '+5', color: 'text-green-400' },
  { label: 'Team Radio Leggendario', pts: '+3', color: 'text-blue-400' },
  { label: 'Rimonta (fondo → top 5)', pts: '+8', color: 'text-green-400' },
  { label: 'DNF per errore del muretto', pts: '-10', color: 'text-ferrari-red' },
  { label: 'Penalità (drive-through ecc.)', pts: '-5', color: 'text-ferrari-red' },
  { label: 'Testacoda senza incidente', pts: '-3', color: 'text-ferrari-red' },
  { label: 'Qualifica eliminato Q1', pts: '-5', color: 'text-ferrari-red' },
  { label: 'Incidente con compagno di squadra', pts: '-8', color: 'text-ferrari-red' },
];

export default function Regolamento() {
  const bonusList = bonuses.filter(b => !b.pts.startsWith('-'));
  const malusList = bonuses.filter(b => b.pts.startsWith('-'));

  return (
    <div className="min-h-screen bg-background">
      <div className="relative bg-gradient-to-b from-[#0e0e1a] via-[#130a0a] to-background px-4 pt-14 pb-6">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ferrari-red/50 to-transparent" />
        <div className="flex items-center gap-3 mb-1">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft size={22} />
          </Link>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Info</p>
        </div>
        <h1 className="font-barlow font-black text-3xl text-foreground uppercase pl-9">Regolamento</h1>
      </div>

      <div className="px-4 space-y-5 pb-6">

        {/* Intro */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="text-ferrari-red font-bold">FantaF1</span> è un gioco fantasy a tema Formula 1.
            Prima di ogni Gran Premio, scegli il pilota che pensi farà la migliore gara.
            Accumula punti con bonus epici e scala la classifica della tua lega.
          </p>
        </div>

        {/* Rules */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-ferrari-gold" />
            <h3 className="font-barlow font-bold text-sm uppercase tracking-widest text-foreground">Regole Principali</h3>
          </div>
          {[
            'Puoi fare 1 pick per GP per ogni lega',
            'Il pick si chiude 1 ora prima della partenza',
            'Una volta chiuso il pick, non si può modificare',
            'I punti vengono assegnati entro 24h dalla fine del GP',
            'Non si possono scegliere piloti già ritirati o non in griglia',
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="font-barlow font-black text-ferrari-red text-sm w-5 flex-shrink-0">{i + 1}.</span>
              <p className="text-sm text-muted-foreground">{rule}</p>
            </div>
          ))}
        </div>

        {/* Bonus */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-green-400" />
            <h3 className="font-barlow font-bold text-sm uppercase tracking-widest text-foreground">Bonus</h3>
          </div>
          {bonusList.map(({ label, pts, color }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
              <p className="text-sm text-muted-foreground">{label}</p>
              <span className={`font-barlow font-black text-base ${color}`}>{pts}</span>
            </div>
          ))}
        </div>

        {/* Malus */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={14} className="text-ferrari-red" />
            <h3 className="font-barlow font-bold text-sm uppercase tracking-widest text-foreground">Malus</h3>
          </div>
          {malusList.map(({ label, pts }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
              <p className="text-sm text-muted-foreground">{label}</p>
              <span className="font-barlow font-black text-base text-ferrari-red">{pts}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}