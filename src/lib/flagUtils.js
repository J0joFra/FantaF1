// Flag images via flagcdn.com — free, no API key, served as PNG by ISO 3166-1 alpha-2 code.
// Usage: <img src={flagUrl('mc')} alt="Monaco" className="w-8 h-6 object-cover rounded-sm" />

export function flagUrl(code, size = 'h40') {
  if (!code) return null;
  return `https://flagcdn.com/${size}/${code.toLowerCase()}.png`;
}

// ── GP name / country_id → ISO code ──────────────────────────────────────────
// Maps either a Supabase country_id string OR a GP name keyword to an ISO code.
const NAME_TO_ISO = {
  // English nouns + adjectives
  australia:        'au', australian:     'au',
  bahrain:          'bh',
  saudi:            'sa', jeddah:         'sa',
  japan:            'jp', japanese:       'jp',
  china:            'cn', chinese:        'cn',
  miami:            'us', 'las vegas':    'us', 'united states': 'us', usa: 'us',
  imola:            'it', emilia:         'it', monza:           'it',
  italy:            'it', italian:        'it', italia:          'it',
  monaco:           'mc',
  canada:           'ca', canadian:       'ca',
  spain:            'es', spanish:        'es', barcelona:       'es',
  catalunya:        'es', 'españa':       'es',
  austria:          'at', austrian:       'at',
  britain:          'gb', british:        'gb', silverstone:     'gb',
  'great britain':  'gb', 'united kingdom': 'gb',
  hungary:          'hu', hungarian:      'hu',
  belgium:          'be', belgian:        'be',
  netherlands:      'nl', dutch:          'nl', zandvoort:       'nl',
  singapore:        'sg',
  mexico:           'mx', mexican:        'mx', 'méxico':        'mx', ciudad: 'mx',
  brazil:           'br', brazilian:      'br', brasil:          'br',
  'são paulo':      'br', 'prêmio':       'br',
  qatar:            'qa',
  'abu dhabi':      'ae', uae:            'ae', 'united arab emirates': 'ae',
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
