/**
 * PatriMoi — Onboarding
 * Affiché une seule fois au premier lancement (avant PageAuth)
 * 4 slides animées + bouton Skip
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Dimensions, Animated, StatusBar, Platform,
} from 'react-native';
import { C } from '../constants/colors';

const { width: SW } = Dimensions.get('window');

// ── Contenu des slides ────────────────────────────────────
const SLIDES = [
  {
    emoji:    '🏦',
    title:    'Votre patrimoine,\ntout en un seul endroit',
    body:     'Immobilier, bourse, or, liquidités… PatriMoi centralise tous vos actifs et calcule votre richesse nette en temps réel.',
    accent:   C.acc,
  },
  {
    emoji:    '📈',
    title:    'Cours BVC en\ntemps réel',
    body:     'Vos actions cotées à la Bourse de Casablanca sont automatiquement valorisées avec les cours du jour.',
    accent:   '#F4A84A',
  },
  {
    emoji:    '🔒',
    title:    'Vos données restent\nvos données',
    body:     'Chiffrement bout en bout, sauvegarde cloud sécurisée. Ou mode démo 100% local — vous choisissez.',
    accent:   '#5BBFBA',
  },
  {
    emoji:    '💡',
    title:    'Des conseils taillés\npour votre profil',
    body:     'PatriMoi analyse votre répartition et vous propose des pistes concrètes pour optimiser votre patrimoine.',
    accent:   C.gpos,
  },
];

// ── Composant slide ───────────────────────────────────────
const Slide = ({ slide, width }) => (
  <View style={{ width, alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 }}>
    {/* Icône */}
    <View style={{
      width: 110, height: 110, borderRadius: 32,
      backgroundColor: slide.accent + '22',
      borderWidth: 2, borderColor: slide.accent + '55',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 32,
    }}>
      <Text style={{ fontSize: 52 }}>{slide.emoji}</Text>
    </View>

    {/* Titre */}
    <Text style={{
      color: C.white, fontWeight: '700', fontSize: 24,
      textAlign: 'center', lineHeight: 32, marginBottom: 16,
    }}>
      {slide.title}
    </Text>

    {/* Corps */}
    <Text style={{
      color: 'rgba(180,230,200,0.75)', fontSize: 15,
      textAlign: 'center', lineHeight: 24,
    }}>
      {slide.body}
    </Text>
  </View>
);

// ── Composant principal ───────────────────────────────────
export default function PageOnboarding({ onDone }) {
  const [current, setCurrent] = useState(0);
  const scrollRef             = useRef(null);
  const dotAnim               = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  const goTo = (index) => {
    scrollRef.current?.scrollTo({ x: index * SW, animated: true });
    // Animate dots
    SLIDES.forEach((_, i) => {
      Animated.spring(dotAnim[i], {
        toValue: i === index ? 1 : 0,
        useNativeDriver: false,
        speed: 20,
      }).start();
    });
    setCurrent(index);
  };

  const handleScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (idx !== current) {
      SLIDES.forEach((_, i) => {
        Animated.spring(dotAnim[i], {
          toValue: i === idx ? 1 : 0,
          useNativeDriver: false,
          speed: 20,
        }).start();
      });
      setCurrent(idx);
    }
  };

  const isLast = current === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: C.pri }}>
      <StatusBar barStyle="light-content" backgroundColor={C.pri}/>

      {/* Bouton Skip */}
      {!isLast && (
        <TouchableOpacity
          onPress={onDone}
          style={{ position: 'absolute', top: Platform.OS === 'ios' ? 56 : 16, right: 20, zIndex: 10, padding: 8 }}
          activeOpacity={0.7}
        >
          <Text style={{ color: 'rgba(180,230,200,0.6)', fontSize: 14 }}>Passer</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={{ flex: 1, marginTop: Platform.OS === 'ios' ? 60 : 20 }}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide, i) => (
          <Slide key={i} slide={slide} width={SW}/>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, gap: 8 }}>
        {SLIDES.map((_, i) => (
          <Animated.View
            key={i}
            style={{
              height: 8, borderRadius: 4,
              backgroundColor: SLIDES[current].accent,
              width: dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [8, 24] }),
              opacity: dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            }}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}>
        {isLast ? (
          <TouchableOpacity
            onPress={onDone}
            style={{
              backgroundColor: C.acc, borderRadius: 14,
              padding: 16, alignItems: 'center',
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 16 }}>
              Commencer →
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => goTo(current + 1)}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 14, padding: 16, alignItems: 'center',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: C.white, fontWeight: '600', fontSize: 16 }}>
              Suivant
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
