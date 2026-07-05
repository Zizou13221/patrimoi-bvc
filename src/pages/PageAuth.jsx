/**
 * PatriMoi — Écran d'authentification
 * Login / Inscription / Mot de passe oublié
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, ScrollView, Platform,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { C } from '../constants/colors';
import { signIn, signUp, resetPassword } from '../utils/auth';

// ── Composants locaux ─────────────────────────────────────
const Input = ({ label, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, placeholder }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(180,230,200,0.85)', marginBottom: 5 }}>
      {label}
    </Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType ?? 'default'}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      placeholder={placeholder}
      placeholderTextColor="rgba(255,255,255,0.3)"
      style={{
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 13,
        color: C.white,
        fontSize: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
      }}
    />
  </View>
);

const ErrBox = ({ msg }) => msg ? (
  <View style={{ backgroundColor: '#FFF0F0', borderRadius: 8, padding: 10, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: C.sec }}>
    <Text style={{ color: C.sec, fontSize: 12 }}>{msg}</Text>
  </View>
) : null;

// ── Composant principal ───────────────────────────────────
export default function PageAuth({ onAuthenticated, onDemo }) {
  const [tab,      setTab]      = useState('login');   // 'login' | 'register' | 'forgot'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [prenom,   setPrenom]   = useState('');
  const [nom,      setNom]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(null);

  const reset = () => { setError(null); setSuccess(null); };

  // ── Connexion ─────────────────────────────────────────
  const handleLogin = async () => {
    reset();
    if (!email.trim() || !password) { setError('Email et mot de passe requis.'); return; }
    setLoading(true);
    const { data, error: err } = await signIn({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (err) {
      setError(err.includes('Invalid') ? 'Email ou mot de passe incorrect.' : err);
      return;
    }
    onAuthenticated(data.user);
  };

  // ── Inscription ───────────────────────────────────────
  const handleRegister = async () => {
    reset();
    if (!prenom.trim() || !nom.trim())     { setError('Prénom et nom requis.'); return; }
    if (!email.trim())                      { setError('Email requis.'); return; }
    if (password.length < 8)               { setError('Mot de passe : 8 caractères minimum.'); return; }
    setLoading(true);
    const { data, error: err } = await signUp({
      email: email.trim().toLowerCase(),
      password,
      prenom: prenom.trim(),
      nom: nom.trim(),
    });
    setLoading(false);
    if (err) { setError(err); return; }
    // Supabase envoie un email de confirmation par défaut
    setSuccess('Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse.');
    setTab('login');
  };

  // ── Mot de passe oublié ───────────────────────────────
  const handleForgot = async () => {
    reset();
    if (!email.trim()) { setError('Entrez votre email.'); return; }
    setLoading(true);
    const { error: err } = await resetPassword(email.trim().toLowerCase());
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess('Email de réinitialisation envoyé !');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.pri }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.pri}/>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 10,
          }}>
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 20 }}>PAT</Text>
            <Text style={{ color: C.acc,   fontWeight: '700', fontSize: 12 }}>RIMOI</Text>
          </View>
          <Text style={{ color: C.white, fontWeight: '700', fontSize: 22 }}>PatriMoi</Text>
          <Text style={{ color: 'rgba(180,230,200,0.8)', fontSize: 12, marginTop: 4 }}>
            Votre Patrimoine. Votre Avenir.
          </Text>
        </View>

        {/* Carte formulaire */}
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
        }}>
          {/* Tabs */}
          {tab !== 'forgot' && (
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 3, marginBottom: 20 }}>
              {[['login','Se connecter'],['register','S\'inscrire']].map(([t, label]) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => { setTab(t); reset(); }}
                  style={{
                    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8,
                    backgroundColor: tab === t ? C.acc : 'transparent',
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: tab === t ? C.white : 'rgba(255,255,255,0.6)' }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Messages */}
          <ErrBox msg={error}/>
          {success && (
            <View style={{ backgroundColor: '#E8F5EE', borderRadius: 8, padding: 10, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: C.gpos }}>
              <Text style={{ color: C.gpos, fontSize: 12 }}>{success}</Text>
            </View>
          )}

          {/* Formulaire Connexion */}
          {tab === 'login' && (
            <>
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="votre@email.ma"/>
              <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••"/>
              <TouchableOpacity onPress={() => { setTab('forgot'); reset(); }} style={{ alignSelf: 'flex-end', marginBottom: 16, marginTop: -4 }}>
                <Text style={{ color: C.acc, fontSize: 12 }}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleLogin} disabled={loading}
                style={{ backgroundColor: C.acc, borderRadius: 12, padding: 14, alignItems: 'center' }}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={C.white}/>
                  : <Text style={{ color: C.white, fontWeight: '700', fontSize: 15 }}>Se connecter</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* Formulaire Inscription */}
          {tab === 'register' && (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input label="Prénom" value={prenom} onChangeText={setPrenom} placeholder="Mohammed"/>
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Alami"/>
                </View>
              </View>
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="votre@email.ma"/>
              <Input label="Mot de passe (8 caractères min.)" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••"/>
              <TouchableOpacity
                onPress={handleRegister} disabled={loading}
                style={{ backgroundColor: C.gpos, borderRadius: 12, padding: 14, alignItems: 'center' }}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={C.white}/>
                  : <Text style={{ color: C.white, fontWeight: '700', fontSize: 15 }}>Créer mon compte</Text>
                }
              </TouchableOpacity>
              <Text style={{ color: 'rgba(180,230,200,0.6)', fontSize: 10, textAlign: 'center', marginTop: 10 }}>
                En créant un compte, vous acceptez nos CGU et notre politique de confidentialité.
              </Text>
            </>
          )}

          {/* Mot de passe oublié */}
          {tab === 'forgot' && (
            <>
              <Text style={{ color: 'rgba(180,230,200,0.85)', fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
                Entrez votre email. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </Text>
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="votre@email.ma"/>
              <TouchableOpacity
                onPress={handleForgot} disabled={loading}
                style={{ backgroundColor: C.acc, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12 }}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={C.white}/>
                  : <Text style={{ color: C.white, fontWeight: '700', fontSize: 15 }}>Envoyer le lien</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setTab('login'); reset(); }} style={{ alignItems: 'center' }}>
                <Text style={{ color: C.acc, fontSize: 13 }}>← Retour à la connexion</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Mode démo */}
        {onDemo && (
          <TouchableOpacity onPress={onDemo} style={{ marginTop: 20, alignItems: 'center' }} activeOpacity={0.7}>
            <Text style={{ color: 'rgba(180,230,200,0.6)', fontSize: 13 }}>
              Continuer sans compte (données locales uniquement)
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
