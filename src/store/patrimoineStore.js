/**
 * PatriMoi — Store Zustand (Phase 2 DAT v2.0)
 *
 * Changements v2.0 :
 *   - setData() enqueue automatiquement dans l'outbox si l'utilisateur est connecté
 *   - Plus de debounce direct vers Supabase — la sync passe par syncQueue
 *   - API publique inchangée : usePatrimoineStore(s => s.field)
 */

import { create } from 'zustand';
import { INIT } from '../constants/data';
import { enqueueSync } from '../utils/syncQueue';

export const usePatrimoineStore = create((set) => ({
  // ── Données patrimoine ────────────────────────────────────
  data: INIT,
  setData: (fn) => set(state => {
    const newData = typeof fn === 'function' ? fn(state.data) : fn;
    // Enqueue vers l'outbox si connecté (pas en démo)
    if (state.user && !state.demoMode) {
      enqueueSync(state.user.id, newData);
    }
    return { data: newData };
  }),

  // setDataRaw : charge des données SANS enqueuer de sync
  // À utiliser uniquement pour le chargement initial depuis Supabase.
  // Évite que la donnée chargée (déjà en Supabase) écrase les mutations
  // utilisateur en attente dans l'outbox.
  setDataRaw: (fn) => set(state => {
    const newData = typeof fn === 'function' ? fn(state.data) : fn;
    return { data: newData };
  }),

  // ── Navigation ────────────────────────────────────────────
  page: 'proverbe',
  sub:  null,
  setPage: (page, sub = null) => set({ page, sub }),

  // ── Auth ──────────────────────────────────────────────────
  user:        null,
  demoMode:    false,
  authReady:   false,
  appReady:    false,
  setUser:      (user)  => set({ user }),
  setDemoMode:  (v)     => set({ demoMode: v }),
  setAuthReady: (v)     => set({ authReady: v }),
  setAppReady:  (v)     => set({ appReady: v }),

  // ── Onboarding ────────────────────────────────────────────
  onboardingDone: null,
  setOnboardingDone: (v) => set({ onboardingDone: v }),

  // ── Abonnement ────────────────────────────────────────────
  // false par défaut — mis à true par StoreKit (Task StoreKit complet)
  // Features PatriMoi+ : historique/snapshots, PDF natif, alertes BVC
  // Features gratuites : sync cloud JSONB de base (patrimoine_data)
  // true par défaut pendant la phase de lancement (SUBSCRIPTION_ENABLED=false)
  // → toutes les features premium sont accessibles sans abonnement
  // Remettre à false quand SUBSCRIPTION_ENABLED=true dans storekit.js
  isPremium: true,
  setIsPremium: (v) => set({ isPremium: v }),

  // ── UI / sync ─────────────────────────────────────────────
  isRefreshing: false,
  bvcStatus:    'loading',
  discret:      false,
  history:      [],
  isOffline:    false,
  objectif:     null,

  setIsRefreshing: (v)  => set({ isRefreshing: v }),
  setBvcStatus:    (v)  => set({ bvcStatus: v }),
  setDiscret:      (v)  => set({ discret: v }),
  setHistory: (fn) => set(state => ({
    history: typeof fn === 'function' ? fn(state.history) : fn,
  })),
  setIsOffline:  (v) => set({ isOffline: v }),
  setObjectif:   (v) => set({ objectif: v }),

  // AN_014 — date de début de suivi (ISO string ou null)
  trackingStartDate: null,
  setTrackingStartDate: (v) => set({ trackingStartDate: v }),

  // ── Budget (opérations) ───────────────────────────────────
  // Stockées dans data.operations pour sync Supabase automatique via setData
  addOperation: (op) => set(state => {
    const ops = [...(state.data.operations || []), op];
    const newData = { ...state.data, operations: ops };
    if (state.user && !state.demoMode) enqueueSync(state.user.id, newData);
    return { data: newData };
  }),
  setOperations: (ops) => set(state => {
    const newData = { ...state.data, operations: Array.isArray(ops) ? ops : ops(state.data.operations || []) };
    if (state.user && !state.demoMode) enqueueSync(state.user.id, newData);
    return { data: newData };
  }),
  setBudgetCibles: (cibles) => set(state => {
    const newData = { ...state.data, budgetCibles: cibles };
    if (state.user && !state.demoMode) enqueueSync(state.user.id, newData);
    return { data: newData };
  }),

  // C14 — Ignorer un conseil (dismiss)
  dismissConseil: (id) => set(state => {
    const newData = {
      ...state.data,
      conseils_dismissed: { ...(state.data.conseils_dismissed || {}), [id]: true },
    };
    if (state.user && !state.demoMode) enqueueSync(state.user.id, newData);
    return { data: newData };
  }),
}));
