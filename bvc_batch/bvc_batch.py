"""
bvc_batch.py — Scraper BVC via medias24.com
Tournez via GitHub Actions 2x/jour : 09h30 et 16h00 (heure Maroc)

Usage : python bvc_batch.py [--output chemin/bvc_cours.json]
"""

import requests
import json
import datetime
import argparse
import sys
import os
import time

# ---------------------------------------------------------------------------
# Registre des actions BVC : ticker -> ISIN
# Ajoutez/retirez des tickers ici selon votre portefeuille
# ---------------------------------------------------------------------------
TICKERS = {
    # Banques
    "ATW":  "MA0000011885",  # Attijariwafa Bank
    "BCP":  "MA0000011884",  # Banque Centrale Populaire
    "CIH":  "MA0000011899",  # CIH Bank
    "BOA":  "MA0000011895",  # Bank of Africa
    "CDM":  "MA0000011893",  # Crédit du Maroc
    "BMCI": "MA0000011890",  # BMCI
    # Télécoms
    "IAM":  "MA0000011880",  # Maroc Telecom
    # Assurances
    "ATL":  "MA0000011902",  # Atlantasanad
    "WAA":  "MA0000011909",  # Wafa Assurance
    # Immobilier
    "ADH":  "MA0000011922",  # Addoha
    "ALM":  "MA0000011924",  # Alliances
    "RDS":  "MA0000011920",  # Résidences Dar Saada
    # Energie & Matières premières
    "AFG":  "MA0000011887",  # Afriquia Gaz
    "LHM":  "MA0000011930",  # Lesieur Cristal
    # Industrie
    "HPS":  "MA0000011910",  # Hightech Payment Systems
    "MNG":  "MA0000011935",  # Managem
    "MSA":  "MA0000011928",  # Maghreb Steel (Aluminium Maroc)
    # Divers
    "TMA":  "MA0000011926",  # Total Maroc
    "LBV":  "MA0000011919",  # Label Vie
    "MUT":  "MA0000011914",  # Mutandis
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://medias24.com/bourse/",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def fetch_cours_ticker(ticker: str, isin: str, annee_debut: int = 2024) -> dict | None:
    """
    Récupère le dernier cours connu pour un ticker via l'API medias24.
    Retourne None en cas d'échec.
    """
    today = datetime.date.today().isoformat()
    date_debut = f"{annee_debut}-01-01"
    url = (
        f"https://medias24.com/content/api"
        f"?method=getPriceHistory"
        f"&ISIN={isin}"
        f"&format=json"
        f"&from={date_debut}"
        f"&to={today}"
    )

    try:
        r = SESSION.get(url, timeout=12)
        r.raise_for_status()
        data = r.json()

        if not data or not isinstance(data, list) or len(data) == 0:
            return None

        # Le dernier élément = séance la plus récente
        last = data[-1]
        return {
            "cours":    round(float(last.get("close", last.get("cloture", 0))), 2),
            "ouverture": round(float(last.get("open",  last.get("ouverture", 0))), 2),
            "haut":     round(float(last.get("high",  last.get("haut", 0))), 2),
            "bas":      round(float(last.get("low",   last.get("bas", 0))), 2),
            "volume":   int(last.get("volume", 0)),
            "date":     last.get("date", today),
            "isin":     isin,
        }

    except requests.exceptions.RequestException as e:
        print(f"  ✗ {ticker} — réseau: {e}", file=sys.stderr)
        return None
    except (KeyError, ValueError, TypeError) as e:
        print(f"  ✗ {ticker} — parsing: {e}", file=sys.stderr)
        return None


def charger_derniere_version(output_path: str) -> dict:
    """Charge le JSON existant pour conserver les derniers cours en cas d'échec."""
    if os.path.exists(output_path):
        try:
            with open(output_path) as f:
                return json.load(f).get("cours", {})
        except Exception:
            pass
    return {}


def run(output_path: str = "bvc_cours.json", pause: float = 0.4):
    print(f"⏱  Démarrage — {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    cours_precedents = charger_derniere_version(output_path)
    resultats = {}
    succes, echecs = 0, 0

    for ticker, isin in TICKERS.items():
        print(f"  → {ticker} ({isin})", end="  ", flush=True)
        data = fetch_cours_ticker(ticker, isin)

        if data:
            resultats[ticker] = data
            print(f"{data['cours']} DH  ({data['date']})")
            succes += 1
        else:
            # Fallback : on garde le dernier cours connu
            if ticker in cours_precedents:
                resultats[ticker] = {**cours_precedents[ticker], "stale": True}
                print(f"[stale] {cours_precedents[ticker]['cours']} DH")
            else:
                print("[aucune donnée]")
            echecs += 1

        time.sleep(pause)  # poli avec le serveur

    # Métadonnées
    output = {
        "updated":  datetime.datetime.utcnow().isoformat() + "Z",
        "source":   "medias24.com",
        "marche":   "BVC — Bourse des Valeurs de Casablanca",
        "succes":   succes,
        "echecs":   echecs,
        "cours":    resultats,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✅  {succes}/{succes + echecs} tickers mis à jour → {output_path}")
    return echecs == 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch scraper BVC")
    parser.add_argument(
        "--output", default="bvc_cours.json",
        help="Chemin du fichier JSON de sortie (défaut: bvc_cours.json)"
    )
    parser.add_argument(
        "--pause", type=float, default=0.4,
        help="Délai entre chaque requête en secondes (défaut: 0.4)"
    )
    args = parser.parse_args()
    ok = run(output_path=args.output, pause=args.pause)
    sys.exit(0 if ok else 1)
