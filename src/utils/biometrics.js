/**
 * PatriMoi — Authentification biométrique (Phase 4 DAT v1.6)
 *
 * Wraps react-native-biometrics avec fallback gracieux.
 * Si le module natif est absent (simulateur sans biométrie),
 * les fonctions retournent false sans planter.
 */

let RNBiometrics = null;
try {
  // Chargement dynamique pour éviter un crash si pod non installé
  const mod = require('react-native-biometrics');
  RNBiometrics = mod.default ?? mod.ReactNativeBiometrics ?? null;
} catch {}

/**
 * Vérifie si la biométrie est disponible sur l'appareil.
 * @returns {Promise<{ available: boolean, biometryType: string|null }>}
 */
export async function isBiometricsAvailable() {
  if (!RNBiometrics) return { available: false, biometryType: null };
  try {
    const rnBiometrics = new RNBiometrics();
    const result = await rnBiometrics.isSensorAvailable();
    return { available: result.available, biometryType: result.biometryType ?? null };
  } catch {
    return { available: false, biometryType: null };
  }
}

/**
 * Lance une invite d'authentification biométrique.
 * @param {string} promptMessage - Message affiché à l'utilisateur
 * @returns {Promise<boolean>} true si authentifié avec succès
 */
export async function authenticateBiometric(promptMessage = 'Confirmez votre identité') {
  if (!RNBiometrics) return false;
  try {
    const rnBiometrics = new RNBiometrics();
    const { success } = await rnBiometrics.simplePrompt({ promptMessage });
    return !!success;
  } catch {
    return false;
  }
}
