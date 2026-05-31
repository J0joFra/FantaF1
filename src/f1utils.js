export const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
export const FASTEST_LAP_POINT = 1;

export const MAX_POINTS_RACE = 26;
export const MAX_POINTS_SPRINT = 8;
export const MAX_POINTS_WEEKEND_WITH_SPRINT = MAX_POINTS_RACE + MAX_POINTS_SPRINT;
export const MAX_POINTS_WEEKEND_NO_SPRINT = MAX_POINTS_RACE;

export function calculateMaxAvailablePoints(config) {
  if (!config) return 0;
  const racesLeft = (config.total_races || 0) - (config.races_completed || 0);
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

export function pointsToClinch(leaderPoints, p2Points, maxAvailable) {
  return maxAvailable - (leaderPoints - p2Points) + 1;
}

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