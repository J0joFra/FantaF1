import { createContext, useContext, useState, useEffect } from "react";

export const LANGS = [
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
];

// Dizionario. Le chiavi mancanti in una lingua ricadono sull'italiano.
const DICT = {
  it: {
    // nav
    nav_overview: "Panoramica", nav_scenarios: "Scenari", nav_compare: "Confronta", nav_teams: "Scuderie",
    // comune
    share: "Condividi", save: "Salva", loading: "Caricamento…", retry: "Riprova",
    season: "Stagione", career: "Carriera", vs: "vs", leader: "Leader",
    showAll: "Vedi tutti", showLess: "Mostra meno", pts: "pt",
    // home
    home_tagline: "Calcola i punti necessari per vincere il Campionato del Mondo di F1",
    home_standings: "Classifica Piloti", home_scenario: "Scenario Attuale", home_edit: "Modifica",
    home_needed: "Punti necessari per vincere", home_nextGps: "Prossimi GP",
    home_canWin: "può vincere il campionato con", home_racesRemaining: "GARE\nRIMANENTI",
    home_maxAvailable: "PUNTI MAX\nDISPONIBILI", home_maxNext: "MAX\nPROSSIMO GP",
    home_neededHint: "Quanti punti deve ancora conquistare il leader per essere sicuro del titolo, considerando il massimo che può fare l'inseguitore nelle gare rimaste.",
    // scenari
    sc_selectDriver: "Seleziona Pilota", sc_gpRemaining: "GP rimanenti",
    sc_untilEnd: "Fino a fine campionato", sc_withSprint: "con sprint",
    sc_objective: "Obiettivo", sc_mainRival: "Rivale principale da battere", sc_gap: "Distacco",
    sc_driversToBeat: "Piloti da superare", sc_toBeat: "da battere",
    sc_tapDriver: "👆 Tocca un pilota per vedere il mosaico delle strategie",
    sc_chooseDriver: "Scegli un pilota da superare",
    sc_chooseHint: "Tocca uno dei piloti qui sopra per vedere il mosaico delle strategie",
    sc_mosaic: "Mosaico Strategie", sc_champion: "Campione del Mondo! 🏆", sc_out: "Matematicamente Fuori ❌",
    // confronta
    cmp_pilot1: "Pilota 1", cmp_pilot2: "Pilota 2", cmp_selectDriver: "Seleziona pilota…",
    cmp_headToHead: "Testa a testa", cmp_ahead: "avanti", cmp_balanced: "In equilibrio",
    cmp_selectTwo: "Seleziona due piloti", cmp_random: "Pescaggio casuale",
    cmp_seasonStats: "Statistiche della stagione in corso", cmp_careerStats: "Statistiche di carriera (tutte le stagioni)",
    // scuderie
    tm_team: "Scuderia", tm_title: "Titolo costruttori", tm_standings: "Classifica costruttori",
    tm_compare: "Confronto scuderie", tm_history: "Albo & storia", tm_chooseOpponent: "Scegli avversario…",
    tm_gpLeft: "GP rimasti", tm_pointsAtStake: "punti in palio", tm_fromLeader: "dal leader",
    // stat labels
    st_points: "Punti", st_wins: "Vittorie", st_podiums: "Podi", st_poles: "Pole position",
    st_fastestLaps: "Giri veloci", st_pointsFinishes: "Arrivi a punti", st_dotd: "Driver of the Day",
    st_positionsGained: "Posizioni guadagnate", st_bestFinish: "Miglior arrivo", st_avgFinish: "Arrivo medio",
    st_dnf: "Ritiri (DNF)", st_titles: "Titoli mondiali", st_constructorTitles: "Titoli costruttori",
    st_careerPoints: "Punti carriera", st_totalPoints: "Punti totali", st_racesEntered: "Gare disputate", st_gpEntered: "GP disputati",
    // tema/lingua
    theme_light: "Tema chiaro", theme_dark: "Tema scuro", language: "Lingua",
  },
  en: {
    nav_overview: "Overview", nav_scenarios: "Scenarios", nav_compare: "Compare", nav_teams: "Teams",
    share: "Share", save: "Save", loading: "Loading…", retry: "Retry",
    season: "Season", career: "Career", vs: "vs", leader: "Leader",
    showAll: "Show all", showLess: "Show less", pts: "pts",
    home_tagline: "Work out the points needed to win the F1 World Championship",
    home_standings: "Driver Standings", home_scenario: "Current Scenario", home_edit: "Edit",
    home_needed: "Points needed to win", home_nextGps: "Upcoming GPs",
    home_canWin: "can win the title with", home_racesRemaining: "RACES\nREMAINING",
    home_maxAvailable: "MAX POINTS\nAVAILABLE", home_maxNext: "MAX\nNEXT GP",
    home_neededHint: "How many points the leader still needs to secure the title, given the maximum the chaser can score in the remaining races.",
    sc_selectDriver: "Select Driver", sc_gpRemaining: "GPs remaining",
    sc_untilEnd: "Until the end of the season", sc_withSprint: "with sprint",
    sc_objective: "Goal", sc_mainRival: "Main rival to beat", sc_gap: "Gap",
    sc_driversToBeat: "Drivers to overtake", sc_toBeat: "to beat",
    sc_tapDriver: "👆 Tap a driver to see the strategy mosaic",
    sc_chooseDriver: "Pick a driver to overtake",
    sc_chooseHint: "Tap one of the drivers above to see the strategy mosaic",
    sc_mosaic: "Strategy Mosaic", sc_champion: "World Champion! 🏆", sc_out: "Mathematically Out ❌",
    cmp_pilot1: "Driver 1", cmp_pilot2: "Driver 2", cmp_selectDriver: "Select driver…",
    cmp_headToHead: "Head to head", cmp_ahead: "ahead", cmp_balanced: "Balanced",
    cmp_selectTwo: "Select two drivers", cmp_random: "Random pick",
    cmp_seasonStats: "Current season statistics", cmp_careerStats: "Career statistics (all seasons)",
    tm_team: "Team", tm_title: "Constructors' title", tm_standings: "Constructor standings",
    tm_compare: "Compare teams", tm_history: "Honours & history", tm_chooseOpponent: "Choose opponent…",
    tm_gpLeft: "GPs left", tm_pointsAtStake: "points at stake", tm_fromLeader: "from leader",
    st_points: "Points", st_wins: "Wins", st_podiums: "Podiums", st_poles: "Pole positions",
    st_fastestLaps: "Fastest laps", st_pointsFinishes: "Points finishes", st_dotd: "Driver of the Day",
    st_positionsGained: "Positions gained", st_bestFinish: "Best finish", st_avgFinish: "Average finish",
    st_dnf: "Retirements (DNF)", st_titles: "World titles", st_constructorTitles: "Constructors' titles",
    st_careerPoints: "Career points", st_totalPoints: "Total points", st_racesEntered: "Races entered", st_gpEntered: "GPs entered",
    theme_light: "Light theme", theme_dark: "Dark theme", language: "Language",
  },
  fr: {
    nav_overview: "Aperçu", nav_scenarios: "Scénarios", nav_compare: "Comparer", nav_teams: "Écuries",
    share: "Partager", save: "Enregistrer", loading: "Chargement…", retry: "Réessayer",
    season: "Saison", career: "Carrière", vs: "vs", leader: "Leader",
    showAll: "Voir tout", showLess: "Voir moins", pts: "pts",
    home_tagline: "Calculez les points nécessaires pour gagner le Championnat du Monde de F1",
    home_standings: "Classement Pilotes", home_scenario: "Scénario actuel", home_edit: "Modifier",
    home_needed: "Points nécessaires pour gagner", home_nextGps: "Prochains GP",
    home_canWin: "peut gagner le titre avec", home_racesRemaining: "COURSES\nRESTANTES",
    home_maxAvailable: "POINTS MAX\nDISPONIBLES", home_maxNext: "MAX\nPROCHAIN GP",
    home_neededHint: "Combien de points le leader doit encore marquer pour assurer le titre, compte tenu du maximum que le poursuivant peut marquer dans les courses restantes.",
    sc_selectDriver: "Choisir un pilote", sc_gpRemaining: "GP restants",
    sc_untilEnd: "Jusqu'à la fin de la saison", sc_withSprint: "avec sprint",
    sc_objective: "Objectif", sc_mainRival: "Rival principal à battre", sc_gap: "Écart",
    sc_driversToBeat: "Pilotes à dépasser", sc_toBeat: "à battre",
    sc_tapDriver: "👆 Touchez un pilote pour voir la mosaïque des stratégies",
    sc_chooseDriver: "Choisissez un pilote à dépasser",
    sc_chooseHint: "Touchez l'un des pilotes ci-dessus pour voir la mosaïque des stratégies",
    sc_mosaic: "Mosaïque des stratégies", sc_champion: "Champion du Monde ! 🏆", sc_out: "Mathématiquement éliminé ❌",
    cmp_pilot1: "Pilote 1", cmp_pilot2: "Pilote 2", cmp_selectDriver: "Choisir un pilote…",
    cmp_headToHead: "Face à face", cmp_ahead: "devant", cmp_balanced: "Équilibré",
    cmp_selectTwo: "Choisissez deux pilotes", cmp_random: "Tirage aléatoire",
    cmp_seasonStats: "Statistiques de la saison en cours", cmp_careerStats: "Statistiques de carrière (toutes saisons)",
    tm_team: "Écurie", tm_title: "Titre constructeurs", tm_standings: "Classement constructeurs",
    tm_compare: "Comparer les écuries", tm_history: "Palmarès & histoire", tm_chooseOpponent: "Choisir un adversaire…",
    tm_gpLeft: "GP restants", tm_pointsAtStake: "points en jeu", tm_fromLeader: "du leader",
    st_points: "Points", st_wins: "Victoires", st_podiums: "Podiums", st_poles: "Pole positions",
    st_fastestLaps: "Meilleurs tours", st_pointsFinishes: "Arrivées dans les points", st_dotd: "Pilote du jour",
    st_positionsGained: "Places gagnées", st_bestFinish: "Meilleure arrivée", st_avgFinish: "Arrivée moyenne",
    st_dnf: "Abandons (DNF)", st_titles: "Titres mondiaux", st_constructorTitles: "Titres constructeurs",
    st_careerPoints: "Points en carrière", st_totalPoints: "Points totaux", st_racesEntered: "Courses disputées", st_gpEntered: "GP disputés",
    theme_light: "Thème clair", theme_dark: "Thème sombre", language: "Langue",
  },
  es: {
    nav_overview: "Resumen", nav_scenarios: "Escenarios", nav_compare: "Comparar", nav_teams: "Escuderías",
    share: "Compartir", save: "Guardar", loading: "Cargando…", retry: "Reintentar",
    season: "Temporada", career: "Carrera", vs: "vs", leader: "Líder",
    showAll: "Ver todos", showLess: "Ver menos", pts: "pts",
    home_tagline: "Calcula los puntos necesarios para ganar el Campeonato del Mundo de F1",
    home_standings: "Clasificación de Pilotos", home_scenario: "Escenario actual", home_edit: "Editar",
    home_needed: "Puntos necesarios para ganar", home_nextGps: "Próximos GP",
    home_canWin: "puede ganar el título con", home_racesRemaining: "CARRERAS\nRESTANTES",
    home_maxAvailable: "PUNTOS MÁX\nDISPONIBLES", home_maxNext: "MÁX\nPRÓXIMO GP",
    home_neededHint: "Cuántos puntos necesita aún el líder para asegurar el título, considerando el máximo que puede sumar el perseguidor en las carreras restantes.",
    sc_selectDriver: "Seleccionar piloto", sc_gpRemaining: "GP restantes",
    sc_untilEnd: "Hasta el final de la temporada", sc_withSprint: "con sprint",
    sc_objective: "Objetivo", sc_mainRival: "Rival principal a batir", sc_gap: "Diferencia",
    sc_driversToBeat: "Pilotos a superar", sc_toBeat: "a batir",
    sc_tapDriver: "👆 Toca un piloto para ver el mosaico de estrategias",
    sc_chooseDriver: "Elige un piloto a superar",
    sc_chooseHint: "Toca uno de los pilotos de arriba para ver el mosaico de estrategias",
    sc_mosaic: "Mosaico de estrategias", sc_champion: "¡Campeón del Mundo! 🏆", sc_out: "Matemáticamente fuera ❌",
    cmp_pilot1: "Piloto 1", cmp_pilot2: "Piloto 2", cmp_selectDriver: "Seleccionar piloto…",
    cmp_headToHead: "Cara a cara", cmp_ahead: "por delante", cmp_balanced: "Equilibrado",
    cmp_selectTwo: "Selecciona dos pilotos", cmp_random: "Selección aleatoria",
    cmp_seasonStats: "Estadísticas de la temporada actual", cmp_careerStats: "Estadísticas de carrera (todas las temporadas)",
    tm_team: "Escudería", tm_title: "Título de constructores", tm_standings: "Clasificación de constructores",
    tm_compare: "Comparar escuderías", tm_history: "Palmarés e historia", tm_chooseOpponent: "Elegir rival…",
    tm_gpLeft: "GP restantes", tm_pointsAtStake: "puntos en juego", tm_fromLeader: "del líder",
    st_points: "Puntos", st_wins: "Victorias", st_podiums: "Podios", st_poles: "Pole positions",
    st_fastestLaps: "Vueltas rápidas", st_pointsFinishes: "Llegadas en puntos", st_dotd: "Piloto del día",
    st_positionsGained: "Posiciones ganadas", st_bestFinish: "Mejor resultado", st_avgFinish: "Resultado medio",
    st_dnf: "Abandonos (DNF)", st_titles: "Títulos mundiales", st_constructorTitles: "Títulos de constructores",
    st_careerPoints: "Puntos en carrera", st_totalPoints: "Puntos totales", st_racesEntered: "Carreras disputadas", st_gpEntered: "GP disputados",
    theme_light: "Tema claro", theme_dark: "Tema oscuro", language: "Idioma",
  },
  de: {
    nav_overview: "Übersicht", nav_scenarios: "Szenarien", nav_compare: "Vergleich", nav_teams: "Teams",
    share: "Teilen", save: "Speichern", loading: "Laden…", retry: "Erneut versuchen",
    season: "Saison", career: "Karriere", vs: "vs", leader: "Führender",
    showAll: "Alle anzeigen", showLess: "Weniger anzeigen", pts: "Pkt",
    home_tagline: "Berechne die Punkte, die zum Gewinn der F1-Weltmeisterschaft nötig sind",
    home_standings: "Fahrerwertung", home_scenario: "Aktuelles Szenario", home_edit: "Bearbeiten",
    home_needed: "Punkte zum Titelgewinn", home_nextGps: "Nächste GP",
    home_canWin: "kann den Titel gewinnen mit", home_racesRemaining: "VERBLEIBENDE\nRENNEN",
    home_maxAvailable: "MAX. PUNKTE\nVERFÜGBAR", home_maxNext: "MAX.\nNÄCHSTER GP",
    home_neededHint: "Wie viele Punkte der Führende noch braucht, um den Titel sicher zu machen, basierend auf dem Maximum, das der Verfolger in den verbleibenden Rennen holen kann.",
    sc_selectDriver: "Fahrer auswählen", sc_gpRemaining: "Verbleibende GP",
    sc_untilEnd: "Bis Saisonende", sc_withSprint: "mit Sprint",
    sc_objective: "Ziel", sc_mainRival: "Hauptrivale zu schlagen", sc_gap: "Rückstand",
    sc_driversToBeat: "Zu überholende Fahrer", sc_toBeat: "zu schlagen",
    sc_tapDriver: "👆 Tippe einen Fahrer an, um das Strategie-Mosaik zu sehen",
    sc_chooseDriver: "Wähle einen Fahrer zum Überholen",
    sc_chooseHint: "Tippe oben einen Fahrer an, um das Strategie-Mosaik zu sehen",
    sc_mosaic: "Strategie-Mosaik", sc_champion: "Weltmeister! 🏆", sc_out: "Rechnerisch raus ❌",
    cmp_pilot1: "Fahrer 1", cmp_pilot2: "Fahrer 2", cmp_selectDriver: "Fahrer auswählen…",
    cmp_headToHead: "Direktvergleich", cmp_ahead: "vorn", cmp_balanced: "Ausgeglichen",
    cmp_selectTwo: "Wähle zwei Fahrer", cmp_random: "Zufallsauswahl",
    cmp_seasonStats: "Statistik der laufenden Saison", cmp_careerStats: "Karrierestatistik (alle Saisons)",
    tm_team: "Team", tm_title: "Konstrukteurstitel", tm_standings: "Konstrukteurswertung",
    tm_compare: "Teams vergleichen", tm_history: "Titel & Geschichte", tm_chooseOpponent: "Gegner wählen…",
    tm_gpLeft: "GP übrig", tm_pointsAtStake: "Punkte zu vergeben", tm_fromLeader: "vom Führenden",
    st_points: "Punkte", st_wins: "Siege", st_podiums: "Podien", st_poles: "Pole-Positions",
    st_fastestLaps: "Schnellste Runden", st_pointsFinishes: "Punkteplatzierungen", st_dotd: "Fahrer des Tages",
    st_positionsGained: "Gewonnene Plätze", st_bestFinish: "Bestes Ergebnis", st_avgFinish: "Durchschnitt",
    st_dnf: "Ausfälle (DNF)", st_titles: "WM-Titel", st_constructorTitles: "Konstrukteurstitel",
    st_careerPoints: "Karrierepunkte", st_totalPoints: "Gesamtpunkte", st_racesEntered: "Rennen bestritten", st_gpEntered: "GP bestritten",
    theme_light: "Helles Thema", theme_dark: "Dunkles Thema", language: "Sprache",
  },
};

function getInitialLang() {
  if (typeof window === "undefined") return "it";
  try {
    const saved = localStorage.getItem("lang");
    if (saved && LANGS.some(l => l.code === saved)) return saved;
    const b = (navigator.language || "it").slice(0, 2).toLowerCase();
    return LANGS.some(l => l.code === b) ? b : "it";
  } catch {
    return "it";
  }
}

const I18nContext = createContext({ lang: "it", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang);
  useEffect(() => {
    try { localStorage.setItem("lang", lang); } catch { /* ignore */ }
    document.documentElement.lang = lang;
  }, [lang]);
  const t = (key) => (DICT[lang] && DICT[lang][key]) || DICT.it[key] || key;
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
