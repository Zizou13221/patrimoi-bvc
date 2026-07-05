/**
 * PatriMoi — React Native (iOS / Android)
 * Compatible Xcode  |  Version 1.3
 *
 * Architecture multi-fichiers :
 *   src/constants/   → colors.js, data.js
 *   src/utils/       → calc.js, fmt.js, api.js, conseils.js
 *   src/components/  → ErrorBoundary.jsx, shared.jsx
 *   src/pages/       → PageProverbe, PageDashboard, PageActifs,
 *                       PageConseils, PageAPropos, PageParams
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, SafeAreaView, StatusBar, ActivityIndicator, Text, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { C, APP_W }           from './src/constants/colors';
import { STORAGE_KEY, BVC_STORAGE_KEY, BVC_STALE_MS, INIT } from './src/constants/data';
import { applyBVCCours, fetchBVC, fetchPrixOr, getBvcCache, setBvcCache } from './src/utils/api';
import { fmtDate }             from './src/utils/fmt';
import ErrorBoundary           from './src/components/ErrorBoundary';
import { NavBar }              from './src/components/shared';
import PageProverbe            from './src/pages/PageProverbe';
import PageDashboard           from './src/pages/PageDashboard';
import PageActifs              from './src/pages/PageActifs';
import PageConseils            from './src/pages/PageConseils';
import PageAPropos             from './src/pages/PageAPropos';
import PageParams              from './src/pages/PageParams';

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
// APPLICATION RACINE
// =========================================================
export default function PatriMoi() {
  const [page,         setPage]         = useState('proverbe');
  const [data,         setData]         = useState(INIT);
  const [sub,          setSub]          = useState(null);
  const [appReady,     setAppReady]     = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bvcStatus,    setBvcStatus]    = useState(null); // null | 'ok' | 'error'

  const appState        = useRef(AppState.currentState);
  const isRefreshingRef = useRef(false);
  const saveTimer       = useRef(null);

  // ── Chargement initial ───────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (stored) {
          try { setData(JSON.parse(stored)); } catch { /* fallback INIT */ }
        }
      })
      .finally(() => setAppReady(true));
  }, []);

  // ── Sauvegarde — debounce 500ms ──────────────────────────
  const saveData = useCallback((d) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(d)).catch(() => {});
    }, 500);
  }, []);

  useEffect(() => {
    if (!appReady) return;
    saveData(data);
  }, [data, appReady, saveData]);

  // ── Refresh or ──────────────────────────────────────────
  const refreshOr = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    const prix = await fetchPrixOr();
    isRefreshingRef.current = false;
    setIsRefreshing(false);
    if (prix) setData(d => ({ ...d, prixOr: prix, lastUpdate: fmtDate() }));
  }, []);

  // ── Refresh BVC ─────────────────────────────────────────
  const refreshBVC = useCallback(async (force = false) => {
    const bvcData = await fetchBVC(force);
    if (bvcData) { setData(d => applyBVCCours(d, bvcData)); setBvcStatus('ok'); }
    else { setBvcStatus('error'); }
  }, []);

  // ── Démarrage : cache BVC local + fetch réseau ───────────
  useEffect(() => {
    if (!appReady) return;
    AsyncStorage.getItem(BVC_STORAGE_KEY).then(raw => {
      if (!raw) return;
      try {
        const cached = JSON.parse(raw);
        if (cached?.data?.cours && cached?.fetchedAt &&
            (Date.now() - cached.fetchedAt) < BVC_STALE_MS && !getBvcCache()) {
          setBvcCache(cached);
          setData(d => applyBVCCours(d, cached.data));
          setBvcStatus('ok');
        }
      } catch {}
    }).catch(() => {});
    refreshOr();
    refreshBVC();
  }, [appReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AppState : refresh au retour premier plan ────────────
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        refreshBVC();
      }
      appState.current = nextState;
    });
    return () => appStateSub.remove();
  }, [refreshBVC]);

  const goTo      = useCallback((p, subPage = null) => { setPage(p); setSub(subPage); }, []);
  const handleNav = useCallback((p)                 => { setPage(p); setSub(null);    }, []);

  if (!appReady) {
    return (
      <SafeAreaView style={{ flex:1, backgroundColor:C.pri, alignItems:'center', justifyContent:'center' }}>
        <Text style={{ color:C.white, fontWeight:'700', fontSize:18, marginBottom:8 }}>PatriMoi</Text>
        <ActivityIndicator color={C.acc} size="large"/>
        <Text style={{ color:'rgba(180,230,200,0.8)', fontSize:12, marginTop:10 }}>Chargement de votre patrimoine...</Text>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={{ flex:1, backgroundColor:C.pri }}>
        <StatusBar barStyle="light-content" backgroundColor={C.pri}/>
        <View style={{ flex:1, backgroundColor:C.bg, maxWidth:APP_W, alignSelf:'center', width:'100%' }}>
          <View style={{ flex:1 }}>
            {page==='proverbe'  && <PageProverbe  onNav={goTo} data={data}/>}
            {page==='dashboard' && <PageDashboard data={data} onNav={goTo} onRefreshOr={refreshOr} isRefreshing={isRefreshing} onRefreshBVC={refreshBVC} bvcStatus={bvcStatus}/>}
            {page==='actifs'    && <PageActifs    data={data} setData={setData} sub={sub} setSub={setSub}/>}
            {page==='conseils'  && <PageConseils  data={data} onNav={goTo}/>}
            {page==='apropos'   && <PageAPropos/>}
            {page==='params'    && <PageParams/>}
          </View>
          <NavBar active={page} onChange={handleNav}/>
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}
