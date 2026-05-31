import { supabase } from './supabase';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function throwIfError(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// ─── DRIVER STANDINGS ────────────────────────────────────────────────────────
export async function getDriverStandings() {
  const { data, error } = await supabase
    .from('current_season_driver_standings')
    .select('*')
    .order('position', { ascending: true });

  throwIfError(error, 'Driver standings');
  return (data || []).map(normalizeDriver);
}

function normalizeDriver(row) {
  return {
    // Use ?? instead of || so falsy-but-valid values like 0 are preserved
    id:           String(row.driver_id ?? row.id ?? row.driver_code ?? ''),
    driver_name:  row.driver_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    driver_code:  row.driver_code || row.abbreviation || '',
    team:         row.constructor_name || row.team || '',
    points:       row.points       ?? 0,
    position:     row.position     ?? 0,
    wins:         row.wins         ?? 0,
    podiums:      row.podiums      ?? 0,
    poles:        row.poles        ?? row.pole_positions ?? 0,
    fastest_laps: row.fastest_laps ?? 0,
    dnfs:         row.dnfs         ?? row.retirements   ?? 0,
  };
}

// ─── CONSTRUCTOR STANDINGS ───────────────────────────────────────────────────
export async function getConstructorStandings() {
  const { data, error } = await supabase
    .from('current_season_constructor_standings')
    .select('*')
    .order('position', { ascending: true });

  throwIfError(error, 'Constructor standings');
  return (data || []).map(normalizeConstructor);
}

function normalizeConstructor(row) {
  return {
    id:         String(row.constructor_id ?? row.id ?? ''),
    team_name:  row.constructor_name || row.name || '',
    team_color: row.color || null,
    points:     row.points   ?? 0,
    position:   row.position ?? 0,
    wins:       row.wins     ?? 0,
    podiums:    row.podiums  ?? 0,
  };
}

// ─── SEASON CONFIG ────────────────────────────────────────────────────────────
export async function getSeasonConfig() {
  const { data, error } = await supabase
    .from('race_calendar_with_results')
    .select('*')
    .order('round', { ascending: true });

  throwIfError(error, 'Season config');

  const races = data || [];
  const now = new Date();

  // A race counts as completed if its date has passed — regardless of whether
  // results have been entered yet. Using winner_name as the gate caused
  // races_completed to be under-counted whenever results were delayed.
  const completed = races.filter(r => {
    const d = r.race_date || r.date;
    return d && new Date(d) < now;
  });

  const upcoming = races.find(r => {
    const d = r.race_date || r.date;
    return d && new Date(d) >= now;
  });

  const sprintRaces     = races.filter(r => r.has_sprint_race || r.sprint_race_winner);
  const completedSprints = completed.filter(r => r.has_sprint_race || r.sprint_race_winner);

  return {
    season:              upcoming?.season || new Date().getFullYear(),
    total_races:         races.length,
    races_completed:     completed.length,
    total_sprints:       sprintRaces.length,
    sprints_completed:   completedSprints.length,
    next_race_name:      upcoming ? (upcoming.grand_prix_name || upcoming.race_name || upcoming.name) : null,
    next_race_circuit:   upcoming ? (upcoming.circuit_name || upcoming.circuit || '') : null,
    next_race_date:      upcoming ? (upcoming.race_date || upcoming.date) : null,
    next_race_has_sprint: !!(upcoming?.has_sprint_race),
  };
}

// ─── NEXT GRAND PRIX ─────────────────────────────────────────────────────────
export async function getNextGrandPrix() {
  // Filter and limit server-side — avoids fetching the entire calendar
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('race_calendar_with_results')
    .select('*')
    .gte('race_date', today)
    .order('round', { ascending: true })
    .limit(1)
    .single();

  if (error) return null; // No upcoming races is not a fatal error
  return data;
}

// ─── LATEST RACE RESULTS ─────────────────────────────────────────────────────
export async function getLatestRaceResults() {
  const { data, error } = await supabase
    .from('latest_race_results')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    console.error('Latest race results:', error.message);
    return [];
  }
  return data || [];
}

// ─── FERRARI DATA ─────────────────────────────────────────────────────────────
export async function getFerrariSeasonSummary() {
  const { data, error } = await supabase
    .from('ferrari_season_summary')
    .select('*')
    .order('season', { ascending: false })
    .limit(20);

  throwIfError(error, 'Ferrari summary');
  return (data || []).map(row => ({
    season:                row.season,
    points:                row.total_points  ?? row.points   ?? 0,
    position:              row.final_position ?? row.position ?? null,
    wins:                  row.wins           ?? row.race_wins ?? 0,
    podiums:               row.podiums        ?? 0,
    poles:                 row.poles          ?? row.pole_positions ?? 0,
    drivers_champion:      row.drivers_champion      ?? false,
    constructors_champion: row.constructors_champion ?? false,
  }));
}

export async function getFerrariPointsByYear() {
  const { data, error } = await supabase
    .from('ferrari_points_by_year')
    .select('*')
    .order('season', { ascending: true });

  if (error) {
    console.error('Ferrari points by year:', error.message);
    return [];
  }
  return data || [];
}

export async function getFerrariDriverStats() {
  const { data, error } = await supabase
    .from('driver_ferrari_stats')
    .select('*')
    .order('wins', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Ferrari driver stats:', error.message);
    return [];
  }
  return data || [];
}

export async function getFerrariArchiveStats() {
  const { data, error } = await supabase
    .from('ferrari_archive_stats')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Ferrari archive stats:', error.message);
    return null;
  }
  return data?.[0] || null;
}
