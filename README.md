# Erika Fashion — produktový carousel na blogu

Automatický carousel tematicky relevantních produktů pod blogovými články erikafashion.cz.
Pilot: 2 články. Metodika: skill `blog-produktovy-carousel` v ~/.claude/skills.

## Jak to funguje

- **carousel.js** — jediný script tag v šabloně Shoptetu (patička, pole „HTML kód"). Na URL
  `/blog/<slug>/` stáhne `carousel.json`; když článek v datech najde, vyrenderuje carousel.
  Jinak nedělá nic.
- **carousel.json** — generuje `pipeline/refresh.py` denně přes GitHub Actions
  (04:30 UTC): kandidáti ze stránek kategorií (dle `pipeline/config.json`), dostupnost
  z Heureka feedu (jen skladem), řazení dle `data/scores.json` (prodané ks za 90 dní).
- **data/scores.json** — generuje lokálně `pipeline/scores_from_orders.py` z exportu
  objednávek Shoptetu. Aktualizovat při novém exportu (nebo po zřízení API tokenu).
- Denní commit z Actions drží repo aktivní → GitHub scheduled workflow se nikdy nevypne
  kvůli 60 dnům neaktivity. Ruční spuštění: Actions → „Denni refresh" → Run workflow.

## Měření (GA4)

`view_item_list` (carousel ve viewportu) a `select_item` (klik) s
`item_list_id: "blog_carousel"`, `item_list_name: "blog: <slug>"`.
Vyhodnocení: GA4 → Přehledy elektronického obchodu → výkon podle item listu.

## Přidání článku

Do `pipeline/config.json` → `articles` přidat `"/blog/<slug>/": {"categories": [...]}`,
commitnout — další ranní běh ho zveřejní. Fallback pro nenamapované články:
`fallback_enabled: true` (zatím vypnuto, pilot).

## Náhled

https://patrikpilous-dev.github.io/erikafashion-blog-carousel/preview.html
