import { supabase } from './supabase';

function throwIfError(error, context) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

function normalizeGp(row) {
  const raceDateRaw = row.race_date || row.date || row.race_datetime || row.raceDate;
  const raceDate = raceDateRaw ? new Date(raceDateRaw) : null;
  const pickDeadlineRaw = row.pick_deadline || (raceDate ? new Date(raceDate.getTime() - 60 * 60 * 1000).toISOString() : null);
  const pickDeadline = pickDeadlineRaw ? new Date(pickDeadlineRaw) : null;
  const now = new Date();

  let status = row.status || 'upcoming';
  if (!row.status && raceDate) {
    if (now >= raceDate) status = 'completed';
    else if (pickDeadline && now >= pickDeadline) status = 'live';
    else status = 'upcoming';
  }

  return {
    id: String(row.id || row.race_id || row.grand_prix_id || row.round || row.name || Math.random()),
    name: row.name || row.grand_prix_name || row.race_name || 'Grand Prix',
    race_date: raceDateRaw || null,
    pick_deadline: pickDeadlineRaw || raceDateRaw || null,
    round: row.round || row.race_round || null,
    flag_emoji: row.flag_emoji || row.country_flag || '🏁',
    circuit: row.circuit || row.circuit_name || row.track_name || '',
    country: row.country || row.country_name || '',
    status,
    race_results: row.race_results || null,
  };
}

async function fetchGpRows(limit = 50, ascending = true) {
  const attempts = [
    () =>
      supabase
        .from('grand_prix')
        .select('*')
        .order('race_date', { ascending })
        .limit(limit),
    () =>
      supabase
        .from('race_calendar_with_results')
        .select('*')
        .order('race_date', { ascending })
        .limit(limit),
    () =>
      supabase
        .from('race')
        .select('*')
        .order('date', { ascending })
        .limit(limit),
  ];

  let lastError = null;
  for (const attempt of attempts) {
    const { data, error } = await attempt();
    if (!error) return data || [];
    lastError = error;
  }
  throwIfError(lastError, 'Failed loading grand prix data');
  return [];
}

export async function getNextGrandPrix() {
  const rows = await fetchGpRows(200, true);
  const mapped = rows.map(normalizeGp).filter((gp) => gp.race_date);
  const now = new Date();

  const upcoming = mapped.find((gp) => new Date(gp.race_date) >= now);
  return upcoming || mapped[mapped.length - 1] || null;
}

export async function getGrandPrixList(limit = 50) {
  const rows = await fetchGpRows(limit, false);
  return rows.map(normalizeGp);
}

export async function getActiveDrivers(season = 2026) {
  const tryLoadWithFilters = async (tableName) => {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('season', season)
      .eq('is_active', true)
      .order('surname', { ascending: true });
    return { data, error };
  };

  const tryLoadSimple = async (tableName) => {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('surname', { ascending: true })
      .limit(40);
    return { data, error };
  };

  const first = await tryLoadWithFilters('drivers');
  if (!first.error) return first.data || [];

  // Fallback for projects using singular table names.
  const second = await tryLoadWithFilters('driver');
  if (!second.error) return second.data || [];

  const third = await tryLoadSimple('driver');
  if (!third.error) return third.data || [];

  const fourth = await tryLoadSimple('drivers');
  if (!fourth.error) return fourth.data || [];

  throw new Error(`Failed loading active drivers: ${first.error.message}`);
}

export async function getCircuits() {
  // Optional dataset: not all projects include this table.
  const { data, error } = await supabase
    .from('circuits')
    .select('*')
    .order('name', { ascending: true });

  if (error) return [];
  return data || [];
}
