#!/usr/bin/env python3
"""
PatriMoi — Scraper BVC via lematin.ma
Source : page /bourse-de-casablanca (données serveur-rendues, 1 seule requête)

Output : bvc_cours.json
Usage  : python scripts/scrape_lematin.py [--output bvc_cours.json]
"""

import re
import json
import datetime
import argparse
import sys
import os
import time

import requests
from bs4 import BeautifulSoup

# ── URL source ───────────────────────────────────────────────────────────────
LEMATIN_URL = "https://lematin.ma/bourse-de-casablanca"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://lematin.ma/",
}

# ── Corrections ticker ────────────────────────────────────────────────────────
# Certains slugs lematin.ma ≠ ticker officiel BVC utilisé dans PatriMoi.
# Format : slug_url → ticker_patrimoi
SLUG_TO_TICKER = {
    "bce": "BOA",   # Bank of Africa (ticker BVC = BCE, PatriMoi utilise BOA)
    "bci": "BMCI",  # BMCI (ticker BVC = BCI, PatriMoi utilise BMCI)
    "gaz": "AFG",   # Afriquia Gaz (ticker BVC = GAZ, PatriMoi utilise AFG)
    "msa": "MSA",   # Marsa Maroc (garder)
    "gtm": "GTM",   # SGTM — Société Générale des Travaux du Maroc
}

# ── Parsing ───────────────────────────────────────────────────────────────────

def parse_price(text: str) -> float | None:
    """
    Extrait le cours depuis le texte d'un lien lematin.
    Format : 'NOM SOCIETE \n 253.15,00 MAD \n 0.46 %'
    Ici '253.15' est le prix avec '.' comme séparateur décimal, ',00' = centimes.
    """
    m = re.search(r"([\d]+(?:[.][\d]+)?),\d+\s*MAD", text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def parse_variation(text: str) -> float | None:
    """Extrait la variation % depuis le texte."""
    m = re.search(r"([+-]?\d+(?:[.,]\d+)?)\s*%", text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", "."))
    except ValueError:
        return None


def charger_precedents(output_path: str) -> dict:
    """Charge le JSON existant pour fallback si scraping échoue."""
    if os.path.exists(output_path):
        try:
            with open(output_path, encoding="utf-8") as f:
                return json.load(f).get("cours", {})
        except Exception:
            pass
    return {}


# ── Scraper principal ─────────────────────────────────────────────────────────

def scrape_lematin() -> dict:
    """
    Scrape tous les cours BVC depuis lematin.ma/bourse-de-casablanca.
    Retourne un dict { TICKER: { cours, variation } }
    """
    resp = requests.get(LEMATIN_URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    cours = {}

    # Les cours sont dans des liens href=/bourse-de-casablanca/societe-cote/{slug}
    links = soup.find_all(
        "a",
        href=re.compile(r"/bourse-de-casablanca/societe-cote/")
    )

    for link in links:
        href = link.get("href", "")
        # Extraire le slug depuis l'URL
        m = re.search(r"/societe-cote/([a-z0-9]+)$", href)
        if not m:
            continue

        slug = m.group(1).lower()
        ticker = SLUG_TO_TICKER.get(slug, slug.upper())

        text = link.get_text(separator="\n", strip=True)
        prix = parse_price(text)
        variation = parse_variation(text)

        if prix is None or prix == 0:
            continue  # ignorer les lignes sans prix (SANLAM, CMT suspendues)

        cours[ticker] = {
            "cours":     round(prix, 2),
            "variation": round(variation, 2) if variation is not None else 0.0,
        }

    return cours


# ── Runner ────────────────────────────────────────────────────────────────────

def run(output_path: str = "bvc_cours.json") -> bool:
    print(f"⏱  Démarrage — {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Source : {LEMATIN_URL}")

    cours_precedents = charger_precedents(output_path)

    try:
        cours = scrape_lematin()
    except requests.exceptions.RequestException as e:
        print(f"✗ Erreur réseau : {e}", file=sys.stderr)
        cours = {}

    if not cours:
        print("✗ Aucune donnée extraite — conservation du JSON précédent", file=sys.stderr)
        if not cours_precedents:
            return False
        # Marquer les données comme stale
        cours = {
            k: {**v, "stale": True}
            for k, v in cours_precedents.items()
        }
        succes, echecs = 0, len(cours)
    else:
        succes = len(cours)
        echecs = 0
        print(f"✓ {succes} tickers extraits")
        for ticker, d in sorted(cours.items()):
            signe = "+" if d["variation"] >= 0 else ""
            print(f"   {ticker:6s} {d['cours']:>10.2f} MAD  {signe}{d['variation']:.2f}%")

    output = {
        "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source":  "lematin.ma",
        "marche":  "BVC — Bourse des Valeurs de Casablanca",
        "succes":  succes,
        "echecs":  echecs,
        "cours":   cours,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✅  {succes} tickers → {output_path}")
    return succes > 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scraper BVC via lematin.ma")
    parser.add_argument(
        "--output", default="bvc_cours.json",
        help="Chemin du JSON de sortie (défaut: bvc_cours.json)"
    )
    args = parser.parse_args()
    ok = run(output_path=args.output)
    sys.exit(0 if ok else 1)
