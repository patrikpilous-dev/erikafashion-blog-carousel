# -*- coding: utf-8 -*-
"""Najde nove clanky na blogu a namapuje je na kategorie.

Bezi denne v Actions pred refresh.py, takze kazdy novy clanek dostane
vlastni tematicky carousel nejpozdeji druhy den rano. Do te doby ho kryje
_default.json (bestsellery).

Stahuje jen sitemapu a clanky, ktere jeste nejsou v config.json, ne vsech
260. Navigacni odkazy (menu, paticka, promo) se neurcuji znovu z frekvence
napric blogem, berou se z ulozene mnoziny config["nav_links"]. Tu jednou
spocita --bootstrap (nebo se spocita sama, kdyz v configu chybi).

Existujici mapovani nikdy neprepisuje, rucni zasahy v configu zustavaji.

Pouziti: python pipeline/discover.py              (denni beh)
         python pipeline/discover.py --bootstrap  (prepocita nav_links)
"""
import json
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path

from match import MAX_CATEGORIES, NAV_THRESHOLD, article_links

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "pipeline" / "config.json"
UA = {"User-Agent": "Mozilla/5.0 (compatible; ef-blog-carousel/1.0)"}
PAGINACE = re.compile(r"^/blog/strana-\d+/$")


def fetch(url, tries=4):
    """Cloudflare pred e-shopem obcas vrati 520 nebo spojeni utne. Jeden
    takovy vypadek nesmi shodit cely denni beh, proto 5xx a sitove chyby
    zkousime znovu s rostouci pauzou. 4xx je trvala chyba, tu hned vyhodime."""
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as exc:
            if exc.code < 500 or attempt == tries - 1:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == tries - 1:
                raise
        time.sleep(5 * 2 ** attempt)


def blog_paths(shop):
    sitemap = fetch(shop + "/sitemap.xml")
    urls = set(re.findall(r"(https://www\.erikafashion\.cz/blog/[^<\s]+/)", sitemap))
    paths = {u.replace(shop, "") for u in urls}
    return sorted(p for p in paths if not PAGINACE.match(p))


def bootstrap_nav(shop, paths):
    """Odkaz, ktery je ve vic nez NAV_THRESHOLD clanku, je navigace, ne tema."""
    freq = Counter()
    for n, p in enumerate(paths, 1):
        try:
            freq.update(set(article_links(fetch(shop + p))))
        except Exception as exc:
            print(f"  chyba {p}: {exc}", file=sys.stderr)
        if n % 50 == 0:
            print(f"  bootstrap {n}/{len(paths)}")
    nav = sorted(h for h, c in freq.items() if c > len(paths) * NAV_THRESHOLD)
    print(f"nav_links: {len(nav)} odkazu z {len(paths)} clanku")
    return nav


def main():
    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    shop = cfg["shop_url"]
    paths = blog_paths(shop)
    articles = cfg["articles"]

    if "--bootstrap" in sys.argv or not cfg.get("nav_links"):
        cfg["nav_links"] = bootstrap_nav(shop, paths)
    nav = set(cfg["nav_links"])

    nove = [p for p in paths if p not in articles]
    pridano = 0
    for p in nove:
        try:
            links = article_links(fetch(shop + p))
        except Exception as exc:
            # clanek nepridavame, zkusi se zitra; mezitim ho kryje _default.json
            print(f"VAROVANI: {p} nejde stahnout ({exc}), zkusim zitra", file=sys.stderr)
            continue
        seen, cats = set(), []
        for href in links:
            if href in nav or href in seen:
                continue
            seen.add(href)
            cats.append(href)
        articles[p] = {"categories": cats[:MAX_CATEGORIES], "added": date.today().isoformat()}
        pridano += 1
        print(f"NOVY: {p} -> {cats[:MAX_CATEGORIES] or '(bestsellery)'}")

    CONFIG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK: v sitemape {len(paths)} clanku, novych {pridano}, celkem v mapovani {len(articles)}")


if __name__ == "__main__":
    main()
