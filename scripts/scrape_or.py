#!/usr/bin/env python3
"""
PatriMoi — Scraper prix de l'or (18k.ma)
Sauvegarde or_prix.json avec le cours du gramme d'or 24k en DH.

Usage : python scripts/scrape_or.py [--output or_prix.json]
"""

import re
import json
import datetime
import argparse
import sys
import os

import requests

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9",
}

# Patterns regex pour extraire le prix en DH/g (plage attendue : 300–1500 DH)
PATTERNS = [
    re.compile(r'(?:24k?|gramme?)[^<\d]*?(\d{3,4}(?:[.,]\d{1,2})?)\s*(?:dh|mad|dirham)', re.IGNORECASE),
    re.compile(r'prix[^<\d]*?(\d{3,4}(?:[.,]\d{1,2})?)\s*(?:dh|mad)', re.IGNORECASE),
    re.compile(r'(\d{3,4}(?:[.,]\d{1,2})?)\s*(?:dh|mad)[^<]*?gram', re.IGNORECASE),
    re.compile(r'"price"[^\d]*?(\d{3,4}(?:[.,]\d{1,2})?)', re.IGNORECASE),
]

OR_URL = "https://www.18k.ma/prix-de-lor"


def scrape_18k_ma() -> float | None:
    """
    Scrape https://www.18k.ma/prix-de-lor et retourne le prix de l'or 24k en DH/g.
    Retourne None si le scraping échoue.
    """
    try:
        resp = requests.get(OR_URL, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        html = resp.text
        for pat in PATTERNS:
            for m in pat.finditer(html):
                raw = (m.group(1) or "").replace(" ", "").replace(",", ".")
                try:
                    val = float(raw)
                    if 300 <= val <= 1500:
                        print(f"   ✓ pattern trouvé : {val} DH/g")
                        return val
                except ValueError:
                    continue
    except requests.RequestException as e:
        print(f"⚠ 18k.ma erreur réseau : {e}", file=sys.stderr)
    except Exception as e:
        print(f"⚠ 18k.ma erreur inattendue : {e}", file=sys.stderr)
    return None


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
    print(f"→ Scraping {OR_URL} …")

    prix = scrape_18k_ma()

    if prix is None:
        # Conserver le fichier précédent si disponible
        precedent = charger_precedent(output_path)
        if precedent:
            print(f"⚠ 18k.ma indisponible — fichier précédent conservé ({precedent.get('prixOr')} DH/g)")
            return True
        print("✗ Impossible de récupérer le prix de l'or et aucun fichier précédent.", file=sys.stderr)
        return False

    data = {
        "updated":  datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source":   "18k.ma",
        "unite":    "DH/gramme (or 24k)",
        "prixOr":   round(prix),
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅  Prix de l'or : {round(prix)} DH/g → {output_path}")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scraper prix de l'or depuis 18k.ma")
    parser.add_argument("--output", default="or_prix.json", help="Fichier JSON de sortie")
    args = parser.parse_args()
    success = run(output_path=args.output)
    sys.exit(0 if success else 1)
