#!/usr/bin/env python3
"""
Fetch the 5 latest F1 news per language from native RSS feeds and store them
in Supabase (table: flash_news). Runs from GitHub Actions every 3 hours.

The app then simply reads from Supabase — no client-side CORS / proxy needed.

Env vars required:
  SUPABASE_URL               e.g. https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY  service_role key (write access)
"""

import os
import re
import sys
import html
import json
import time
import datetime as dt
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

import feedparser

# ── Feeds per language (first that returns items wins) ────────────────────────
FEEDS = {
    "it": [
        "https://it.motorsport.com/rss/f1/news/",
        "https://www.formulapassion.it/feed",
    ],
    "en": [
        "https://www.motorsport.com/rss/f1/news/",
        "https://www.planetf1.com/news/feed/",
        "https://www.autosport.com/rss/f1/news/",
    ],
    "fr": [
        "https://fr.motorsport.com/rss/f1/news/",
        "https://motorsport.nextgen-auto.com/fr/rss.php",
    ],
    "es": [
        "https://es.motorsport.com/rss/f1/news/",
        "https://www.motorpasion.com/formula1/feed",
    ],
    "de": [
        "https://de.motorsport.com/rss/f1/news/",
        "https://www.motorsport-total.com/rss.xml",
    ],
}

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print(
        "ERRORE: secret mancanti.\n"
        "  Vai su GitHub → Settings → Secrets and variables → Actions e aggiungi:\n"
        "    SUPABASE_URL               = https://noleeodnpfautgbhpmdv.supabase.co\n"
        "    SUPABASE_SERVICE_ROLE_KEY  = (service_role key da Supabase → Settings → API Keys)\n"
    )
    sys.exit(1)


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]*>", "", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def categorize(title):
    t = (title or "").lower()
    if "ferrari" in t:
        return "SCUDERIA"
    if any(k in t for k in ("leclerc", "hamilton", "verstappen")):
        return "PILOTI"
    return "F1 NEWS"


def extract_image(entry):
    # media:content / media:thumbnail
    for key in ("media_content", "media_thumbnail"):
        media = entry.get(key)
        if media and isinstance(media, list) and media[0].get("url"):
            return media[0]["url"]
    # enclosures
    for enc in entry.get("enclosures", []) or []:
        if enc.get("href") and (enc.get("type", "").startswith("image") or True):
            return enc["href"]
    # <img> inside summary/content
    blobs = [entry.get("summary", "")]
    for c in entry.get("content", []) or []:
        blobs.append(c.get("value", ""))
    for blob in blobs:
        m = re.search(r'<img[^>]+src="([^">]+)"', blob or "")
        if m:
            return m.group(1)
    return None


def parse_date(entry):
    for key in ("published_parsed", "updated_parsed"):
        tm = entry.get(key)
        if tm:
            return dt.datetime(*tm[:6], tzinfo=dt.timezone.utc).isoformat()
    return None


def fetch_feed(url):
    """Return list of parsed entries, or [] on failure."""
    try:
        req = Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*"})
        with urlopen(req, timeout=25) as resp:
            raw = resp.read()
        parsed = feedparser.parse(raw)
        return parsed.entries or []
    except (URLError, HTTPError, Exception) as e:  # noqa: BLE001
        print(f"    ! feed error {url}: {e}")
        return []


def build_items(locale):
    for url in FEEDS[locale]:
        entries = fetch_feed(url)
        if not entries:
            continue
        source = re.sub(r"^https?://(www\.)?", "", url).split("/")[0]
        items = []
        for i, entry in enumerate(entries[:5]):
            title = strip_html(entry.get("title", ""))
            if not title:
                continue
            items.append({
                "locale": locale,
                "rank": i,
                "title": title,
                "url": entry.get("link", ""),
                "image": extract_image(entry),
                "excerpt": strip_html(entry.get("summary", ""))[:180],
                "category": categorize(title),
                "pub_date": parse_date(entry),
                "source": source,
            })
        if items:
            print(f"  {locale}: {len(items)} items from {source}")
            return items
    print(f"  {locale}: NO items from any feed")
    return []


def supabase_request(method, path, body=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}{params}"
    data = json.dumps(body).encode() if body is not None else None
    req = Request(url, data=data, method=method, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    })
    with urlopen(req, timeout=25) as resp:
        return resp.status


def save(locale, items):
    # Remove old rows for this locale, then insert the fresh 5
    supabase_request("DELETE", "flash_news", params=f"?locale=eq.{locale}")
    if items:
        supabase_request("POST", "flash_news", body=items)
    print(f"  {locale}: saved {len(items)}")


def main():
    print("Fetching F1 flash news…")
    total = 0
    for locale in FEEDS:
        items = build_items(locale)
        if items:
            save(locale, items)
            total += len(items)
        time.sleep(1)
    print(f"Done. {total} items saved.")
    if total == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
