import { useEffect, useRef, useState } from "react";
import { Share2, RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { buildGameCard, shareCanvas } from "@/lib/shareImage";

/* ─── SEMAFORO ────────────────────────────────────────────────────────────────
   La partenza di un GP: i cinque rossi si accendono uno al secondo, poi
   restano accesi per un tempo che nessuno può prevedere e si spengono tutti
   insieme. Si tocca lo schermo appena si spengono.

   Il tempo si misura da quando i rossi si spengono *sullo schermo*: il
   cambio di stato parte dentro un requestAnimationFrame, così il cronometro
   non comincia prima che il frame con le luci spente sia davvero disegnato. */

const LIGHT_MS = 1000;
const HOLD_MIN_MS = 200;
const HOLD_MAX_MS = 3000;
const BEST_KEY = "gridup_lights_best";
// Sotto questa soglia non è una reazione ma un tocco anticipato a caso.
const MIN_HUMAN_MS = 100;

// Un pilota di F1 sta intorno ai 200 ms.
function rating(ms) {
  if (ms < 200) return "lights_rateF1";
  if (ms < 250) return "lights_rateGreat";
  if (ms < 320) return "lights_rateGood";
  return "lights_rateSlow";
}

function readBest() {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

export default function StartLights() {
  const { t } = useI18n();
  // idle → lighting → armed → go → result | jump
  const [phase, setPhase] = useState("idle");
  const [lit, setLit] = useState(0);
  const [ms, setMs] = useState(null);
  const [best, setBest] = useState(readBest);
  const [isNewBest, setIsNewBest] = useState(false);
  const timers = useRef([]);
  const goAt = useRef(0);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const start = () => {
    clearTimers();
    setMs(null);
    setIsNewBest(false);
    setLit(0);
    setPhase("lighting");
    for (let i = 1; i <= 5; i++) {
      timers.current.push(setTimeout(() => {
        setLit(i);
        if (i === 5) setPhase("armed");
      }, i * LIGHT_MS));
    }
    const hold = HOLD_MIN_MS + Math.random() * (HOLD_MAX_MS - HOLD_MIN_MS);
    timers.current.push(setTimeout(() => {
      requestAnimationFrame(() => {
        goAt.current = performance.now();
        setLit(0);
        setPhase("go");
      });
    }, 5 * LIGHT_MS + hold));
  };

  const tap = () => {
    if (phase === "idle" || phase === "result" || phase === "jump") {
      start();
      return;
    }
    if (phase === "lighting" || phase === "armed") {
      clearTimers();
      setPhase("jump");
      return;
    }
    // phase === "go"
    const reaction = Math.round(performance.now() - goAt.current);
    if (reaction < MIN_HUMAN_MS) {
      setPhase("jump");
      return;
    }
    setMs(reaction);
    setPhase("result");
    if (!best || reaction < best) {
      setBest(reaction);
      setIsNewBest(true);
      try { localStorage.setItem(BEST_KEY, String(reaction)); } catch { /* ignore */ }
    }
  };

  const share = (e) => {
    e.stopPropagation();
    const card = buildGameCard({
      heading: t("lights_title"),
      big: `${ms} ms`,
      bigColor: ms < 250 ? "#22c55e" : "#ffffff",
      sub: `${t(rating(ms))}${best ? ` · ${t("lights_best")} ${best} ms` : ""}`,
    });
    shareCanvas(card, {
      fileName: `gridup-semaforo-${ms}ms.png`,
      title: "GridUP",
      text: `🚦 ${t("lights_title")}: ${ms} ms — ${t("lights_shareText")}`,
    });
  };

  const message = {
    idle: t("lights_tapToStart"),
    lighting: t("lights_wait"),
    armed: t("lights_wait"),
    go: t("lights_go"),
    jump: t("lights_jump"),
    result: null,
  }[phase];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onPointerDown={tap}
        className="dark-card w-full p-5 select-none touch-manipulation text-center"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {/* i cinque semafori: due file di luci per colonna, come quelli veri */}
        <div className="flex justify-center gap-2.5 mb-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="bg-black/80 rounded-xl p-1.5 flex flex-col gap-1.5 border border-white/10">
              {[0, 1].map((row) => (
                <span
                  key={row}
                  className="block w-9 h-9 rounded-full transition-colors duration-75"
                  style={{
                    background: lit >= n ? "#ff1a1a" : "#2a2a33",
                    boxShadow: lit >= n ? "0 0 18px 4px rgba(255,26,26,0.6)" : "none",
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="h-24 flex flex-col items-center justify-center">
          {phase === "result" ? (
            <>
              <p className="font-heading font-black text-5xl leading-none">
                {ms}<span className="text-2xl ml-1">ms</span>
              </p>
              <p className="text-sm font-body font-semibold mt-2 opacity-90">
                {isNewBest ? `🏆 ${t("lights_newBest")}` : t(rating(ms))}
              </p>
            </>
          ) : (
            <p className={`font-heading font-black uppercase tracking-wide
              ${phase === "jump" ? "text-2xl text-amber-400" : "text-xl"}`}>
              {message}
            </p>
          )}
        </div>
        {(phase === "result" || phase === "jump") && (
          <p className="text-xs font-body opacity-60 mt-2 flex items-center justify-center gap-1">
            <RotateCcw className="w-3 h-3" /> {t("lights_again")}
          </p>
        )}
      </button>

      <div className="app-card px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground font-body uppercase tracking-widest">{t("lights_best")}</p>
          <p className="font-heading font-black text-2xl leading-none mt-1">{best ? `${best} ms` : "—"}</p>
        </div>
        {phase === "result" && (
          <button
            onClick={share}
            className="flex items-center gap-1.5 rounded-full bg-primary text-white px-4 py-2 text-sm font-body font-semibold active:scale-95 transition-transform"
          >
            <Share2 className="w-4 h-4" /> {t("share")}
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground font-body leading-snug px-1">{t("lights_how")}</p>
    </div>
  );
}
