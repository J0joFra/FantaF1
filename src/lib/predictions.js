// Local-only storage + scoring for the pre-race podium predictions game.
// One prediction per race, kept per-device in localStorage (wrapped so private
// browsing / blocked storage never throws). No backend, no account needed.

const PREFIX = "gridup_pred_";
const INDEX = "gridup_pred_index";

// Scoring:
//   exact driver + position      → 5 pts
//   right driver, wrong position → 2 pts (still on the podium)
//   perfect podium (all 3 exact) → +5 bonus
const PTS_EXACT = 5;
const PTS_PODIUM = 2;
const PTS_PERFECT_BONUS = 5;
export const MAX_POINTS_PER_RACE = PTS_EXACT * 3 + PTS_PERFECT_BONUS; // 20

function readIndex() {
  try {
    const v = JSON.parse(localStorage.getItem(INDEX) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function writeIndex(ids) {
  try { localStorage.setItem(INDEX, JSON.stringify([...new Set(ids)])); } catch { /* ignore */ }
}

// data = { p1, p2, p3, raceName, raceDate, country_id }
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

// All stored predictions, newest first: [{ raceId, p1, p2, p3, raceName, ... }].
export function allPredictions() {
  return readIndex()
    .map(id => {
      const p = getPrediction(id);
      return p ? { raceId: id, ...p } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

// pred = { p1, p2, p3 } (driver ids); actual = [a1, a2, a3] (driver ids).
// Returns { points, perfect, detail:[{driver, pts, kind}] } or null if unscored.
export function scorePodium(pred, actual) {
  if (!pred || !actual || actual.length < 3 || actual.some(x => !x)) return null;
  const slots = [pred.p1, pred.p2, pred.p3];
  let points = 0;
  const detail = slots.map((driver, i) => {
    if (!driver) return { driver, pts: 0, kind: "empty" };
    if (driver === actual[i]) { points += PTS_EXACT; return { driver, pts: PTS_EXACT, kind: "exact" }; }
    if (actual.includes(driver)) { points += PTS_PODIUM; return { driver, pts: PTS_PODIUM, kind: "podium" }; }
    return { driver, pts: 0, kind: "miss" };
  });
  const perfect = slots.every((d, i) => d && d === actual[i]);
  if (perfect) points += PTS_PERFECT_BONUS;
  return { points, perfect, detail };
}
