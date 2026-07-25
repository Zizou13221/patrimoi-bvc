# App Review Notes — PatriMoi

> To be pasted in the **Notes for App Review** field in App Store Connect.
> Keep under 4000 characters. English required.

---

## Paste-ready text (copy below this line)

---

**PatriMoi — Notes for App Review**

PatriMoi is a personal net worth tracker designed for Moroccan users. It supports 8 asset categories: real estate, bank accounts, savings accounts (carnets), Casablanca Stock Exchange (BVC) holdings, gold, foreign currencies, vehicles, and PEA/CTO portfolios.

---

**DEMO MODE — No account required to review the full app**

The app includes a built-in Demo Mode that pre-loads realistic sample data across all asset categories. No account creation is needed to evaluate all core features.

To access Demo Mode:
1. Launch the app and complete the short onboarding (swipe through 3 screens).
2. On the login screen, tap **"Mode Démo"** (bottom of the screen).
3. All features are immediately available with sample data.

---

**TEST ACCOUNT (optional — for reviewing sync and cloud features)**

If you prefer to test with a real account:

- Email: `review@patrimoi.ma`
- Password: `AppReview2026!`

> Note: This account contains sample data only. All financial figures shown are fictional.

---

**Key features to review**

- **Dashboard** (tab "DBD"): Total net worth, asset breakdown chart, gold price and BVC market data pulled live.
- **Assets** (tab "ACT"): Detailed view of each asset category. Tap any category to expand.
- **Conseils** (tab "CNS"): Personalized financial tips based on portfolio composition.
- **Params** (tab "PRM"): PIN lock setup, discrete mode (hides financial values on screen), account management.

---

**Network requests**

- Live gold price fetched from a public API (no API key, no user data sent).
- BVC market data fetched from Bank Al-Maghrib's public endpoint.
- User portfolio data synced to Supabase (authenticated, TLS 1.2+).
- Crash reports sent to Sentry (anonymized, no financial data included).

---

**No special hardware or permissions required**

The app does not request access to camera, microphone, contacts, location, or photos. No background modes are used.

---

**Language**

The app is in French. This is intentional — the target market is French-speaking Moroccan users. All UI strings, financial terms, and onboarding screens are in French.

---

**Subscription (PatriMoi+)**

PatriMoi+ (49 MAD/month) unlocks advanced features. In Demo Mode and with the test account, all PatriMoi+ features are enabled for review purposes.

---
*(end of review notes)*

---

## Checklist avant soumission

- [ ] Remplacer `review@patrimoi.ma` par le vrai compte de test créé dans Supabase
- [ ] Vérifier que le compte de test a le plan `plus` activé
- [ ] Confirmer que le Mode Démo est accessible sans compte Apple Review n'ayant pas de compte Moroccan phone number
- [ ] URL de politique de confidentialité hébergée et accessible : `https://patrimoi.ma/privacy`
- [ ] Support URL : `https://patrimoi.ma/support` (ou email)
- [ ] Screenshots 6.7" et 5.5" préparés (Xcode Simulator ou device)
- [ ] App icon 1024×1024 sans alpha, sans coins arrondis
