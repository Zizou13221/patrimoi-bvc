/**
 * PatriMoi — Référence globale au NavigationContainer (Phase 4 DAT v2.0)
 * Permet d'appeler navigate() en dehors des composants React.
 */

import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootParamList>();
