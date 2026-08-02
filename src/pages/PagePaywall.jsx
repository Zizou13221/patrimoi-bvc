/**
 * PatriMoi — PagePaywall
 *
 * Écran paywall affiché quand un utilisateur non-premium tente d'accéder
 * à une feature PatriMoi+. Peut être appelé depuis n'importe quelle page.
 *
 * Usage :
 *   import PagePaywall from './PagePaywall';
 *   // Dans un Modal ou en navigation :
 *   <PagePaywall onClose={() => setPaywallVisible(false)} trigger="pdf_export"/>
 *
 * Props :
 *   onClose  — fermer le paywall
 *   trigger  — string identifiant la feature déclenchante (pour analytics)
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, Modal,
} from 'react-native';
import { C } from '../constants/colors';
import { usePatrimoineStore } from '../store/patrimoineStore';
import {
  initIAP, endIAP, fetchProducts,
  purchaseSubscription, finalizePurchase,
  restorePurchases, checkSubscriptionStatus,
  PRODUCT_ID,
} from '../utils/storekit';
import { trackPaywallViewed, trackTrialStarted, trackSubscriptionStarted } from '../utils/analytics';

// ── Features PatriMoi+ ────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '📈', label: 'Historique & graphique d\'évolution',     sub: 'Snapshots journaliers, courbe patrimoniale' },
  { icon: '📄', label: 'Export PDF professionnel',                sub: 'Rapport patrimoine + budget formatés' },
  { icon: '🔔', label: 'Alertes cours BVC en temps réel',         sub: 'Seuils haut/bas sur vos titres favoris' },
  { icon: '☁️', label: 'Synchronisation multi-appareils',         sub: 'Vos données disponibles partout' },
  { icon: '🔒', label: 'Chiffrement AES-128 + Secure Enclave',   sub: 'Sécurité maximale pour votre patrimoine' },
];

// ── Composant ─────────────────────────────────────────────────────────────────
export default function PagePaywall({ onClose, trigger }) {
  const setIsPremium = usePatrimoineStore(s => s.setIsPremium);

  const [loading,      setLoading]      = useState(false);
  const [restoring,    setRestoring]    = useState(false);
  const [priceLabel,   setPriceLabel]   = useState('29 DH/mois');
  const [iapReady,     setIapReady]     = useState(false);

  // Init IAP + fetch prix localisé depuis App Store
  useEffect(() => {
    trackPaywallViewed(trigger || 'unknown');
    let mounted = true;
    (async () => {
      const { ok } = await initIAP();
      if (!mounted) return;
      if (ok) {
        setIapReady(true);
        const { products } = await fetchProducts();
        if (mounted && products?.[0]?.localizedPrice) {
          setPriceLabel(products[0].localizedPrice + '/mois');
        }
      }
    })();
    return () => {
      mounted = false;
      endIAP();
    };
  }, []); // eslint-disable-line

  // ── Achat ──────────────────────────────────────────────────────────────────
  const handleSubscribe = async () => {
    if (!iapReady) {
      Alert.alert('Non disponible', 'L\'achat in-app n\'est pas disponible sur cet appareil.');
      return;
    }
    setLoading(true);
    try {
      const { purchase, error } = await purchaseSubscription();
      if (error) {
        Alert.alert('Erreur', error);
        setLoading(false);
        return;
      }
      if (!purchase) {
        // Annulé par l'utilisateur
        setLoading(false);
        return;
      }
      // Finaliser la transaction (acknowledge)
      await finalizePurchase(purchase);
      // Vérifier le statut abonnement
      const { isPremium } = await checkSubscriptionStatus();
      setIsPremium(isPremium);
      trackSubscriptionStarted('monthly');
      setLoading(false);
      Alert.alert(
        'Bienvenue dans PatriMoi+ ! 🎉',
        'Votre abonnement est actif. Profitez de toutes les fonctionnalités premium.',
        [{ text: 'Commencer', onPress: onClose }]
      );
    } catch (e) {
      setLoading(false);
      Alert.alert('Erreur', e?.message || 'Erreur lors de l\'achat');
    }
  };

  // ── Restauration ──────────────────────────────────────────────────────────
  const handleRestore = async () => {
    setRestoring(true);
    const { purchases, error } = await restorePurchases();
    if (error) {
      setRestoring(false);
      Alert.alert('Erreur', error);
      return;
    }
    const { isPremium } = await checkSubscriptionStatus();
    setIsPremium(isPremium);
    setRestoring(false);
    if (isPremium) {
      Alert.alert(
        'Abonnement restauré ✓',
        'Votre abonnement PatriMoi+ a été restauré avec succès.',
        [{ text: 'Super !', onPress: onClose }]
      );
    } else {
      Alert.alert(
        'Aucun abonnement actif',
        'Aucun abonnement PatriMoi+ actif n\'a été trouvé pour cet identifiant Apple.'
      );
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.pri }}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ paddingTop: 52, paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={onClose}
          style={{ position: 'absolute', top: 16, right: 20, padding: 8 }}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={{ color: 'rgba(180,230,200,0.7)', fontSize: 22, fontWeight: '300' }}>✕</Text>
        </TouchableOpacity>

        <View style={{
          width: 64, height: 64, borderRadius: 18,
          backgroundColor: 'rgba(255,255,255,0.15)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <Text style={{ fontSize: 30 }}>⭐</Text>
        </View>

        <Text style={{ color: C.white, fontWeight: '800', fontSize: 24, textAlign: 'center', marginBottom: 6 }}>
          PatriMoi+
        </Text>
        <Text style={{ color: 'rgba(180,230,200,0.8)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Gérez votre patrimoine marocain{'\n'}comme un professionnel
        </Text>
      </View>

      {/* Features */}
      <View style={{ marginHorizontal: 18, marginBottom: 20 }}>
        {FEATURES.map((f, i) => (
          <View key={i} style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: 12,
            backgroundColor: 'rgba(255,255,255,0.09)',
            borderRadius: 12, padding: 12, marginBottom: 8,
          }}>
            <Text style={{ fontSize: 22, flexShrink: 0 }}>{f.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.white, fontWeight: '700', fontSize: 13 }}>{f.label}</Text>
              <Text style={{ color: 'rgba(180,230,200,0.7)', fontSize: 11, marginTop: 2 }}>{f.sub}</Text>
            </View>
            <Text style={{ color: 'rgba(180,230,200,0.6)', fontSize: 18 }}>✓</Text>
          </View>
        ))}
      </View>

      {/* Prix + CTA */}
      <View style={{ marginHorizontal: 18 }}>
        <TouchableOpacity
          onPress={handleSubscribe}
          disabled={loading}
          style={{
            backgroundColor: C.acc,
            borderRadius: 14, paddingVertical: 16,
            alignItems: 'center', marginBottom: 12,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
          }}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <>
              <Text style={{ color: C.white, fontWeight: '800', fontSize: 16 }}>
                S'abonner — {priceLabel}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 3 }}>
                Résiliation à tout moment depuis les Réglages iOS
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Restaurer */}
        <TouchableOpacity
          onPress={handleRestore}
          disabled={restoring}
          style={{ alignItems: 'center', paddingVertical: 12 }}
          activeOpacity={0.7}
        >
          {restoring
            ? <ActivityIndicator color="rgba(180,230,200,0.6)" size="small"/>
            : <Text style={{ color: 'rgba(180,230,200,0.65)', fontSize: 13 }}>Restaurer mes achats</Text>
          }
        </TouchableOpacity>

        {/* Mentions légales */}
        <Text style={{ color: 'rgba(180,230,200,0.4)', fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 8 }}>
          L'abonnement se renouvelle automatiquement sauf résiliation au moins 24h avant la date de renouvellement.
          Le paiement est débité sur votre compte Apple. Gérez votre abonnement dans les Réglages iOS → [Votre nom] → Abonnements.
        </Text>

        {/* C22 — Avertissement sécurité PIN */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-start', gap: 8,
          marginTop: 16, backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: 10, padding: 12,
        }}>
          <Text style={{ fontSize: 15 }}>🔐</Text>
          <Text style={{ color: 'rgba(180,230,200,0.55)', fontSize: 10, flex: 1, lineHeight: 15 }}>
            <Text style={{ fontWeight: '700' }}>Conseil sécurité : </Text>
            PatriMoi chiffre vos données localement. Pour une protection maximale, activez le verrouillage par code ou Face ID sur votre iPhone (Réglages → Face ID & code).
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Helper : Modal paywall ─────────────────────────────────────────────────────
/**
 * PaywallModal
 * Wrapper pratique pour afficher PagePaywall dans un Modal.
 *
 * Usage :
 *   <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} trigger="pdf_export"/>
 */
export function PaywallModal({ visible, onClose, trigger }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <PagePaywall onClose={onClose} trigger={trigger} />
    </Modal>
  );
}
