# -*- coding: utf-8 -*-
"""Vygeneruje data/scores.json (kod produktu -> prodane kusy za poslednich 90 dni dat)
z anonymizovaneho Shoptet exportu objednavek (utf-8, oddelovac ';').

Pouziti: python scores_from_orders.py "C:/cesta/erikafashion_orders.csv"
Spousti se lokalne pri novem exportu objednavek; vysledek se commitne do repa.
"""
import csv
import json
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_CODE_PREFIXES = ("SHIPPING", "BILLING")
SKIP_STATUSES = {"Stornována"}


def main(csv_path):
    # 1. pruchod: najdi max datum
    max_date = None
    with open(csv_path, encoding="utf-8", errors="replace", newline="") as f:
        for row in csv.DictReader(f, delimiter=";"):
            d = (row.get("date") or "")[:10]
            if d and (max_date is None or d > max_date):
                max_date = d
    since = (datetime.fromisoformat(max_date) - timedelta(days=90)).strftime("%Y-%m-%d")
    print(f"Okno: {since} az {max_date}")

    sales = Counter()
    with open(csv_path, encoding="utf-8", errors="replace", newline="") as f:
        for row in csv.DictReader(f, delimiter=";"):
            d = (row.get("date") or "")[:10]
            code = (row.get("itemCode") or "").strip()
            if not code or d < since or code.startswith(SKIP_CODE_PREFIXES):
                continue
            if (row.get("statusName") or "") in SKIP_STATUSES:
                continue
            base = code.split("/")[0]
            try:
                amount = int(float(row.get("itemAmount") or 1))
            except ValueError:
                amount = 1
            sales[base] += amount

    out = ROOT / "data" / "scores.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(dict(sales), ensure_ascii=False), encoding="utf-8")
    meta = ROOT / "data" / "scores-meta.json"
    meta.write_text(json.dumps({"window_from": since, "window_to": max_date,
                                "products": len(sales)}), encoding="utf-8")
    print(f"OK: {len(sales)} produktu -> {out}")


if __name__ == "__main__":
    main(sys.argv[1])
