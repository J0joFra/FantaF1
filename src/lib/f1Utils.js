// ─── POINTS SYSTEM ───────────────────────────────────────────────────────────
export const RACE_POINTS   = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

export const MAX_POINTS_RACE   = 25;
export const MAX_POINTS_SPRINT = 8;
export const MAX_POINTS_WEEKEND_WITH_SPRINT = MAX_POINTS_RACE + MAX_POINTS_SPRINT;
export const MAX_POINTS_WEEKEND_NO_SPRINT   = MAX_POINTS_RACE;

// ─── CHAMPIONSHIP MATH ───────────────────────────────────────────────────────
export function calculateMaxAvailablePoints(config) {
  if (!config) return 0;
  const racesLeft   = (config.total_races   || 0) - (config.races_completed   || 0);
  const sprintsLeft = (config.total_sprints || 0) - (config.sprints_completed || 0);
  return racesLeft * MAX_POINTS_RACE + sprintsLeft * MAX_POINTS_SPRINT;
}

export function isMathematicallyEliminated(driverPoints, leaderPoints, maxAvailable) {
  return driverPoints + maxAvailable <= leaderPoints;
}

export function pointsNeededPerRace(gap, racesLeft) {
  if (racesLeft <= 0) return Infinity;
  return gap / racesLeft;
}

export function pointsToClinchVsRival(leaderPts, rivalPts, racesLeft, sprintsLeft) {
  const rivalMax = rivalPts + racesLeft * MAX_POINTS_RACE + sprintsLeft * MAX_POINTS_SPRINT;
  return rivalMax - leaderPts + 1;
}

export function clinchAnalysis(driver, allDrivers, racesLeft, sprintsLeft) {
  const rivals = allDrivers.filter(r => r.id !== driver.id && r.points >= driver.points);

  if (rivals.length === 0) {
    const chasers = allDrivers.filter(r => r.id !== driver.id);
    const results = chasers.map(r => {
      const needed   = pointsToClinchVsRival(driver.points, r.points, racesLeft, sprintsLeft);
      const rivalMax = r.points + racesLeft * MAX_POINTS_RACE + sprintsLeft * MAX_POINTS_SPRINT;
      return { rival: r, needed, rivalMax, eliminated: needed <= 0 };
    });
    const hardest = results.reduce((a, b) => (b.needed > a.needed ? b : a), results[0]);
    return { isLeader: true, hardest, allRivals: results, alreadyClinched: hardest ? hardest.needed <= 0 : true };
  }

  const results = rivals.map(r => {
    const needed   = pointsToClinchVsRival(driver.points, r.points, racesLeft, sprintsLeft);
    const rivalMax = r.points + racesLeft * MAX_POINTS_RACE + sprintsLeft * MAX_POINTS_SPRINT;
    return { rival: r, needed, rivalMax, eliminated: needed <= 0 };
  });
  const hardest = results.reduce((a, b) => (b.needed > a.needed ? b : a), results[0]);

  return {
    isLeader: false, hardest, allRivals: results, alreadyClinched: false,
    mathematicallyOut: driver.points + racesLeft * MAX_POINTS_RACE + sprintsLeft * MAX_POINTS_SPRINT < rivals[0].points,
  };
}

// ─── DRIVER COLORS ───────────────────────────────────────────────────────────
// THREE keys per driver:
//   1. Official F1 3-letter code (VER, NOR, HAM...)
//   2. First-name 3-letter prefix as stored in some DBs (KIM, GEO, CHA, LAN...)
//   3. Full last name lowercase
const DRIVER_COLORS = {
  // Mercedes
  ant: '#27F4D2', kim: '#27F4D2', antonelli: '#27F4D2',
  rus: '#27F4D2', geo: '#27F4D2', russell:   '#27F4D2',

  // Red Bull
  ver: '#3671C6', max: '#3671C6', verstappen: '#3671C6',
  had: '#3671C6', isa: '#3671C6', hadjar:     '#3671C6',

  // Ferrari
  lec: '#E8002D', cha: '#E8002D', leclerc:  '#E8002D',
  ham: '#E8002D', lew: '#E8002D', hamilton: '#E8002D',

  // McLaren
  nor: '#FF8000', lan: '#FF8000', norris:  '#FF8000',
  pia: '#FF8000', osc: '#FF8000', piastri: '#FF8000',

  // Aston Martin
  alo: '#358C75', fer: '#358C75', alonso: '#358C75',
  str: '#358C75', lan2:'#358C75', stroll: '#358C75',

  // Alpine
  gas: '#FF87BC', pie: '#FF87BC', gasly:     '#FF87BC',
  col: '#FF87BC', fco: '#FF87BC', colapinto: '#FF87BC',
  doo: '#FF87BC', jac: '#FF87BC', doohan:    '#FF87BC',

  // Williams
  alb: '#64C4FF', ale: '#64C4FF', albon: '#64C4FF',
  sai: '#64C4FF', car: '#64C4FF', sainz: '#64C4FF',

  // Racing Bulls
  law: '#6692FF', lia: '#6692FF', lawson:   '#6692FF',
  bea: '#6692FF', oli: '#6692FF', bearman:  '#6692FF',
  lin: '#6692FF',                 lindblad: '#6692FF',

  // Haas
  ocn: '#B6BABD', est: '#B6BABD', ocon:      '#B6BABD',
  bor: '#B6BABD', gab: '#B6BABD', bortoleto: '#B6BABD',

  // Audi
  hul: '#A8A8A8', nic: '#A8A8A8', hulkenberg: '#A8A8A8',
  bor2:'#A8A8A8',

  // Cadillac
  per: '#6CD3BF', ser: '#6CD3BF', perez:  '#6CD3BF',
  bot: '#6CD3BF', val: '#6CD3BF', bottas: '#6CD3BF',
};

export function getDriverColor(driverCode, driverName, teamName) {
  // 1. Direct code lookup (handles both official codes AND first-name prefixes)
  if (driverCode) {
    const c = DRIVER_COLORS[driverCode.toLowerCase().trim()];
    if (c) return c;
  }

  if (driverName) {
    const parts = driverName.trim().split(' ');
    const first = parts[0].toLowerCase();
    const last  = parts[parts.length - 1].toLowerCase();

    // 2. First 3 chars of first name (KIM, GEO, CHA, LAN — DB format)
    const c2 = DRIVER_COLORS[first.slice(0, 3)];
    if (c2) return c2;

    // 3. Full last name
    const c3 = DRIVER_COLORS[last];
    if (c3) return c3;

    // 4. First 3 chars of last name
    const c4 = DRIVER_COLORS[last.slice(0, 3)];
    if (c4) return c4;
  }

  // 5. Team colour fallback
  return getTeamColor(teamName);
}

// ─── TEAM COLORS ─────────────────────────────────────────────────────────────
const TEAM_COLORS = {
  ferrari:                '#E8002D',
  'red bull':             '#3671C6',
  'oracle red bull':      '#3671C6',
  mercedes:               '#27F4D2',
  'mercedes-amg':         '#27F4D2',
  mclaren:                '#FF8000',
  'aston martin':         '#358C75',
  alpine:                 '#FF87BC',
  williams:               '#64C4FF',
  audi:                   '#A8A8A8',
  haas:                   '#B6BABD',
  'moneygram haas':       '#B6BABD',
  'racing bulls':         '#6692FF',
  'visa cash app rb':     '#6692FF',
  alphatauri:             '#6692FF',
  'scuderia alphatauri':  '#6692FF',
  rb:                     '#6692FF',
  cadillac:               '#6CD3BF',
  andretti:               '#6CD3BF',
  sauber:                 '#00E701',
  'stake f1':             '#00E701',
  'alfa romeo':           '#900000',
  kick:                   '#00E701',
};

export function getTeamColor(teamName) {
  if (!teamName) return '#888888';
  const key = teamName.toLowerCase().trim();
  for (const [name, color] of Object.entries(TEAM_COLORS)) {
    if (key.includes(name)) return color;
  }
  return '#888888';
}
