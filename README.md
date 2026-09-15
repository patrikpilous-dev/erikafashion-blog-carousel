# Erika Fashion — produktový carousel na blogu

Automatický carousel tematicky relevantních produktů pod blogovými články erikafashion.cz.
Nasazeno na celém blogu. Metodika: skill `blog-produktovy-carousel` v ~/.claude/skills.

## Jak to funguje

- **carousel.js** — jediný script tag v šabloně Shoptetu (patička). Na URL `/blog/<slug>/`
  stáhne `a/<slug>.json` a vykreslí carousel pod první odstavec. Když článek vlastní data
  nemá, sáhne po `a/_default.json` (bestsellery), takže carousel je i u úplně nového článku.
- **Denní běh v GitHub Actions** (04:30 UTC):
  1. `pipeline/discover.py` najde v sitemapě články, které ještě nejsou v `pipeline/config.json`,
     a namapuje je na kategorie podle odkazů v textu. Nový článek tak dostane tematický
     carousel nejpozději druhé ráno po zveřejnění. Existující mapování nepřepisuje.
  2. `pipeline/refresh.py` vygeneruje `a/<slug>.json`: kandidáti ze stránek kategorií,
     dostupnost z Heureka feedu (jen skladem), řazení dle `data/scores.json`.
- **data/scores.json** — generuje lokálně `pipeline/scores_from_orders.py` z exportu
  objednávek Shoptetu. Aktualizovat při novém exportu.
- Denní commit z Actions drží repo aktivní, takže se scheduled workflow nevypne kvůli
  60 dnům neaktivity. Ruční spuštění: Actions → „Denni refresh" → Run workflow.

## Na co nesahat

- **`.nojekyll` musí zůstat v kořeni repa.** GitHub Pages staví přes Jekyll, který
  ignoruje soubory začínající podtržítkem. Bez `.nojekyll` vrací `a/_default.json` 404
  a nové články zůstanou bez carouselu. Chyběl od začátku, doplněn 15. 9. 2026.
- Požadavky na e-shop se při chybě 5xx opakují (Cloudflare občas vrátí 520). Jeden
  výpadek dřív shodil celý denní běh.

## Měření (GA4)

`view_item_list` (carousel ve viewportu) a `select_item` (klik) s
`item_list_id: "blog_carousel"`, `item_list_name: "blog: <slug>"`.
Vyhodnocení: GA4 → Přehledy → Seznamy položek, do vyhledávání napsat `blog`.

## Ruční zásah do mapování

V `pipeline/config.json` → `articles` upravit `categories` u daného článku a commitnout.
Denní běh ruční úpravy nepřepisuje. Navigační odkazy, které se při mapování ignorují,
jsou v `nav_links`, přepočítá je `python pipeline/discover.py --bootstrap`.

## Náhled

https://patrikpilous-dev.github.io/erikafashion-blog-carousel/preview.html
