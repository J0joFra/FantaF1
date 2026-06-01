// ─── POINTS SYSTEM ───────────────────────────────────────────────────────────
export const RACE_POINTS   = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

// Fastest lap point was abolished from the 2025 season.
export const MAX_POINTS_RACE   = 25; // win only — no fastest lap since 2025
export const MAX_POINTS_SPRINT = 8;
export const MAX_POINTS_WEEKEND_WITH_SPRINT = MAX_POINTS_RACE + MAX_POINTS_SPRINT; // 33
export const MAX_POINTS_WEEKEND_NO_SPRINT   = MAX_POINTS_RACE;                     // 25

// ─── CHAMPIONSHIP MATH ───────────────────────────────────────────────────────
export function calculateMaxAvailablePoints(config) {
  if (!config) return 0;
  const racesLeft   = (config.total_races    || 0) - (config.races_completed    || 0);
  const sprintsLeft = (config.total_sprints  || 0) - (config.sprints_completed  || 0);
  return racesLeft * MAX_POINTS_RACE + sprintsLeft * MAX_POINTS_SPRINT;
}

/**
 * Returns true if a driver is mathematically eliminated from winning the title.
 * Uses <= so a tie is also considered eliminated (ties broken by wins).
 */
export function isMathematicallyEliminated(driverPoints, leaderPoints, maxAvailable) {
  return driverPoints + maxAvailable <= leaderPoints;
}

export function pointsNeededPerRace(gap, racesLeft) {
  if (racesLeft <= 0) return Infinity;
  return gap / racesLeft;
}

/**
 * Points the LEADER must still gain over a specific rival to clinch the title
 * against that rival. Returns ≤ 0 if already clinched vs that rival.
 *
 * rivalMax = rivalPts + races*MAX_POINTS_RACE + sprints*MAX_POINTS_SPRINT
 * needed   = rivalMax - leaderPts + 1
 */
export function pointsToClinchVsRival(leaderPts, rivalPts, racesLeft, sprintsLeft) {
  const rivalMax = rivalPts + racesLeft * MAX_POINTS_RACE + sprintsLeft * MAX_POINTS_SPRINT;
  return rivalMax - leaderPts + 1;
}

/**
 * The HARDEST rival to clinch against is the one who gives the highest
 * "points needed" value — i.e. the closest rival in the standings.
 * Returns { needed, hardestRival, rivalMax, alreadyClinched }
 */
export function clinchAnalysis(driver, allDrivers, racesLeft, sprintsLeft) {
  // rivals = everyone with more or equal points who is not the driver itself
  const rivals = allDrivers.filter(
    r => r.id !== driver.id && r.points >= driver.points
  );

  if (rivals.length === 0) {
    // driver is leader — find rivals behind who can still catch up
    const chasers = allDrivers.filter(r => r.id !== driver.id);
    const results = chasers.map(r => {
      const needed = pointsToClinchVsRival(driver.points, r.points, racesLeft, sprintsLeft);
      const rivalMax = r.points + racesLeft * MAX_POINTS_RACE + sprintsLeft * MAX_POINTS_SPRINT;
      return { rival: r, needed, rivalMax, eliminated: needed <= 0 };
    });
    const hardest = results.reduce((a, b) => (b.needed > a.needed ? b : a), results[0]);
    return {
      isLeader: true,
      hardest,
      allRivals: results,
      alreadyClinched: hardest ? hardest.needed <= 0 : true,
    };
  }

  // driver is NOT the leader — calculate vs each rival ahead
  const results = rivals.map(r => {
    const needed   = pointsToClinchVsRival(driver.points, r.points, racesLeft, sprintsLeft);
    const rivalMax = r.points + racesLeft * MAX_POINTS_RACE + sprintsLeft * MAX_POINTS_SPRINT;
    return { rival: r, needed, rivalMax, eliminated: needed <= 0 };
  });

  // The one that needs the MOST points to beat is the hardest
  const hardest = results.reduce((a, b) => (b.needed > a.needed ? b : a), results[0]);

  return {
    isLeader: false,
    hardest,
    allRivals: results,
    alreadyClinched: false, // can't clinch if not leader
    mathematicallyOut: driver.points + racesLeft * MAX_POINTS_RACE + sprintsLeft * MAX_POINTS_SPRINT
                       < rivals[0].points, // can't even catch the lowest rival
  };
}

// ─── DRIVER COLORS ───────────────────────────────────────────────────────────
const DRIVER_COLORS = {
  // Mercedes
  rus: '#27F4D2', russell: '#27F4D2',
  ant: '#27F4D2', antonelli: '#27F4D2',

  // Red Bull Racing
  ver: '#3671C6', verstappen: '#3671C6',
  had: '#3671C6', hadjar: '#3671C6', // Promosso in Red Bull

  // Ferrari
  lec: '#E8002D', leclerc: '#E8002D',
  ham: '#E8002D', hamilton: '#E8002D',

  // McLaren
  nor: '#FF8000', norris: '#FF8000',
  pia: '#FF8000', piastri: '#FF8000',

  // Aston Martin (Honda Works)
  alo: '#358C75', alonso: '#358C75',
  str: '#358C75', stroll: '#358C75',

  // Alpine
  gas: '#FF87BC', gasly: '#FF87BC',
  col: '#FF87BC', colapinto: '#FF87BC', // Passato in Alpine

  // Williams
  alb: '#64C4FF', albon: '#64C4FF',
  sai: '#64C4FF', sainz: '#64C4FF',

  // Racing Bulls (VCARB)
  law: '#6692FF', lawson: '#6692FF',
  lin: '#6692FF', lindblad: '#6692FF', // Nuovo rookie in RB

  // Haas
  ocn: '#B6BABD', ocon: '#B6BABD',
  bea: '#B6BABD', bearman: '#B6BABD',

  // Audi F1 Team
  hul: '#F50537', hulkenberg: '#F50537',
  bor: '#F50537', bortoleto: '#F50537',

  // Cadillac F1 Team (Colorazione Oro/Nera per staccare dai troppi blu in griglia)
  per: '#FFD700', perez: '#FFD700',
  bot: '#FFD700', bottas: '#FFD700',
};

/**
 * Get a driver's colour by their 3-letter code or full name.
 * Falls back to getTeamColor(teamName) if not found.
 */
export function getDriverColor(driverCode, driverName, teamName) {
  if (driverCode) {
    const c = DRIVER_COLORS[driverCode.toLowerCase().trim()];
    if (c) return c;
  }
  if (driverName) {
    // Try last name
    const last = driverName.trim().split(' ').pop().toLowerCase();
    const c = DRIVER_COLORS[last];
    if (c) return c;
    // Try first 3 chars of last name
    const c3 = DRIVER_COLORS[last.slice(0, 3)];
    if (c3) return c3;
  }
  // Fall back to team colour
  return getTeamColor(teamName);
}

// ─── TEAM COLORS ─────────────────────────────────────────────────────────────
const TEAM_COLORS = {
  // Ferrari
  ferrari:                  '#E8002D',
  // Red Bull
  'red bull':               '#3671C6',
  'oracle red bull':        '#3671C6',
  // Mercedes
  mercedes:                 '#27F4D2',
  'mercedes-amg':           '#27F4D2',
  // McLaren
  mclaren:                  '#FF8000',
  // Aston Martin
  'aston martin':           '#358C75',
  // Alpine
  alpine:                   '#FF87BC',
  // Williams
  williams:                 '#64C4FF',
  // Audi
  audi:                     '#A8A8A8',
  // Haas
  haas:                     '#B6BABD',
  'moneygram haas':         '#B6BABD',
  // Racing Bulls / RB / AlphaTauri / Visa Cash App
  'racing bulls':           '#6692FF',
  'visa cash app rb':       '#6692FF',
  alphatauri:               '#6692FF',
  'scuderia alphatauri':    '#6692FF',
  rb:                       '#6692FF',
  // Cadillac / Andretti
  cadillac:                 '#6CD3BF',
  andretti:                 '#6CD3BF',
  // Sauber / Alfa Romeo / Stake
  sauber:                   '#00E701',
  'stake f1':               '#00E701',
  'alfa romeo':             '#900000',
  kick:                     '#00E701',
};

export function getTeamColor(teamName) {
  if (!teamName) return '#888888';
  const key = teamName.toLowerCase().trim();
  for (const [name, color] of Object.entries(TEAM_COLORS)) {
    if (key.includes(name)) return color;
  }
  return '#888888';
}
