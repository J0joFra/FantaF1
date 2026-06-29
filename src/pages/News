import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Newspaper } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const RSS_URL = "https://it.motorsport.com/rss/f1/news/";
const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}&count=30`;

function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
}

async function fetchNews() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error("Errore caricamento notizie");
  const json = await res.json();
  if (json.status !== "ok") throw new Error("Feed non disponibile");
  return json.items.map(item => ({
    title:     item.title,
    excerpt:   stripHtml(item.description).slice(0, 160),
    image:     item.thumbnail || item.enclosure?.link || null,
    url:       item.link,
    date:      item.pubDate ? new Date(item.pubDate) : null,
  }));
}

function NewsCard({ item }) {
  const handleClick = () => {
    window.open(item.url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left app-card overflow-hidden active:scale-[0.98] transition-transform"
    >
      {/* Cover image */}
      {item.image && (
        <div className="w-full aspect-[16/9] overflow-hidden bg-gray-100">
          <img
            src={item.image}
            alt=""
            className="w-full h-full object-cover"
            onError={e => { e.target.parentElement.style.display = "none"; }}
          />
        </div>
      )}

      <div className="p-3">
        {/* Date */}
        {item.date && (
          <p className="text-[10px] text-muted-foreground font-body mb-1">
            {item.date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}

        {/* Title */}
        <p className="font-heading font-black text-sm text-foreground leading-snug line-clamp-2">
          {item.title}
        </p>

        {/* Excerpt */}
        {item.excerpt && (
          <p className="text-[12px] text-muted-foreground font-body mt-1 line-clamp-2 leading-relaxed">
            {item.excerpt}
          </p>
        )}

        {/* Read more */}
        <div className="flex items-center gap-1 mt-2 text-primary">
          <span className="text-[11px] font-semibold font-body">Leggi su Motorsport.com</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </button>
  );
}

export default function News() {
  const { t } = useI18n();
  const { data: items = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["f1news"],
    queryFn: fetchNews,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 pb-4">
      <PageHeader
        icon={Newspaper}
        title="News F1"
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

      <div className="px-4 py-4 space-y-3">
        {isLoading && (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="app-card overflow-hidden animate-pulse">
                <div className="w-full aspect-[16/9] bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="app-card p-6 flex flex-col items-center gap-3 text-center">
            <p className="font-heading font-black text-base">Notizie non disponibili</p>
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
          <NewsCard key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
