import { supabase } from './supabase';

function throwIfError(error, context) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

export async function getNextGrandPrix() {
  const { data, error } = await supabase
    .from('grand_prix')
    .select('*')
    .or('status.eq.upcoming,status.eq.live')
    .order('race_date', { ascending: true })
    .limit(1);

  throwIfError(error, 'Failed loading next grand prix');
  return data?.[0] || null;
}

export async function getGrandPrixList(limit = 50) {
  const { data, error } = await supabase
    .from('grand_prix')
    .select('*')
    .order('race_date', { ascending: false })
    .limit(limit);

  throwIfError(error, 'Failed loading grand prix list');
  return data || [];
}

export async function getActiveDrivers(season = 2026) {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('season', season)
    .eq('is_active', true)
    .order('surname', { ascending: true });

  throwIfError(error, 'Failed loading active drivers');
  return data || [];
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
