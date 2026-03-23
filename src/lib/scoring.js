/**
 * src/lib/scoring.js
 * Regole di punteggio per la pagina Regolamento
 */

export const SCORING_RULES = {
  // ── Griglia principale ──
  exactPosition:    { label: 'Posizione esatta (top 10)',       points: 100, type: 'auto' },
  podiumWrong:      { label: 'Sul podio, posizione sbagliata',  points: 25,  type: 'auto' },
  top10Wrong:       { label: 'In top 10, posizione sbagliata',  points: 17,  type: 'auto' },
  // ── Zona coda ──
  lastTailExact:    { label: 'Pos. esatta zona coda (11–17)',   points: 20,  type: 'auto' },
  lastTailZone:     { label: 'In zona coda, pos. sbagliata',    points: 10,  type: 'auto' },
  lastFiveExact:    { label: 'Pos. esatta ultimi 5 (18–22)',    points: 15,  type: 'auto' },
  // ── Bonus collettivi ──
  podiumBonus:      { label: 'Almeno 2/3 pronosticati sul podio', points: 1, type: 'auto' },
  top10Bonus:       { label: 'Almeno 7/10 pronosticati in top 10', points: 3, type: 'auto' },
  pos13Bonus:       { label: '13° posto esatto ⭐',              points: 5,  type: 'auto' },
  // ── Bonus gara ──
  fastestLapExact:  { label: 'Giro veloce esatto',              points: 15,  type: 'manual' },
  safetyCarCorrect: { label: 'Safety car / VSC (sì o no)',      points: 5,   type: 'manual' },
  dnfCorrect:       { label: 'DNF previsto (per pilota)',        points: 8,   type: 'manual' },
  teamDoublePodium: { label: 'Doppietta team sul podio',         points: 12,  type: 'manual' },
  winningConstructor: { label: 'Costruttore vincitore',          points: 5,   type: 'manual' },
};
