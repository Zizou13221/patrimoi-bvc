/**
 * PatriMoi — PinGate (C16)
 *
 * Écran de verrouillage affiché quand l'app revient de l'arrière-plan
 * après dépassement du délai configuré (Paramètres → Code PIN).
 *
 * - Clavier numérique 6 chiffres natif (circles)
 * - Tentative biométrique automatique à l'ouverture
 * - Fallback saisie PIN
 * - onUnlock() appelé dès authentification réussie
 *
 * Usage :
 *   {locked && <PinGate onUnlock={() => setLocked(false)} />}
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Vibration,
} from 'react-native';
import { C } from '../constants/colors';
import { storage } from '../utils/storage';

// ── Biométrie (optional — fallback gracieux si module absent) ─────────────────
let _isBioAvailable = async () => ({ available: false, biometryType: null });
let _authBio        = async () => false;
try {
  const bio = require('../utils/biometrics');
  if (bio.isBiometricsAvailable) _isBioAvailable = bio.isBiometricsAvailable;
  if (bio.authenticateBiometric)  _authBio        = bio.authenticateBiometric;
} catch (_) {}

const PIN_KEY = '@patrimoi_pin';
const PIN_LEN = 6;

const KEYS = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['bio','0','⌫'],
];

export default function PinGate({ onUnlock }) {
  const [pin,         setPin]         = useState('');
  const [error,       setError]       = useState('');
  const [bioType,     setBioType]     = useState(null);
  const [bioEnabled,  setBioEnabled]  = useState(false);

  // ── Vérifier disponibilité biométrique au montage ─────────────────────────
  useEffect(() => {
    (async () => {
      const { available, biometryType } = await _isBioAvailable();
      if (available) {
        setBioEnabled(true);
        setBioType(biometryType || 'Face ID');
        // Tentative auto dès l'ouverture
        tryBiometric();
      }
    })();
  }, []); // eslint-disable-line

  const tryBiometric = useCallback(async () => {
    try {
      const ok = await _authBio('Déverrouiller PatriMoi');
      if (ok) onUnlock();
    } catch (_) {}
  }, [onUnlock]);

  // ── Vérification PIN ──────────────────────────────────────────────────────
  const verifyPin = useCallback((candidate) => {
    const stored = storage.get(PIN_KEY);
    if (!stored) { onUnlock(); return; } // Pas de PIN défini → pas de verrou
    if (candidate === stored) {
      setError('');
      onUnlock();
    } else {
      Vibration.vibrate(100);
      setError('Code incorrect');
      setPin('');
    }
  }, [onUnlock]);

  // ── Pression touche ───────────────────────────────────────────────────────
  const handleKey = useCallback((key) => {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      setError('');
      return;
    }
    if (key === 'bio') {
      tryBiometric();
      return;
    }
    setError('');
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LEN) {
      verifyPin(next);
    }
  }, [pin, tryBiometric, verifyPin]);

  // ── Rendu ─────────────────────────────────────────────────────────────────
  const dots = Array.from({ length: PIN_LEN }, (_, i) => (
    <View
      key={i}
      style={[
        styles.dot,
        i < pin.length && styles.dotFilled,
      ]}
    />
  ));

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content"/>

      {/* Entête */}
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>🔐</Text>
        </View>
        <Text style={styles.title}>PatriMoi</Text>
        <Text style={styles.sub}>Entrez votre code PIN pour continuer</Text>
      </View>

      {/* Cercles PIN */}
      <View style={styles.dotsRow}>{dots}</View>

      {/* Message d'erreur */}
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <View style={{ height: 18 }}/>
      )}

      {/* Clavier */}
      <View style={styles.keyboard}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((key) => {
              const isBioKey  = key === 'bio';
              const isDelKey  = key === '⌫';
              const isHidden  = isBioKey && !bioEnabled;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.key, (isHidden) && styles.keyInvisible]}
                  onPress={() => !isHidden && handleKey(key)}
                  activeOpacity={0.6}
                  disabled={isHidden}
                >
                  {isBioKey ? (
                    <Text style={styles.keyLabel}>
                      {bioType === 'TouchID' ? '✦' : '⊙'}
                    </Text>
                  ) : (
                    <Text style={[styles.keyLabel, isDelKey && styles.keyDel]}>{key}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Lien biométrie si disponible */}
      {bioEnabled && (
        <TouchableOpacity onPress={tryBiometric} style={styles.bioBtn} activeOpacity={0.7}>
          <Text style={styles.bioBtnText}>
            Utiliser {bioType === 'TouchID' ? 'Touch ID' : 'Face ID'}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.pri,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconBox: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  iconText: { fontSize: 28 },
  title: {
    color: C.white, fontWeight: '800', fontSize: 24, marginBottom: 6,
  },
  sub: {
    color: 'rgba(180,230,200,0.75)', fontSize: 13, textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row', gap: 18, marginBottom: 8,
  },
  dot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: 'rgba(180,230,200,0.5)',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: C.acc, borderColor: C.acc,
  },
  error: {
    color: '#FF6B6B', fontSize: 13, fontWeight: '600',
    height: 18, marginBottom: 2,
  },
  keyboard: {
    marginTop: 16, gap: 8,
  },
  keyRow: {
    flexDirection: 'row', gap: 20,
  },
  key: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  keyInvisible: {
    backgroundColor: 'transparent',
  },
  keyLabel: {
    color: C.white, fontWeight: '600', fontSize: 22,
  },
  keyDel: {
    fontSize: 20,
  },
  bioBtn: {
    marginTop: 28, paddingVertical: 10, paddingHorizontal: 24,
  },
  bioBtnText: {
    color: 'rgba(180,230,200,0.65)', fontSize: 13,
  },
});
