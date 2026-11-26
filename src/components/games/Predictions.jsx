import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Check, Clock, Lock, Wrench } from "lucide-react";
import { getPredictionContext, getRaceOutcomes, getAllSeasonRaces } from "@/lib/supabaseData";
import {
  getPrediction, savePrediction, allPredictions, scoreRace, normalizePrediction, MAX_POINTS_PER_RACE,
  reconcileWithCalendar,
} from "@/lib/predictions";
import { getDriverColor, getTeamColor } from "@/lib/f1Utils";
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
  const teams = ctx?.teams || [];
  const driverById = useMemo(() => Object.fromEntries(drivers.map(d => [d.id, d])), [drivers]);
  const teamById = useMemo(() => Object.fromEntries(teams.map(x => [x.id, x])), [teams]);

  const [bump, setBump] = useState(0);
  const history = useMemo(() => allPredictions(), [bump]);
  const storedIds = useMemo(() => history.map(h => h.raceId), [history]);

  const { data: outcomes = {} } = useQuery({
    queryKey: ["predictionOutcomes", storedIds],
    queryFn: () => getRaceOutcomes(storedIds),
    enabled: storedIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  // Current pick — seed from an existing prediction.
  const existing = race ? getPrediction(race.id) : null;
  const seed = normalizePrediction(existing);
  const [slots, setSlots] = useState(() => seed.slots);
  const [pitTeam, setPitTeam] = useState(() => seed.pitTeam);
  const [activeSlot, setActiveSlot] = useState(0);
  const [justSaved, setJustSaved] = useState(false);

  // Pronostici salvati con un id di gara che nel frattempo è cambiato (il
  // calendario 2026 è stato rinumerato): si rimettono sotto la gara con la
  // stessa data, prima di valutarli.
  const { data: seasonRaces } = useQuery({
    queryKey: ["allSeasonRaces"], queryFn: () => getAllSeasonRaces(), staleTime: 60 * 60 * 1000,
  });
  useEffect(() => {
    if (!seasonRaces?.length || !reconcileWithCalendar(seasonRaces)) return;
    setBump(b => b + 1);
    if (race) {
      const fixed = normalizePrediction(getPrediction(race.id));
      setSlots(fixed.slots);
      setPitTeam(fixed.pitTeam);
    }
  }, [seasonRaces]);

  const firstEmpty = () => { const i = slots.findIndex(x => !x); return i === -1 ? activeSlot : i; };

  const chooseDriver = (id) => {
    if (slots.includes(id)) return; // one driver, one slot
    const slot = slots[activeSlot] ? firstEmpty() : activeSlot;
    const next = [...slots]; next[slot] = id;
    setSlots(next);
    const e = next.findIndex(x => !x);
    setActiveSlot(e === -1 ? slot : e);
    setJustSaved(false);
    hapticSelect();
  };
  const clearSlot = (i) => {
    const next = [...slots]; next[i] = null;
    setSlots(next); setActiveSlot(i); setJustSaved(false);
  };
  const choosePit = (id) => {
    setPitTeam(prev => (prev === id ? null : id));
    setJustSaved(false);
    hapticSelect();
  };

  const podiumComplete = slots[0] && slots[1] && slots[2];
  const changed = !existing
    || JSON.stringify(seed.slots) !== JSON.stringify(slots)
    || seed.pitTeam !== pitTeam;

  const save = () => {
    if (!race || !podiumComplete) return;
    savePrediction(race.id, {
      slots, pitTeam,
      raceName: race.name, raceDate: race.date, country_id: race.country_id,
    });
    setBump(b => b + 1);
    setJustSaved(true);
    hapticSuccess();
  };

  const total = useMemo(() => history.reduce((sum, h) => {
    const s = scoreRace(h, outcomes[h.raceId]);
    return sum + (s ? s.points : 0);
  }, 0), [history, outcomes]);

  const nameOf = (id) => driverById[id]?.name || id || "—";
  const codeOf = (id) => driverById[id]?.code || "";
  const colorOf = (id) => getDriverColor(codeOf(id), nameOf(id), driverById[id]?.team || "");

  if (isLoading) {
    return <div className="app-card p-6 text-center text-sm text-muted-foreground font-body">{t("predict_loading")}</div>;
  }

  const SlotRow = ({ i }) => {
    const id = slots[i];
    const active = activeSlot === i;
    const podium = i < 3;
    return (
      <button
        onClick={() => (id ? clearSlot(i) : setActiveSlot(i))}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-colors
          ${active ? "border-primary bg-primary/5" : "border-gray-200 bg-gray-50"}`}
      >
        <span className={`shrink-0 text-center ${podium ? "text-lg w-6" : "w-6 font-heading font-black text-xs text-gray-400"}`}>
          {podium ? MEDALS[i] : `P${i + 1}`}
        </span>
        {id ? (
          <>
            <span className="w-1 h-5 rounded-full shrink-0" style={{ backgroundColor: colorOf(id) }} />
            <span className="font-heading font-bold text-sm text-foreground truncate flex-1">{nameOf(id)}</span>
            <span className="text-[10px] text-muted-foreground font-body shrink-0">{t("predict_tapToChange")}</span>
          </>
        ) : (
          <span className={`text-sm font-body flex-1 ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>
            {t("predict_chooseP", { n: i + 1 })}
          </span>
        )}
      </button>
    );
  };

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

          {/* Podio */}
          <div className="px-3 pt-3">
            <p className="text-[10px] font-body uppercase tracking-widest text-gray-400 mb-1.5 px-1">{t("predict_podium")}</p>
            <div className="space-y-1.5">{[0, 1, 2].map(i => <SlotRow key={i} i={i} />)}</div>
          </div>

          {/* 4-10 */}
          <div className="px-3 pt-3">
            <p className="text-[10px] font-body uppercase tracking-widest text-gray-400 mb-1.5 px-1">
              {t("predict_rest")} <span className="text-gray-300 normal-case tracking-normal">· {t("predict_optional")}</span>
            </p>
            <div className="space-y-1.5">{[3, 4, 5, 6, 7, 8, 9].map(i => <SlotRow key={i} i={i} />)}</div>
          </div>

          {/* Driver grid */}
          <div className="px-3 py-3">
            <div className="grid grid-cols-2 gap-1.5">
              {drivers.map(d => {
                const picked = slots.includes(d.id);
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

          {/* Pit stop team */}
          <div className="px-3 pb-2 border-t border-gray-100 pt-3">
            <p className="text-[10px] font-body uppercase tracking-widest text-gray-400 mb-1.5 px-1 flex items-center gap-1">
              <Wrench className="w-3 h-3" /> {t("predict_pit")} <span className="text-gray-300 normal-case tracking-normal">· {t("predict_optional")}</span>
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {teams.map(tm => {
                const on = pitTeam === tm.id;
                const tc = getTeamColor(tm.name);
                return (
                  <button
                    key={tm.id}
                    onClick={() => choosePit(tm.id)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors
                      ${on ? "border-primary bg-primary/5" : "border-gray-200 bg-white active:bg-gray-50"}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tc }} />
                    <span className="font-body text-xs text-foreground truncate flex-1">{tm.name}</span>
                    {on && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save */}
          <div className="px-3 pb-3 pt-2">
            <button
              onClick={save}
              disabled={!podiumComplete || (!changed && !!existing)}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-body font-semibold text-sm transition-colors
                ${podiumComplete && (changed || !existing)
                  ? "bg-primary text-white active:scale-[0.98]"
                  : "bg-gray-100 text-muted-foreground"}`}
            >
              {justSaved
                ? <><Check className="w-4 h-4" /> {t("predict_saved")}</>
                : existing ? t("predict_update") : t("predict_save")}
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
              const score = scoreRace(h, outcomes[h.raceId]);
              return (
                <div key={h.raceId} className="app-card px-4 py-3">
                  <div className="flex items-center gap-2">
                    {raceFlagUrl(h, "h40") && (
                      <img src={raceFlagUrl(h, "h40")} alt="" className="w-6 h-4 object-cover rounded-sm ring-1 ring-black/5 shrink-0" />
                    )}
                    <span className="font-heading font-bold text-xs uppercase tracking-wide truncate flex-1">{h.raceName}</span>
                    {score ? (
                      <span className={`tag shrink-0 ${score.perfectPodium ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}`}>
                        {score.perfectPodium ? "🏆 " : ""}{score.points} {t("pts")}
                      </span>
                    ) : (
                      <span className="tag bg-amber-100 text-amber-700 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t("predict_waiting")}
                      </span>
                    )}
                  </div>
                  {score && (
                    <div className="flex gap-2 mt-2 text-[10px] font-body text-muted-foreground">
                      <span>{t("predict_podium")}: <b className="text-foreground">{score.podiumPts}</b></span>
                      <span>4–10: <b className="text-foreground">{score.restPts}</b></span>
                      <span className="flex items-center gap-0.5"><Wrench className="w-2.5 h-2.5" /> <b className="text-foreground">{score.pitPts}</b></span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
