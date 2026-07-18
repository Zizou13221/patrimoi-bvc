#!/usr/bin/env python3
"""
PatriMoi — Scraper BVC
Source 1 : TradingView scanner (endpoint JSON non-auth, tous les tickers BVC)
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

# ── Liste complète des 80 valeurs cotées à la BVC (codes officiels) ──────────
# Source : african-markets.com/fr/bourse/bvc + TradingView scanner morocco
# Format : CODE_BVC = "Nom complet"
#
# Banques & Finance
# ATW  = Attijariwafa Bank       BCP  = Banque Centrale Populaire
# CIH  = CIH Bank                BOA  = Bank of Africa (BMCE)
# BCI  = BMCI Bank               CDM  = Crédit du Maroc
# CFG  = CFG Bank                EQD  = Eqdom
# MAB  = Maghrebail              MLE  = Maroc Leasing
# SLF  = Salafin                 SAHM = Sanlam Maroc
# DIS  = Diac Salaf              BAL  = Balima
# WAA  = Wafa Assurance          IMO  = Immorente Invest
# ARD  = Aradei Capital          AFM  = AFMA
# AGM  = AGMA                    ADI  = Alliances
# Immobilier
# ADH  = Douja Prom Addoha       RDS  = Résidences Dar Saada
# RIS  = Risma
# Télécoms & Tech
# IAM  = Maroc Telecom           HPS  = HPS
# M2M  = M2M Group               IBMC = IB Maroc.Com
# INV  = Involys                 MIC  = Microdata
# S2M  = S.M Monétique           DWAY = Disway
# DYT  = Disty Technologies      VCN  = Vicenne
# CAP  = Cash Plus
# Industrie & BTP
# TGC  = TGCC                    JET  = Jet Contractors
# ALM  = Aluminium du Maroc      DHO  = Delta Holding
# DLM  = Delattre Levivier Maroc SNA  = Stokvis Nord Afrique
# STR  = Stroc Industrie         SRM  = Réalisations Mécaniques
# AFI  = Afric Industries        GTM  = GTM (BTP)
# Mines & Matières premières
# MNG  = Managem                 SMI  = Société Métallurgique d'Imiter
# CMT  = Compagnie Minière de Touissit
# SNP  = SNEP                    SID  = Sonasid
# MOX  = Maghreb Oxygene         ZDJ  = Zellidja
# REB  = Rebab Company           COL  = Colorado
# Ciment & Construction
# LHM  = LafargeHolcim Maroc     CMA  = Ciments du Maroc
# HOL  = Holcim Maroc
# Pétrole & Gaz
# GAZ  = Afriquia Gaz            TMA  = TotalEnergies Maroc
# SAM  = Samir                   TQM  = Taqa Morocco
# Distribution & Consommation
# LBV  = Label Vie               MUT  = Mutandis
# CSR  = Cosumar                 LES  = Lesieur Cristal
# OUL  = Oulmes                  UMR  = Unimer
# SBM  = Société des Boissons du Maroc
# CTM  = CTM                     ATH  = Auto Hall
# NEJ  = Auto Nejma              DARI = Dari Couspate
# CRS  = Cartier Saada           CMG  = CMGP Group
# Santé
# AKT  = Akdital                 PRO  = Promopharm
# SOT  = Sothema
# Transport & Ports
# MSA  = Marsa Maroc
# Agroalimentaire
# MDP  = Med Paper
# Autres
# FBR  = Fenie Brossette         NAKL = Ennakl

PATRIMOI_TICKERS = {
    # Banques & Finance
    "ATW", "BCP", "CIH", "BOA", "BCI", "CDM", "CFG", "EQD",
    "MAB", "MLE", "SLF", "SAHM", "DIS", "BAL", "WAA", "IMO",
    "ARD", "AFM", "AGM", "ADI",
    # Assurances
    "ATL",  # AtlantaSanad
    # Immobilier
    "ADH", "RDS", "RIS",
    # Télécoms & Tech
    "IAM", "HPS", "M2M", "IBMC", "INV", "MIC", "S2M", "DWAY",
    "DYT", "VCN", "CAP",
    # Industrie & BTP
    "TGC", "JET", "ALM", "DHO", "DLM", "SNA", "STR", "SRM",
    "AFI", "GTM",
    # Mines & Matières premières
    "MNG", "SMI", "CMT", "SNP", "SID", "MOX", "ZDJ", "REB", "COL",
    # Ciment
    "LHM", "CMA", "HOL",
    # Pétrole & Gaz
    "GAZ", "TMA", "SAM", "TQM",
    # Distribution & Consommation
    "LBV", "MUT", "CSR", "LES", "OUL", "UMR", "SBM",
    "CTM", "ATH", "NEJ", "DARI", "CRS", "CMG",
    # Santé
    "AKT", "PRO", "SOT",
    # Transport & Ports
    "MSA",
    # Autres
    "MDP", "FBR", "NAKL",
    # Services
    "T2S",   # Trans2S Holding
}

# ── Alias TradingView → code BVC (TradingView tronque certains tickers) ───────
TV_TO_PATRIMOI = {
    "DRI":  "DARI",   # Dari Couspate   : TV=DRI  → BVC=DARI
    "DWY":  "DWAY",   # Disway          : TV=DWY  → BVC=DWAY
    "IBC":  "IBMC",   # IB Maroc.Com    : TV=IBC  → BVC=IBMC
    "NKL":  "NAKL",   # Ennakl          : TV=NKL  → BVC=NAKL
    "SAH":  "SAHM",   # Sanlam Maroc    : TV=SAH  → BVC=SAHM
    # DIS (Diac Salaf) et DLM (Delattre Levivier) : code TV = code BVC → pas d'alias
    # HOL (Holcim), SAM (Samir) : suspendus / peu liquides, absents du scanner TV
}

# ── Alias de compatibilité (anciens codes app → codes BVC officiels) ──────────
# Certains tickers dans l'app utilisent des codes non-BVC hérités
# On duplique la valeur dans le JSON pour les deux codes
PATRIMOI_ALIASES = {
    "AFG":  "GAZ",   # Afriquia Gaz : app=AFG → BVC=GAZ
    "BMCI": "BCI",   # BMCI Bank    : app=BMCI → BVC=BCI
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


# ── Source 1 : TradingView scanner ────────────────────────────────────────────

TV_SCANNER_URL = "https://scanner.tradingview.com/morocco/scan"

TV_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Content-Type":  "application/json",
    "Origin":        "https://www.tradingview.com",
    "Referer":       "https://www.tradingview.com/",
    "Accept":        "application/json",
}

TV_PAYLOAD = {
    "columns": ["name", "close", "change"],   # name=ticker, close=cours, change=variation%
    "range":   [0, 150],                       # max 150 titres BVC
    "sort":    {"sortBy": "name", "sortOrder": "asc"},
}


def scrape_tradingview() -> dict:
    """
    POST https://scanner.tradingview.com/morocco/scan
    Retourne { TICKER: { cours, variation } } pour tous les tickers PatriMoi trouvés.
    """
    resp = requests.post(TV_SCANNER_URL, json=TV_PAYLOAD, headers=TV_HEADERS, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    rows = data.get("data", [])
    if not rows:
        # Debug : afficher la réponse brute pour diagnostiquer
        print(f"   DEBUG réponse TV : {json.dumps(data)[:300]}", file=sys.stderr)
        raise ValueError("TradingView scanner : réponse vide")

    cours = {}
    unmatched = []
    for row in rows:
        # row["s"] = "XCAS:ATW"  ou  "CSE:IAM"  etc.
        # row["d"] = [name, close, change]
        symbol_full = row.get("s", "")
        values      = row.get("d", [])
        if len(values) < 3:
            continue
        ticker = symbol_full.split(":")[-1].upper()
        # Appliquer les alias éventuels
        ticker_mapped = TV_TO_PATRIMOI.get(ticker, ticker)
        if ticker_mapped not in PATRIMOI_TICKERS:
            unmatched.append(ticker)
            continue
        price     = values[1]
        variation = values[2] or 0.0
        if price and float(price) > 0:
            cours[ticker_mapped] = {
                "cours":   round(float(price), 2),
                "var_pct": round(float(variation), 2),
            }
            print(f"   tv ✓ {ticker_mapped} = {price:.2f} MAD  ({variation:+.2f}%)")

    manquants = PATRIMOI_TICKERS - set(cours.keys())
    if manquants:
        print(f"   ⚠ Tickers PatriMoi non trouvés sur TV : {sorted(manquants)}", file=sys.stderr)
        print(f"   ℹ Symboles TV non reconnus (extrait) : {sorted(unmatched)[:30]}", file=sys.stderr)

    if not cours:
        raise ValueError("TradingView scanner : aucun ticker PatriMoi trouvé")

    return cours


# ── MASI — indice général BVC ─────────────────────────────────────────────────
# L'indice MASI n'est pas un ticker BVC ordinaire → pas dans le scanner Morocco.
# On l'interroge directement via le scanner global TradingView (XCAS:MASI).

def fetch_masi() -> dict | None:
    """
    Récupère l'indice MASI via TradingView scanner global.
    Retourne { cours, var_pct } ou None si indisponible.
    """
    endpoints = [
        # Scanner global — le plus fiable pour les indices
        "https://scanner.tradingview.com/global/scan",
        # Fallback : scanner Morocco avec ticker explicite
        "https://scanner.tradingview.com/morocco/scan",
    ]
    payload = {
        "symbols": {"tickers": ["XCAS:MASI"]},
        "columns": ["close", "change"],
    }
    for url in endpoints:
        try:
            resp = requests.post(url, json=payload, headers=TV_HEADERS, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("data") or []
            if items:
                values = items[0].get("d", [])
                if len(values) >= 2 and values[0] and float(values[0]) > 0:
                    return {
                        "cours":   round(float(values[0]), 2),
                        "var_pct": round(float(values[1] or 0), 2),
                    }
        except Exception as e:
            print(f"   ⚠ MASI {url.split('/')[-2]} erreur : {e}", file=sys.stderr)
            continue
    return None


# ── Tickers non retournés par le scanner Morocco (lookup direct) ──────────────
# Certains tickers BVC (peu liquides, récemment introduits, etc.) n'apparaissent
# pas dans le scanner Morocco générique. On les interroge un par un.

DIRECT_TV_LOOKUPS = {
    "T2S": "XCAS:T2S",   # Trans2S Holding — absent du scanner Morocco
}


def fetch_direct_tv(tv_symbol: str) -> dict | None:
    """Fetch un ticker spécifique via le scanner global TradingView."""
    try:
        payload = {
            "symbols": {"tickers": [tv_symbol]},
            "columns": ["close", "change"],
        }
        resp = requests.post(
            "https://scanner.tradingview.com/global/scan",
            json=payload,
            headers=TV_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        items = data.get("data") or []
        if items:
            values = items[0].get("d", [])
            if len(values) >= 2 and values[0] and float(values[0]) > 0:
                return {
                    "cours":   round(float(values[0]), 2),
                    "var_pct": round(float(values[1] or 0), 2),
                }
    except Exception as e:
        print(f"   ⚠ Direct TV {tv_symbol} erreur : {e}", file=sys.stderr)
    return None


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
                "cours":   round(prix, 2),
                "var_pct": round(var, 2) if var is not None else 0.0,
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
            cours[ticker] = {"cours": result["cours"], "var_pct": result.get("variation", 0.0)}
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

    # 1. TradingView scanner
    print("→ Tentative TradingView scanner …")
    try:
        cours = scrape_tradingview()
        if cours:
            source_utilisee = "tradingview"
            print(f"✓ TradingView : {len(cours)} tickers")
        else:
            print("✗ TradingView : aucun résultat")
    except Exception as e:
        print(f"✗ TradingView : {e}")

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

    # Fallback stale — si un fichier frais existe déjà, on NE l'écrase PAS
    if not cours:
        if cours_precedents:
            print("⚠ Toutes les sources ont échoué — fichier existant conservé (aucune écriture)")
            return True
        print("⚠ Fallback stale (aucun fichier précédent)")
        cours           = {k: {**v, "stale": True} for k, v in cours_precedents.items()}
        source_utilisee = "stale"

    # Fetch direct pour les tickers absents du scanner Morocco (ex: T2S)
    for ticker, tv_symbol in DIRECT_TV_LOOKUPS.items():
        if ticker not in cours:
            print(f"→ Fetch direct {ticker} ({tv_symbol}) …")
            result = fetch_direct_tv(tv_symbol)
            if result:
                cours[ticker] = result
                print(f"   ✓ {ticker} = {result['cours']} MAD ({result['var_pct']:+.2f}%)")
            else:
                print(f"   ⚠ {ticker} non disponible", file=sys.stderr)

    # Fetch MASI séparément (indice global, pas un ticker BVC standard)
    print("→ Fetch MASI …")
    masi = fetch_masi()
    if masi:
        cours["MASI"] = masi
        print(f"   ✓ MASI = {masi['cours']} ({masi['var_pct']:+.2f}%)")
    else:
        print("   ⚠ MASI non disponible", file=sys.stderr)

    # Aliases de compatibilité (ex : GAZ → aussi AFG pour anciens utilisateurs)
    for alias, real in PATRIMOI_ALIASES.items():
        if real in cours and alias not in cours:
            cours[alias] = cours[real]

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
