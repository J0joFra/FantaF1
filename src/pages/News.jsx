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
  return items.slice(0, 30).map(item => {
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
      excerpt: stripHtml(description).slice(0, 160),
      image,
      url: link,
      date: pubDate ? new Date(pubDate) : null,
    };
  });
}

async function fetchViaRss2Json() {
  const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}&count=30`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`rss2json ${res.status}`);
  const json = await res.json();
  if (json.status !== "ok") throw new Error("rss2json: " + (json.message || "errore"));
  return json.items.map(item => ({
    title: item.title,
    excerpt: stripHtml(item.description || "").slice(0, 160),
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

function NewsCard({ item }) {
  const handleClick = () => {
    window.open(item.url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left app-card overflow-hidden active:scale-[0.98] transition-transform"
    >
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
        {item.date && (
          <p className="text-[10px] text-muted-foreground font-body mb-1">
            {item.date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}

        <p className="font-heading font-black text-sm text-foreground leading-snug line-clamp-2">
          {item.title}
        </p>

        {item.excerpt && (
          <p className="text-[12px] text-muted-foreground font-body mt-1 line-clamp-2 leading-relaxed">
            {item.excerpt}
          </p>
        )}

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
