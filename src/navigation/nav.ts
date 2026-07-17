/**
 * PatriMoi — Façade de navigation (Phase 4 DAT v2.0)
 *
 * API identique à l'ancien setPage(page, sub) du store Zustand.
 * Les pages existantes n'ont PAS besoin de changer.
 *
 * Usage : navigate('actifs', 'pea')  →  même comportement qu'avant
 */

import { navigationRef } from './navigationRef';
import { usePatrimoineStore } from '../store/patrimoineStore';
import type { Page } from '../types';

export function navigate(page: Page, sub: string | null = null): void {
  // 1. Mettre à jour le store Zustand (rétrocompat avec les pages existantes)
  usePatrimoineStore.getState().setPage(page, sub);

  // 2. Synchroniser React Navigation (si le ref est prêt)
  if (navigationRef.isReady()) {
    navigationRef.navigate(page as never, sub ? { sub } : undefined);
  }
}

/**
 * Retourne la page active courante depuis le store.
 * Rétrocompat : toujours lisible via usePatrimoineStore(s => s.page).
 */
export function getCurrentPage(): Page {
  return usePatrimoineStore.getState().page;
}
