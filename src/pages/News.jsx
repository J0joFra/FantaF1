import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Newspaper } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const RSS_URL = "https://it.motorsport.com/rss/f1/news/";

function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, "").trim();
}

function getText(el, tag) {
  const node = el.getElementsByTagName(tag)[0];
  return node ? (node.textContent || node.innerHTML || "").trim() : "";
}

function parseRssXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const items = Array.from(doc.getElementsByTagName("item"));
  return items.slice(0, 5).map(item => {
    const title = getText(item, "title");
    const link = getText(item, "link") || item.querySelector("link")?.textContent?.trim() || "";
    const pubDate = getText(item, "pubDate");
    const description = getText(item, "description");
    const mediaContent = item.getElementsByTagNameNS("http://search.yahoo.com/mrss/", "content")[0];
    const enclosure = item.getElementsByTagName("enclosure")[0];
    const image =
      mediaContent?.getAttribute("url") ||
      enclosure?.getAttribute("url") ||
      null;
    return {
      title,
      excerpt: stripHtml(description).slice(0, 120),
      image,
      url: link,
      date: pubDate ? new Date(pubDate) : null,
    };
  });
}

async function fetchViaRss2Json() {
  const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}&count=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`rss2json ${res.status}`);
  const json = await res.json();
  if (json.status !== "ok") throw new Error("rss2json: " + (json.message || "errore"));
  return json.items.map(item => ({
    title: item.title,
    excerpt: stripHtml(item.description || "").slice(0, 120),
    image: item.thumbnail || item.enclosure?.link || null,
    url: item.link,
    date: item.pubDate ? new Date(item.pubDate) : null,
  }));
}

async function fetchViaAllOrigins() {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(RSS_URL)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`allorigins ${res.status}`);
  const json = await res.json();
  if (!json.contents) throw new Error("allorigins: nessun contenuto");
  return parseRssXml(json.contents);
}

async function fetchNews() {
  try {
    const items = await fetchViaRss2Json();
    if (items.length > 0) return items;
    throw new Error("nessun articolo");
  } catch {
    return fetchViaAllOrigins();
  }
}

function formatDate(date) {
  if (!date) return "";
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

function NewsCard({ item }) {
  return (
    <button
      onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
      className="w-full text-left app-card overflow-hidden active:scale-[0.98] transition-transform flex gap-3 p-3"
    >
      {/* Square thumbnail */}
      <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
        {item.image ? (
          <img
            src={item.image}
            alt=""
            className="w-full h-full object-cover"
            onError={e => { e.target.parentElement.style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <Newspaper className="w-6 h-6 text-gray-400" />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <p className="font-heading font-black text-sm text-foreground leading-snug line-clamp-2">
            {item.title}
          </p>
          {item.excerpt && (
            <p className="text-[11px] text-muted-foreground font-body mt-1 line-clamp-2 leading-relaxed">
              {item.excerpt}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10px] text-muted-foreground font-body">{formatDate(item.date)}</p>
          <div className="flex items-center gap-0.5 text-primary">
            <span className="text-[10px] font-semibold font-body">Leggi</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </div>
        </div>
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="app-card overflow-hidden animate-pulse flex gap-3 p-3">
      <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-gray-200" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3.5 bg-gray-200 rounded w-full" />
        <div className="h-3.5 bg-gray-200 rounded w-4/5" />
        <div className="h-3 bg-gray-200 rounded w-1/3 mt-auto" />
      </div>
    </div>
  );
}

export default function News() {
  const { t } = useI18n();
  const { data: items = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["f1news"],
    queryFn: fetchNews,
    staleTime: 10 * 60 * 1000,
    retry: 1,
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

      <div className="px-4 py-4 space-y-2.5">
        {isLoading && [...Array(5)].map((_, i) => <SkeletonCard key={i} />)}

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

        {!isLoading && !error && items.length > 0 && (
          <a
            href="https://it.motorsport.com/f1/news/"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[12px] text-primary font-semibold font-body py-2"
          >
            Tutte le notizie su Motorsport.com →
          </a>
        )}
      </div>
    </div>
  );
}
