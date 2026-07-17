import type { StateCreator } from 'zustand';
import type { AppUser } from '../../types';
import type { Store } from '../types';

export type AuthSlice = {
  user:        AppUser | null;
  demoMode:    boolean;
  authReady:   boolean;
  appReady:    boolean;
  onboardingDone: boolean | null;
  setUser:          (user: AppUser | null) => void;
  setDemoMode:      (v: boolean) => void;
  setAuthReady:     (v: boolean) => void;
  setAppReady:      (v: boolean) => void;
  setOnboardingDone:(v: boolean | null) => void;
};

export const createAuthSlice: StateCreator<Store, [], [], AuthSlice> = (set) => ({
  user:           null,
  demoMode:       false,
  authReady:      false,
  appReady:       false,
  onboardingDone: null,

  setUser:           (user)  => set({ user }),
  setDemoMode:       (v)     => set({ demoMode: v }),
  setAuthReady:      (v)     => set({ authReady: v }),
  setAppReady:       (v)     => set({ appReady: v }),
  setOnboardingDone: (v)     => set({ onboardingDone: v }),
});
