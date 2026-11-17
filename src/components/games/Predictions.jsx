import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Check, Clock, Lock } from "lucide-react";
import { getPredictionContext, getPodiums } from "@/lib/supabaseData";
import {
  getPrediction, savePrediction, allPredictions, scorePodium, MAX_POINTS_PER_RACE,
} from "@/lib/predictions";
import { getDriverColor } from "@/lib/f1Utils";
import { raceFlagUrl } from "@/lib/flagUtils";
import { hapticSelect, hapticSuccess } from "@/lib/native";
import { useI18n } from "@/lib/i18n";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Predictions() {
  const { t, lang } = useI18n();
  const localeTag = { it: "it-IT", en: "en-GB", fr: "fr-FR", es: "es-ES", de: "de-DE" }[lang] || "it-IT";

  const { data: ctx, isLoading } = useQuery({
    queryKey: ["predictionContext"],
    queryFn: getPredictionContext,
    staleTime: 10 * 60 * 1000,
  });
  const race = ctx?.race || null;
  const drivers = ctx?.drivers || [];
  const driverById = useMemo(() => Object.fromEntries(drivers.map(d => [d.id, d])), [drivers]);

  // Stored predictions (re-read after each save via the bump counter).
  const [bump, setBump] = useState(0);
  const history = useMemo(() => allPredictions(), [bump]);
  const storedIds = useMemo(() => history.map(h => h.raceId), [history]);

  const { data: podiums = {} } = useQuery({
    queryKey: ["predictionPodiums", storedIds],
    queryFn: () => getPodiums(storedIds),
    enabled: storedIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  // Current pick for the next race — seed from an existing prediction.
  const existing = race ? getPrediction(race.id) : null;
  const [pick, setPick] = useState(() => existing
    ? [existing.p1, existing.p2, existing.p3]
    : [null, null, null]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [justSaved, setJustSaved] = useState(false);

  const firstEmpty = () => { const i = pick.findIndex(x => !x); return i === -1 ? 0 : i; };

  const chooseDriver = (id) => {
    if (pick.includes(id)) return; // already on the podium
    const slot = pick[activeSlot] ? firstEmpty() : activeSlot;
    const next = [...pick]; next[slot] = id;
    setPick(next);
    setActiveSlot(next.findIndex(x => !x) === -1 ? slot : next.findIndex(x => !x));
    setJustSaved(false);
    hapticSelect();
  };

  const clearSlot = (i) => {
    const next = [...pick]; next[i] = null;
    setPick(next); setActiveSlot(i); setJustSaved(false);
  };

  const complete = pick.every(Boolean);
  const changed = !existing || existing.p1 !== pick[0] || existing.p2 !== pick[1] || existing.p3 !== pick[2];

  const save = () => {
    if (!race || !complete) return;
    savePrediction(race.id, {
      p1: pick[0], p2: pick[1], p3: pick[2],
      raceName: race.name, raceDate: race.date, country_id: race.country_id,
    });
    setBump(b => b + 1);
    setJustSaved(true);
    hapticSuccess();
  };

  // Personal total across scored predictions.
  const total = useMemo(() => history.reduce((sum, h) => {
    const s = scorePodium(h, podiums[h.raceId]);
    return sum + (s ? s.points : 0);
  }, 0), [history, podiums]);

  const nameOf = (id) => driverById[id]?.name || id || "—";
  const codeOf = (id) => driverById[id]?.code || "";
  const colorOf = (id) => getDriverColor(codeOf(id), nameOf(id), driverById[id]?.team || "");

  if (isLoading) {
    return <div className="app-card p-6 text-center text-sm text-muted-foreground font-body">{t("predict_loading")}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Personal score */}
      <div className="app-card px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground font-body uppercase tracking-widest">{t("predict_yourPoints")}</p>
          <p className="font-heading font-black text-2xl leading-none mt-1">{total} <span className="text-sm text-muted-foreground">{t("pts")}</span></p>
        </div>
        <Trophy className="w-8 h-8 text-primary/30" />
      </div>

      {/* Next race prediction */}
      {race ? (
        <div className="app-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            {raceFlagUrl(race, "h40") && (
              <img src={raceFlagUrl(race, "h40")} alt="" className="w-7 h-[18px] object-cover rounded-sm ring-1 ring-black/5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-heading font-black text-sm uppercase tracking-wide truncate">{race.name}</p>
              <p className="text-[11px] text-muted-foreground font-body">
                {t("predict_predictPodium")}
                {race.date && ` · ${new Date(race.date).toLocaleDateString(localeTag, { day: "numeric", month: "short" })}`}
              </p>
            </div>
          </div>

          {/* Podium slots */}
          <div className="px-3 pt-3 space-y-2">
            {[0, 1, 2].map(i => {
              const id = pick[i];
              const active = activeSlot === i;
              return (
                <button
                  key={i}
                  onClick={() => (id ? clearSlot(i) : setActiveSlot(i))}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors
                    ${active ? "border-primary bg-primary/5" : "border-gray-200 bg-gray-50"}`}
                >
                  <span className="text-xl shrink-0">{MEDALS[i]}</span>
                  {id ? (
                    <>
                      <span className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: colorOf(id) }} />
                      <span className="font-heading font-bold text-sm text-foreground truncate flex-1">{nameOf(id)}</span>
                      <span className="text-[11px] text-muted-foreground font-body shrink-0">{t("predict_tapToChange")}</span>
                    </>
                  ) : (
                    <span className={`text-sm font-body flex-1 ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                      {t("predict_chooseP", { n: i + 1 })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Driver grid */}
          <div className="px-3 py-3">
            <div className="grid grid-cols-2 gap-1.5">
              {drivers.map(d => {
                const picked = pick.includes(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => chooseDriver(d.id)}
                    disabled={picked}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors
                      ${picked ? "border-gray-100 bg-gray-100 opacity-40" : "border-gray-200 bg-white active:bg-gray-50"}`}
                  >
                    <span className="w-1 h-5 rounded-full shrink-0" style={{ backgroundColor: colorOf(d.id) }} />
                    <span className="font-heading font-bold text-[11px] text-muted-foreground shrink-0">{d.code}</span>
                    <span className="font-body text-xs text-foreground truncate">{d.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save */}
          <div className="px-3 pb-3">
            <button
              onClick={save}
              disabled={!complete || (!changed && !!existing)}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-body font-semibold text-sm transition-colors
                ${complete && (changed || !existing)
                  ? "bg-primary text-white active:scale-[0.98]"
                  : "bg-gray-100 text-muted-foreground"}`}
            >
              {justSaved
                ? <><Check className="w-4 h-4" /> {t("predict_saved")}</>
                : existing
                  ? <>{t("predict_update")}</>
                  : <>{t("predict_save")}</>}
            </button>
            <p className="text-[10px] text-muted-foreground font-body text-center mt-2 flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" /> {t("predict_lockHint")}
            </p>
          </div>
        </div>
      ) : (
        <div className="app-card p-6 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-body">{t("predict_noRace")}</p>
        </div>
      )}

      {/* How scoring works */}
      <p className="text-[11px] text-muted-foreground font-body leading-snug px-1">
        {t("predict_rules", { max: MAX_POINTS_PER_RACE })}
      </p>

      {/* History */}
      {history.filter(h => !race || h.raceId !== String(race.id)).length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground font-body uppercase tracking-widest px-1">{t("predict_history")}</p>
          {history
            .filter(h => !race || h.raceId !== String(race.id))
            .map(h => {
              const actual = podiums[h.raceId];
              const score = scorePodium(h, actual);
              return (
                <div key={h.raceId} className="app-card px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    {raceFlagUrl(h, "h40") && (
                      <img src={raceFlagUrl(h, "h40")} alt="" className="w-6 h-4 object-cover rounded-sm ring-1 ring-black/5 shrink-0" />
                    )}
                    <span className="font-heading font-bold text-xs uppercase tracking-wide truncate flex-1">{h.raceName}</span>
                    {score ? (
                      <span className={`tag shrink-0 ${score.perfect ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}`}>
                        {score.perfect ? "🏆 " : ""}{score.points} {t("pts")}
                      </span>
                    ) : (
                      <span className="tag bg-amber-100 text-amber-700 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t("predict_waiting")}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[0, 1, 2].map(i => {
                      const predId = [h.p1, h.p2, h.p3][i];
                      const kind = score?.detail?.[i]?.kind;
                      const bg = kind === "exact" ? "bg-emerald-50 border-emerald-200"
                        : kind === "podium" ? "bg-amber-50 border-amber-200"
                        : score ? "bg-gray-50 border-gray-200 opacity-60"
                        : "bg-gray-50 border-gray-200";
                      return (
                        <div key={i} className={`rounded-lg border px-2 py-1.5 ${bg}`}>
                          <span className="text-[10px]">{MEDALS[i]}</span>
                          <span className="block font-heading font-bold text-[11px] truncate">{codeOf(predId) || nameOf(predId)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
