import { supabase } from './supabase';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function throwIfError(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function currentYear() {
  return new Date().getFullYear();
}

// ─── DRIVER STANDINGS ────────────────────────────────────────────────────────
export async function getDriverStandings(season = currentYear()) {
  // Load standings + driver info in parallel
  const [{ data: standings, error: stErr }, { data: drivers, error: drErr }] =
    await Promise.all([
      supabase
        .from('season_driver_standing')
        .select('*')
        .eq('year', season)
        .order('position_number', { ascending: true }),
      supabase
        .from('driver')
        .select('id, first_name, last_name, abbreviation, nationality_country_id'),
    ]);

  throwIfError(stErr, 'Driver standings');
  throwIfError(drErr, 'Drivers lookup');

  const driverMap = {};
  (drivers || []).forEach(d => { driverMap[d.id] = d; });

  return (standings || [])
    .filter(s => s.position_number)
    .map(s => {
      const dr = driverMap[s.driver_id] || {};
      return {
        id:           String(s.driver_id ?? s.id ?? ''),
        driver_name:  dr.first_name && dr.last_name
                        ? `${dr.first_name} ${dr.last_name}`
                        : s.driver_name || String(s.driver_id || ''),
        driver_code:  dr.abbreviation || s.abbreviation || '',
        team:         s.constructor_name || s.team_name || s.team || '',
        points:       s.points              ?? 0,
        position:     s.position_number     ?? 0,
        wins:         s.wins                ?? 0,
        podiums:      s.podiums             ?? 0,
        poles:        s.poles               ?? s.pole_positions ?? 0,
        fastest_laps: s.fastest_laps        ?? 0,
        dnfs:         s.dnfs                ?? s.retirements    ?? 0,
      };
    });
}

// ─── CONSTRUCTOR STANDINGS ───────────────────────────────────────────────────
export async function getConstructorStandings(season = currentYear()) {
  const [{ data: standings, error: stErr }, { data: constructors, error: coErr }] =
    await Promise.all([
      supabase
        .from('season_constructor_standing')
        .select('*')
        .eq('year', season)
        .order('position_number', { ascending: true }),
      supabase
        .from('constructor')
        .select('id, name, color'),
    ]);

  throwIfError(stErr, 'Constructor standings');
  throwIfError(coErr, 'Constructors lookup');

  const coMap = {};
  (constructors || []).forEach(c => { coMap[c.id] = c; });

  return (standings || [])
    .filter(s => s.position_number)
    .map(s => {
      const co = coMap[s.constructor_id] || {};
      return {
        id:         String(s.constructor_id ?? s.id ?? ''),
        team_name:  co.name || s.constructor_name || s.name || '',
        team_color: co.color || s.color || null,
        points:     s.points          ?? 0,
        position:   s.position_number ?? 0,
        wins:       s.wins            ?? 0,
        podiums:    s.podiums         ?? 0,
      };
    });
}

// ─── SEASON CONFIG ────────────────────────────────────────────────────────────
export async function getSeasonConfig(season = currentYear()) {
  const { data: races, error } = await supabase
    .from('race')
    .select('id, round, date, sprint_race_date, official_name, circuit_id, grand_prix_id')
    .eq('year', season)
    .order('round', { ascending: true });

  throwIfError(error, 'Season config');

  const all  = races || [];
  const now  = new Date();

  const completed = all.filter(r => r.date && new Date(r.date) < now);
  const upcoming  = all.find(r  => r.date && new Date(r.date) >= now);

  const sprintRaces      = all.filter(r => r.sprint_race_date);
  const completedSprints = completed.filter(r => r.sprint_race_date);

  // Fetch grand_prix name for the next race if available
  let nextRaceName    = upcoming?.official_name || null;
  let nextRaceCircuit = null;

  if (upcoming?.grand_prix_id) {
    const { data: gp } = await supabase
      .from('grand_prix')
      .select('name, circuit_id')
      .eq('id', upcoming.grand_prix_id)
      .single();
    if (gp) {
      nextRaceName    = gp.name || nextRaceName;
      nextRaceCircuit = gp.circuit_id || null;
    }
  }

  return {
    season,
    total_races:          all.length,
    races_completed:      completed.length,
    total_sprints:        sprintRaces.length,
    sprints_completed:    completedSprints.length,
    next_race_name:       nextRaceName,
    next_race_circuit:    nextRaceCircuit,
    next_race_date:       upcoming?.date || null,
    next_race_has_sprint: !!(upcoming?.sprint_race_date),
  };
}

// ─── NEXT GRAND PRIX ─────────────────────────────────────────────────────────
export async function getNextGrandPrix(season = currentYear()) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('race')
    .select('*')
    .eq('year', season)
    .gte('date', today)
    .order('round', { ascending: true })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

// ─── LATEST RACE RESULTS ─────────────────────────────────────────────────────
export async function getLatestRaceResults(season = currentYear()) {
  // Get the most recently completed race
  const today = new Date().toISOString().split('T')[0];

  const { data: races, error: raceErr } = await supabase
    .from('race')
    .select('id, official_name, round')
    .eq('year', season)
    .lt('date', today)
    .order('round', { ascending: false })
    .limit(1);

  if (raceErr || !races?.length) return [];

  const raceId = races[0].id;

  const { data, error } = await supabase
    .from('race_driver_standing')
    .select('*')
    .eq('race_id', raceId)
    .order('position_number', { ascending: true });

  if (error) {
    console.error('Latest race results:', error.message);
    return [];
  }
  return data || [];
}

// ─── FERRARI DATA ─────────────────────────────────────────────────────────────
export async function getFerrariSeasonSummary() {
  // Pull Ferrari constructor standings across all seasons
  const { data: coRows, error: coErr } = await supabase
    .from('constructor')
    .select('id')
    .ilike('name', '%ferrari%')
    .limit(1);

  if (coErr || !coRows?.length) return [];

  const ferrariId = coRows[0].id;

  const { data, error } = await supabase
    .from('season_constructor_standing')
    .select('year, points, position_number, wins')
    .eq('constructor_id', ferrariId)
    .order('year', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Ferrari summary:', error.message);
    return [];
  }

  return (data || []).map(row => ({
    season:   row.year,
    points:   row.points          ?? 0,
    position: row.position_number ?? null,
    wins:     row.wins            ?? 0,
    podiums:  row.podiums         ?? 0,
    poles:    row.poles           ?? 0,
    drivers_champion:      false,
    constructors_champion: row.position_number === 1,
  }));
}

export async function getFerrariPointsByYear() {
  const { data: coRows } = await supabase
    .from('constructor')
    .select('id')
    .ilike('name', '%ferrari%')
    .limit(1);

  if (!coRows?.length) return [];

  const { data, error } = await supabase
    .from('season_constructor_standing')
    .select('year, points')
    .eq('constructor_id', coRows[0].id)
    .order('year', { ascending: true });

  if (error) {
    console.error('Ferrari points by year:', error.message);
    return [];
  }
  return data || [];
}

export async function getFerrariDriverStats() {
  // Drivers who scored points with Ferrari, ranked by wins
  const { data: coRows } = await supabase
    .from('constructor')
    .select('id')
    .ilike('name', '%ferrari%')
    .limit(1);

  if (!coRows?.length) return [];

  const { data, error } = await supabase
    .from('season_driver_standing')
    .select('driver_id, points, wins, position_number')
    .eq('constructor_id', coRows[0].id)
    .order('wins', { ascending: false })
    .limit(40);

  if (error) {
    console.error('Ferrari driver stats:', error.message);
    return [];
  }

  // Aggregate across seasons per driver
  const totals = {};
  (data || []).forEach(row => {
    const id = row.driver_id;
    if (!totals[id]) totals[id] = { driver_id: id, points: 0, wins: 0 };
    totals[id].points += row.points || 0;
    totals[id].wins   += row.wins   || 0;
  });

  // Enrich with driver names
  const ids = Object.keys(totals);
  if (!ids.length) return [];

  const { data: drivers } = await supabase
    .from('driver')
    .select('id, first_name, last_name')
    .in('id', ids);

  (drivers || []).forEach(d => {
    if (totals[d.id]) {
      totals[d.id].driver_name = `${d.first_name} ${d.last_name}`;
    }
  });

  return Object.values(totals)
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 20);
}

export async function getFerrariArchiveStats() {
  const { data: coRows } = await supabase
    .from('constructor')
    .select('id')
    .ilike('name', '%ferrari%')
    .limit(1);

  if (!coRows?.length) return null;

  const ferrariId = coRows[0].id;

  const { data, error } = await supabase
    .from('season_constructor_standing')
    .select('year, points, wins, position_number')
    .eq('constructor_id', ferrariId);

  if (error) {
    console.error('Ferrari archive stats:', error.message);
    return null;
  }

  const rows = data || [];
  return {
    seasons:              rows.length,
    total_wins:           rows.reduce((s, r) => s + (r.wins   || 0), 0),
    total_points:         rows.reduce((s, r) => s + (r.points || 0), 0),
    constructors_titles:  rows.filter(r => r.position_number === 1).length,
    // drivers_titles requires a separate table — leave as unknown
    drivers_titles:       '–',
  };
}