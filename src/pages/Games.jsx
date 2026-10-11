import { useState } from "react";
import { Gamepad2, ChevronRight, ArrowLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StartLights from "@/components/games/StartLights";
import DriverGuess from "@/components/games/DriverGuess";
import { dayNumber, playedToday } from "@/lib/driverGame";
import { useI18n } from "@/lib/i18n";
import { useBackHandler } from "@/lib/backStack";

const GAMES = [
  { id: "guess", emoji: "🕵️", title: "guess_title", desc: "guess_desc", Component: DriverGuess },
  { id: "lights", emoji: "🚦", title: "lights_title", desc: "lights_desc", Component: StartLights },
];

export default function Games() {
  const { t } = useI18n();
  const [open, setOpen] = useState(null);
  const game = GAMES.find((g) => g.id === open);

  // Dentro un gioco, il gesto indietro torna all'elenco dei giochi.
  useBackHandler(!!game, () => setOpen(null));

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 pb-4">
      <PageHeader icon={Gamepad2} title={t("games_title")} />

      <div className="px-4 py-5 space-y-4">
        {game ? (
          <>
            <button onClick={() => setOpen(null)}
              className="flex items-center gap-1 text-sm font-body font-semibold text-primary">
              <ArrowLeft className="w-4 h-4" /> {t("games_all")}
            </button>
            <game.Component />
          </>
        ) : (
          GAMES.map((g) => (
            <button key={g.id} onClick={() => setOpen(g.id)}
              className="app-card w-full p-4 flex items-center gap-4 text-left active:scale-[0.99] transition-transform">
              <span className="text-4xl shrink-0">{g.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-heading font-black text-base uppercase tracking-wide flex items-center gap-2">
                  {t(g.title)}
                  {g.id === "guess" && (
                    <span className="tag bg-primary/10 text-primary">#{dayNumber()}</span>
                  )}
                  {g.id === "guess" && !playedToday() && (
                    <span className="tag bg-amber-100 text-amber-700">{t("games_new")}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground font-body leading-snug mt-1">{t(g.desc)}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
