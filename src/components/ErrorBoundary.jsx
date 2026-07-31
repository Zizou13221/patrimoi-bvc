import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { C } from '../constants/colors';

// =========================================================
// ERROR BOUNDARY — capture les crashes JS, affiche un écran de secours
// Props :
//   context  {string}  — onglet/section qui a crashé (ex: 'actifs', 'global')
//   fullPage {boolean} — true = SafeAreaView plein écran (usage global)
//                        false (défaut) = encart dans l'onglet courant
// =========================================================
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this._retry = this._retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const context = this.props.context ?? 'unknown';
    console.error(`[PatriMoi ErrorBoundary:${context}]`, error, info?.componentStack ?? '');
    // Log vers Supabase error_logs — fail-silencieux
    try {
      const { logError } = require('../utils/errorLogger');
      logError({
        message: error?.message,
        stack:   error?.stack ?? info?.componentStack,
        context,
      });
    } catch {}
  }

  _retry() { this.setState({ hasError: false, error: null }); }

  render() {
    if (!this.state.hasError) return this.props.children;

    const fullPage = this.props.fullPage ?? false;
    const context  = this.props.context  ?? 'section';

    if (fullPage) {
      const { SafeAreaView } = require('react-native');
      return (
        <SafeAreaView style={{ flex:1, backgroundColor:C.pri, alignItems:'center', justifyContent:'center', padding:24 }}>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:18, marginBottom:12 }}>
            Une erreur est survenue
          </Text>
          <Text style={{ color:'rgba(180,230,200,0.85)', fontSize:13, textAlign:'center', marginBottom:20 }}>
            {this.state.error?.message ?? 'Erreur inconnue'}
          </Text>
          <TouchableOpacity
            onPress={this._retry}
            style={{ backgroundColor:C.acc, borderRadius:10, paddingHorizontal:20, paddingVertical:10 }}
          >
            <Text style={{ color:C.white, fontWeight:'700' }}>Réessayer</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    // Encart dans l'onglet (usage par page)
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:32 }}>
        <Text style={{ fontSize:28, marginBottom:12 }}>⚠️</Text>
        <Text style={{ fontWeight:'700', fontSize:16, color:C.dark, marginBottom:8, textAlign:'center' }}>
          Oups, l'écran {context} a planté
        </Text>
        <Text style={{ fontSize:13, color:C.g3, textAlign:'center', marginBottom:24 }}>
          {this.state.error?.message ?? 'Erreur inconnue'}
        </Text>
        <TouchableOpacity
          onPress={this._retry}
          style={{ backgroundColor:C.pri, borderRadius:10, paddingHorizontal:24, paddingVertical:11 }}
        >
          <Text style={{ color:C.white, fontWeight:'700' }}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
