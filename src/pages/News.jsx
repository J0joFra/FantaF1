import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Newspaper } from "lucide-react";
import { motion } from "framer-motion";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

const DATE_LOCALE = { it: "it-IT", fr: "fr-FR", es: "es-ES", de: "de-DE", en: "en-GB" };

// News are pre-fetched server-side (GitHub Action, every 3h) and stored in
// Supabase. The app just reads them — no CORS / proxy / RSS on the client.
async function fetchNews(locale = "it") {
  const dateLocale = DATE_LOCALE[locale] ?? "en-GB";

  const { data, error } = await supabase
    .from("flash_news")
    .select("title, url, image, excerpt, category, pub_date, source")
    .eq("locale", locale)
    .order("rank", { ascending: true });

  if (error) throw new Error(error.message);

  const items = (data ?? []).map((row, i) => ({
    id:          i,
    title:       row.title || "",
    description: (row.excerpt || "").slice(0, 140),
    category:    row.category || "F1 NEWS",
    date:        row.pub_date
      ? new Date(row.pub_date).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" })
      : "",
    url:         row.url,
    thumbnail:   row.image || null,
    source:      row.source || "",
  }));

  if (items.length) {
    try {
      localStorage.setItem(`f1news_${locale}`, JSON.stringify({ ts: Date.now(), items }));
    } catch { /* ignore quota */ }
  }
  return items;
}

// Read cached news synchronously so the page paints instantly
function readCache(locale) {
  try {
    const raw = localStorage.getItem(`f1news_${locale}`);
    if (!raw) return undefined;
    const { items } = JSON.parse(raw);
    return Array.isArray(items) && items.length ? items : undefined;
  } catch {
    return undefined;
  }
}

const CAT_BADGE = {
  SCUDERIA:  "bg-red-100 text-red-600 border-red-200",
  PILOTI:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  "F1 NEWS": "bg-gray-100 text-gray-500 border-gray-200",
};

function NewsCard({ item, index }) {
  const badge = CAT_BADGE[item.category] ?? CAT_BADGE["F1 NEWS"];

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
      className="app-card overflow-hidden active:scale-[0.98] transition-transform"
      onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
    >
      {/* Thumbnail */}
      <div className="relative w-full h-36 overflow-hidden bg-gray-100 shrink-0">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={e => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <Newspaper className="w-8 h-8 text-gray-300" />
          </div>
        )}
        {/* Category badge */}
        <span className={`absolute top-2.5 left-2.5 text-[9px] font-black uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border ${badge}`}>
          {item.category}
        </span>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-1.5">
        <h3 className="text-sm font-heading font-black text-foreground leading-snug line-clamp-2">
          {item.title}
        </h3>
        <p className="text-[11px] text-muted-foreground font-body leading-relaxed line-clamp-2">
          {item.description}
        </p>
        <div className="flex justify-between items-center pt-2 border-t border-border mt-0.5">
          <time className="text-[10px] font-body text-muted-foreground/70 uppercase tracking-wider">
            {item.date}
          </time>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold font-body text-primary">
            Leggi <ExternalLink className="w-2.5 h-2.5" />
          </span>
        </div>
      </div>
    </motion.article>
  );
}

function SkeletonCard() {
  return (
    <div className="app-card overflow-hidden animate-pulse">
      <div className="w-full h-36 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 bg-gray-200 rounded w-full" />
        <div className="h-3.5 bg-gray-200 rounded w-4/5" />
        <div className="h-2.5 bg-gray-100 rounded w-1/4 mt-2" />
      </div>
    </div>
  );
}

export default function News() {
  const { t, lang } = useI18n();
  const locale = lang ?? "it";
  const cached = readCache(locale);
  const { data: items = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["f1news", locale],
    queryFn: () => fetchNews(locale),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: "always",          // always revalidate so newly-added langs appear
    initialData: cached,               // paints instantly from localStorage
    initialDataUpdatedAt: 0,           // treat cache as stale → refresh in background
    placeholderData: (prev) => prev,   // keep old items while switching language
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 pb-4">
      <PageHeader
        icon={Newspaper}
        title="Flash News"
        right={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        }
      />

      {/* Live badge */}
      <div className="px-4 pt-1 pb-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Live · F1 News</span>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {isLoading && [...Array(3)].map((_, i) => <SkeletonCard key={i} />)}

        {error && (
          <div className="app-card p-6 flex flex-col items-center gap-3 text-center">
            <p className="font-heading font-black text-base text-foreground">Notizie non disponibili</p>
            <p className="text-sm text-muted-foreground font-body">{error.message}</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold font-body"
            >
              Riprova
            </button>
          </div>
        )}

        {!isLoading && !error && items.map((item, i) => (
          <NewsCard key={i} item={item} index={i} />
        ))}

        {/* Empty state — data still being generated for this language */}
        {!isLoading && !error && items.length === 0 && (
          <div className="app-card p-6 flex flex-col items-center gap-3 text-center">
            <Newspaper className="w-8 h-8 text-gray-300" />
            <p className="font-heading font-black text-base text-foreground">Nessuna notizia</p>
            <p className="text-sm text-muted-foreground font-body">Le notizie per questa lingua saranno disponibili a breve.</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold font-body"
            >
              Aggiorna
            </button>
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <p className="text-center text-muted-foreground/50 text-[11px] font-body py-2 tracking-wider">
            Aggiornato ogni 3 ore
          </p>
        )}
      </div>
    </div>
  );
}
