/**
 * PatriMoi — Navigator principal (Zustand page-state, sans React Navigation)
 *
 * Bug 2&3 fix : canal pendingActifsSub (Zustand) — voir PageDashboard, PageActifs, PageConseils
 * Bug 4 fix   : onRefreshOr / onRefreshBVC câblés ici
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { usePatrimoineStore } from '../store/patrimoineStore';
import { C } from '../constants/colors';
import { fetchPrixOr, fetchBVC, applyBVCCours } from '../utils/api';
import { fmtDate } from '../utils/fmt';

import PageProverbe  from '../pages/PageProverbe';
import PageDashboard from '../pages/PageDashboard';
import PageActifs    from '../pages/PageActifs';
import PageConseils  from '../pages/PageConseils';
import PageAPropos   from '../pages/PageAPropos';
import PageParams    from '../pages/PageParams';

// ── Onglets ───────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { name: 'proverbe',  label: 'Accueil',   abbr: 'ACC' },
  { name: 'dashboard', label: 'Dashboard',  abbr: 'DBD' },
  { name: 'actifs',    label: 'Actifs',     abbr: 'ACT' },
  { name: 'conseils',  label: 'Conseils',   abbr: 'CNS' },
  { name: 'apropos',   label: 'A propos',   abbr: 'APR' },
  { name: 'params',    label: 'Params',     abbr: 'PRM' },
];

// ── NavBar custom ─────────────────────────────────────────────────────────────
function NavBar({ current, onPress }: { current: string; onPress: (name: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.g2 }}>
      {NAV_ITEMS.map(item => {
        const isActive = current === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            onPress={() => onPress(item.name)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 7 }}
            activeOpacity={0.7}
          >
            <View style={{
              backgroundColor: isActive ? C.pri : C.g1,
              borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2,
              marginBottom: 2, minWidth: 26, alignItems: 'center',
            }}>
              <Text style={{ fontSize: 7.5, fontWeight: '700', color: isActive ? C.white : C.g3 }}>
                {item.abbr}
              </Text>
            </View>
            <Text style={{ fontSize: 8.5, fontWeight: isActive ? '700' : '400', color: isActive ? C.pri : C.g3 }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Navigator principal ───────────────────────────────────────────────────────
export function AppNavigator() {
  const page            = usePatrimoineStore(s => s.page);
  const setPage         = usePatrimoineStore(s => s.setPage);
  const setUser               = usePatrimoineStore(s => s.setUser);
  const setData               = usePatrimoineStore(s => s.setData);
  const setIsRefreshing       = usePatrimoineStore(s => s.setIsRefreshing);
  const setBvcStatus          = usePatrimoineStore(s => s.setBvcStatus);
  const setIsOffline          = usePatrimoineStore(s => s.setIsOffline);
  const setObjectif           = usePatrimoineStore(s => s.setObjectif);
  const setTrackingStartDate  = usePatrimoineStore(s => s.setTrackingStartDate);

  // Bug 2&3 : setPage atomiquement set {page, sub} → PageActifs lit sub via getState() au montage
  const onNav = useCallback((p: string, sub?: string | null) => {
    setPage(p as any, sub ?? null);
  }, [setPage]);

  const onTabPress = useCallback((name: string) => {
    setPage(name as any, null);
  }, [setPage]);

  const refreshOr = useCallback(async () => {
    setIsRefreshing(true);
    const prix = await fetchPrixOr();
    setIsRefreshing(false);
    if (prix) {
      setData((d: any) => ({ ...d, prixOr: prix, lastUpdate: fmtDate() }));
      setIsOffline(false);
    } else {
      setIsOffline(true);
    }
  }, [setData, setIsRefreshing, setIsOffline]);

  const refreshBVC = useCallback(async () => {
    setBvcStatus('loading');
    const bvcData = await fetchBVC(true);
    if (bvcData) {
      setData((d: any) => applyBVCCours(d, bvcData));
      setBvcStatus('ok');
    } else {
      setBvcStatus('error');
    }
  }, [setData, setBvcStatus]);

  const handleSignOut = useCallback(() => setUser(null), [setUser]);

  const currentPage = page ?? 'proverbe';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
      <View style={{ flex: 1 }}>
        {currentPage === 'proverbe'  && <PageProverbe  onNav={onNav} />}
        {currentPage === 'dashboard' && <PageDashboard onNav={onNav} onRefreshOr={refreshOr} onRefreshBVC={refreshBVC} />}
        {currentPage === 'actifs'    && <PageActifs    onNav={onNav} />}
        {currentPage === 'conseils'  && <PageConseils  onNav={onNav} />}
        {currentPage === 'apropos'   && <PageAPropos />}
        {currentPage === 'params'    && <PageParams onSignOut={handleSignOut} onObjectifChange={setObjectif} onTrackingStartChange={setTrackingStartDate} />}
      </View>
      <NavBar current={currentPage} onPress={onTabPress} />
    </SafeAreaView>
  );
}
