/**
 * PatriMoi — Tests unitaires store Zustand (4 slices)
 * Phase 5 DAT v2.0
 */

// Mock syncQueue avant tout import du store
jest.mock('../src/utils/syncQueue', () => ({
  enqueueSync: jest.fn(),
}));

import { usePatrimoineStore } from '../src/store/patrimoineStore';
import { enqueueSync } from '../src/utils/syncQueue';

// Reset le store entre chaque test
beforeEach(() => {
  usePatrimoineStore.setState(usePatrimoineStore.getInitialState?.() ?? {
    data:           { liquidites: { dh: 0, devises: [] }, banque: [], carnet: [], pea: [],
                      ct: { actions: [], opcvm: [] }, immobilier: [], transport: [], or: [],
                      prixOr: 0, lastUpdate: '' },
    user:           null,
    demoMode:       false,
    authReady:      false,
    appReady:       false,
    onboardingDone: null,
    page:           'dashboard',
    sub:            null,
    discret:        false,
    bvcStatus:      'loading',
    isRefreshing:   false,
    isOffline:      false,
    history:        [],
    objectif:       null,
  });
  (enqueueSync as jest.Mock).mockClear();
});

// ── DataSlice ────────────────────────────────────────────────────────────────

describe('dataSlice — setData', () => {
  it('met à jour les données avec un objet', () => {
    const newData = { liquidites: { dh: 9999, devises: [] }, banque: [], carnet: [], pea: [],
      ct: { actions: [], opcvm: [] }, immobilier: [], transport: [], or: [], prixOr: 0, lastUpdate: '' };
    usePatrimoineStore.getState().setData(newData);
    expect(usePatrimoineStore.getState().data.liquidites.dh).toBe(9999);
  });

  it('met à jour les données avec une fonction', () => {
    usePatrimoineStore.getState().setData(prev => ({ ...prev, prixOr: 650 }));
    expect(usePatrimoineStore.getState().data.prixOr).toBe(650);
  });

  it('n\'appelle PAS enqueueSync si user est null', () => {
    usePatrimoineStore.getState().setData(prev => ({ ...prev, prixOr: 1 }));
    expect(enqueueSync).not.toHaveBeenCalled();
  });

  it('appelle enqueueSync si user connecté et pas demoMode', () => {
    usePatrimoineStore.setState({ user: { id: 'user-123' }, demoMode: false });
    usePatrimoineStore.getState().setData(prev => ({ ...prev, prixOr: 2 }));
    expect(enqueueSync).toHaveBeenCalledWith('user-123', expect.objectContaining({ prixOr: 2 }));
  });

  it('n\'appelle PAS enqueueSync en demoMode', () => {
    usePatrimoineStore.setState({ user: { id: 'user-demo' }, demoMode: true });
    usePatrimoineStore.getState().setData(prev => ({ ...prev, prixOr: 3 }));
    expect(enqueueSync).not.toHaveBeenCalled();
  });
});

// ── AuthSlice ────────────────────────────────────────────────────────────────

describe('authSlice', () => {
  it('setUser met à jour user', () => {
    usePatrimoineStore.getState().setUser({ id: 'abc', email: 'test@patrimoi.ma' });
    expect(usePatrimoineStore.getState().user?.id).toBe('abc');
  });

  it('setDemoMode bascule le mode', () => {
    usePatrimoineStore.getState().setDemoMode(true);
    expect(usePatrimoineStore.getState().demoMode).toBe(true);
  });

  it('setAuthReady et setAppReady fonctionnent', () => {
    usePatrimoineStore.getState().setAuthReady(true);
    usePatrimoineStore.getState().setAppReady(true);
    const s = usePatrimoineStore.getState();
    expect(s.authReady).toBe(true);
    expect(s.appReady).toBe(true);
  });

  it('setOnboardingDone accepte null, true, false', () => {
    const { setOnboardingDone } = usePatrimoineStore.getState();
    setOnboardingDone(true);
    expect(usePatrimoineStore.getState().onboardingDone).toBe(true);
    setOnboardingDone(null);
    expect(usePatrimoineStore.getState().onboardingDone).toBeNull();
  });
});

// ── UiSlice ──────────────────────────────────────────────────────────────────

describe('uiSlice', () => {
  it('setPage met à jour page et sub', () => {
    usePatrimoineStore.getState().setPage('actifs', 'pea');
    const s = usePatrimoineStore.getState();
    expect(s.page).toBe('actifs');
    expect(s.sub).toBe('pea');
  });

  it('setPage sans sub → sub = null', () => {
    usePatrimoineStore.getState().setPage('dashboard');
    expect(usePatrimoineStore.getState().sub).toBeNull();
  });

  it('setDiscret bascule le mode discret', () => {
    usePatrimoineStore.getState().setDiscret(true);
    expect(usePatrimoineStore.getState().discret).toBe(true);
  });

  it('setBvcStatus', () => {
    usePatrimoineStore.getState().setBvcStatus('ok');
    expect(usePatrimoineStore.getState().bvcStatus).toBe('ok');
  });

  it('setIsOffline', () => {
    usePatrimoineStore.getState().setIsOffline(true);
    expect(usePatrimoineStore.getState().isOffline).toBe(true);
  });
});

// ── HistorySlice ─────────────────────────────────────────────────────────────

describe('historySlice', () => {
  const entry1 = { date: '2026-07-09', val: 150_000 };
  const entry2 = { date: '2026-07-10', val: 155_000 };

  it('setHistory avec tableau direct', () => {
    usePatrimoineStore.getState().setHistory([entry1]);
    expect(usePatrimoineStore.getState().history).toEqual([entry1]);
  });

  it('setHistory avec fonction (append)', () => {
    usePatrimoineStore.setState({ history: [entry1] });
    usePatrimoineStore.getState().setHistory(prev => [...prev, entry2]);
    expect(usePatrimoineStore.getState().history).toHaveLength(2);
    expect(usePatrimoineStore.getState().history[1]).toEqual(entry2);
  });

  it('setObjectif', () => {
    const obj = { montant: 500_000, label: 'Retraite', date: '2035-01-01' };
    usePatrimoineStore.getState().setObjectif(obj);
    expect(usePatrimoineStore.getState().objectif).toEqual(obj);
  });

  it('setObjectif null efface l\'objectif', () => {
    usePatrimoineStore.setState({ objectif: { montant: 100_000 } });
    usePatrimoineStore.getState().setObjectif(null);
    expect(usePatrimoineStore.getState().objectif).toBeNull();
  });
});
