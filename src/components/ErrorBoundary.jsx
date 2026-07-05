import React from 'react';
import { SafeAreaView, Text, TouchableOpacity } from 'react-native';
import { C } from '../constants/colors';

// =========================================================
// ERROR BOUNDARY — capture les crashes JS, affiche un écran de secours
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
    console.error('[PatriMoi ErrorBoundary]', error, info?.componentStack ?? '');
  }

  _retry() { this.setState({ hasError: false, error: null }); }

  render() {
    if (!this.state.hasError) return this.props.children;
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
}
