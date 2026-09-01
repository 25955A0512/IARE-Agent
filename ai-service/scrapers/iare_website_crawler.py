"""
iare_website_crawler.py — Live On-Demand Crawler & Scraper for https://www.iare.ac.in/

Fetches live pages, caches responses, and parses college announcements, faculty directories,
and institutional pages.
"""

import logging
import re
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

BASE_URL = "https://www.iare.ac.in"

# In-memory LRU cache: url -> {"timestamp": float, "title": str, "text": str, "links": List[str]}
_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour cache


class IAREWebsiteCrawler:
    """Crawler and live reader for the official IARE website."""

    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url.rstrip("/")

    def fetch_page(self, path_or_url: str, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Fetches and extracts clean textual content from a URL on www.iare.ac.in.
        """
        if path_or_url.startswith("http"):
            url = path_or_url
        else:
            url = f"{self.base_url}/{path_or_url.lstrip('/')}"

        now = time.time()
        if not force_refresh and url in _CACHE:
            entry = _CACHE[url]
            if now - entry["timestamp"] < CACHE_TTL_SECONDS:
                return entry

        try:
            with httpx.Client(timeout=10.0, follow_redirects=True, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }) as client:
                res = client.get(url)
                if res.status_code != 200:
                    log.warning("IARE Crawler: Received status %d for %s", res.status_code, url)
                    return {"url": url, "success": False, "title": "", "text": "", "status_code": res.status_code}

                soup = BeautifulSoup(res.text, "html.parser")

                # Remove script, style, nav boilerplate
                for tag in soup(["script", "style", "noscript", "svg", "header", "footer"]):
                    tag.decompose()

                title = soup.title.string.strip() if soup.title and soup.title.string else "IARE Official Page"

                # Extract main content
                main_div = (
                    soup.find("div", {"id": "main-content"}) or
                    soup.find("div", {"class": "region-content"}) or
                    soup.find("div", {"class": "content"}) or
                    soup.body
                )

                text = main_div.get_text(separator="\n", strip=True) if main_div else ""
                # Normalize excessive whitespace
                cleaned_text = re.sub(r"\n{3,}", "\n\n", text)

                extracted_links = []
                for a in (main_div or soup).find_all("a", href=True):
                    href = a["href"]
                    full_href = urljoin(url, href)
                    if self.base_url in full_href:
                        extracted_links.append({"text": a.get_text(strip=True), "url": full_href})

                result = {
                    "url": url,
                    "success": True,
                    "title": title,
                    "text": cleaned_text[:12000],  # cap at 12k chars
                    "links": extracted_links[:30],
                    "timestamp": now,
                }
                _CACHE[url] = result
                return result

        except Exception as e:
            log.warning("IARE Crawler failed for %s: %s", url, e)
            return {"url": url, "success": False, "title": "", "text": "", "error": str(e)}

    def search_live(self, query: str) -> List[Dict[str, Any]]:
        """
        Attempts a live site search query against IARE search endpoint.
        """
        search_url = f"{self.base_url}/search/node/{httpx.URL(query).raw_path.decode('utf-8') if hasattr(httpx, 'URL') else query}"
        page = self.fetch_page(search_url)
        if not page.get("success") or not page.get("text"):
            return []

        soup = BeautifulSoup(page.get("text", ""), "html.parser")
        results = []
        for item in soup.find_all(["li", "p"]):
            text = item.get_text(strip=True)
            if len(text) > 30 and any(w in text.lower() for w in query.lower().split()):
                results.append({"snippet": text[:300], "url": search_url})

        return results
