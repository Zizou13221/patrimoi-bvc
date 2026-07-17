import React, { useState, useCallback, useEffect } from 'react';
import { usePatrimoineStore } from '../store/patrimoineStore';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, Share, Platform, Modal } from 'react-native';
import { storage } from '../utils/storage';
import { C } from '../constants/colors';
import { Card, BtnSec, BtnPri, Toggle, TopBar, Input, PickerModal } from '../components/shared';

import { isBiometricsAvailable, authenticateBiometric } from '../utils/biometrics';
import { updateProfile } from '../utils/auth';
import {
  calcLiquide, calcBanque, calcCarnet, calcPEA, calcCT,
  calcOr, calcImmo, calcTransport, totalPatrimoine,
} from '../utils/calc';
import { fmt } from '../utils/fmt';
import { INIT } from '../constants/data';

const PREFS_KEY = '@patrimoi_prefs';

export default function PageParams({ onSignOut, onObjectifChange, onTrackingStartChange }) {
  const data     = usePatrimoineStore(s => s.data);
  const user     = usePatrimoineStore(s => s.user);
  const demoMode = usePatrimoineStore(s => s.demoMode);
  const discret  = usePatrimoineStore(s => s.discret);
  const onDiscretChange = usePatrimoineStore(s => s.setDiscret);
  const objectif = usePatrimoineStore(s => s.objectif);
  const [bio,            setBio]            = useState(false);
  const [rappels,        setRappels]        = useState(true);
  const [alertes,        setAlertes]        = useState(true);
  const [hebdo,          setHebdo]          = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  // Import CSV
  const [importVisible,  setImportVisible]  = useState(false);
  const [importText,     setImportText]     = useState('');
  const [importResult,   setImportResult]   = useState(null);

  // ── AN_012 — PIN 6 chiffres ────────────────────────────────
  const PIN_KEY  = '@patrimoi_pin';
  const [pinSet,       setPinSet]       = useState(false);
  const [pinModal,     setPinModal]     = useState(false);
  const [pinStep,      setPinStep]      = useState('set');  // 'verify' | 'set' | 'confirm'
  const [pinInput,     setPinInput]     = useState('');
  const [pinConfirm,   setPinConfirm]   = useState('');
  const [pinVerify,    setPinVerify]    = useState('');
  const [pinError,     setPinError]     = useState('');

  // ── AN_013 — Verrouillage automatique ─────────────────────
  const LOCK_KEY   = '@patrimoi_locktime';
  const LOCK_OPTS  = [
    { value:'0',   label:'Jamais' },
    { value:'60',  label:'1 minute' },
    { value:'120', label:'2 minutes' },
    { value:'300', label:'5 minutes' },
    { value:'600', label:'10 minutes' },
  ];
  const [lockTime,     setLockTime]     = useState('0');
  const [lockPicker,   setLockPicker]   = useState(false);

  // ── AN_014 — Date de début de suivi ───────────────────────
  const TRACK_KEY  = '@patrimoi_tracking_start';
  const [trackDate,    setTrackDate]    = useState('');
  const [editTrack,    setEditTrack]    = useState(false);
  const [trackInput,   setTrackInput]   = useState('');

  // Charger préférences persistées (MMKV sync — Phase 3)
  useEffect(() => {
    const p = storage.get(PREFS_KEY);
    if (p) {
      if (p.bio     !== undefined) setBio(p.bio);
      if (p.rappels !== undefined) setRappels(p.rappels);
      if (p.alertes !== undefined) setAlertes(p.alertes);
      if (p.hebdo   !== undefined) setHebdo(p.hebdo);
    }
    // AN_012 : PIN
    const pin = storage.get(PIN_KEY);
    if (pin) setPinSet(true);
    // AN_013 : verrouillage
    const lt = storage.get(LOCK_KEY);
    if (lt !== undefined && lt !== null) setLockTime(String(lt));
    // AN_014 : date de début
    const td = storage.get(TRACK_KEY);
    if (td) { setTrackDate(td); onTrackingStartChange?.(td); }
  }, []); // eslint-disable-line

  const savePrefs = useCallback((patch) => {
    const prev = storage.get(PREFS_KEY) ?? {};
    storage.set(PREFS_KEY, { ...prev, ...patch });
  }, []);

  // ── AN_012 — PIN handlers ──────────────────────────────────
  const openPinSetup = useCallback(() => {
    if (demoMode) { Alert.alert('Mode Démo', 'Disponible uniquement sur un compte réel.'); return; }
    setPinInput(''); setPinConfirm(''); setPinVerify(''); setPinError('');
    setPinStep(pinSet ? 'verify' : 'set');
    setPinModal(true);
  }, [demoMode, pinSet]);

  const handlePinNext = useCallback(() => {
    if (pinStep === 'verify') {
      const stored = storage.get(PIN_KEY);
      if (pinVerify !== stored) { setPinError('Code PIN incorrect.'); return; }
      setPinVerify(''); setPinError(''); setPinStep('set');
    } else if (pinStep === 'set') {
      if (pinInput.length !== 6) { setPinError('Le code doit contenir exactement 6 chiffres.'); return; }
      setPinError(''); setPinStep('confirm');
    } else if (pinStep === 'confirm') {
      if (pinConfirm !== pinInput) { setPinError('Les codes ne correspondent pas.'); setPinConfirm(''); return; }
      storage.set(PIN_KEY, pinInput);
      setPinSet(true); setPinModal(false);
      Alert.alert('Code PIN défini', 'Votre code PIN a été enregistré.');
    }
  }, [pinStep, pinVerify, pinInput, pinConfirm]);

  const handleRemovePin = useCallback(() => {
    if (demoMode) return;
    Alert.alert('Supprimer le PIN', 'Voulez-vous supprimer votre code PIN ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:() => {
        storage.set(PIN_KEY, null); setPinSet(false);
        Alert.alert('Code PIN supprimé');
      }},
    ]);
  }, [demoMode]);

  // ── AN_013 — Verrouillage auto handler ────────────────────
  const handleLockChange = useCallback((val) => {
    setLockTime(val);
    storage.set(LOCK_KEY, val);
    savePrefs({ lockTime: val });
  }, [savePrefs]);

  // ── AN_014 — Date de début de suivi ───────────────────────
  const handleSaveTrackDate = useCallback(() => {
    const trimmed = trackInput.trim();
    // Accepte JJ/MM/AAAA ou AAAA-MM-JJ ou simplement AAAA
    let iso = null;
    const yOnly = /^\d{4}$/.test(trimmed);
    const dmY   = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
    const isoRe = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    if (yOnly)  iso = `${trimmed}-01-01`;
    else if (dmY) iso = `${dmY[3]}-${dmY[2]}-${dmY[1]}`;
    else if (isoRe) iso = trimmed;
    if (!iso || isNaN(new Date(iso).getTime())) {
      Alert.alert('Format invalide', 'Exemples : 2022, 01/01/2022, 2022-01-01'); return;
    }
    storage.set(TRACK_KEY, iso);
    setTrackDate(iso);
    onTrackingStartChange?.(iso);
    setEditTrack(false);
    Alert.alert('Date enregistrée', `Suivi depuis le ${new Date(iso).toLocaleDateString('fr-FR')}.`);
  }, [trackInput, onTrackingStartChange]);

  // Push notifications locales (@react-native-community/push-notification-ios)
  const handleRappelToggle = useCallback(async (val) => {
    setRappels(val);
    savePrefs({ rappels: val });
    let PushNotifIOS = null;
    try { PushNotifIOS = require('@react-native-community/push-notification-ios').default; } catch {
      try { PushNotifIOS = require('react-native').PushNotificationIOS; } catch {}
    }
    if (!PushNotifIOS) return;
    try {
      if (val) {
        const perms = await PushNotifIOS.requestPermissions({ alert:true, badge:true, sound:true });
        if (perms?.alert || perms?.badge) {
          PushNotifIOS.cancelAllLocalNotifications();
          const fire = new Date();
          fire.setDate(fire.getDate() + 30);
          PushNotifIOS.scheduleLocalNotification({
            alertTitle: 'PatriMoi — Rappel mensuel',
            alertBody:  'Mettez à jour votre patrimoine ce mois-ci.',
            fireDate:   fire.toISOString(),
            repeatInterval: 'month',
            soundName:  'default',
          });
          Alert.alert('Rappels activés', 'Vous serez rappelé chaque mois pour mettre à jour votre patrimoine.');
        } else {
          Alert.alert('Notifications bloquées', 'Autorisez les notifications PatriMoi dans Réglages iOS.');
        }
      } else {
        PushNotifIOS.cancelAllLocalNotifications();
      }
    } catch {}
  }, [savePrefs]);

  // Auth biométrique (react-native-biometrics)
  const handleBioToggle = useCallback(async (val) => {
    if (val) {
      const { available, biometryType } = await isBiometricsAvailable();
      if (!available) {
        Alert.alert('Biométrie indisponible', 'Face ID / Touch ID non configuré sur cet appareil.');
        return;
      }
      const ok = await authenticateBiometric(`Activer ${biometryType ?? 'Face ID'} pour PatriMoi`);
      if (!ok) return; // annulé par l'utilisateur
    }
    setBio(val);
    savePrefs({ bio: val });
  }, [savePrefs]);

  // Parser CSV bancaire
  const parseCSV = useCallback((text) => {
    if (!text.trim()) return null;
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return { solde: null, count: 0 };
    const sep = (text.match(/;/g)||[]).length >= (text.match(/,/g)||[]).length ? ';' : ',';
    // Chercher colonne "Solde"
    const header = lines[0].toLowerCase().split(sep);
    let soldeCol = header.findIndex(h => /solde|balance|encours/.test(h));
    let lastSolde = null;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/["\s]/g,'').replace(',','.'));
      if (soldeCol >= 0 && cols[soldeCol]) {
        const n = parseFloat(cols[soldeCol]);
        if (!isNaN(n)) lastSolde = n;
      }
    }
    // Fallback : dernière valeur positive significative de la dernière ligne
    if (lastSolde === null) {
      const last = lines[lines.length-1].split(sep);
      for (let j = last.length-1; j >= 0; j--) {
        const n = parseFloat(last[j].trim().replace(/["\s]/g,'').replace(',','.'));
        if (!isNaN(n) && n > 100) { lastSolde = n; break; }
      }
    }
    return { solde: lastSolde, count: lines.length - 1 };
  }, []);
  const [editPrenom,     setEditPrenom]     = useState('');
  const [editNom,        setEditNom]        = useState('');
  const [saving,         setSaving]         = useState(false);
  // Objectif
  const [editingObj,  setEditingObj]  = useState(false);
  const [objMontant,  setObjMontant]  = useState('');
  const [objDate,     setObjDate]     = useState('');

  const prenom     = user?.user_metadata?.prenom || '';
  const nom        = user?.user_metadata?.nom    || '';
  const nomComplet = prenom && nom ? prenom + ' ' + nom : prenom || nom || (demoMode ? 'Mode Demo' : 'Utilisateur');
  const initiales  = ((prenom[0] || '') + (nom[0] || '')).toUpperCase() || (demoMode ? 'D' : 'U');
  const email      = user?.email || (demoMode ? 'Mode Demo — donnees locales' : '—');

  const handleSignOut = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: () => onSignOut?.() },
      ]
    );
  };

  const handleItem = (label) => {
    Alert.alert(label, 'Fonctionnalité disponible dans une prochaine version.');
  };

  const handleEditProfile = () => {
    if (demoMode) {
      Alert.alert('Mode Démo', 'La modification du profil n\'est pas disponible en mode démo. Créez un compte pour personnaliser votre profil.');
      return;
    }
    setEditPrenom(prenom);
    setEditNom(nom);
    setEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!editPrenom.trim() && !editNom.trim()) return;
    setSaving(true);
    const { error } = await updateProfile({ prenom: editPrenom.trim(), nom: editNom.trim() });
    setSaving(false);
    if (error) {
      Alert.alert('Erreur', error);
    } else {
      setEditingProfile(false);
      Alert.alert('Succès', 'Profil mis à jour !');
    }
  };

  // Export PDF
  const [exportingPDF, setExportingPDF] = useState(false);

  const handleExportPDF = useCallback(async () => {
    const d = data || INIT;
    setExportingPDF(true);
    try {
      let RNHTMLtoPDF;
      try { RNHTMLtoPDF = require('react-native-html-to-pdf').default; } catch {}
      if (!RNHTMLtoPDF) {
        Alert.alert('Module PDF indisponible', 'Le module natif PDF n\'est pas lie. Relancez l\'app depuis Xcode apres un pod install.');
        return;
      }
      const date = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
      const total = totalPatrimoine(d);

      const cats = [
        { label:'Argent Liquide & Devises', val: calcLiquide(d.liquidites),   color:'#1E7A4A' },
        { label:'Argent en Banque',          val: calcBanque(d.banque),         color:'#1A3A7A' },
        { label:'Compte sur Carnet',         val: calcCarnet(d.carnet),         color:'#0E6B6B' },
        { label:'Compte PEA',                val: calcPEA(d.pea),               color:'#1E5C3A' },
        { label:'Compte-Titre',              val: calcCT(d.ct),                 color:'#1A3A7A' },
        { label:'Or & Métaux Précieux',       val: calcOr(d.or, d.prixOr),      color:'#B8860B' },
        { label:'Immobilier & Terrains',     val: calcImmo(d.immobilier),       color:'#7A3A00' },
        { label:'Biens de Transport',        val: calcTransport(d.transport),   color:'#3A3A5A' },
      ];

      const fmtPDF = (n) => {
        if (n === 0) return '0 DH';
        return n.toLocaleString('fr-FR', { maximumFractionDigits:0 }) + ' DH';
      };

      const rows = cats.map(c => {
        const pct = total > 0 ? (c.val / total * 100).toFixed(1) : '0.0';
        const barW = total > 0 ? Math.round(c.val / total * 200) : 0;
        return `
          <tr>
            <td style="padding:10px 14px; color:#222; font-size:13px; border-bottom:1px solid #eee;">${c.label}</td>
            <td style="padding:10px 14px; text-align:right; font-weight:700; font-size:13px; color:${c.val > 0 ? c.color : '#bbb'}; border-bottom:1px solid #eee; white-space:nowrap;">${fmtPDF(c.val)}</td>
            <td style="padding:10px 14px; text-align:right; color:#888; font-size:12px; border-bottom:1px solid #eee;">${pct}%</td>
            <td style="padding:10px 14px; border-bottom:1px solid #eee; vertical-align:middle;">
              <div style="background:#eee; border-radius:4px; height:6px; width:200px;">
                <div style="background:${c.color}; border-radius:4px; height:6px; width:${barW}px;"></div>
              </div>
            </td>
          </tr>`;
      }).join('');

      const objetifHtml = objectif ? `
        <div style="background:#F0FBF4; border:1px solid #1E7A4A; border-radius:10px; padding:16px; margin-bottom:20px;">
          <div style="font-size:13px; color:#555; margin-bottom:4px;">Objectif patrimonial — ${objectif.dateTarget}</div>
          <div style="font-size:18px; font-weight:700; color:#1E7A4A;">${fmtPDF(objectif.montant)}</div>
          <div style="background:#ddd; border-radius:4px; height:8px; margin-top:10px;">
            <div style="background:#1E7A4A; border-radius:4px; height:8px; width:${Math.min(100, total/objectif.montant*100).toFixed(1)}%;"></div>
          </div>
          <div style="font-size:11px; color:#888; margin-top:6px;">${(total/objectif.montant*100).toFixed(1)}% atteint — ${fmtPDF(total)} / ${fmtPDF(objectif.montant)}</div>
        </div>` : '';

      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background:#fff; color:#222; }
</style>
</head>
<body>
  <!-- En-tête -->
  <div style="background:linear-gradient(135deg,#1E7A4A,#155C38); padding:32px 36px 28px; color:white;">
    <div style="font-size:28px; font-weight:800; letter-spacing:-0.5px;">PatriMoi</div>
    <div style="font-size:13px; opacity:0.8; margin-top:4px;">Votre Patrimoine. Votre Avenir.</div>
    <div style="margin-top:24px; font-size:13px; opacity:0.75;">Rapport du ${date}</div>
    ${nomComplet ? `<div style="font-size:13px; opacity:0.75; margin-top:2px;">${nomComplet}</div>` : ''}
  </div>

  <!-- Total -->
  <div style="padding:28px 36px 20px;">
    <div style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:1px;">Patrimoine Total</div>
    <div style="font-size:38px; font-weight:800; color:#1E7A4A; margin-top:6px;">${fmtPDF(total)}</div>
  </div>

  <div style="padding:0 36px 20px;">
    ${objetifHtml}

    <!-- Tableau -->
    <table style="width:100%; border-collapse:collapse; border-radius:10px; overflow:hidden; border:1px solid #eee;">
      <thead>
        <tr style="background:#1E7A4A;">
          <th style="padding:10px 14px; text-align:left; color:white; font-size:12px; font-weight:600;">Catégorie</th>
          <th style="padding:10px 14px; text-align:right; color:white; font-size:12px; font-weight:600;">Valeur</th>
          <th style="padding:10px 14px; text-align:right; color:white; font-size:12px; font-weight:600;">%</th>
          <th style="padding:10px 14px; color:white; font-size:12px; font-weight:600;">Répartition</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#F0FBF4;">
          <td style="padding:12px 14px; font-weight:800; font-size:14px; color:#1E7A4A;">TOTAL</td>
          <td style="padding:12px 14px; text-align:right; font-weight:800; font-size:14px; color:#1E7A4A;" colspan="3">${fmtPDF(total)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- Pied de page -->
    <div style="margin-top:32px; padding-top:16px; border-top:1px solid #eee; font-size:11px; color:#aaa; text-align:center;">
      Document généré par PatriMoi v1.6 · ${date}
    </div>
  </div>
</body>
</html>`;

      const result = await RNHTMLtoPDF.convert({
        html,
        fileName: `PatriMoi_${new Date().toISOString().slice(0,10)}`,
        directory: Platform.OS === 'ios' ? 'Documents' : 'Download',
        base64: false,
      });

      if (!result?.filePath) throw new Error('Échec génération PDF');

      await Share.share({
        url: `file://${result.filePath}`,
        title: 'PatriMoi — Rapport Patrimoine',
      });

    } catch (e) {
      Alert.alert('Erreur', 'Impossible de générer le PDF : ' + (e.message || 'erreur inconnue'));
    } finally {
      setExportingPDF(false);
    }
  }, [data, objectif, nomComplet]); // data peut être null → fallback INIT intégré

  // Export CSV — pure JS, toujours fonctionnel (pas de module natif)
  const handleExportCSV = useCallback(async () => {
    const d = data || INIT;
    const total = totalPatrimoine(d);
    const date = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
    const cats = [
      { label:'Argent Liquide & Devises', val: calcLiquide(d.liquidites) },
      { label:'Argent en Banque',          val: calcBanque(d.banque) },
      { label:'Compte sur Carnet',         val: calcCarnet(d.carnet) },
      { label:'Compte PEA',                val: calcPEA(d.pea) },
      { label:'Compte-Titre',              val: calcCT(d.ct) },
      { label:'Or & Metaux Precieux',      val: calcOr(d.or, d.prixOr) },
      { label:'Immobilier & Terrains',     val: calcImmo(d.immobilier) },
      { label:'Biens de Transport',        val: calcTransport(d.transport) },
    ];
    const lines = [
      `PatriMoi — Export du ${date}`,
      '',
      'Catégorie;Valeur (DH);Pourcentage',
      ...cats.map(c => `${c.label};${c.val};${total > 0 ? (c.val/total*100).toFixed(2) + '%' : '0%'}`),
      '',
      `TOTAL PATRIMOINE;${total};100%`,
      ...(objectif ? [`Objectif ${objectif.dateTarget};${objectif.montant};${(total/objectif.montant*100).toFixed(1)}% atteint`] : []),
    ];
    try {
      await Share.share({
        message: lines.join('\n'),
        title: `PatriMoi_${new Date().toISOString().slice(0,10)}.csv`,
      });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de partager : ' + (e.message || ''));
    }
  }, [data, objectif]);

  // Objectif
  const handleEditObj = () => {
    setObjMontant(objectif ? String(objectif.montant) : '');
    setObjDate(objectif ? objectif.dateTarget : '');
    setEditingObj(true);
  };

  const handleSaveObj = () => {
    const m = parseFloat(objMontant);
    if (isNaN(m) || m <= 0) { Alert.alert('Erreur', 'Montant invalide.'); return; }
    onObjectifChange?.({ montant: m, dateTarget: objDate.trim() || '2030' });
    setEditingObj(false);
  };

  const lockLabel = LOCK_OPTS.find(o => o.value === lockTime)?.label ?? 'Jamais';
  const trackLabel = trackDate
    ? new Date(trackDate).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })
    : 'Non définie ›';

  const sections = [
    { title:'Mon compte', items:[
      { label:'Informations personnelles', right:'›', onPress: handleEditProfile },
      { label:"Monnaie d'affichage",       right:'DH (MAD) ›', onPress:() => handleItem("Monnaie d'affichage") },
      { label:'Date de debut de suivi',    right:`${trackLabel} ›`, onPress:() => { setTrackInput(trackDate || ''); setEditTrack(true); } },
    ]},
    { title:'Sécurité', items:[
      { label:'Auth. biometrique (Face ID)',    right:<Toggle on={bio}      onChange={handleBioToggle}/> },
      { label:'Code PIN 6 chiffres',            right:pinSet ? '✓ Défini ›' : 'Non défini ›', onPress: openPinSetup },
      { label:'Verrouillage automatique',       right:`${lockLabel} ›`, onPress:() => setLockPicker(true) },
      { label:'Mode discret (masquer montants)',right:<Toggle on={!!discret} onChange={onDiscretChange}/> },
    ]},
    { title:'Notifications', items:[
      { label:'Rappels mensuels patrimoine', right:<Toggle on={rappels} onChange={handleRappelToggle}/> },
      { label:'Alertes de performance',      right:<Toggle on={alertes} onChange={v => { setAlertes(v); savePrefs({ alertes:v }); }}/> },
      { label:'Synthese hebdo marches',      right:<Toggle on={hebdo}   onChange={v => { setHebdo(v);   savePrefs({ hebdo:v });   }}/> },
    ]},
    { title:'Données & Export', items:[
      { label: exportingPDF ? 'Generation du PDF...' : 'Exporter en PDF', right: exportingPDF ? '⏳' : '›', onPress: exportingPDF ? null : handleExportPDF },
      { label:'Exporter en CSV',              right:'›',  onPress: handleExportCSV },
      { label:'Importer releve bancaire CSV', right:'📥', onPress: () => { setImportText(''); setImportResult(null); setImportVisible(true); } },
      { label:'Supprimer mon compte', right:<Text style={{ color:C.sec }}>›</Text>, onPress:() => Alert.alert('Suppression', 'Contactez zineddine.othmane1@gmail.com pour supprimer votre compte.') },
    ]},
  ];

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Paramètres" subtitle="PatriMoi v1.6"/>
      <ScrollView style={{ flex:1, backgroundColor:C.g1 }} contentContainerStyle={{ padding:12 }}>

        {/* Profil */}
        <Card style={{ backgroundColor:C.pri, padding:14, marginBottom:14 }}>
          <View style={{ flexDirection:'row', gap:12, alignItems:'center' }}>
            <View style={{ width:50, height:50, borderRadius:25, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color:C.white, fontWeight:'700', fontSize:18 }}>{initiales}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ color:C.white, fontWeight:'700', fontSize:15 }}>{nomComplet}</Text>
              <Text style={{ color:'rgba(180,230,200,0.85)', fontSize:12 }}>{email}</Text>
            </View>
            <View style={{ backgroundColor:C.acc, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}>
              <Text style={{ fontSize:11, fontWeight:'700', color:C.white }}>{demoMode ? 'Demo' : 'PatriMoi+'}</Text>
            </View>
          </View>
        </Card>

        {/* Formulaire édition profil */}
        {editingProfile && (
          <Card style={{ borderWidth:1.5, borderColor:C.pri, marginBottom:14 }}>
            <Text style={{ fontWeight:'700', fontSize:13, color:C.pri, marginBottom:10 }}>Modifier le profil</Text>
            <Input label="Prenom" value={editPrenom} onChangeText={setEditPrenom} placeholder="Votre prenom"/>
            <Input label="Nom"    value={editNom}    onChangeText={setEditNom}    placeholder="Votre nom"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec style={{ flex:1 }} onPress={() => setEditingProfile(false)}>Annuler</BtnSec>
              <BtnPri style={{ flex:1 }} onPress={handleSaveProfile} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={C.white}/> : 'Enregistrer'}
              </BtnPri>
            </View>
          </Card>
        )}

        {/* Sections */}
        {sections.map((sec, si) => (
          <View key={si}>
            <Text style={{ fontSize:11, fontWeight:'600', color:C.g3, marginTop:14, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>{sec.title}</Text>
            <Card style={{ padding:0, overflow:'hidden' }}>
              {sec.items.map((it, ii) => {
                const hasPress = !!it.onPress;
                const Wrap = hasPress ? TouchableOpacity : View;
                return (
                  <Wrap
                    key={ii}
                    onPress={it.onPress}
                    activeOpacity={0.7}
                    style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:13, borderBottomWidth:ii<sec.items.length-1?1:0, borderBottomColor:C.g1 }}
                  >
                    <Text style={{ flex:1, fontSize:13, color:C.dark }}>{it.label}</Text>
                    {typeof it.right === 'string'
                      ? <Text style={{ fontSize:12, color:C.g3 }}>{it.right}</Text>
                      : it.right
                    }
                  </Wrap>
                );
              })}
            </Card>
          </View>
        ))}

        {/* Objectif patrimonial */}
        <Text style={{ fontSize:11, fontWeight:'600', color:C.g3, marginTop:14, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Objectif Patrimonial</Text>
        <Card style={{ padding:14 }}>
          {editingObj ? (
            <>
              <Text style={{ fontWeight:'700', fontSize:13, color:C.pri, marginBottom:10 }}>Definir mon objectif</Text>
              <Input label="Montant cible (DH)" value={objMontant} onChangeText={setObjMontant} keyboardType="numeric" placeholder="3000000"/>
              <Input label="Annee cible"        value={objDate}    onChangeText={setObjDate}    keyboardType="numeric" placeholder="2030"/>
              <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
                <BtnSec style={{ flex:1 }} onPress={() => setEditingObj(false)}>Annuler</BtnSec>
                <BtnPri style={{ flex:1 }} onPress={handleSaveObj}>Enregistrer</BtnPri>
              </View>
            </>
          ) : objectif ? (
            <View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <View>
                  <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>{fmt(objectif.montant)}</Text>
                  <Text style={{ fontSize:12, color:C.g3, marginTop:2 }}>Objectif d'ici {objectif.dateTarget}</Text>
                </View>
                <TouchableOpacity onPress={handleEditObj} style={{ backgroundColor:C.priL, borderRadius:8, paddingHorizontal:12, paddingVertical:6 }}>
                  <Text style={{ fontSize:12, color:C.pri, fontWeight:'600' }}>Modifier</Text>
                </TouchableOpacity>
              </View>
              {onObjectifChange && (
                <TouchableOpacity onPress={() => { Alert.alert('Supprimer', 'Retirer cet objectif ?', [{ text:'Annuler', style:'cancel' }, { text:'Supprimer', style:'destructive', onPress:() => onObjectifChange(null) }]); }}
                  style={{ marginTop:10 }}>
                  <Text style={{ fontSize:11, color:C.g3, textAlign:'center' }}>Supprimer l'objectif</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <BtnPri onPress={handleEditObj}>+ Définir un objectif patrimonial</BtnPri>
          )}
        </Card>

        {/* Abonnement */}
        <Text style={{ fontSize:11, fontWeight:'600', color:C.g3, marginTop:14, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Abonnement</Text>
        <Card style={{ borderLeftWidth:4, borderLeftColor:C.pri }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <View>
              <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>Plan PatriMoi+</Text>
              <Text style={{ fontSize:12, color:C.g3, marginTop:2 }}>Comptes illimités - Temps réel - Export</Text>
            </View>
            <View style={{ alignItems:'flex-end' }}>
              <Text style={{ fontWeight:'700', fontSize:16, color:C.pri }}>29 DH</Text>
              <Text style={{ fontSize:10, color:C.g3 }}>/mois</Text>
            </View>
          </View>
          <BtnSec
            style={{ marginTop:10 }}
            onPress={() => Alert.alert('Abonnement', "Gestion de l'abonnement disponible dans une prochaine version.")}
          >
            Gérer mon abonnement →
          </BtnSec>
        </Card>

        {/* Déconnexion */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={{ marginTop:20, marginBottom:8, backgroundColor:'#FFF0F0', borderRadius:12, paddingVertical:14, alignItems:'center', borderWidth:1.5, borderColor:'#FFCCCC' }}
          activeOpacity={0.8}
        >
          <Text style={{ color:C.sec, fontWeight:'700', fontSize:14 }}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal — PIN 6 chiffres (AN_012) */}
      <Modal visible={pinModal} transparent animationType="slide" onRequestClose={() => setPinModal(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:C.white, borderTopLeftRadius:20, borderTopRightRadius:20, padding:24 }}>
            <Text style={{ fontWeight:'700', fontSize:15, color:C.dark, marginBottom:4, textAlign:'center' }}>
              {pinStep === 'verify' ? 'Vérification' : pinStep === 'set' ? 'Nouveau code PIN' : 'Confirmer le code'}
            </Text>
            <Text style={{ fontSize:12, color:C.g3, marginBottom:18, textAlign:'center' }}>
              {pinStep === 'verify' ? 'Entrez votre code PIN actuel'
                : pinStep === 'set' ? 'Choisissez un code à 6 chiffres'
                : 'Répétez le même code PIN'}
            </Text>
            <TextInput
              value={pinStep === 'verify' ? pinVerify : pinStep === 'set' ? pinInput : pinConfirm}
              onChangeText={v => {
                const d = v.replace(/\D/g, '').slice(0, 6);
                if (pinStep === 'verify') setPinVerify(d);
                else if (pinStep === 'set') setPinInput(d);
                else setPinConfirm(d);
                setPinError('');
              }}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor={C.g3}
              maxLength={6}
              autoFocus
              style={{
                borderWidth:1.5, borderColor:C.g2, borderRadius:10,
                fontSize:22, textAlign:'center', paddingVertical:14,
                letterSpacing:8, color:C.dark, backgroundColor:C.g1, marginBottom:8,
              }}
            />
            {pinError ? <Text style={{ color:C.sec, fontSize:12, textAlign:'center', marginBottom:8 }}>{pinError}</Text> : null}
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <TouchableOpacity onPress={() => setPinModal(false)} style={{ flex:1, paddingVertical:13, borderRadius:10, alignItems:'center', backgroundColor:C.g1 }}>
                <Text style={{ color:C.g3, fontWeight:'600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePinNext} style={{ flex:2, paddingVertical:13, borderRadius:10, alignItems:'center', backgroundColor:C.pri }}>
                <Text style={{ color:C.white, fontWeight:'700' }}>
                  {pinStep === 'confirm' ? 'Enregistrer' : 'Suivant'}
                </Text>
              </TouchableOpacity>
            </View>
            {pinSet && pinStep === 'verify' && (
              <TouchableOpacity onPress={() => { setPinModal(false); handleRemovePin(); }} style={{ marginTop:14, alignItems:'center' }}>
                <Text style={{ fontSize:12, color:C.sec }}>Supprimer le code PIN</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Picker — Verrouillage automatique (AN_013) */}
      <PickerModal
        visible={lockPicker}
        title="Verrouillage automatique"
        options={LOCK_OPTS}
        onSelect={handleLockChange}
        onClose={() => setLockPicker(false)}
      />

      {/* Modal — Date de début de suivi (AN_014) */}
      <Modal visible={editTrack} transparent animationType="slide" onRequestClose={() => setEditTrack(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:C.white, borderTopLeftRadius:20, borderTopRightRadius:20, padding:24 }}>
            <Text style={{ fontWeight:'700', fontSize:15, color:C.dark, marginBottom:4 }}>Date de début de suivi</Text>
            <Text style={{ fontSize:12, color:C.g3, marginBottom:14 }}>
              Le graphique évolution affichera les données depuis cette date (période MAX).
            </Text>
            <TextInput
              value={trackInput}
              onChangeText={setTrackInput}
              placeholder="2022  ou  01/01/2022  ou  2022-01-01"
              placeholderTextColor={C.g3}
              style={{
                borderWidth:1.5, borderColor:C.g2, borderRadius:10,
                fontSize:14, paddingHorizontal:14, paddingVertical:12,
                color:C.dark, backgroundColor:C.g1, marginBottom:14,
              }}
            />
            <View style={{ flexDirection:'row', gap:8 }}>
              <TouchableOpacity onPress={() => setEditTrack(false)} style={{ flex:1, paddingVertical:13, borderRadius:10, alignItems:'center', backgroundColor:C.g1 }}>
                <Text style={{ color:C.g3, fontWeight:'600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveTrackDate} style={{ flex:2, paddingVertical:13, borderRadius:10, alignItems:'center', backgroundColor:C.pri }}>
                <Text style={{ color:C.white, fontWeight:'700' }}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
            {trackDate ? (
              <TouchableOpacity onPress={() => { storage.set(TRACK_KEY, null); setTrackDate(''); onTrackingStartChange?.(null); setEditTrack(false); }} style={{ marginTop:14, alignItems:'center' }}>
                <Text style={{ fontSize:12, color:C.sec }}>Réinitialiser (afficher tout)</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Modal — Import CSV bancaire */}
      <Modal visible={importVisible} animationType="slide" onRequestClose={() => setImportVisible(false)}>
        <View style={{ flex:1, backgroundColor:C.g1 }}>
          <TopBar
            title="Importer relevé bancaire"
            subtitle="Collez votre CSV banque"
            onBack={() => setImportVisible(false)}
          />
          <ScrollView contentContainerStyle={{ padding:14 }}>
            <Card>
              <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, marginBottom:6 }}>Collez le contenu de votre relevé CSV</Text>
              <Text style={{ fontSize:11, color:C.g3, marginBottom:10, lineHeight:16 }}>
                Exportez depuis CIH Online, Attijarinet, BCP… au format CSV, copiez tout, et collez ici.
              </Text>
              <TextInput
                multiline
                value={importText}
                onChangeText={t => { setImportText(t); setImportResult(null); }}
                placeholder={'Date;Libelle;Debit;Credit;Solde\n01/07/2026;Salaire;;12000;32000\n15/07/2026;Loyer;5000;;27000'}
                placeholderTextColor={C.g3}
                style={{
                  backgroundColor:C.g1, borderRadius:8, padding:10, borderWidth:1, borderColor:C.g2,
                  fontSize:11, color:C.dark, height:180, textAlignVertical:'top',
                }}
              />
              <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
                <BtnSec style={{ flex:1 }} onPress={() => { setImportText(''); setImportResult(null); }}>Effacer</BtnSec>
                <BtnPri style={{ flex:1 }} onPress={() => setImportResult(parseCSV(importText))}>Analyser</BtnPri>
              </View>
            </Card>

            {importResult && (
              <Card style={{ marginTop:10, borderLeftWidth:4, borderLeftColor: importResult.solde !== null ? C.gpos : C.gold }}>
                <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, marginBottom:8 }}>Résultat</Text>
                <Text style={{ fontSize:12, color:C.g3, marginBottom:6 }}>{importResult.count} ligne(s) analysée(s)</Text>
                {importResult.solde !== null ? (
                  <>
                    <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:8, borderTopWidth:1, borderTopColor:C.g1 }}>
                      <Text style={{ fontSize:13, color:C.dark }}>Solde détecté</Text>
                      <Text style={{ fontWeight:'800', fontSize:20, color:C.gpos }}>{importResult.solde.toLocaleString('fr-FR', { maximumFractionDigits:0 })} DH</Text>
                    </View>
                    <Text style={{ fontSize:11, color:C.g3, marginTop:4, marginBottom:12, lineHeight:16 }}>
                      Accédez à Actifs → Argent en Banque pour mettre à jour le solde de votre compte avec cette valeur.
                    </Text>
                    <BtnPri onPress={() => {
                      setImportVisible(false);
                      Alert.alert(
                        'Solde importé',
                        `Solde détecté : ${importResult.solde.toLocaleString('fr-FR', { maximumFractionDigits:0 })} DH\n\nRendez-vous dans Actifs > Argent en Banque pour mettre à jour votre compte.`,
                        [{ text: 'OK' }]
                      );
                    }}>Fermer et mettre à jour →</BtnPri>
                  </>
                ) : (
                  <Text style={{ fontSize:12, color:C.gold, lineHeight:18 }}>
                    ⚠ Aucun solde détecté automatiquement. Vérifiez que votre CSV contient une colonne "Solde" ou des montants lisibles.
                  </Text>
                )}
              </Card>
            )}

            <Card style={{ marginTop:10, backgroundColor:'#EFF6FF', borderWidth:0 }}>
              <Text style={{ fontWeight:'700', fontSize:12, color:'#1D4ED8', marginBottom:6 }}>Format reconnu</Text>
              <Text style={{ fontSize:11, color:C.dark, lineHeight:17 }}>
                {'Date;Libellé;Débit;Crédit;Solde\n01/07/2026;Virement;-;12000;32000\n15/07/2026;Loyer;5000;-;27000'}
              </Text>
              <Text style={{ fontSize:10, color:C.g3, marginTop:6 }}>
                Séparateurs acceptés : virgule (,) ou point-virgule (;)
              </Text>
            </Card>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
