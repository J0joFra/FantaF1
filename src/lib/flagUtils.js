// Flag images via flagcdn.com — free, no API key, served as PNG by ISO 3166-1 alpha-2 code.
// Usage: <img src={flagUrl('mc')} alt="Monaco" className="w-8 h-6 object-cover rounded-sm" />

export function flagUrl(code, size = 'h40') {
  if (!code) return null;
  return `https://flagcdn.com/${size}/${code.toLowerCase()}.png`;
}

// ── GP name / country_id → ISO code ──────────────────────────────────────────
// Maps either a Supabase country_id string OR a GP name keyword to an ISO code.
const NAME_TO_ISO = {
  // by GP / circuit name keyword
  australia:      'au', bahrain:      'bh', saudi:        'sa',
  jeddah:         'sa', japan:        'jp', china:        'cn',
  miami:          'us', imola:        'it', 'emilia':     'it',
  monaco:         'mc', canada:       'ca', spain:        'es',
  austria:        'at', britain:      'gb', silverstone:  'gb',
  hungary:        'hu', belgium:      'be', netherlands:  'nl',
  zandvoort:      'nl', italy:        'it', monza:        'it',
  singapore:      'sg', 'united states': 'us', usa:       'us',
  mexico:         'mx', brazil:       'br', 'las vegas':  'us',
  qatar:          'qa', 'abu dhabi':  'ae',
  // by Supabase country_id (usually the country name in English, lowercase)
  'australia':    'au', 'bahrain':    'bh', 'saudi arabia': 'sa',
  'japan':        'jp', 'china':      'cn', 'united states': 'us',
  'italy':        'it', 'monaco':     'mc', 'canada':     'ca',
  'spain':        'es', 'austria':    'at', 'great britain': 'gb',
  'united kingdom': 'gb', 'hungary':  'hu', 'belgium':    'be',
  'netherlands':  'nl', 'singapore':  'sg', 'mexico':     'mx',
  'brazil':       'br', 'qatar':      'qa', 'uae':        'ae',
  'united arab emirates': 'ae',
};

export function gpIso(nameOrId = '') {
  const n = nameOrId.toLowerCase().trim();
  // Direct lookup first
  if (NAME_TO_ISO[n]) return NAME_TO_ISO[n];
  // Substring scan
  for (const [key, iso] of Object.entries(NAME_TO_ISO)) {
    if (n.includes(key)) return iso;
  }
  return null;
}

// Convenience: given a race object {name, country_id}, return a flag <img> src
export function raceFlagUrl(race, size = 'h40') {
  const iso = (race?.country_id ? gpIso(race.country_id) : null)
           || (race?.name       ? gpIso(race.name)       : null);
  return iso ? flagUrl(iso, size) : null;
}
