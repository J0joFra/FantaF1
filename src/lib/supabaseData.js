import { supabase } from './supabase';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function throwIfError(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// ─── DRIVER STANDINGS ────────────────────────────────────────────────────────
// View: current_season_driver_standings (9 cols)
// Known columns from error messages + original code:
//   position_number, driver_id, points, wins, driver_name/first_name/last_name,
//   constructor_name, abbreviation, fastest_laps, etc.
export async function getDriverStandings(season = currentYear()) {
  // Query standings + driver info + constructor info all at once
  const [
    { data: standings, error: stErr },
    { data: drivers,   error: drErr },
    { data: constructors, error: coErr },
  ] = await Promise.all([
    supabase
      .from('season_driver_standing')
      .select('*')
      .eq('year', season)
      .order('position_number', { ascending: true }),
    supabase
      .from('driver')
      .select('id, first_name, last_name, abbreviation'),
    supabase
      .from('constructor')
      .select('id, name'),
  ]);

  throwIfError(stErr, 'Driver standings');

  const driverMap = {};
  (drivers || []).forEach(d => { driverMap[d.id] = d; });
  const constructorMap = {};
  (constructors || []).forEach(c => { constructorMap[c.id] = c; });

  return (standings || [])
    .filter(s => s.position_number)
    .map(s => {
      const dr = driverMap[s.driver_id]      || {};
      const co = constructorMap[s.constructor_id] || {};
      return normalizeDriver({
        ...s,
        driver_name:      s.driver_name
                          || (dr.first_name && dr.last_name
                              ? \`\${dr.first_name} \${dr.last_name}\`
                              : ''),
        abbreviation:     dr.abbreviation || s.abbreviation || '',
        constructor_name: s.constructor_name || co.name || '',
      });
    });
}

function normalizeDriver(row) {
  return {
    id:           String(row.driver_id ?? row.id ?? ''),
    driver_name:  row.driver_name
                    || (row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : '')
                    || String(row.driver_id ?? ''),
    driver_code:  row.abbreviation  || row.driver_code  || row.code || '',
    team:         row.constructor_name || row.team_name || row.team || '',
    points:       row.points          ?? 0,
    position:     row.position_number ?? row.position   ?? 0,
    wins:         row.wins            ?? 0,
    podiums:      row.podiums         ?? 0,
    poles:        row.poles           ?? row.pole_positions ?? 0,
    fastest_laps: row.fastest_laps    ?? 0,
    dnfs:         row.dnfs            ?? row.retirements    ?? 0,
  };
}

// ─── CONSTRUCTOR STANDINGS ───────────────────────────────────────────────────
// View: current_season_constructor_standings (7 cols)
export async function getConstructorStandings() {
  const { data, error } = await supabase
    .from('current_season_constructor_standings')
    .select('*')
    .order('position_number', { ascending: true });

  throwIfError(error, 'Constructor standings');
  return (data || []).map(normalizeConstructor);
}

function normalizeConstructor(row) {
  return {
    id:         String(row.constructor_id ?? row.id ?? ''),
    team_name:  row.constructor_name || row.name || '',
    team_color: row.color            || null,
    points:     row.points           ?? 0,
    position:   row.position_number  ?? row.position ?? 0,
    wins:       row.wins             ?? 0,
    podiums:    row.podiums          ?? 0,
  };
}

// ─── SEASON CONFIG ────────────────────────────────────────────────────────────
// View: race_calendar_with_results (14 cols)
export async function getSeasonConfig() {
  const { data, error } = await supabase
    .from('race_calendar_with_results')
    .select('*')
    .order('round', { ascending: true });

  throwIfError(error, 'Season config');

  const races = data || [];
  const now   = new Date();

  const completed = races.filter(r => {
    const d = r.race_date || r.date;
    return d && new Date(d) < now;
  });

  const upcoming = races.find(r => {
    const d = r.race_date || r.date;
    return d && new Date(d) >= now;
  });

  const sprintRaces      = races.filter(r => r.sprint_race_date || r.has_sprint_race);
  const completedSprints = completed.filter(r => r.sprint_race_date || r.has_sprint_race);

  return {
    season:               upcoming?.year || upcoming?.season || new Date().getFullYear(),
    total_races:          races.length,
    races_completed:      completed.length,
    total_sprints:        sprintRaces.length,
    sprints_completed:    completedSprints.length,
    next_race_name:       upcoming?.grand_prix_name || upcoming?.official_name || upcoming?.race_name || upcoming?.name || null,
    next_race_circuit:    upcoming?.circuit_name    || upcoming?.circuit       || '',
    next_race_date:       upcoming?.race_date       || upcoming?.date          || null,
    next_race_has_sprint: !!(upcoming?.sprint_race_date || upcoming?.has_sprint_race),
  };
}

// ─── NEXT GRAND PRIX ─────────────────────────────────────────────────────────
export async function getNextGrandPrix() {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('race_calendar_with_results')
    .select('*')
    .gte('race_date', today)
    .order('round', { ascending: true })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

// ─── LATEST RACE RESULTS ─────────────────────────────────────────────────────
// View: latest_race_results (18 cols)
export async function getLatestRaceResults() {
  const { data, error } = await supabase
    .from('latest_race_results')
    .select('*')
    .order('position_number', { ascending: true });

  if (error) {
    console.error('Latest race results:', error.message);
    return [];
  }
  return data || [];
}

// ─── FERRARI DATA ─────────────────────────────────────────────────────────────
// View: ferrari_season_summary (9 cols)
export async function getFerrariSeasonSummary() {
  const { data, error } = await supabase
    .from('ferrari_season_summary')
    .select('*')
    .order('year', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Ferrari summary:', error.message);
    return [];
  }

  return (data || []).map(row => ({
    season:                row.year              ?? row.season,
    points:                row.points            ?? row.total_points    ?? 0,
    position:              row.position_number   ?? row.final_position  ?? row.position ?? null,
    wins:                  row.wins              ?? row.race_wins        ?? 0,
    podiums:               row.podiums           ?? 0,
    poles:                 row.poles             ?? row.pole_positions   ?? 0,
    drivers_champion:      row.drivers_champion      ?? false,
    constructors_champion: row.constructors_champion ?? (row.position_number === 1) ?? false,
  }));
}

// View: ferrari_points_by_year (4 cols)
export async function getFerrariPointsByYear() {
  const { data, error } = await supabase
    .from('ferrari_points_by_year')
    .select('*')
    .order('year', { ascending: true });

  if (error) {
    console.error('Ferrari points by year:', error.message);
    return [];
  }
  return data || [];
}

// View: driver_ferrari_stats (9 cols)
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

// View: ferrari_archive_stats (3 cols)
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

// ─── NEXT N RACES ─────────────────────────────────────────────────────────────
export async function getUpcomingRaces(limit = 5, season = new Date().getFullYear()) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('race')
    .select('id, round, date, sprint_race_date, official_name, grand_prix_id')
    .eq('year', season)
    .gte('date', today)
    .order('round', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Upcoming races:', error.message);
    return [];
  }

  // Enrich with grand_prix names if available
  const gpIds = (data || []).map(r => r.grand_prix_id).filter(Boolean);
  let gpMap = {};
  if (gpIds.length) {
    const { data: gps } = await supabase
      .from('grand_prix')
      .select('id, name, country_id')
      .in('id', gpIds);
    (gps || []).forEach(g => { gpMap[g.id] = g; });
  }

  return (data || []).map(r => {
    const gp = gpMap[r.grand_prix_id] || {};
    return {
      id:          r.id,
      round:       r.round,
      name:        gp.name || r.official_name || '',
      date:        r.date,
      has_sprint:  !!(r.sprint_race_date),
      country_id:  gp.country_id || null,
    };
  });
}
