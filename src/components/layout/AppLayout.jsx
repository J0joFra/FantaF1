import { Outlet, useLocation, Link } from "react-router-dom";
import { BarChart2, Calculator, GitCompare, Shield, Newspaper, RefreshCw, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Suspense } from "react";
import { Capacitor } from "@capacitor/core";
import { useI18n } from "@/lib/i18n";
import { useAndroidBack } from "@/lib/useAndroidBack";
import { hapticSelect, hapticTap } from "@/lib/native";
import { syncDailyReminder } from "@/lib/dailyReminder";
import { queryClientInstance } from "@/lib/query-client";
import OfflineBanner from "@/components/OfflineBanner";
import { useEffect, useRef, useState } from "react";

const PTR_THRESHOLD = 70; // px of pull needed to trigger a refresh

const tabs = [
  { path: "/",           key: "nav_overview",  icon: BarChart2  },
  { path: "/calculator", key: "nav_scenarios", icon: Calculator },
  { path: "/compare",    key: "nav_compare",   icon: GitCompare },
  { path: "/ferrari",    key: "nav_teams",     icon: Shield     },
  { path: "/news",       key: "nav_news",      icon: Newspaper  },
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const { t, lang } = useI18n();

  // Riallinea le notifiche del «Pilota del giorno» a ogni apertura (e al
  // cambio lingua, perché il testo è già scritto dentro la notifica).
  useEffect(() => { syncDailyReminder(t); }, [lang]);

  // Il gesto indietro riporta alla Panoramica invece di chiudere l'app.
  useAndroidBack();

  // ── Pull-to-refresh ────────────────────────────────────────────────────────
  // Trascinando giù dall'inizio della pagina si ricaricano i dati (classifiche,
  // calendario, news…). Si attiva solo quando si è già in cima allo scroll.
  const mainRef = useRef(null);
  const startY = useRef(0);
  const tracking = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e) => {
    if (refreshing) return;
    const el = mainRef.current;
    tracking.current = !!el && el.scrollTop <= 0;
    if (tracking.current) startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (!tracking.current || refreshing) return;
    const el = mainRef.current;
    if (el && el.scrollTop > 0) { tracking.current = false; setPull(0); return; }
    const dy = e.touches[0].clientY - startY.current;
    setPull(dy > 0 ? Math.min(dy * 0.5, 90) : 0); // elastic resistance
  };
  const onTouchEnd = async () => {
    if (!tracking.current) return;
    tracking.current = false;
    if (pull >= PTR_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(48);
      hapticTap();
      try { await queryClientInstance.invalidateQueries(); } catch { /* ignore */ }
      setTimeout(() => { setRefreshing(false); setPull(0); }, 600);
    } else {
      setPull(0);
    }
  };

  // Sul nativo la bottom nav (fixed) salirebbe sopra la tastiera e coprirebbe il
  // contenuto: la nascondiamo mentre un campo di testo è a fuoco.
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const isField = (el) => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    const onIn = (e) => { if (isField(e.target)) setKbOpen(true); };
    const onOut = () => { setTimeout(() => setKbOpen(isField(document.activeElement)), 60); };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col app-column overflow-x-hidden">
      <OfflineBanner />
      <main
        ref={mainRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative flex-1 overflow-y-auto overflow-x-hidden pb-nav"
        style={{ overscrollBehaviorY: "contain" }}
      >
        {/* Pull-to-refresh indicator */}
        {pull > 0 && (
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-20"
            style={{ height: pull, opacity: Math.min(1, pull / PTR_THRESHOLD) }}
          >
            <RefreshCw
              className={`w-5 h-5 text-primary ${refreshing ? "animate-spin" : ""}`}
              style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
            />
          </div>
        )}
        <div
          style={{
            transform: `translateY(${pull}px)`,
            transition: tracking.current ? "none" : "transform 0.2s ease-out",
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="min-h-full"
            >
              <Suspense fallback={
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              }>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom nav — iOS/Android style (hidden while typing so it doesn't cover content) */}
      <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 app-column z-50
                      bg-white border-t border-border safe-bottom ${kbOpen ? "hidden" : ""}`}
           style={{ boxShadow: "0 -1px 0 rgba(0,0,0,0.06), 0 -4px 16px rgba(0,0,0,0.06)" }}>
        <div className="grid grid-cols-5 h-16">
          {tabs.map(({ path, key, icon: Icon }) => {
            const active = pathname === path;
            return (
              <Link key={path} to={path} onClick={() => { if (!active) hapticSelect(); }}
                className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors
                  ${active ? "text-primary" : "text-muted-foreground"}`}>
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
                <Icon style={{ width: 20, height: 20 }}
                      strokeWidth={active ? 2.2 : 1.8} />
                <span className={`text-[10px] font-body font-semibold mt-0.5
                  ${active ? "text-primary" : "text-muted-foreground/70"}`}
                      style={{ fontFamily: "var(--font-body)" }}>
                  {t(key)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
