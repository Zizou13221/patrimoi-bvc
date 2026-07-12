#!/usr/bin/env python3
"""
PatriMoi — Scraper BVC
Source 1 : Yahoo Finance API (symboles .CS) — fiable, non bloqué
Source 2 : lematin.ma (serveur-rendu)
Source 3 : medias24.com (par ISIN)
Fallback  : données précédentes (stale)

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

# ── Mapping ticker PatriMoi → symbole Yahoo Finance (.CS = Casablanca) ─────────
# Format Yahoo : TICKER.CS  (ex: IAM.CS, ATW.CS)
# Quelques tickers ont un nom différent sur Yahoo vs PatriMoi
YAHOO_SYMBOLS = {
    "ATW":  "ATW.CS",
    "BCP":  "BCP.CS",
    "CIH":  "CIH.CS",
    "BOA":  "BOA.CS",
    "CDM":  "CDM.CS",
    "BMCI": "BMCI.CS",
    "IAM":  "IAM.CS",
    "ATL":  "ATL.CS",
    "WAA":  "WAA.CS",
    "ADH":  "ADH.CS",
    "RDS":  "RDS.CS",
    "AFG":  "AFG.CS",
    "LHM":  "LHM.CS",
    "HPS":  "HPS.CS",
    "MNG":  "MNG.CS",
    "TMA":  "TMA.CS",
    "LBV":  "LBV.CS",
    "MUT":  "MUT.CS",
    "GTM":  "GTM.CS",
    "MSA":  "MSA.CS",
}

# ── Source 2 : medias24.com (fallback ISIN) ───────────────────────────────────
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

# ── Source 3 : lematin.ma ─────────────────────────────────────────────────────
LEMATIN_URL = "https://lematin.ma/bourse-de-casablanca"

HEADERS_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
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

SLUG_TO_TICKER = {
    "bce": "BOA",
    "bci": "BMCI",
    "gaz": "AFG",
}


# ── Source 1 : Yahoo Finance ──────────────────────────────────────────────────

def scrape_yahoo() -> dict:
    """
    Récupère les cours via l'API Yahoo Finance v7/finance/quote.
    Retourne { TICKER: { cours, variation } }
    """
    symbols = list(YAHOO_SYMBOLS.values())
    # Yahoo accepte jusqu'à ~50 symboles par requête
    url = "https://query1.finance.yahoo.com/v7/finance/quote"
    params = {
        "symbols":    ",".join(symbols),
        "fields":     "regularMarketPrice,regularMarketChangePercent",
        "formatted":  "false",
    }
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept":     "application/json",
    }

    resp = requests.get(url, params=params, headers=headers, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    quotes = data.get("quoteResponse", {}).get("result", [])
    if not quotes:
        raise ValueError("Yahoo Finance : réponse vide")

    # Inverser le mapping Yahoo → PatriMoi
    yahoo_to_patrimoi = {v: k for k, v in YAHOO_SYMBOLS.items()}
    cours = {}

    for q in quotes:
        symbol = q.get("symbol", "")
        ticker = yahoo_to_patrimoi.get(symbol)
        if not ticker:
            continue
        price = q.get("regularMarketPrice")
        change = q.get("regularMarketChangePercent", 0.0)
        if price and price > 0:
            cours[ticker] = {
                "cours":     round(float(price), 2),
                "variation": round(float(change), 2),
            }

    return cours


# ── Source 2 : lematin.ma ─────────────────────────────────────────────────────

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


def scrape_lematin() -> dict:
    resp = requests.get(LEMATIN_URL, headers=HEADERS_BROWSER, timeout=20)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    cours = {}
    for link in soup.find_all("a", href=re.compile(r"/societe-cote/")):
        href = link.get("href", "")
        m = re.search(r"/societe-cote/([a-z0-9]+)$", href)
        if not m:
            continue
        slug   = m.group(1).lower()
        ticker = SLUG_TO_TICKER.get(slug, slug.upper())
        text   = link.get_text(separator="\n", strip=True)
        prix   = parse_price(text)
        var    = parse_variation(text)
        if prix and prix > 0:
            cours[ticker] = {
                "cours":     round(prix, 2),
                "variation": round(var, 2) if var is not None else 0.0,
            }
    return cours


# ── Source 3 : medias24.com ───────────────────────────────────────────────────

def fetch_medias24(ticker: str, isin: str):
    today = datetime.date.today().isoformat()
    url   = (
        f"https://medias24.com/content/api"
        f"?method=getPriceHistory&ISIN={isin}"
        f"&format=json&from=2024-01-01&to={today}"
    )
    try:
        r    = requests.get(url, headers=HEADERS_API, timeout=12)
        r.raise_for_status()
        data = r.json()
        if not data or not isinstance(data, list):
            return None
        last = data[-1]
        return {
            "cours":     round(float(last.get("close", last.get("cloture", 0))), 2),
            "variation": 0.0,
        }
    except Exception:
        return None


def scrape_medias24() -> dict:
    cours = {}
    for ticker, isin in TICKERS_MEDIAS24.items():
        result = fetch_medias24(ticker, isin)
        if result:
            cours[ticker] = result
            print(f"   medias24 ✓ {ticker} = {result['cours']} MAD")
        else:
            print(f"   medias24 ✗ {ticker}", file=sys.stderr)
        time.sleep(0.4)
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


# ── Runner ────────────────────────────────────────────────────────────────────

def run(output_path: str = "bvc_cours.json") -> bool:
    print(f"⏱  Démarrage — {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    cours_precedents = charger_precedents(output_path)
    cours            = {}
    source_utilisee  = "aucune"

    # 1. Yahoo Finance
    print("→ Tentative Yahoo Finance …")
    try:
        cours = scrape_yahoo()
        if cours:
            source_utilisee = "yahoo-finance"
            print(f"✓ Yahoo Finance : {len(cours)} tickers")
            for t, d in sorted(cours.items()):
                signe = "+" if d["variation"] >= 0 else ""
                print(f"   {t:6s} {d['cours']:>10.2f} MAD  {signe}{d['variation']:.2f}%")
        else:
            print("✗ Yahoo Finance : aucun résultat")
    except Exception as e:
        print(f"✗ Yahoo Finance : {e}")

    # 2. lematin.ma
    if not cours:
        print("→ Tentative lematin.ma …")
        try:
            cours = scrape_lematin()
            if cours:
                source_utilisee = "lematin.ma"
                print(f"✓ lematin.ma : {len(cours)} tickers")
        except Exception as e:
            print(f"✗ lematin.ma : {e}")

    # 3. medias24.com
    if not cours:
        print("→ Tentative medias24.com …")
        cours = scrape_medias24()
        if cours:
            source_utilisee = "medias24.com"
            print(f"✓ medias24.com : {len(cours)} tickers")

    # Fallback stale
    if not cours:
        print("⚠ Fallback stale")
        cours           = {k: {**v, "stale": True} for k, v in cours_precedents.items()}
        source_utilisee = "stale"

    succes = len([v for v in cours.values() if not v.get("stale")])
    echecs = len(cours) - succes

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "source":  source_utilisee,
            "marche":  "BVC — Bourse des Valeurs de Casablanca",
            "succes":  succes,
            "echecs":  echecs,
            "cours":   cours,
        }, f, ensure_ascii=False, indent=2)

    print(f"\n✅  {succes} tickers frais → {output_path} (source: {source_utilisee})")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="bvc_cours.json")
    args = parser.parse_args()
    run(output_path=args.output)
    sys.exit(0)
