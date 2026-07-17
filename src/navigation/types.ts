/**
 * PatriMoi — Types React Navigation (Phase 4 DAT v2.0)
 */

import type { Page } from '../types';

// Paramètres de chaque onglet (sub est optionnel, uniquement pour actifs)
export type RootParamList = {
  proverbe:  undefined;
  dashboard: undefined;
  actifs:    { sub?: string } | undefined;
  conseils:  undefined;
  apropos:   undefined;
  params:    undefined;
};

export type NavPage = Page;
