import { supabase } from './supabase';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function throwIfError(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function currentYear() {
  return new Date().getFullYear();
}

// ─── SEASON PROGRESS (results-driven) ────────────────────────────────────────
// Source of truth for "which race is done": a race is completed when it has
// RACE_RESULT rows — NOT when its calendar date has passed. The dataset can
// carry results slightly ahead of the calendar dates, which made date-based
// logic look "one race behind" (wrong last race, next race and GP counts).
// Everything season-related derives from this so it all stays consistent.
export async function getSeasonRaceStatus(season = currentYear()) {
  const { data: races, error } = await supabase
    .from('race')
    .select('id, round, date, time, official_name, grand_prix_id, circuit_id, sprint_race_date, year')
    .eq('year', season)
    .order('round', { ascending: true });
  throwIfError(error, 'Season race status');

  const list = races || [];
  const ids = list.map(r => r.id);
  let doneSet = new Set();
  if (ids.length) {
    const { data: rows } = await supabase
      .from('race_data').select('race_id').eq('type', 'RACE_RESULT').in('race_id', ids);
    doneSet = new Set((rows || []).map(r => r.race_id));
  }

  // Una gara conta come "corsa" solo se ha i risultati E la sua data non è nel
  // futuro. Il dataset può contenere risultati in anticipo (una gara con
  // risultato ma data ancora a venire): senza questo controllo verrebbe data
  // per disputata, sballando "ultima"/"prossima" gara e il conteggio.
  const todayStr = new Date().toISOString().slice(0, 10);
  const isRun = (r) => doneSet.has(r.id) && (!r.date || r.date <= todayStr);

  const withStatus = list.map(r => ({ ...r, done: isRun(r) }));
  const doneRaces = withStatus.filter(r => r.done);
  const todo = withStatus.filter(r => !r.done);
  // La "prossima" è la prima gara ancora da correre con data odierna o futura,
  // così una gara passata e mai disputata (cancellata) non viene scambiata per
  // il prossimo appuntamento.
  const upcoming = todo.filter(r => !r.date || r.date >= todayStr);
  // Gare passate e mai disputate (cancellate): né corse né in programma. Non
  // devono gonfiare il conteggio di "gare rimaste".
  const cancelled = todo.filter(r => r.date && r.date < todayStr);

  return {
    season,
    races: withStatus,
    upcoming,
    cancelled,
    lastDone: doneRaces.length ? doneRaces[doneRaces.length - 1] : null,
    nextRace: upcoming.length ? upcoming[0] : null,
    completedCount: doneRaces.length,
    totalCount: withStatus.length,
    // Gare/sprint ancora da correre = solo quelle in programma (future).
    remainingCount: upcoming.length,
    remainingSprints: upcoming.filter(r => r.sprint_race_date).length,
    sprintsTotal: withStatus.filter(r => r.sprint_race_date).length,
    sprintsCompleted: doneRaces.filter(r => r.sprint_race_date).length,
  };
}

// grand_prix name + country for a race row (one query).
async function gpInfo(grandPrixId) {
  if (!grandPrixId) return {};
  const { data } = await supabase
    .from('grand_prix').select('name, country_id').eq('id', grandPrixId).limit(1);
  return data?.[0] || {};
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
    .select('id, round, date, sprint_race_date, official_name, circuit_id')
    .eq('year', season)
    .order('round', { ascending: true });
  throwIfError(error, 'All season races');

  const cityMap = await fetchCityMap(data);

  return (data || []).map(r => ({
    id:        r.id,
    round:     r.round,
    date:      r.date,
    name:      r.official_name || '',
    city:      cityMap[r.circuit_id] || '',
    hasSprint: !!r.sprint_race_date,
    isPast:    r.date <= today,
  }));
}

// ─── LAST RACE DATE ──────────────────────────────────────────────────────────
export async function getLastRaceDate() {
  const st = await getSeasonRaceStatus();
  return st.lastDone?.date ?? null;
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

// ─── CONSTRUCTOR RECENT RESULTS (form) ───────────────────────────────────────
// Best finishing position (of either car) in the most recent completed races.
// Returns most-recent-first: [{ race_id, date, name, country_id, position, dnf }].
export async function getConstructorRecentResults(constructorId, limit = 5) {
  if (!constructorId) return [];
  const st = await getSeasonRaceStatus();
  const races = st.races.filter(r => r.done).slice(-limit).reverse(); // latest done, newest first
  if (!races.length) return [];

  const ids = races.map(r => r.id);
  const { data: rows } = await supabase
    .from('race_data')
    .select('race_id, position_number, race_reason_retired')
    .in('race_id', ids)
    .eq('type', 'RACE_RESULT')
    .eq('constructor_id', constructorId);

  const byRace = {};
  (rows || []).forEach(r => {
    const g = (byRace[r.race_id] ||= { best: null, finishers: 0, cars: 0 });
    g.cars++;
    if (r.position_number != null) {
      g.finishers++;
      if (g.best === null || r.position_number < g.best) g.best = r.position_number;
    }
  });

  const gpIds = races.map(r => r.grand_prix_id).filter(Boolean);
  let gpMap = {};
  if (gpIds.length) {
    const { data: gps } = await supabase
      .from('grand_prix').select('id, name, country_id').in('id', gpIds);
    (gps || []).forEach(g => { gpMap[g.id] = g; });
  }

  return races.map(r => {
    const g = byRace[r.id] || null;
    const gp = gpMap[r.grand_prix_id] || {};
    return {
      race_id:    r.id,
      date:       r.date,
      name:       gp.name || r.official_name || '',
      country_id: gp.country_id || null,
      position:   g?.best ?? null,
      dnf:        !!g && g.cars > 0 && g.finishers === 0,
    };
  });
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
  const st = await getSeasonRaceStatus();
  const next = st.nextRace; // first race without results (null if season over)
  const gp = next ? await gpInfo(next.grand_prix_id) : {};

  return {
    season:               st.season,
    total_races:          st.totalCount,
    races_completed:      st.completedCount,
    // Gare che si correranno davvero (escluse le cancellate) e quante ne restano.
    races_scheduled:      st.completedCount + st.remainingCount,
    races_remaining:      st.remainingCount,
    total_sprints:        st.sprintsTotal,
    sprints_completed:    st.sprintsCompleted,
    sprints_remaining:    st.remainingSprints,
    next_race_name:       gp.name || next?.official_name || null,
    next_race_circuit:    '',
    next_race_date:       next?.date || null,
    next_race_has_sprint: !!next?.sprint_race_date,
  };
}

// Next race = the first race without results yet (what to count down to).
// Returns the ISO start (for the countdown) + flag/city info.
export async function getNextRace() {
  const st = await getSeasonRaceStatus();
  const r = st.nextRace || st.lastDone || st.races[st.races.length - 1];
  if (!r) return null;

  const gp = await gpInfo(r.grand_prix_id);

  let city = '';
  if (r.circuit_id) {
    const { data: cir } = await supabase
      .from('circuit').select('place_name').eq('id', r.circuit_id).limit(1);
    city = cir?.[0]?.place_name || '';
  }

  return {
    id:            r.id,
    name:          gp.name || r.official_name || '',
    official_name: r.official_name || '',
    startIso:      `${r.date}T${(r.time || '00:00').slice(0, 5)}:00Z`,
    country_id:    gp.country_id || null,
    city,
    has_sprint:    !!r.sprint_race_date,
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
// Podium (top 3) of the most recent completed race of the season.
export async function getLastRaceResults() {
  const st = await getSeasonRaceStatus();
  const r = st.lastDone; // most recent race that actually has results
  if (!r) return null;

  const results = await fetchRaceResults(r.id);
  if (!results.length) return null;

  const gp = await gpInfo(r.grand_prix_id);
  const name = gp.name || r.official_name || '';

  // Giro veloce e Pilota del giorno (posizione 1 = chi l'ha ottenuto): marcano
  // le righe corrispondenti così il recap mostra più dell'ordine d'arrivo.
  const { data: extra } = await supabase
    .from('race_data')
    .select('type, driver_id')
    .eq('race_id', r.id)
    .in('type', ['FASTEST_LAP', 'DRIVER_OF_THE_DAY_RESULT'])
    .eq('position_number', 1);
  const flId   = (extra || []).find(x => x.type === 'FASTEST_LAP')?.driver_id || null;
  const dotdId = (extra || []).find(x => x.type === 'DRIVER_OF_THE_DAY_RESULT')?.driver_id || null;
  const marked = results.map(p => ({
    ...p,
    fl:   !!flId   && p.driverId === flId,
    dotd: !!dotdId && p.driverId === dotdId,
  }));

  // `podium` kept for back-compat; `results` is the full classification.
  return { name, country_id: gp.country_id || null, date: r.date, results: marked, podium: marked.slice(0, 3) };
}

// Full race classification (with points) for one race, ordered as officially
// finished (DNFs last). Shared by the last-race recap and the calendar modal.
async function fetchRaceResults(raceId) {
  const { data: rows } = await supabase
    .from('race_data')
    .select('position_number, position_text, driver_id, constructor_id, race_points, position_display_order')
    .eq('race_id', raceId)
    .eq('type', 'RACE_RESULT')
    .order('position_display_order', { ascending: true });
  if (!rows || !rows.length) return [];

  const driverIds = rows.map(x => x.driver_id).filter(Boolean);
  const dmap = {};
  if (driverIds.length) {
    const { data: drivers } = await supabase
      .from('driver').select('id, name, abbreviation').in('id', driverIds);
    (drivers || []).forEach(d => { dmap[d.id] = d; });
  }

  return rows.map(x => ({
    pos:     x.position_number,
    posText: x.position_text || (x.position_number != null ? String(x.position_number) : '—'),
    driverId: x.driver_id || null,
    driver:  dmap[x.driver_id]?.name || x.driver_id || '',
    code:    dmap[x.driver_id]?.abbreviation || '',
    team:    (x.constructor_id || '').replace(/-/g, ' '),
    points:  x.race_points != null ? Number(x.race_points) : 0,
  }));
}

// On-demand race results, used when a past race is expanded in the calendar.
export async function getRaceResults(raceId) {
  if (!raceId) return [];
  return fetchRaceResults(raceId);
}

// Sessions (FP/Qualifying/Sprint/Race) of the next race, with UTC datetimes.
// Times in the DB are UTC "HH:MM" strings — we build ISO-UTC so the client can
// render them in the user's own timezone.
export async function getNextRaceSessions() {
  const st = await getSeasonRaceStatus();
  const nr = st.nextRace; // first race without results
  if (!nr) return null;

  const cols = [
    'round', 'date', 'time', 'official_name', 'grand_prix_id',
    'free_practice_1_date', 'free_practice_1_time',
    'free_practice_2_date', 'free_practice_2_time',
    'free_practice_3_date', 'free_practice_3_time',
    'sprint_qualifying_date', 'sprint_qualifying_time',
    'sprint_race_date', 'sprint_race_time',
    'qualifying_date', 'qualifying_time',
  ].join(', ');

  const { data, error } = await supabase
    .from('race').select(cols).eq('id', nr.id).limit(1);

  if (error || !data || !data.length) return null;
  const r = data[0];

  const gp = await gpInfo(r.grand_prix_id);
  const name = gp.name || r.official_name || '';

  const toUtc = (d, t) => `${d}T${(t || '00:00').slice(0, 5)}:00Z`;
  const defs = [
    ['fp1',    r.free_practice_1_date,   r.free_practice_1_time],
    ['fp2',    r.free_practice_2_date,   r.free_practice_2_time],
    ['fp3',    r.free_practice_3_date,   r.free_practice_3_time],
    ['sq',     r.sprint_qualifying_date, r.sprint_qualifying_time],
    ['sprint', r.sprint_race_date,       r.sprint_race_time],
    ['quali',  r.qualifying_date,        r.qualifying_time],
    ['race',   r.date,                   r.time],
  ];

  const sessions = defs
    .filter(([, d]) => d)
    .map(([key, d, t]) => ({ key, iso: toUtc(d, t), hasTime: !!t }))
    .sort((a, b) => (a.iso < b.iso ? -1 : 1));

  return { name, round: r.round, sessions };
}

// ─── DRIVER RECENT RESULTS (form) ────────────────────────────────────────────
// Finishing position of a driver in the most recent completed races of the season.
// Returns most-recent-first: [{ race_id, date, name, country_id, position, dnf }].
export async function getDriverRecentResults(driverId, limit = 5) {
  if (!driverId) return [];
  const st = await getSeasonRaceStatus();
  const races = st.races.filter(r => r.done).slice(-limit).reverse(); // latest done, newest first
  if (!races.length) return [];

  const ids = races.map(r => r.id);
  const { data: rows } = await supabase
    .from('race_data')
    .select('race_id, position_number, race_reason_retired')
    .in('race_id', ids)
    .eq('type', 'RACE_RESULT')
    .eq('driver_id', driverId);

  const byRace = {};
  (rows || []).forEach(r => { byRace[r.race_id] = r; });

  // Enrich with grand_prix names/flags
  const gpIds = races.map(r => r.grand_prix_id).filter(Boolean);
  let gpMap = {};
  if (gpIds.length) {
    const { data: gps } = await supabase
      .from('grand_prix').select('id, name, country_id').in('id', gpIds);
    (gps || []).forEach(g => { gpMap[g.id] = g; });
  }

  return races.map(r => {
    const rd = byRace[r.id] || null;
    const gp = gpMap[r.grand_prix_id] || {};
    return {
      race_id:    r.id,
      date:       r.date,
      name:       gp.name || r.official_name || '',
      country_id: gp.country_id || null,
      position:   rd?.position_number ?? null,
      dnf:        !!rd?.race_reason_retired,
    };
  });
}

export async function getUpcomingRaces(limit = 5) {
  const st = await getSeasonRaceStatus();
  const data = st.upcoming.slice(0, limit); // scheduled races still to come (excludes cancelled)
  if (!data.length) return [];

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

  const cityMap = await fetchCityMap(data);

  return (data || []).map(r => {
    const gp = gpMap[r.grand_prix_id] || {};
    return {
      id:          r.id,
      round:       r.round,
      name:        gp.name || r.official_name || '',
      date:        r.date,
      has_sprint:  !!(r.sprint_race_date),
      country_id:  gp.country_id || null,
      city:        cityMap[r.circuit_id] || '',
    };
  });
}

// Maps circuit_id → place_name (city) for a list of race rows, in one query.
async function fetchCityMap(rows) {
  const ids = [...new Set((rows || []).map(r => r.circuit_id).filter(Boolean))];
  if (!ids.length) return {};
  const { data } = await supabase
    .from('circuit').select('id, place_name').in('id', ids);
  const map = {};
  (data || []).forEach(c => { map[c.id] = c.place_name; });
  return map;
}
