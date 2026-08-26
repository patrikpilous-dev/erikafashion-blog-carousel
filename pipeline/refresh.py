# -*- coding: utf-8 -*-
"""Denni refresh carousel.json pro blog carousel Erika Fashion.

Zdroje (vse verejne, bez tokenu):
- Heureka XML feed  -> dostupnost variant, kod produktu (ITEMGROUP_ID), zaloha obrazku/ceny
- stranky kategorii -> kandidati per clanek (nazev, URL, obrazek, cena)
- data/scores.json  -> prodejnost (kusy za 90 dni z exportu objednavek, generuje scores_from_orders.py)

Vystup: carousel.json v rootu repa (serviruje GitHub Pages).
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / "pipeline" / "config.json").read_text(encoding="utf-8"))
UA = {"User-Agent": "Mozilla/5.0 (compatible; ef-blog-carousel/1.0)"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def slug_of(url):
    """Posledni segment cesty bez query — stabilni identifikator produktu."""
    path = url.split("?")[0].rstrip("/")
    return path.rsplit("/", 1)[-1]


def load_feed():
    """slug -> {code, in_stock, name, img, price} (agregace variant na produkt)."""
    raw = fetch(CONFIG["feed_url"])
    products = {}
    for _, el in ElementTree.iterparse(__import__("io").BytesIO(raw)):
        if el.tag != "SHOPITEM":
            continue
        url = el.findtext("URL") or ""
        if not url:
            el.clear()
            continue
        slug = slug_of(url)
        code = el.findtext("ITEMGROUP_ID") or (el.findtext("ITEM_ID") or "").split("_")[0]
        in_stock = (el.findtext("DELIVERY_DATE") or "").strip() == "0"
        name = re.sub(r"\s+Barva:\s.*$", "", (el.findtext("PRODUCT") or "").strip())
        price_raw = (el.findtext("PRICE_VAT") or "0").replace(",", ".").replace("\xa0", "").replace(" ", "")
        try:
            price = float(price_raw)
        except ValueError:
            price = 0.0
        p = products.setdefault(slug, {
            "code": code, "in_stock": False, "name": name,
            "img": el.findtext("IMGURL") or "", "price": price,
            "url": CONFIG["shop_url"] + "/" + slug + "/",
        })
        p["in_stock"] = p["in_stock"] or in_stock
        if 0 < price < (p["price"] or 1e12):
            p["price"] = price
        el.clear()
    return products


CARD_RE = re.compile(
    r'data-micro="product".*?href="(?P<href>[^"]+)"[^>]*class="image".*?'
    r'(?P<imgtag><img[^>]+>).*?'
    r'data-testid="productCardName">\s*(?P<name>[^<]+?)\s*</span>.*?'
    r'data-micro-price="(?P<price>[0-9.]+)"',
    re.S,
)


def real_img(imgtag):
    """Lazy-load karty maji v src SVG placeholder a realny obrazek v data-src."""
    attrs = dict(re.findall(r'(data-src|src)="([^"]+)"', imgtag))
    for key in ("data-src", "src"):
        val = (attrs.get(key) or "").strip()
        if val and not val.startswith("data:"):
            return val
    return ""


def category_products(cat_path):
    """Kandidati z kategorie v poradi vypisu, vc. stranky /strana-N/."""
    out, seen = [], set()
    for page in range(1, CONFIG["max_category_pages"] + 1):
        suffix = "" if page == 1 else f"strana-{page}/"
        try:
            html = fetch(CONFIG["shop_url"] + cat_path + suffix).decode("utf-8", "replace")
        except Exception:
            break
        found = 0
        for m in CARD_RE.finditer(html):
            slug = slug_of(m.group("href"))
            if slug in seen:
                continue
            seen.add(slug)
            img = real_img(m.group("imgtag"))
            if img.startswith("/"):
                img = CONFIG["shop_url"] + img
            out.append({
                "slug": slug,
                "name": re.sub(r"\s+", " ", m.group("name")).strip(),
                "url": CONFIG["shop_url"] + m.group("href"),
                "img": img,
                "price": float(m.group("price")),
            })
            found += 1
        if found == 0 or f"strana-{page + 1}/" not in html:
            break
    return out


def build_list(cat_paths, feed, scores, n):
    """Kandidati z kategorii (v poradi priority) -> jen skladem -> razeni dle prodejnosti."""
    picked, seen = [], set()
    for ci, cat in enumerate(cat_paths):
        for card in category_products(cat):
            slug = card["slug"]
            if slug in seen:
                continue
            seen.add(slug)
            fp = feed.get(slug)
            if not fp or not fp["in_stock"]:
                continue
            picked.append({
                "code": fp["code"],
                "name": card["name"] or fp["name"],
                "url": card["url"],
                "img": card["img"] or fp["img"],
                "price": card["price"] or fp["price"],
                "_sales": scores.get(fp["code"], 0),
                "_cat": ci,
            })
        if len(picked) >= n * 2 and ci == 0:
            break  # primarni kategorie dala dost kandidatu
    picked.sort(key=lambda p: (-p["_sales"], p["_cat"]))
    return [{k: v for k, v in p.items() if not k.startswith("_")} for p in picked[:n]]


def main():
    scores_file = ROOT / "data" / "scores.json"
    scores = json.loads(scores_file.read_text(encoding="utf-8")) if scores_file.exists() else {}
    feed = load_feed()
    n = CONFIG["products_per_carousel"]

    articles = {}
    for article_path, spec in CONFIG["articles"].items():
        items = build_list(spec["categories"], feed, scores, n)
        if len(items) >= CONFIG["min_products"]:
            articles[article_path] = {"products": items}
        else:
            print(f"VAROVANI: {article_path} ma jen {len(items)} produktu, vynechavam", file=sys.stderr)

    default_items = build_list(CONFIG["fallback_categories"], feed, scores, n)

    out = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fallback_enabled": CONFIG["fallback_enabled"],
        "articles": articles,
        "default": {"products": default_items},
    }
    (ROOT / "carousel.json").write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"OK: {len(articles)} clanku, default {len(default_items)} produktu, feed {len(feed)} produktu")


if __name__ == "__main__":
    main()
