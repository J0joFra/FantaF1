import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Search, Share2, Dumbbell, ArrowUp, ArrowDown, Bell, BellRing, Filter } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { flagUrl } from "@/lib/flagUtils";
import { buildGameCard, shareCanvas } from "@/lib/shareImage";
import {
  DRIVERS, MAX_GUESSES, STATE_KEY, STATS_KEY, EMPTY_STATS,
  dayNumber, driverOfDay, readJSON, writeJSON, liveStreak, readMode, writeMode,
} from "@/lib/driverGame";
import {
  dailyReminderSupported, isDailyReminderOn, toggleDailyReminder, syncDailyReminder,
} from "@/lib/dailyReminder";

/* ─── PILOTA DEL GIORNO ───────────────────────────────────────────────────────
   Un pilota misterioso al giorno, lo stesso per tutti, sei tentativi. Ogni
   tentativo dice, per cinque indizi, se il misterioso è uguale, vicino, più
   in alto o più in basso. Regole e salvataggi stanno in lib/driverGame.

   Due modalità:
   - hardcore (default): la ricerca suggerisce solo per nome;
   - facilitato: toccando la ricerca compaiono solo i piloti compatibili con
     gli indizi già indovinati (verdi). Indovinata la nazionalità, si vedono
     solo i piloti di quel paese.
   La modalità si sceglie prima del primo tentativo del giorno e poi resta
   quella: cambiarla a metà vorrebbe dire giocare in hardcore e chiedere
   l'aiuto all'ultimo. */

const GREEN = "#16a34a";
const YELLOW = "#f59e0b";
const GREY = "#3f3f46";

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Confronto di un indizio numerico: «vicino» se entro `near`.
function numeric(guess, target, near) {
  if (guess === target) return { color: GREEN };
  return {
    color: Math.abs(guess - target) <= near ? YELLOW : GREY,
    dir: target > guess ? "up" : "down",
  };
}

// Ogni indizio porta con sé il campo del pilota a cui si riferisce: serve al
// filtro della modalità facilitata.
function compare(g, target) {
  return [
    { key: "nat", field: "iso", color: g.iso === target.iso ? GREEN : GREY },
    { key: "debut", field: "debut", value: g.debut, ...numeric(g.debut, target.debut, 4) },
    { key: "wins", field: "wins", value: g.wins, ...numeric(g.wins, target.wins, 5) },
    { key: "titles", field: "titles", value: g.titles, ...numeric(g.titles, target.titles, 1) },
    { key: "team", field: "team", value: g.team, color: g.team === target.team ? GREEN : GREY },
  ];
}

// Gli indizi già indovinati: { iso: "it", team: "Ferrari", … }
function knownClues(guessed, target) {
  const known = {};
  for (const d of guessed) {
    for (const c of compare(d, target)) {
      if (c.color === GREEN) known[c.field] = d[c.field];
    }
  }
  return known;
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

function ModeSwitch({ mode, onChange, locked, t }) {
  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100 border border-border">
        {[["hardcore", "💀", "guess_modeHardcore"], ["easy", "🤝", "guess_modeEasy"]].map(([m, icon, label]) => (
          <button key={m} disabled={locked && mode !== m} onClick={() => onChange(m)}
            className={`rounded-lg py-1.5 text-xs font-body font-semibold transition-colors
              ${mode === m ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}
              ${locked && mode !== m ? "opacity-40" : ""}`}>
            {icon} {t(label)}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground font-body leading-snug mt-1.5">
        {t(mode === "easy" ? "guess_modeEasyDesc" : "guess_modeHardcoreDesc")}
        {locked && ` ${t("guess_modeLocked")}`}
      </p>
    </div>
  );
}

export default function DriverGuess() {
  const { t, lang } = useI18n();
  const today = dayNumber();
  // Allenamento: un pilota a caso, non conta per le statistiche.
  const [practice, setPractice] = useState(null);
  const target = practice ?? driverOfDay(today);

  const saved = readJSON(STATE_KEY, null);
  const savedToday = saved && saved.day === today ? saved : null;
  const [guesses, setGuesses] = useState(() => savedToday?.guesses ?? []);
  const [mode, setMode] = useState(() => savedToday?.mode ?? readMode());
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const [stats, setStats] = useState(() => readJSON(STATS_KEY, EMPTY_STATS));
  const [reminderOn, setReminderOn] = useState(isDailyReminderOn);

  const guessed = guesses.map((id) => DRIVERS.find((d) => d.id === id)).filter(Boolean);
  const won = guessed.some((d) => d.id === target.id);
  const done = won || guessed.length >= MAX_GUESSES;
  const locked = !practice && guesses.length > 0;
  const easy = mode === "easy";
  const streak = liveStreak(stats, today);

  // Salva solo la partita del giorno; l'allenamento resta in memoria.
  useEffect(() => {
    if (practice) return;
    writeJSON(STATE_KEY, { day: today, guesses, done, mode });
  }, [guesses, done, mode, practice, today]);

  // Partita del giorno finita (e già salvata dall'effetto sopra): il
  // promemoria di oggi non serve più.
  useEffect(() => {
    if (!practice && done) syncDailyReminder(t);
  }, [done, practice]);

  const known = useMemo(() => (easy ? knownClues(guessed, target) : {}), [easy, guessed, target]);
  const knownEntries = Object.entries(known);

  const suggestions = useMemo(() => {
    const q = norm(query.trim());
    // Hardcore: solo ricerca per nome, da due lettere in su.
    if (!easy) {
      if (q.length < 2) return [];
      return DRIVERS.filter((d) => !guesses.includes(d.id) && norm(d.name).includes(q)).slice(0, 6);
    }
    // Facilitato: appena si tocca la ricerca, i piloti compatibili con gli indizi verdi.
    if (!focused && !q) return [];
    return DRIVERS.filter((d) =>
      !guesses.includes(d.id)
      && knownEntries.every(([field, value]) => d[field] === value)
      && (!q || norm(d.name).includes(q)));
  }, [query, guesses, easy, focused, knownEntries]);

  const changeMode = (m) => {
    if (locked) return;
    setMode(m);
    writeMode(m);
  };

  const pick = (d) => {
    const next = [...guesses, d.id];
    setGuesses(next);
    setQuery("");
    // Toglie il fuoco (e la tastiera): il prossimo tocco sulla ricerca la
    // riapre con la lista aggiornata ai nuovi indizi.
    inputRef.current?.blur();
    const isWin = d.id === target.id;
    if (practice || !(isWin || next.length >= MAX_GUESSES)) return;
    // Fine della partita del giorno: aggiorna le statistiche una volta sola.
    if (stats.lastDay === today) return;
    const nextStreak = isWin ? liveStreak(stats, today) + 1 : 0;
    const s = {
      played: stats.played + 1,
      won: stats.won + (isWin ? 1 : 0),
      streak: nextStreak,
      maxStreak: Math.max(stats.maxStreak, nextStreak),
      lastDay: today,
    };
    setStats(s);
    writeJSON(STATS_KEY, s);
  };

  const toggleReminder = async () => {
    const r = await toggleDailyReminder(t);
    if (r === "on") { setReminderOn(true); toast.success(t("guess_reminderOn")); }
    else if (r === "off") { setReminderOn(false); toast(t("guess_reminderOff")); }
    else if (r === "denied") toast.error(t("guess_reminderDenied"));
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
    const s = readJSON(STATE_KEY, null);
    const st = s && s.day === today ? s : null;
    setGuesses(st?.guesses ?? []);
    setMode(st?.mode ?? readMode());
  };

  const share = () => {
    const grid = guessed.map((d) => compare(d, target).map((c) => c.color));
    const emoji = grid
      .map((row) => row.map((c) => (c === GREEN ? "🟩" : c === YELLOW ? "🟨" : "⬛")).join(""))
      .join("\n");
    const score = won ? `${guessed.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    const modeTxt = easy ? ` · ${t("guess_modeEasy")}` : " · 💀";
    const card = buildGameCard({
      heading: `${t("guess_title")} #${today}${modeTxt}`,
      big: score,
      bigColor: won ? "#22c55e" : "#ffffff",
      sub: streak > 1 ? `🔥 ${t("guess_streak")}: ${streak}` : "",
      grid,
    });
    shareCanvas(card, {
      fileName: `gridup-pilota-${today}.png`,
      title: "GridUP",
      text: `🏎️ ${t("guess_title")} #${today}${modeTxt} ${score}\n${emoji}`,
    });
  };

  const canRemind = dailyReminderSupported();

  return (
    <div className="space-y-4">
      <div className="app-card p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h2 className="font-heading font-black text-base uppercase tracking-wide">
            {practice ? t("guess_practice") : `${t("guess_title")} #${today}`}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-body text-muted-foreground">{guessed.length}/{MAX_GUESSES}</span>
            {canRemind && (
              <button onClick={toggleReminder} title={t("guess_reminder")}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center active:scale-95 transition-transform
                  ${reminderOn ? "bg-primary text-white border-primary" : "bg-gray-50 border-border text-muted-foreground"}`}>
                {reminderOn ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-body leading-snug">{t("guess_how")}</p>

        <ModeSwitch mode={mode} onChange={changeMode} locked={locked} t={t} />

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
            {easy && knownEntries.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2 text-[11px] font-body text-muted-foreground">
                <Filter className="w-3 h-3" />
                {knownEntries.map(([field, value]) => (
                  <span key={field} className="rounded-full bg-green-100 text-green-800 px-2 py-0.5 font-semibold">
                    {field === "iso" ? countryName(value, lang) : `${t(COLS[["iso", "debut", "wins", "titles", "team"].indexOf(field)])}: ${value}`}
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                ref={inputRef}
                onFocus={() => setFocused(true)}
                onClick={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={t("guess_placeholder")}
                className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2.5 text-sm font-body
                           focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            {suggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 app-card overflow-y-auto max-h-64 border border-border">
                {easy && (
                  <p className="px-3 py-1.5 text-[10px] font-body uppercase tracking-wide text-muted-foreground border-b border-border">
                    {t("guess_compatible", { n: suggestions.length })}
                  </p>
                )}
                {suggestions.map((d) => (
                  <button key={d.id}
                    // mousedown prima del blur: senza, la lista sparisce prima del tocco
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(d)}
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
          {!practice && canRemind && !reminderOn && (
            <button onClick={toggleReminder}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white text-gray-900 px-4 py-2 text-sm font-body font-semibold active:scale-95 transition-transform">
              <Bell className="w-4 h-4" /> {t("guess_remindMe")}
            </button>
          )}
        </div>
      )}

      {!practice && (
        <div className="app-card px-4 py-3 grid grid-cols-4 text-center">
          {[
            [stats.played, t("guess_played")],
            [stats.played ? `${Math.round((stats.won / stats.played) * 100)}%` : "—", t("guess_winRate")],
            [streak, t("guess_streak")],
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
