#!/usr/bin/env python3
"""
PatriMoi — Scraper prix de l'or
Sources (dans l'ordre) :
  1. 18k.ma             — prix DH/g direct (site marocain)
  2. goldprice.org API  — prix once troy en MAD, converti en DH/g (fallback)

Usage : python scripts/scrape_or.py [--output or_prix.json]
"""

import re
import json
import datetime
import argparse
import sys
import os

import requests
import cloudscraper

TROY_OZ_TO_GRAM = 31.1035   # 1 once troy = 31.1035 grammes

# ── Source 1 : 18k.ma (via cloudscraper — contourne Cloudflare) ──────────────

PATTERNS_18K = [
    re.compile(r'(?:24k?|gramme?)[^<\d]*?(\d{3,4}(?:[.,]\d{1,2})?)\s*(?:dh|mad|dirham)', re.IGNORECASE),
    re.compile(r'prix[^<\d]*?(\d{3,4}(?:[.,]\d{1,2})?)\s*(?:dh|mad)', re.IGNORECASE),
    re.compile(r'(\d{3,4}(?:[.,]\d{1,2})?)\s*(?:dh|mad)[^<]*?gram', re.IGNORECASE),
    re.compile(r'"price"[^\d]*?(\d{3,4}(?:[.,]\d{1,2})?)', re.IGNORECASE),
]


def scrape_18k_ma() -> float | None:
    """
    Scrape 18k.ma pour le prix de l'or 24k en DH/g.
    Utilise cloudscraper pour contourner la protection Cloudflare.
    """
    try:
        scraper = cloudscraper.create_scraper(
            browser={"browser": "chrome", "platform": "darwin", "mobile": False}
        )
        resp = scraper.get("https://www.18k.ma/prix-de-lor", timeout=20)
        resp.raise_for_status()
        html = resp.text
        for pat in PATTERNS_18K:
            for m in pat.finditer(html):
                raw = (m.group(1) or "").replace(" ", "").replace(",", ".")
                try:
                    val = float(raw)
                    if 300 <= val <= 1500:
                        print(f"   ✓ 18k.ma pattern trouvé : {val} DH/g")
                        return val
                except ValueError:
                    continue
        print("   ⚠ 18k.ma : aucun pattern ne correspond (HTML inattendu)", file=sys.stderr)
    except Exception as e:
        print(f"   ⚠ 18k.ma erreur : {e}", file=sys.stderr)
    return None


# ── Source 2 : goldprice.org API (fallback) ───────────────────────────────────

def scrape_goldprice_org() -> float | None:
    """
    goldprice.org API publique — retourne le prix de l'once troy en MAD.
    Converti en DH/gramme (÷ 31.1035).
    """
    try:
        resp = requests.get(
            "https://data-asg.goldprice.org/dbXRates/MAD",
            headers={
                "User-Agent": HEADERS_BROWSER["User-Agent"],
                "Referer": "https://goldprice.org/",
                "Accept": "application/json",
            },
            timeout=12,
        )
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items") or []
        if items:
            xau_mad = items[0].get("xauPrice")
            if xau_mad and float(xau_mad) > 0:
                prix_gramme = float(xau_mad) / TROY_OZ_TO_GRAM
                val = round(prix_gramme, 2)
                if 300 <= val <= 1500:
                    print(f"   ✓ goldprice.org : {float(xau_mad):.2f} MAD/oz → {val} DH/g")
                    return val
    except Exception as e:
        print(f"   ⚠ goldprice.org erreur : {e}", file=sys.stderr)
    return None


# ── Runner ────────────────────────────────────────────────────────────────────

def charger_precedent(output_path: str) -> dict | None:
    if os.path.exists(output_path):
        try:
            with open(output_path, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return None


def run(output_path: str = "or_prix.json") -> bool:
    print(f"⏱  Démarrage — {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Source 1 : 18k.ma
    print("→ Tentative 18k.ma …")
    prix = scrape_18k_ma()
    source = "18k.ma"

    # Source 2 : goldprice.org (fallback)
    if prix is None:
        print("→ Fallback goldprice.org …")
        prix = scrape_goldprice_org()
        source = "goldprice.org"

    if prix is None:
        precedent = charger_precedent(output_path)
        if precedent:
            print(f"⚠ Toutes sources échouées — fichier précédent conservé ({precedent.get('prixOr')} DH/g)")
            return True
        print("✗ Impossible de récupérer le prix de l'or (aucun fichier précédent).", file=sys.stderr)
        return False

    data = {
        "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source":  source,
        "unite":   "DH/gramme (or 24k)",
        "prixOr":  round(prix),
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅  Prix de l'or : {round(prix)} DH/g → {output_path} (source: {source})")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scraper prix de l'or")
    parser.add_argument("--output", default="or_prix.json")
    args = parser.parse_args()
    success = run(output_path=args.output)
    sys.exit(0 if success else 1)
