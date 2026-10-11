import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Share2, Dumbbell, ArrowUp, ArrowDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { flagUrl } from "@/lib/flagUtils";
import { buildGameCard, shareCanvas } from "@/lib/shareImage";
import DRIVERS from "@/data/driverGame.json";

/* ─── PILOTA DEL GIORNO ───────────────────────────────────────────────────────
   Un pilota misterioso al giorno, lo stesso per tutti, sei tentativi. Ogni
   tentativo dice, per cinque indizi, se il misterioso è uguale, vicino, più
   in alto o più in basso. I dati vengono da scripts/build-driver-game.mjs.

   Il pilota del giorno dipende solo dalla data locale: niente server, e chi
   gioca alla stessa data trova lo stesso pilota (a patto di avere la stessa
   versione dei dati). */

export const MAX_GUESSES = 6;
const STATE_KEY = "gridup_guess_today";
const STATS_KEY = "gridup_guess_stats";
// Numero 1 del gioco.
const EPOCH = Date.UTC(2026, 9, 11);
// Coprimo con la dimensione del pool: in N giorni passano tutti, senza ripetere.
const STEP = 37;

const GREEN = "#16a34a";
const YELLOW = "#f59e0b";
const GREY = "#3f3f46";

export function dayNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / 86400000) + 1;
}

function stepFor(n) {
  let s = STEP;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  while (gcd(s, n) !== 1) s++;
  return s;
}

function driverOfDay(day) {
  const n = DRIVERS.length;
  const i = (((day * stepFor(n) + 11) % n) + n) % n;
  return DRIVERS[i];
}

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

/** Ha già giocato la partita di oggi? Serve alla card in Panoramica. */
export function playedToday() {
  const s = read(STATE_KEY, null);
  return !!s && s.day === dayNumber() && s.done;
}

// Confronto di un indizio numerico: «vicino» se entro `near`.
function numeric(guess, target, near) {
  if (guess === target) return { color: GREEN };
  return {
    color: Math.abs(guess - target) <= near ? YELLOW : GREY,
    dir: target > guess ? "up" : "down",
  };
}

function compare(g, target) {
  return [
    { key: "nat", color: g.iso === target.iso ? GREEN : GREY },
    { key: "debut", value: g.debut, ...numeric(g.debut, target.debut, 4) },
    { key: "wins", value: g.wins, ...numeric(g.wins, target.wins, 5) },
    { key: "titles", value: g.titles, ...numeric(g.titles, target.titles, 1) },
    { key: "team", value: g.team, color: g.team === target.team ? GREEN : GREY },
  ];
}

const COLS = ["guess_colNat", "guess_colDebut", "guess_colWins", "guess_colTitles", "guess_colTeam"];

function countryName(iso, lang) {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(iso.toUpperCase());
  } catch {
    return iso.toUpperCase();
  }
}

function GuessRow({ driver, target, lang }) {
  const cells = compare(driver, target);
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
      <p className="text-xs font-heading font-bold truncate">{driver.name}</p>
      <div className="grid grid-cols-5 gap-1">
        {cells.map((c) => (
          <div key={c.key}
            className="h-12 rounded-lg flex flex-col items-center justify-center text-white px-0.5"
            style={{ background: c.color }}>
            {c.key === "nat" ? (
              <img src={flagUrl(driver.iso, "h20")} alt={countryName(driver.iso, lang)}
                   title={countryName(driver.iso, lang)} className="h-4 w-auto rounded-sm" />
            ) : (
              <span className={`font-heading font-black leading-tight text-center
                ${c.key === "team" ? "text-[9px] line-clamp-2" : "text-sm"}`}>
                {c.value}
              </span>
            )}
            {c.dir === "up" && <ArrowUp className="w-3 h-3" />}
            {c.dir === "down" && <ArrowDown className="w-3 h-3" />}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function DriverGuess() {
  const { t, lang } = useI18n();
  const today = dayNumber();
  // Allenamento: un pilota a caso, non conta per le statistiche.
  const [practice, setPractice] = useState(null);
  const target = practice ?? driverOfDay(today);

  const [guesses, setGuesses] = useState(() => {
    const s = read(STATE_KEY, null);
    return s && s.day === today ? s.guesses : [];
  });
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState(() => read(STATS_KEY, { played: 0, won: 0, streak: 0, maxStreak: 0, lastDay: null }));

  const guessed = guesses.map((id) => DRIVERS.find((d) => d.id === id)).filter(Boolean);
  const won = guessed.some((d) => d.id === target.id);
  const done = won || guessed.length >= MAX_GUESSES;

  // Salva solo la partita del giorno; l'allenamento resta in memoria.
  useEffect(() => {
    if (practice) return;
    write(STATE_KEY, { day: today, guesses, done });
  }, [guesses, done, practice, today]);

  const suggestions = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    return DRIVERS.filter((d) => !guesses.includes(d.id) && norm(d.name).includes(q)).slice(0, 6);
  }, [query, guesses]);

  const pick = (d) => {
    const next = [...guesses, d.id];
    setGuesses(next);
    setQuery("");
    const isWin = d.id === target.id;
    if (practice || !(isWin || next.length >= MAX_GUESSES)) return;
    // Fine della partita del giorno: aggiorna le statistiche una volta sola.
    if (stats.lastDay === today) return;
    const streak = isWin ? (stats.lastDay === today - 1 && stats.streak > 0 ? stats.streak + 1 : 1) : 0;
    const s = {
      played: stats.played + 1,
      won: stats.won + (isWin ? 1 : 0),
      streak,
      maxStreak: Math.max(stats.maxStreak, streak),
      lastDay: today,
    };
    setStats(s);
    write(STATS_KEY, s);
  };

  const startPractice = () => {
    let d;
    do d = DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
    while (d.id === target.id);
    setPractice(d);
    setGuesses([]);
    setQuery("");
  };

  const backToDaily = () => {
    setPractice(null);
    const s = read(STATE_KEY, null);
    setGuesses(s && s.day === today ? s.guesses : []);
  };

  const share = () => {
    const grid = guessed.map((d) => compare(d, target).map((c) => c.color));
    const emoji = grid
      .map((row) => row.map((c) => (c === GREEN ? "🟩" : c === YELLOW ? "🟨" : "⬛")).join(""))
      .join("\n");
    const score = won ? `${guessed.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    const card = buildGameCard({
      heading: `${t("guess_title")} #${today}`,
      big: score,
      bigColor: won ? "#22c55e" : "#ffffff",
      sub: stats.streak > 1 ? `🔥 ${t("guess_streak")}: ${stats.streak}` : "",
      grid,
    });
    shareCanvas(card, {
      fileName: `gridup-pilota-${today}.png`,
      title: "GridUP",
      text: `🏎️ ${t("guess_title")} #${today} ${score}\n${emoji}`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="app-card p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading font-black text-base uppercase tracking-wide">
            {practice ? t("guess_practice") : `${t("guess_title")} #${today}`}
          </h2>
          <span className="text-xs font-body text-muted-foreground">
            {guessed.length}/{MAX_GUESSES}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-body leading-snug">{t("guess_how")}</p>

        {/* intestazioni delle colonne */}
        <div className="grid grid-cols-5 gap-1 mt-3">
          {COLS.map((k) => (
            <span key={k} className="text-[9px] text-center font-body uppercase tracking-wide text-muted-foreground">
              {t(k)}
            </span>
          ))}
        </div>

        <div className="space-y-2 mt-1">
          {guessed.map((d) => <GuessRow key={d.id} driver={d} target={target} lang={lang} />)}
        </div>

        {!done && (
          <div className="relative mt-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("guess_placeholder")}
              className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2.5 text-sm font-body
                         focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 app-card overflow-hidden border border-border">
                {suggestions.map((d) => (
                  <button key={d.id} onClick={() => pick(d)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-body hover:bg-gray-50 border-b border-border last:border-0">
                    <img src={flagUrl(d.iso, "h20")} alt="" className="h-3.5 w-auto rounded-sm" />
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {done && (
        <div className="dark-card p-4 text-center">
          <p className="text-xs uppercase tracking-widest font-body opacity-70">
            {won ? t("guess_won") : t("guess_lost")}
          </p>
          <p className="font-heading font-black text-2xl mt-1">
            <img src={flagUrl(target.iso, "h20")} alt="" className="inline h-5 w-auto rounded-sm mr-2 align-[-2px]" />
            {target.name}
          </p>
          <p className="text-xs font-body opacity-70 mt-1">
            {target.team} · {target.debut} · {target.wins} {t("guess_colWins").toLowerCase()} · {target.titles} {t("guess_colTitles").toLowerCase()}
          </p>
          <div className="flex justify-center gap-2 mt-4 flex-wrap">
            {!practice && (
              <button onClick={share}
                className="flex items-center gap-1.5 rounded-full bg-primary text-white px-4 py-2 text-sm font-body font-semibold active:scale-95 transition-transform">
                <Share2 className="w-4 h-4" /> {t("share")}
              </button>
            )}
            <button onClick={startPractice}
              className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-body font-semibold active:scale-95 transition-transform">
              <Dumbbell className="w-4 h-4" /> {t("guess_practiceBtn")}
            </button>
            {practice && (
              <button onClick={backToDaily}
                className="rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-body font-semibold active:scale-95 transition-transform">
                {t("guess_backDaily")}
              </button>
            )}
          </div>
          {!practice && <p className="text-[11px] font-body opacity-60 mt-3">{t("guess_comeBack")}</p>}
        </div>
      )}

      {!practice && (
        <div className="app-card px-4 py-3 grid grid-cols-4 text-center">
          {[
            [stats.played, t("guess_played")],
            [stats.played ? `${Math.round((stats.won / stats.played) * 100)}%` : "—", t("guess_winRate")],
            [stats.streak, t("guess_streak")],
            [stats.maxStreak, t("guess_maxStreak")],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="font-heading font-black text-xl leading-none">{v}</p>
              <p className="text-[9px] text-muted-foreground font-body uppercase tracking-wide mt-1 leading-tight">{l}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
