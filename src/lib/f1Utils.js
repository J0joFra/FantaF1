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

// ─── TEAM COLORS ─────────────────────────────────────────────────────────────
const TEAM_COLORS = {
  ferrari:        '#E8002D',
  'red bull':     '#3671C6',
  mercedes:       '#27F4D2',
  mclaren:        '#FF8000',
  'aston martin': '#358C75',
  alpine:         '#FF87BC',
  williams:       '#64C4FF',
  audi:           '#A8A8A8',
  haas:           '#B6BABD',
  'racing bulls': '#6692FF',
  cadillac:       '#FFFFFF',
  rb:             '#6692FF',
  'alfa romeo':   '#900000',
  sauber:         '#00E701',
  alphatauri:     '#6692FF',
};

export function getTeamColor(teamName) {
  if (!teamName) return '#888888';
  const key = teamName.toLowerCase().trim();
  for (const [name, color] of Object.entries(TEAM_COLORS)) {
    if (key.includes(name)) return color;
  }
  return '#888888';
}