// Local-only storage + scoring for the pre-race predictions game.
// One prediction per race, kept per-device in localStorage (wrapped so private
// browsing / blocked storage never throws). No backend, no account needed.

const PREFIX = "gridup_pred_";
const INDEX = "gridup_pred_index";

// Scoring:
//   podium (P1-P3): exact driver+position +5, right driver wrong podium spot +2,
//                   perfect podium +5 bonus
//   P4-P10:         exact driver+position +3, right driver in the 4-10 group +1
//   fastest pit team: correct +5
const PTS_PODIUM_EXACT = 5;
const PTS_PODIUM_GROUP = 2;
const PTS_PERFECT_BONUS = 5;
const PTS_REST_EXACT = 3;
const PTS_REST_GROUP = 1;
const PTS_PIT = 5;
export const MAX_POINTS_PER_RACE =
  PTS_PODIUM_EXACT * 3 + PTS_PERFECT_BONUS + PTS_REST_EXACT * 7 + PTS_PIT; // 46

function readIndex() {
  try {
    const v = JSON.parse(localStorage.getItem(INDEX) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function writeIndex(ids) {
  try { localStorage.setItem(INDEX, JSON.stringify([...new Set(ids)])); } catch { /* ignore */ }
}

// data = { slots:[10 driver ids|null], pitTeam, raceName, raceDate, country_id }
export function savePrediction(raceId, data) {
  if (raceId == null) return;
  try {
    localStorage.setItem(PREFIX + raceId, JSON.stringify({ ...data, savedAt: Date.now() }));
    writeIndex([...readIndex(), String(raceId)]);
  } catch { /* ignore */ }
}

export function getPrediction(raceId) {
  if (raceId == null) return null;
  try {
    const raw = localStorage.getItem(PREFIX + raceId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Normalise a stored prediction to { slots:[10], pitTeam } (back-compat with the
// old {p1,p2,p3} podium-only format).
export function normalizePrediction(p) {
  if (!p) return { slots: Array(10).fill(null), pitTeam: null };
  if (Array.isArray(p.slots)) {
    const slots = p.slots.slice(0, 10);
    while (slots.length < 10) slots.push(null);
    return { ...p, slots, pitTeam: p.pitTeam ?? null };
  }
  const slots = [p.p1 ?? null, p.p2 ?? null, p.p3 ?? null, ...Array(7).fill(null)];
  return { ...p, slots, pitTeam: p.pitTeam ?? null };
}

export function allPredictions() {
  return readIndex()
    .map(id => {
      const p = getPrediction(id);
      return p ? { raceId: id, ...normalizePrediction(p), raceName: p.raceName, raceDate: p.raceDate, country_id: p.country_id, savedAt: p.savedAt } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

// pred = { slots:[10], pitTeam }; outcome = { top10:[...], pitTeam }.
// Returns { points, perfectPodium, podiumPts, restPts, pitPts, detail:[10], pit } or null if unscored.
export function scoreRace(pred, outcome) {
  const p = normalizePrediction(pred);
  const top10 = outcome?.top10 || [];
  if (top10.length < 3 || !top10[0]) return null; // results not in yet

  const top3 = top10.slice(0, 3);
  const group = top10.slice(3, 10);
  const detail = [];
  let podiumPts = 0, restPts = 0;

  for (let i = 0; i < 10; i++) {
    const d = p.slots[i];
    const isPodium = i < 3;
    if (!d) { detail.push({ kind: "empty", pts: 0 }); continue; }
    if (d === top10[i]) {
      const pts = isPodium ? PTS_PODIUM_EXACT : PTS_REST_EXACT;
      if (isPodium) podiumPts += pts; else restPts += pts;
      detail.push({ kind: "exact", pts });
    } else if ((isPodium ? top3 : group).includes(d)) {
      const pts = isPodium ? PTS_PODIUM_GROUP : PTS_REST_GROUP;
      if (isPodium) podiumPts += pts; else restPts += pts;
      detail.push({ kind: "group", pts });
    } else {
      detail.push({ kind: "miss", pts: 0 });
    }
  }

  const perfectPodium = [0, 1, 2].every(i => p.slots[i] && p.slots[i] === top10[i]);
  if (perfectPodium) podiumPts += PTS_PERFECT_BONUS;

  let pit = null, pitPts = 0;
  if (p.pitTeam && outcome?.pitTeam) {
    const ok = p.pitTeam === outcome.pitTeam;
    pitPts = ok ? PTS_PIT : 0;
    pit = { ok, pts: pitPts };
  }

  return { points: podiumPts + restPts + pitPts, perfectPodium, podiumPts, restPts, pitPts, detail, pit };
}

/**
 * Rimette ogni pronostico sotto l'id giusto, cercando la gara per data.
 *
 * Il pronostico è salvato con l'id della gara, e gli id possono cambiare:
 * nel 2026 F1DB ha tolto due gare e rinumerato le successive, e chi aveva
 * pronosticato Las Vegas si ritrovava il pronostico sotto l'id di San Paolo,
 * valutato con i risultati sbagliati. La data invece non cambia, ed è salvata
 * con il pronostico: se la gara di quella data ha un altro id, il pronostico
 * si sposta lì. Restituisce quanti ne ha spostati.
 *
 * races: [{ id, date }] della stagione.
 */
export function reconcileWithCalendar(races = []) {
  const idByDate = Object.fromEntries(races.filter(r => r.date).map(r => [r.date, String(r.id)]));
  const moves = [];
  for (const id of readIndex()) {
    const p = getPrediction(id);
    const target = p?.raceDate ? idByDate[p.raceDate] : null;
    if (target && target !== String(id)) moves.push({ from: String(id), to: target, data: p });
  }
  if (!moves.length) return 0;

  // In due tempi: prima si tolgono tutti, poi si riscrivono. Gli id slittano
  // tutti nella stessa direzione, e spostandoli uno alla volta il primo
  // sovrascriverebbe il pronostico che deve ancora partire.
  const movedFrom = new Set(moves.map(m => m.from));
  try {
    moves.forEach(m => localStorage.removeItem(PREFIX + m.from));
    let index = readIndex().filter(id => !movedFrom.has(String(id)));
    for (const m of moves) {
      const there = getPrediction(m.to);
      if (there && there.raceDate === m.data.raceDate) continue; // c'è già quello giusto
      localStorage.setItem(PREFIX + m.to, JSON.stringify(m.data));
      index.push(m.to);
    }
    writeIndex(index);
  } catch { /* ignore */ }
  return moves.length;
}
