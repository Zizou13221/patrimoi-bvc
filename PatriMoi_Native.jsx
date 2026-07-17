/**
 * PatriMoi — React Native (iOS / Android)
 * Compatible Xcode  |  Version 1.5
 *
 * Architecture multi-fichiers :
 *   src/constants/   → colors.js, data.js
 *   src/utils/       → calc.js, fmt.js, api.js, conseils.js, supabase.js, auth.js
 *   src/components/  → ErrorBoundary.jsx, shared.jsx
 *   src/pages/       → PageOnboarding, PageAuth, PageProverbe, PageDashboard,
 *                       PageActifs, PageConseils, PageAPropos, PageParams
 *
 * Backend : Supabase (auth + sync données)
 *   → voir backend/supabase/schema.sql pour la mise en place
 *   → configurer SUPABASE_URL et SUPABASE_ANON_KEY dans .env
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { View, SafeAreaView, StatusBar, ActivityIndicator, Text, AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePatrimoineStore } from './src/store/patrimoineStore';
import { STORAGE_KEY, BVC_STORAGE_KEY, BVC_STALE_MS, INIT } from './src/constants/data';
// Utils — require() avec string literals (Metro interdit require(variable))
// Chaque module est wrappé dans try/catch pour résister à tout échec.
const _noop  = () => {};
const _noopP = () => Promise.resolve(null);
const _fn = (mod, key, fb) => (typeof mod[key] === 'function' ? mod[key] : fb);

const _sentryMod    = (() => { try { return require('./src/utils/sentry');     } catch(_) { return {}; } })();
const initSentry    = _fn(_sentryMod, 'initSentry',    _noop);
const identifyUser  = _fn(_sentryMod, 'identifyUser',  _noop);
const captureError  = _fn(_sentryMod, 'captureError',  _noop);
const addBreadcrumb = _fn(_sentryMod, 'addBreadcrumb', _noop);

const _apiMod       = (() => { try { return require('./src/utils/api');        } catch(_) { return {}; } })();
const applyBVCCours = _fn(_apiMod, 'applyBVCCours', (d) => d);
const fetchBVC      = _fn(_apiMod, 'fetchBVC',      _noopP);
const fetchPrixOr   = _fn(_apiMod, 'fetchPrixOr',   _noopP);
const fetchDevises  = _fn(_apiMod, 'fetchDevises',  _noopP);
const getBvcCache   = _fn(_apiMod, 'getBvcCache',   () => null);
const setBvcCache   = _fn(_apiMod, 'setBvcCache',   _noop);

const _migMod       = (() => { try { return require('./src/utils/migrations'); } catch(_) { return {}; } })();
const migrateData   = _fn(_migMod, 'migrateData', (d) => d);

const _histMod      = (() => { try { return require('./src/utils/history');    } catch(_) { return {}; } })();
const mergeHistory   = _fn(_histMod, 'mergeHistory',   (a, b) => [...(a||[]), ...(b||[])]);
const upsertSnapshot = _fn(_histMod, 'upsertSnapshot', (h) => h || []);

const _fmtMod       = (() => { try { return require('./src/utils/fmt');        } catch(_) { return {}; } })();
const fmtDate       = _fn(_fmtMod, 'fmtDate', (d) => d);

const _calcMod      = (() => { try { return require('./src/utils/calc');       } catch(_) { return {}; } })();
const totalPatrimoine = _fn(_calcMod, 'totalPatrimoine', () => 0);

const _authMod      = (() => { try { return require('./src/utils/auth');       } catch(_) { return {}; } })();
const getSession         = _fn(_authMod, 'getSession',         _noopP);
const loadPatrimoineData = _fn(_authMod, 'loadPatrimoineData', _noopP);
const onAuthStateChange  = _fn(_authMod, 'onAuthStateChange',  (_cb) => () => {});

const _syncMod      = (() => { try { return require('./src/utils/syncQueue');  } catch(_) { return {}; } })();
const startSyncWorker = _fn(_syncMod, 'startSyncWorker', _noop);
const stopSyncWorker  = _fn(_syncMod, 'stopSyncWorker',  _noop);
const clearSyncState  = _fn(_syncMod, 'clearSyncState',  _noop);
const flushNow        = _fn(_syncMod, 'flushNow',        _noopP);

const _storageMod   = (() => { try { return require('./src/utils/storage');    } catch(_) { return {}; } })();
const storage       = _storageMod.storage || { getString: () => null, setString: _noop, delete: _noop };
import ErrorBoundary           from './src/components/ErrorBoundary';
import PageAuth                from './src/pages/PageAuth';
import PageOnboarding          from './src/pages/PageOnboarding';
const _navMod      = (() => { try { return require('./src/navigation/AppNavigator'); } catch(_) { return {}; } })();
const AppNavigator = _navMod.AppNavigator || (() => null);

// ── Colors via require() — évite le bug de capture Babel où `var C = _colors.C`
// est évalué AVANT que colors.js ait fini son initialisation.
// require() s'exécute ici (après tous les import), colors.js est déjà en cache.
const _colorsModule = require('./src/constants/colors');
const C   = _colorsModule.C   || { pri:'#1A6B3A',priL:'#E8F5EE',priD:'#0F4B26',sec:'#C8102E',acc:'#F5A623',accL:'#FEF7DC',navy:'#1E3C82',navyL:'#E1E8FA',teal:'#008080',tealL:'#E0F4F4',gold:'#B88E30',goldL:'#FFF8DC',goldD:'#785A14',gpos:'#27AE60',rneg:'#E74C3C',g1:'#F1F3F5',g2:'#CED4DA',g3:'#868E96',dark:'#1C2833',bg:'#F8FAFA',white:'#FFFFFF' };
const APP_W = _colorsModule.APP_W || 390;

if (__DEV__) {
  console.log('[PatriMoi] colors module:', typeof _colorsModule, 'C.pri=', C?.pri);
  if (!_colorsModule.C) console.error('[PatriMoi] WARN: colors.C undefined — fallback utilisé. module=', _colorsModule);
}

// ── Constants module-level ────────────────────────────────────────────────────
const ONBOARDING_KEY = '@patrimoi_onboarding_done';
const HISTORY_KEY    = '@patrimoi_history';
const OBJECTIF_KEY   = '@patrimoi_objectif';
const DEMO_KEY       = '@patrimoi_demo_mode';

// Sentry initialisé après tout
initSentry();

// =========================================================
// TNR — tests unitaires (dev uniquement)
// =========================================================
if (__DEV__) (function runTNR() {
  const { calcLiquide, calcBanque, calcCarnet, calcPEA, calcPEACout, calcCT, calcCTCout, valImmo, valTransport, valOr, calcImmo, calcTransport, calcOr, totalPatrimoine } = require('./src/utils/calc');
  const { INIT: D } = require('./src/constants/data');
  let ok = 0, ko = 0;
  const run = (name, fn, expected) => {
    try {
      const r = fn();
      if (JSON.stringify(r) === JSON.stringify(expected)) { ok++; }
      else { ko++; console.error('[TNR FAIL] ' + name + ': recu=' + JSON.stringify(r) + ', attendu=' + JSON.stringify(expected)); }
    } catch(e) { ko++; console.error('[TNR CRASH] ' + name + ': ' + e.message); }
  };
  run('calcLiquide vide',          () => calcLiquide({ dh:0, devises:[] }),                                                               0);
  run('calcLiquide DH only',       () => calcLiquide({ dh:5000, devises:[] }),                                                            5000);
  run('calcLiquide avec devise',   () => calcLiquide({ dh:1000, devises:[{quantite:100,taux:10,code:'USD',nom:'',variation:0}] }),         2000);
  run('calcBanque vide',           () => calcBanque([]),                                                                                   0);
  run('calcBanque 2 comptes',      () => calcBanque([{solde:100},{solde:200}]),                                                            300);
  run('calcCarnet',                () => calcCarnet([{solde:30000,taux:3},{solde:15000,taux:2.5}]),                                        45000);
  run('calcPEA',                   () => calcPEA([{cours:120,qty:10},{cours:200,qty:5}]),                                                  2200);
  run('calcPEACout',               () => calcPEACout([{pru:100,qty:10}]),                                                                  1000);
  run('calcCT actions+opcvm',      () => calcCT({actions:[{cours:200,qty:5}],opcvm:[{vl:100,parts:3}]}),                                   1300);
  run('valImmo estimatif',         () => valImmo({meth:'estimatif',prixM2:8000,surface:85,prixOffert:null}),                               680000);
  run('valImmo offert',            () => valImmo({meth:'offert',prixM2:8000,surface:85,prixOffert:720000}),                                720000);
  run('valOr sans offert',         () => valOr({quantite:250,prixOffert:null},905),                                                        226250);
  run('valOr avec offert > estim', () => valOr({quantite:100,prixOffert:100000},905),                                                      100000);
  run('totalPatrimoine > 1.8M',    () => totalPatrimoine(D) > 1800000,                                                                     true);
  console.log('[PatriMoi TNR] ' + ok + '/' + (ok+ko) + ' tests ' + (ko===0?'OK':'— '+ko+' ECHEC(S)'));
})();

// =========================================================
// MIGRATION LAZY AsyncStorage → MMKV (Phase 4 DAT v2.0)
// Lit MMKV en priorité ; fallback AsyncStorage + copie vers MMKV.
// Après le premier lancement post-mise-à-jour, toutes les lectures
// sont sync depuis MMKV (plus de passage par AsyncStorage).
// =========================================================
async function smartRead(key) {
  const v = storage.getString(key);
  if (v !== null) return v;                      // déjà dans MMKV
  try {
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) storage.setString(key, legacy); // copie → MMKV
    return legacy;
  } catch { return null; }
}

// =========================================================
// APPLICATION RACINE
// =========================================================
export default function PatriMoi() {
  // ── Zustand store (Phase 2 DAT v1.6) ─────────────────────
  const {
    page, sub, setPage,
    data, setData,
    onboardingDone, setOnboardingDone,
    user, setUser,
    demoMode, setDemoMode,
    authReady, setAuthReady,
    appReady, setAppReady,
    isRefreshing, setIsRefreshing,
    bvcStatus, setBvcStatus,
    discret, setDiscret,
    history, setHistory,
    isOffline, setIsOffline,
    objectif, setObjectif,
  } = usePatrimoineStore();


  // ── Mode discret — preventScreenCapture (Phase 1 DAT v2.0) ──
  useEffect(() => {
    let SC = null;
    try { SC = require('react-native-prevent-screenshot'); } catch {}
    if (!SC) return;
    try {
      if (discret) {
        if (typeof SC.enabled   === 'function') SC.enabled();
        else if (typeof SC.activate === 'function') SC.activate();
      } else {
        if (typeof SC.disabled  === 'function') SC.disabled();
        else if (typeof SC.deactivate === 'function') SC.deactivate();
      }
    } catch (e) {
      if (__DEV__) console.warn('[PatriMoi] ScreenCapture error:', e?.message);
    }
  }, [discret]);

  const appState        = useRef(AppState.currentState);
  const isRefreshingRef = useRef(false);
  const saveTimer       = useRef(null);
  const dataRef         = useRef(data);

  // ── 0b. Chargement historique + objectif (MMKV, lazy migration) ─
  useEffect(() => {
    (async () => {
      const rawH = await smartRead(HISTORY_KEY);
      if (rawH) try { setHistory(JSON.parse(rawH)); } catch {}
      const rawO = await smartRead(OBJECTIF_KEY);
      if (rawO) try { setObjectif(JSON.parse(rawO)); } catch {}
    })();
  }, []);

  const updateObjectif = useCallback(async (obj) => {
    setObjectif(obj);
    if (obj) storage.set(OBJECTIF_KEY, obj);
    else     storage.delete(OBJECTIF_KEY);
  }, []);

  // ── 0c. Sauvegarde snapshot journalier ───────────────────
  // ── 0c. Snapshot journalier debounced (1s) ──────────────
  const snapshotTimer = useRef(null);
  useEffect(() => {
    if (!appReady) return;
    if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    snapshotTimer.current = setTimeout(() => {
      const today = new Date().toISOString().slice(0, 10);
      const val   = totalPatrimoine(dataRef.current);
      setHistory(prev => {
        const next = upsertSnapshot(prev, today, val);
        storage.set(HISTORY_KEY, next);
        return next;
      });
    }, 1000);
    return () => { if (snapshotTimer.current) clearTimeout(snapshotTimer.current); };
  }, [data, appReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 0. Vérification onboarding + restauration demoMode ───────
  useEffect(() => {
    smartRead(ONBOARDING_KEY)
      .then(v => setOnboardingDone(v === 'true'))
      .catch(() => setOnboardingDone(true));
    // Restaurer demoMode persisté
    AsyncStorage.getItem(DEMO_KEY).then(v => { if (v === 'true') setDemoMode(true); }).catch(() => {});
  }, []);

  const handleOnboardingDone = useCallback(() => {
    storage.setString(ONBOARDING_KEY, 'true');
    setOnboardingDone(true);
  }, []);

  // ── 1. Vérification session au démarrage ─────────────────
  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (session?.user) {
        setUser(session.user);
        identifyUser(session.user.id);
        startSyncWorker();
      }
      setAuthReady(true);
    })();

    const unsub = onAuthStateChange((session) => {
      if (session?.user) {
        setUser(session.user);
        identifyUser(session.user.id);
        addBreadcrumb('auth:signed_in');
        startSyncWorker();
      } else {
        setUser(null);
        identifyUser(null);
        stopSyncWorker();
        clearSyncState();
        setData(INIT); setAppReady(false); setDemoMode(false);
        AsyncStorage.removeItem(DEMO_KEY).catch(() => {});
      }
    });
    return unsub;
  }, []);

  // ── 2. Chargement des données selon le mode ──────────────
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      if (user) {
        const { data: remoteData, error } = await loadPatrimoineData(user.id);
        if (remoteData) {
          // Extraire l'historique embarqué et le merger avec l'historique local
          const { _history: remoteHist, ...cleanData } = remoteData;
          setData(migrateData(cleanData));
          if (remoteHist?.length > 0) {
            const rawLocal = await smartRead(HISTORY_KEY);
            const localHist = rawLocal ? (() => { try { return JSON.parse(rawLocal); } catch { return []; } })() : [];
            const merged = mergeHistory(localHist, remoteHist);
            setHistory(merged);
            storage.set(HISTORY_KEY, merged);
          }
        } else if (error) {
          // Offline : fallback MMKV (lazy migration depuis AsyncStorage)
          const rawStored = await smartRead(STORAGE_KEY);
          if (rawStored) { try { setData(migrateData(JSON.parse(rawStored))); } catch {} }
        }
      } else if (demoMode) {
        const rawStored = await smartRead(STORAGE_KEY + '_demo');
        if (rawStored) { try { setData(migrateData(JSON.parse(rawStored))); } catch {} }
      }
      setAppReady(true);
    })();
  }, [authReady, user, demoMode]);

  // ── 3. Sauvegarde debounce 500ms — local + Supabase (avec historique) ──────
  // Sauvegarde locale (MMKV sync + AsyncStorage backup) — sync Supabase gérée par l'outbox
  const saveData = useCallback((d) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const localKey = user ? STORAGE_KEY : STORAGE_KEY + '_demo';
      storage.set(localKey, d);                                      // MMKV (sync, rapide)
      try { await AsyncStorage.setItem(localKey, JSON.stringify(d)); } catch {} // AsyncStorage backup
    }, 500);
  }, [user]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!appReady) return;
    saveData(data);
  }, [data, appReady, saveData]);

  // ── 4. Refresh or ────────────────────────────────────────
  const refreshOr = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    const prix = await fetchPrixOr();
    isRefreshingRef.current = false;
    setIsRefreshing(false);
    if (prix) { setData(d => ({ ...d, prixOr: prix, lastUpdate: fmtDate() })); setIsOffline(false); }
    else       { setIsOffline(true); }
  }, []);

  // ── 4b. Refresh taux devises — lit toujours via dataRef pour éviter stale closure ──
  const refreshDevises = useCallback(async () => {
    const codes = dataRef.current.liquidites.devises.map(d => d.code);
    if (codes.length === 0) return;
    const taux = await fetchDevises(codes);
    if (!taux) return;
    setData(d => ({
      ...d,
      liquidites: {
        ...d.liquidites,
        devises: d.liquidites.devises.map(dv => {
          const newTaux = taux[dv.code];
          if (!newTaux) return dv;
          const variation = dv.taux > 0
            ? Math.round(((newTaux - dv.taux) / dv.taux) * 10000) / 100
            : 0;
          return { ...dv, taux: newTaux, variation };
        }),
      },
    }));
  }, []); // pas de dépendance sur data — utilise dataRef

  // ── 5. Refresh BVC ───────────────────────────────────────
  const refreshBVC = useCallback(async (force = false) => {
    const bvcData = await fetchBVC(force);
    if (bvcData) { setData(d => applyBVCCours(d, bvcData)); setBvcStatus('ok'); }
    else { setBvcStatus('error'); }
  }, []);

  // ── 6. Démarrage : cache BVC local + fetch réseau ────────
  useEffect(() => {
    if (!appReady) return;
    // Cache BVC — lecture MMKV (sync)
    const cached = storage.get(BVC_STORAGE_KEY);
    if (cached?.data?.cours && cached?.fetchedAt &&
        (Date.now() - cached.fetchedAt) < BVC_STALE_MS && !getBvcCache()) {
      setBvcCache(cached);
      setData(d => applyBVCCours(d, cached.data));
      setBvcStatus('ok');
    }
    refreshOr();
    refreshBVC();
    refreshDevises();
  }, [appReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 6b. Rappels carnet en retard ─────────────────────────
  useEffect(() => {
    if (!appReady) return;
    const today = new Date();
    const overdues = data.carnet.filter(c => {
      if (!c.rappel?.prochaine) return false;
      const parts = c.rappel.prochaine.split('/');
      if (parts.length < 3) return false;
      return new Date(parts[2], parts[1]-1, parts[0]) < today;
    });
    if (overdues.length > 0) {
      Alert.alert(
        'Rappel epargne',
        overdues.map(c => `• ${c.banque} — ${c.rappel.freq}`).join('\n') + '\n\nPensez a alimenter vos comptes !',
        [
          { text: 'Plus tard' },
          { text: 'Voir mes carnets', onPress: () => setPage('actifs', 'carnet') },
        ]
      );
    }
  }, [appReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 7. AppState : refresh BVC au retour + flush sync avant arrière-plan ──
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        refreshBVC();
      }
      // Flush immédiat avant que l'app soit suspendue
      if (nextState.match(/inactive|background/) && user) {
        flushNow();
      }
      appState.current = nextState;
    });
    return () => appStateSub.remove();
  }, [refreshBVC, user]);

  const goTo      = useCallback((p, subPage = null) => setPage(p, subPage), [setPage]);
  const handleNav = useCallback((p)                 => setPage(p, null),   [setPage]);

  const handleSignOut = useCallback(async () => {
    const { signOut } = await import('./src/utils/auth');
    await signOut();
  }, []);

  // ── Onboarding (premier lancement) ───────────────────────
  if (onboardingDone === null) {
    // Lecture AsyncStorage en cours
    return (
      <SafeAreaView style={{ flex:1, backgroundColor:C.pri, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator color={C.acc} size="large"/>
      </SafeAreaView>
    );
  }

  if (!onboardingDone) {
    return (
      <ErrorBoundary>
        <PageOnboarding onDone={handleOnboardingDone}/>
      </ErrorBoundary>
    );
  }

  // ── Splashscreen ─────────────────────────────────────────
  if (!authReady) {
    return (
      <SafeAreaView style={{ flex:1, backgroundColor:C.pri, alignItems:'center', justifyContent:'center' }}>
        <Text style={{ color:C.white, fontWeight:'700', fontSize:18, marginBottom:8 }}>PatriMoi</Text>
        <ActivityIndicator color={C.acc} size="large"/>
      </SafeAreaView>
    );
  }

  // ── Écran auth ───────────────────────────────────────────
  if (!user && !demoMode) {
    return (
      <ErrorBoundary>
        <PageAuth
          onAuthenticated={(u) => setUser(u)}
          onDemo={() => { setDemoMode(true); AsyncStorage.setItem(DEMO_KEY, 'true').catch(() => {}); }}
        />
      </ErrorBoundary>
    );
  }

  // ── Chargement données ───────────────────────────────────
  if (!appReady) {
    return (
      <SafeAreaView style={{ flex:1, backgroundColor:C.pri, alignItems:'center', justifyContent:'center' }}>
        <Text style={{ color:C.white, fontWeight:'700', fontSize:18, marginBottom:8 }}>PatriMoi</Text>
        <ActivityIndicator color={C.acc} size="large"/>
        <Text style={{ color:'rgba(180,230,200,0.8)', fontSize:12, marginTop:10 }}>Chargement de votre patrimoine...</Text>
      </SafeAreaView>
    );
  }

  // ── App principale — React Navigation v7 ────────────────────
  return (
    <ErrorBoundary>
      <StatusBar barStyle="light-content" backgroundColor={C.pri}/>
      <AppNavigator />
    </ErrorBoundary>
  );
}
