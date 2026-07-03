import { supabase } from './supabase';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function throwIfError(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function currentYear() {
  return new Date().getFullYear();
}

// ─── DRIVER STANDINGS ────────────────────────────────────────────────────────
// View: current_season_driver_standings (9 cols)
// Known columns from error messages + original code:
//   position_number, driver_id, points, wins, driver_name/first_name/last_name,
//   constructor_name, abbreviation, fastest_laps, etc.
export async function getDriverStandings() {
  // The current_season_driver_standings view has NO team/constructor column,
  // so we enrich it: driver_id -> constructor (via season_entrant_driver) -> name,
  // plus the official 3-letter code, nationality and career totals from the driver table.
  const { data: standings, error: stErr } = await supabase
    .from('current_season_driver_standings')
    .select('*')
    .order('position_number', { ascending: true });

  throwIfError(stErr, 'Driver standings');

  const year = standings?.[0]?.year ?? currentYear();

  const [
    { data: entrants },
    { data: constructors },
    { data: driversMeta },
    { data: countries },
  ] = await Promise.all([
    supabase
      .from('season_entrant_driver')
      .select('driver_id, constructor_id, test_driver, rounds')
      .eq('year', year),
    supabase
      .from('constructor')
      .select('id, name'),
    supabase
      .from('driver')
      .select('id, abbreviation, permanent_number, date_of_birth, place_of_birth, nationality_country_id, total_race_wins, total_podiums, total_pole_positions, total_fastest_laps, total_championship_wins, total_points, total_race_starts, best_race_result'),
    supabase
      .from('country')
      .select('id, alpha2_code, name'),
  ]);

  // constructor id -> name
  const constructorMap = {};
  (constructors || []).forEach(c => { constructorMap[c.id] = c.name; });

  // country id -> { iso, name }
  const countryMap = {};
  (countries || []).forEach(c => { countryMap[c.id] = { iso: c.alpha2_code, name: c.name }; });

  // driver id -> team name (prefer the actual race seat over test-driver entries)
  const driverTeamMap = {};
  (entrants || []).forEach(e => {
    const name = constructorMap[e.constructor_id];
    if (!name) return;
    if (!(e.driver_id in driverTeamMap) || !e.test_driver) {
      driverTeamMap[e.driver_id] = name;
    }
  });

  // driver id -> metadata
  const driverMetaMap = {};
  (driversMeta || []).forEach(d => { driverMetaMap[d.id] = d; });

  return (standings || []).map(row => {
    const meta    = driverMetaMap[row.driver_id] || {};
    const country = countryMap[meta.nationality_country_id] || {};
    const base = normalizeDriver({
      ...row,
      constructor_name: driverTeamMap[row.driver_id] || row.constructor_name || '',
      abbreviation: meta.abbreviation || row.abbreviation || '',
    });
    return {
      ...base,
      permanent_number: meta.permanent_number ?? null,
      date_of_birth:    meta.date_of_birth ?? null,
      place_of_birth:   meta.place_of_birth ?? null,
      nationality:      country.name || null,
      nationality_iso:  country.iso || null,
      career: {
        titles:       meta.total_championship_wins ?? 0,
        wins:         meta.total_race_wins ?? 0,
        podiums:      meta.total_podiums ?? 0,
        poles:        meta.total_pole_positions ?? 0,
        fastest_laps: meta.total_fastest_laps ?? 0,
        points:       meta.total_points ?? 0,
        starts:       meta.total_race_starts ?? 0,
        best_finish:  meta.best_race_result ?? null,
      },
    };
  });
}

// ─── ALL SEASON RACES (calendar) ─────────────────────────────────────────────
export async function getAllSeasonRaces(season = currentYear()) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('race')
    .select('id, round, date, sprint_race_date, official_name')
    .eq('year', season)
    .order('round', { ascending: true });
  throwIfError(error, 'All season races');
  return (data || []).map(r => ({
    id:        r.id,
    round:     r.round,
    date:      r.date,
    name:      r.official_name || '',
    hasSprint: !!r.sprint_race_date,
    isPast:    r.date <= today,
  }));
}

// ─── LAST RACE DATE ──────────────────────────────────────────────────────────
export async function getLastRaceDate() {
  const { data, error } = await supabase
    .from('race')
    .select('date')
    .lte('date', new Date().toISOString().slice(0, 10))
    .order('date', { ascending: false })
    .limit(1)
    .single();
  throwIfError(error, 'Last race date');
  return data?.date ?? null;
}

// ─── DRIVER SEASON STATS (per-race aggregation) ──────────────────────────────
// Aggregates the current season's race_data into per-driver stats keyed by driver_id.
export async function getDriverSeasonStats(season = currentYear()) {
  const { data: races, error: rErr } = await supabase
    .from('race')
    .select('id')
    .eq('year', season);

  if (rErr) throw new Error(`Season stats (races): ${rErr.message}`);
  const ids = (races || []).map(r => r.id);
  if (!ids.length) return {};

  const { data: rows, error: dErr } = await supabase
    .from('race_data')
    .select('type, position_number, driver_id, race_reason_retired, race_positions_gained')
    .in('race_id', ids)
    .in('type', ['RACE_RESULT', 'QUALIFYING_RESULT', 'FASTEST_LAP', 'SPRINT_RACE_RESULT', 'DRIVER_OF_THE_DAY_RESULT']);

  if (dErr) throw new Error(`Season stats (data): ${dErr.message}`);

  const stats = {};
  const get = (id) => (stats[id] ||= {
    wins: 0, podiums: 0, points_finishes: 0, dnf: 0, poles: 0,
    fastest_laps: 0, dotd: 0, sprint_wins: 0, positions_gained: 0,
    best_finish: null, avg_finish: null, races: 0, _sum: 0, _fin: 0,
  });

  (rows || []).forEach(r => {
    const s = get(r.driver_id);
    const p = r.position_number;
    switch (r.type) {
      case 'RACE_RESULT':
        s.races++;
        if (p === 1) s.wins++;
        if (p && p <= 3) s.podiums++;
        if (p && p <= 10) s.points_finishes++;
        if (r.race_reason_retired) s.dnf++;
        if (p) { s._fin++; s._sum += p; if (s.best_finish === null || p < s.best_finish) s.best_finish = p; }
        if (r.race_positions_gained) s.positions_gained += r.race_positions_gained;
        break;
      case 'QUALIFYING_RESULT':        if (p === 1) s.poles++; break;
      case 'FASTEST_LAP':              if (p === 1) s.fastest_laps++; break;
      case 'SPRINT_RACE_RESULT':       if (p === 1) s.sprint_wins++; break;
      case 'DRIVER_OF_THE_DAY_RESULT': if (p === 1) s.dotd++; break;
      default: break;
    }
  });

  Object.values(stats).forEach(s => {
    s.avg_finish = s._fin ? Math.round((s._sum / s._fin) * 10) / 10 : null;
    delete s._sum; delete s._fin;
  });

  return stats;
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
// View: current_season_constructor_standings — enriched with career stats + flag.
export async function getConstructorStandings() {
  const { data: standings, error } = await supabase
    .from('current_season_constructor_standings')
    .select('*')
    .order('position_number', { ascending: true });

  throwIfError(error, 'Constructor standings');

  const [{ data: cons }, { data: countries }] = await Promise.all([
    supabase
      .from('constructor')
      .select('id, name, country_id, total_championship_wins, total_race_wins, total_podiums, total_pole_positions, total_points, total_race_entries, best_championship_position'),
    supabase
      .from('country')
      .select('id, alpha2_code'),
  ]);

  const conMap = {}; (cons || []).forEach(c => { conMap[c.id] = c; });
  const isoMap = {}; (countries || []).forEach(c => { isoMap[c.id] = c.alpha2_code; });

  // Dedupe by constructor_id (the view can contain duplicate rows) — keep highest points.
  const byId = {};
  (standings || []).forEach(row => {
    const id = row.constructor_id;
    if (!byId[id] || (row.points ?? 0) > (byId[id].points ?? 0)) byId[id] = row;
  });

  return Object.values(byId)
    .map(row => {
      const meta = conMap[row.constructor_id] || {};
      return {
        id:               String(row.constructor_id ?? ''),
        team_name:        row.constructor_name || meta.name || '',
        team_color:       null,
        points:           row.points ?? 0,
        championship_won: row.championship_won ?? false,
        nationality_iso:  isoMap[meta.country_id] || null,
        // back-compat fields (current-season wins/podiums live in getConstructorSeasonStats)
        wins: 0, podiums: 0,
        career: {
          titles:            meta.total_championship_wins ?? 0,
          wins:              meta.total_race_wins ?? 0,
          podiums:           meta.total_podiums ?? 0,
          poles:             meta.total_pole_positions ?? 0,
          points:            meta.total_points ?? 0,
          entries:           meta.total_race_entries ?? 0,
          best_championship: meta.best_championship_position ?? null,
        },
      };
    })
    .sort((a, b) => b.points - a.points)
    .map((t, i) => ({ ...t, position: i + 1 }));
}

// ─── CONSTRUCTOR SEASON STATS (per-race aggregation) ─────────────────────────
export async function getConstructorSeasonStats(season = currentYear()) {
  const { data: races, error: rErr } = await supabase
    .from('race').select('id').eq('year', season);
  if (rErr) throw new Error(`Constructor stats (races): ${rErr.message}`);
  const ids = (races || []).map(r => r.id);
  if (!ids.length) return {};

  const { data: rows, error: dErr } = await supabase
    .from('race_data')
    .select('type, position_number, constructor_id, race_reason_retired')
    .in('race_id', ids)
    .in('type', ['RACE_RESULT', 'QUALIFYING_RESULT', 'FASTEST_LAP']);
  if (dErr) throw new Error(`Constructor stats (data): ${dErr.message}`);

  const stats = {};
  const get = (id) => (stats[id] ||= { wins: 0, podiums: 0, poles: 0, fastest_laps: 0, dnf: 0, points_finishes: 0 });
  (rows || []).forEach(r => {
    const s = get(r.constructor_id);
    const p = r.position_number;
    if (r.type === 'RACE_RESULT') {
      if (p === 1) s.wins++;
      if (p && p <= 3) s.podiums++;
      if (p && p <= 10) s.points_finishes++;
      if (r.race_reason_retired) s.dnf++;
    } else if (r.type === 'QUALIFYING_RESULT' && p === 1) s.poles++;
    else if (r.type === 'FASTEST_LAP' && p === 1) s.fastest_laps++;
  });
  return stats;
}

// ─── CONSTRUCTOR POINTS BY YEAR (history, any team) ──────────────────────────
export async function getConstructorPointsByYear(constructorId) {
  if (!constructorId) return [];
  const { data, error } = await supabase
    .from('season_constructor_standing')
    .select('year, position_number, points')
    .eq('constructor_id', constructorId)
    .order('year', { ascending: true });
  if (error) { console.error('Constructor points by year:', error.message); return []; }
  return (data || []).map(r => ({ year: r.year, points: r.points ?? 0, position: r.position_number ?? null }));
}

// ─── SEASON CONFIG ────────────────────────────────────────────────────────────
// Next-race info comes from the race_calendar_with_results view (flag + countdown),
// but the GP counts come from the authoritative `race` table — the view is
// incomplete and otherwise produced wrong counts (e.g. 992/1000).
export async function getSeasonConfig() {
  const now = new Date();

  const { data: viewRows, error } = await supabase
    .from('race_calendar_with_results')
    .select('*')
    .order('round', { ascending: true });

  throwIfError(error, 'Season config');

  const all = viewRows || [];
  const yearOf = (r) => {
    if (r.year) return r.year;
    if (r.season) return r.season;
    const d = r.race_date || r.date;
    return d ? new Date(d).getFullYear() : null;
  };
  const upcoming = all.find(r => {
    const d = r.race_date || r.date;
    return d && new Date(d) >= now;
  });
  const years = all.map(yearOf).filter(Boolean);
  const season = (upcoming && yearOf(upcoming))
    || (years.length ? Math.max(...years) : now.getFullYear());

  // Authoritative race count for the season (the view omits some races).
  const { data: races } = await supabase
    .from('race')
    .select('date, sprint_race_date')
    .eq('year', season)
    .order('round', { ascending: true });

  const list = (races && races.length)
    ? races
    : all.filter(r => yearOf(r) === season).map(r => ({ date: r.race_date || r.date, sprint_race_date: r.sprint_race_date }));

  const completed        = list.filter(r => r.date && new Date(r.date) < now);
  const sprintRaces      = list.filter(r => r.sprint_race_date);
  const completedSprints = completed.filter(r => r.sprint_race_date);

  return {
    season,
    total_races:          list.length,
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
    constructors_champion: row.constructors_champion ?? (row.position_number === 1),
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
