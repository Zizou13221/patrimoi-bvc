#!/usr/bin/env python3
"""
PatriMoi — Scraper BVC
Source 1 (priorité) : lematin.ma  — 1 requête, tous les tickers
Source 2 (fallback)  : medias24.com API — par ticker via ISIN

Usage : python scripts/scrape_lematin.py [--output bvc_cours.json]
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

# ── Source 1 : lematin.ma ─────────────────────────────────────────────────────
LEMATIN_URL = "https://lematin.ma/bourse-de-casablanca"

# ── Source 2 : medias24.com (fallback) ────────────────────────────────────────
TICKERS_MEDIAS24 = {
    "ATW":  "MA0000011885",
    "BCP":  "MA0000011884",
    "CIH":  "MA0000011899",
    "BOA":  "MA0000011895",
    "CDM":  "MA0000011893",
    "BMCI": "MA0000011890",
    "IAM":  "MA0000011880",
    "ATL":  "MA0000011902",
    "WAA":  "MA0000011909",
    "ADH":  "MA0000011922",
    "ALM":  "MA0000011924",
    "RDS":  "MA0000011920",
    "AFG":  "MA0000011887",
    "LHM":  "MA0000011930",
    "HPS":  "MA0000011910",
    "MNG":  "MA0000011935",
    "MSA":  "MA0000011928",
    "TMA":  "MA0000011926",
    "LBV":  "MA0000011919",
    "MUT":  "MA0000011914",
}

HEADERS_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://lematin.ma/",
}

HEADERS_API = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://medias24.com/bourse/",
}

# Corrections slug URL → ticker PatriMoi
SLUG_TO_TICKER = {
    "bce": "BOA",
    "bci": "BMCI",
    "gaz": "AFG",
}


# ── Helpers parsing ───────────────────────────────────────────────────────────

def parse_price(text: str):
    m = re.search(r"([\d]+(?:[.][\d]+)?),\d+\s*MAD", text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def parse_variation(text: str):
    m = re.search(r"([+-]?\d+(?:[.,]\d+)?)\s*%", text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", "."))
    except ValueError:
        return None


# ── Source 1 : lematin.ma ─────────────────────────────────────────────────────

def scrape_lematin() -> dict:
    """
    Retourne { TICKER: { cours, variation } } depuis lematin.ma.
    Lève une exception si la page est inaccessible.
    """
    resp = requests.get(LEMATIN_URL, headers=HEADERS_BROWSER, timeout=20)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    cours = {}

    links = soup.find_all(
        "a",
        href=re.compile(r"/bourse-de-casablanca/societe-cote/")
    )

    for link in links:
        href = link.get("href", "")
        m = re.search(r"/societe-cote/([a-z0-9]+)$", href)
        if not m:
            continue
        slug   = m.group(1).lower()
        ticker = SLUG_TO_TICKER.get(slug, slug.upper())
        text   = link.get_text(separator="\n", strip=True)
        prix   = parse_price(text)
        var    = parse_variation(text)

        if prix is None or prix == 0:
            continue

        cours[ticker] = {
            "cours":     round(prix, 2),
            "variation": round(var, 2) if var is not None else 0.0,
        }

    return cours


# ── Source 2 : medias24.com ───────────────────────────────────────────────────

def fetch_medias24(ticker: str, isin: str) -> dict | None:
    today      = datetime.date.today().isoformat()
    url = (
        f"https://medias24.com/content/api"
        f"?method=getPriceHistory&ISIN={isin}"
        f"&format=json&from=2024-01-01&to={today}"
    )
    try:
        r = requests.get(url, headers=HEADERS_API, timeout=12)
        r.raise_for_status()
        data = r.json()
        if not data or not isinstance(data, list) or len(data) == 0:
            return None
        last = data[-1]
        return {
            "cours":     round(float(last.get("close", last.get("cloture", 0))), 2),
            "variation": 0.0,
        }
    except Exception:
        return None


def scrape_medias24(tickers: dict, pause: float = 0.4) -> dict:
    """Récupère les tickers manquants via medias24.com."""
    cours = {}
    for ticker, isin in tickers.items():
        result = fetch_medias24(ticker, isin)
        if result:
            cours[ticker] = result
            print(f"   medias24 ✓ {ticker} = {result['cours']} MAD")
        else:
            print(f"   medias24 ✗ {ticker}", file=sys.stderr)
        time.sleep(pause)
    return cours


# ── Fallback local ────────────────────────────────────────────────────────────

def charger_precedents(output_path: str) -> dict:
    if os.path.exists(output_path):
        try:
            with open(output_path, encoding="utf-8") as f:
                return json.load(f).get("cours", {})
        except Exception:
            pass
    return {}


# ── Runner principal ──────────────────────────────────────────────────────────

def run(output_path: str = "bvc_cours.json") -> bool:
    print(f"⏱  Démarrage — {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    cours_precedents = charger_precedents(output_path)
    cours            = {}
    source_utilisee  = "aucune"

    # ── Tentative 1 : lematin.ma ──────────────────────────────────────────────
    print("→ Tentative lematin.ma …")
    try:
        cours = scrape_lematin()
        if cours:
            source_utilisee = "lematin.ma"
            print(f"✓ lematin.ma : {len(cours)} tickers extraits")
        else:
            print("✗ lematin.ma : page vide ou format inattendu")
    except Exception as e:
        print(f"✗ lematin.ma : {e}")

    # ── Tentative 2 : medias24.com (si lematin a échoué) ─────────────────────
    if not cours:
        print("→ Tentative medias24.com …")
        cours = scrape_medias24(TICKERS_MEDIAS24, pause=0.4)
        if cours:
            source_utilisee = "medias24.com"
            print(f"✓ medias24.com : {len(cours)} tickers extraits")
        else:
            print("✗ medias24.com : aucune donnée")

    # ── Fallback : données précédentes (stale) ────────────────────────────────
    if not cours:
        print("⚠ Fallback : conservation des données précédentes (stale)")
        cours = {
            k: {**v, "stale": True}
            for k, v in cours_precedents.items()
        }
        source_utilisee = "stale"

    succes = len([v for v in cours.values() if not v.get("stale")])
    echecs = len(cours) - succes

    output = {
        "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source":  source_utilisee,
        "marche":  "BVC — Bourse des Valeurs de Casablanca",
        "succes":  succes,
        "echecs":  echecs,
        "cours":   cours,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✅  {succes} tickers frais, {echecs} stale → {output_path}")
    # Retourne True même en mode stale (le JSON est valide, juste pas frais)
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scraper BVC (lematin + medias24 fallback)")
    parser.add_argument("--output", default="bvc_cours.json")
    args = parser.parse_args()
    ok = run(output_path=args.output)
    sys.exit(0 if ok else 1)
