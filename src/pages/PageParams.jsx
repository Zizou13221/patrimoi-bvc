import React, { useState, useCallback, useEffect } from 'react';
import { usePatrimoineStore } from '../store/patrimoineStore';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, Share, Platform, Modal } from 'react-native';
import { storage } from '../utils/storage';
import { C } from '../constants/colors';
import { Card, BtnSec, BtnPri, Toggle, TopBar, Input, PickerModal } from '../components/shared';

import { isBiometricsAvailable, authenticateBiometric } from '../utils/biometrics';
import { updateProfile, deleteAccount } from '../utils/auth';
import { trackExportPDF, trackBvcAlertAdded, trackPaywallViewed } from '../utils/analytics';
import {
  calcLiquide, calcBanque, calcCarnet, calcPEA, calcPEACout, calcCT, calcCTCout,
  calcOr, calcImmo, calcTransport, totalPatrimoine, totalCout,
} from '../utils/calc';
import { fmt } from '../utils/fmt';
import { INIT } from '../constants/data';

const PREFS_KEY = '@patrimoi_prefs';

export default function PageParams({ onSignOut, onObjectifChange, onTrackingStartChange, onNav }) {
  const data              = usePatrimoineStore(s => s.data);
  const user              = usePatrimoineStore(s => s.user);
  const demoMode          = usePatrimoineStore(s => s.demoMode);
  const discret           = usePatrimoineStore(s => s.discret);
  const onDiscretChange   = usePatrimoineStore(s => s.setDiscret);
  const objectif          = usePatrimoineStore(s => s.objectif);
  const history           = usePatrimoineStore(s => s.history);
  const trackingStartDate = usePatrimoineStore(s => s.trackingStartDate);
  const isPremium         = usePatrimoineStore(s => s.isPremium);
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

  // ── Alertes BVC ───────────────────────────────────────────
  const [bvcAlerts,    setBvcAlerts]    = useState([]);
  const [alertModal,   setAlertModal]   = useState(false);
  const [alertTicker,  setAlertTicker]  = useState('');
  const [alertHaut,    setAlertHaut]    = useState('');
  const [alertBas,     setAlertBas]     = useState('');
  const [editAlertIdx, setEditAlertIdx] = useState(-1);
  // ── PDF date range ────────────────────────────────────────
  const [pdfModal,     setPdfModal]     = useState(false);
  const [pdfFrom,      setPdfFrom]      = useState('');
  const [pdfTo,        setPdfTo]        = useState('');

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
    // Alertes BVC
    const savedAlerts = storage.get('@patrimoi_bvc_alerts') || [];
    setBvcAlerts(savedAlerts);
  }, []); // eslint-disable-line

  const savePrefs = useCallback((patch) => {
    const prev = storage.get(PREFS_KEY) ?? {};
    storage.set(PREFS_KEY, { ...prev, ...patch });
  }, []);

  // ── AN_012 — PIN handlers ──────────────────────────────────
  const openPinSetup = useCallback(() => {
    setPinInput(''); setPinConfirm(''); setPinVerify(''); setPinError('');
    setPinStep(pinSet ? 'verify' : 'set');
    setPinModal(true);
  }, [pinSet]);

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

  // ── Alertes BVC — CRUD ────────────────────────────────────
  const saveAlertsList = useCallback((updated) => {
    setBvcAlerts(updated);
    storage.set('@patrimoi_bvc_alerts', updated);
  }, []);

  const handleOpenAddAlert = useCallback(() => {
    if (!isPremium) {
      trackPaywallViewed('bvc_alerts');
      Alert.alert(
        'Fonctionnalité PatriMoi+',
        'Les alertes cours BVC sont réservées aux abonnés PatriMoi+.\n\nAbonnez-vous pour être notifié dès qu\'un cours franchit votre seuil.',
        [
          { text: 'Fermer', style: 'cancel' },
          { text: 'Découvrir PatriMoi+', onPress: () => Alert.alert('PatriMoi+', 'Gestion de l\'abonnement disponible dans une prochaine version.') },
        ]
      );
      return;
    }
    setAlertTicker(''); setAlertHaut(''); setAlertBas(''); setEditAlertIdx(-1);
    setAlertModal(true);
  }, [isPremium]);

  const handleEditAlert = useCallback((idx) => {
    const a = bvcAlerts[idx];
    setAlertTicker(a.ticker);
    setAlertHaut(a.seuilHaut > 0 ? String(a.seuilHaut) : '');
    setAlertBas(a.seuilBas  > 0 ? String(a.seuilBas)  : '');
    setEditAlertIdx(idx);
    setAlertModal(true);
  }, [bvcAlerts]);

  const handleSaveAlert = useCallback(() => {
    const ticker = alertTicker.trim().toUpperCase().replace(/ .*/, ''); // prend juste le ticker
    if (!ticker) { Alert.alert('Erreur', 'Entrez un ticker BVC (ex : ATW, BCP…)'); return; }
    const h = parseFloat(String(alertHaut).replace(',', '.')) || 0;
    const b = parseFloat(String(alertBas).replace(',', '.'))  || 0;
    if (h === 0 && b === 0) { Alert.alert('Erreur', 'Définissez au moins un seuil (haut ou bas).'); return; }
    const newAlert = {
      id:        editAlertIdx >= 0 ? bvcAlerts[editAlertIdx].id : Date.now(),
      ticker,
      seuilHaut: h,
      seuilBas:  b,
      enabled:   true,
    };
    const updated = editAlertIdx >= 0
      ? bvcAlerts.map((a, i) => i === editAlertIdx ? newAlert : a)
      : [...bvcAlerts, newAlert];
    if (editAlertIdx < 0) trackBvcAlertAdded(); // E14 — seulement à la création
    saveAlertsList(updated);
    setAlertModal(false);
  }, [alertTicker, alertHaut, alertBas, editAlertIdx, bvcAlerts, saveAlertsList]);

  const handleDeleteAlert = useCallback((idx) => {
    Alert.alert('Supprimer', 'Supprimer cette alerte ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => saveAlertsList(bvcAlerts.filter((_, i) => i !== idx)) },
    ]);
  }, [bvcAlerts, saveAlertsList]);

  const handleToggleAlert = useCallback((idx) => {
    saveAlertsList(bvcAlerts.map((a, i) => i === idx ? { ...a, enabled: !a.enabled } : a));
  }, [bvcAlerts, saveAlertsList]);

  // ── PDF — ouvrir modal plage de dates ─────────────────────
  const openPdfModal = useCallback(() => {
    const now = new Date();
    const y   = now.getFullYear();
    const m   = String(now.getMonth() + 1).padStart(2, '0');
    const dd  = String(now.getDate()).padStart(2, '0');
    setPdfFrom(`${y}-${m}-01`);
    setPdfTo(`${y}-${m}-${dd}`);
    setPdfModal(true);
  }, []);

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
  const [exportingPatrimoinePDF, setExportingPatrimoinePDF] = useState(false);
  const [exportingBudgetPDF,     setExportingBudgetPDF]     = useState(false);
  const [deletingAccount,        setDeletingAccount]        = useState(false);

  // ── Résolution module PDF natif (commun aux deux exports) ─────────────
  const getPDFModule = () => {
    try { const { NativeModules } = require('react-native'); const m = NativeModules?.RNPDFExport; if (m && typeof m.convert === 'function') return m; } catch {}
    try { const { NativeModules } = require('react-native'); const m = NativeModules?.RNHTMLtoPDF || NativeModules?.HtmlToPdf; if (m && typeof m.convert === 'function') return m; } catch {}
    try { const { TurboModuleRegistry } = require('react-native'); const m = TurboModuleRegistry?.get?.('RNPDFExport') || TurboModuleRegistry?.get?.('HtmlToPdf') || TurboModuleRegistry?.get?.('RNHTMLtoPDF'); if (m && typeof m.convert === 'function') return m; } catch {}
    return null;
  };

  // ── Export Patrimoine PDF ──────────────────────────────────────────────
  const handleExportPatrimoinePDF = useCallback(async () => {
    const d = data || INIT;
    setExportingPatrimoinePDF(true);
    try {
      const RNHTMLtoPDF = getPDFModule();

      // Fallback texte si pas de module natif
      if (!RNHTMLtoPDF) {
        const fmtT = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits:0 }) + ' DH';
        const sep  = '─'.repeat(38);
        const lines = [
          '📊 PatriMoi — Rapport Patrimoine',
          `Date : ${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}`,
          sep,
          `Argent Liquide & Devises  ${fmtT(calcLiquide(d.liquidites))}`,
          `Argent en Banque          ${fmtT(calcBanque(d.banque))}`,
          `Compte sur Carnet         ${fmtT(calcCarnet(d.carnet))}`,
          `Compte PEA                ${fmtT(calcPEA(d.pea))}`,
          `Compte-Titre              ${fmtT(calcCT(d.ct))}`,
          `Or & Métaux Précieux      ${fmtT(calcOr(d.or, d.prixOr))}`,
          `Immobilier & Terrains     ${fmtT(calcImmo(d.immobilier))}`,
          `Biens de Transport        ${fmtT(calcTransport(d.transport))}`,
          sep,
          `TOTAL PATRIMOINE          ${fmtT(totalPatrimoine(d))}`,
          '', 'Généré par PatriMoi v1.6',
        ].join('\n');
        await Share.share({ message: lines, title: 'PatriMoi — Rapport Patrimoine' });
        setExportingPatrimoinePDF(false);
        return;
      }

      // ── Helpers ────────────────────────────────────────────
      const fmtPDF  = (n) => { if (!n && n !== 0) return '—'; return n.toLocaleString('fr-FR', { maximumFractionDigits:0 }) + ' DH'; };
      const fmtPct  = (v) => v > 0 ? '+' + v.toFixed(1) + '%' : v.toFixed(1) + '%';
      const fmtDiff = (v) => v > 0 ? '+' + Math.round(v).toLocaleString('fr-FR') + ' DH' : Math.round(v).toLocaleString('fr-FR') + ' DH';
      const fmtD    = (iso) => { if (!iso) return ''; const d = String(iso).slice(0, 10); const [yy,mm,dd] = d.split('-'); return `${dd||'?'}/${mm||'?'}/${yy||'?'}`; };
      const colPos  = '#1E7A4A';
      const colNeg  = '#C0392B';
      const colNeu  = '#888';
      const diffColor = (v) => v > 0 ? colPos : v < 0 ? colNeg : colNeu;

      const date  = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
      const total = totalPatrimoine(d);
      const today = new Date().toISOString().slice(0, 10);

      // ── Historique patrimoine ──────────────────────────────
      const sortedHist = [...(history || [])].sort((a, b) => a.date.localeCompare(b.date));
      const firstEntry = sortedHist[0];

      // Mois précédent : dernier snapshot du mois M-1
      const prevMonthDate = new Date(); prevMonthDate.setDate(1); prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const prevMonthStr  = prevMonthDate.toISOString().slice(0, 7); // YYYY-MM
      const prevMonthSnaps = sortedHist.filter(h => h.date.startsWith(prevMonthStr));
      const prevMonthEntry = prevMonthSnaps[prevMonthSnaps.length - 1] || null;

      // Début du mois courant
      const curMonthStr  = today.slice(0, 7);
      const curMonthSnaps = sortedHist.filter(h => h.date.startsWith(curMonthStr));
      const startOfMonthEntry = curMonthSnaps[0] || prevMonthEntry;

      const varMois      = prevMonthEntry ? total - prevMonthEntry.val : null;
      const varMoisPct   = prevMonthEntry && prevMonthEntry.val > 0 ? (varMois / prevMonthEntry.val * 100) : null;
      const varCreation  = firstEntry ? total - firstEntry.val : null;
      const varCreaPct   = firstEntry && firstEntry.val > 0 ? (varCreation / firstEntry.val * 100) : null;
      const dateCreation = firstEntry ? fmtD(firstEntry.date) : null;

      // ── Sparkline SVG ─────────────────────────────────────
      const sparkData = sortedHist.slice(-13);
      const sparkHtml = (() => {
        if (sparkData.length < 2) return '';
        const W = 580, H = 56, pad = 4;
        const vals = sparkData.map(h => h.val);
        const minV = Math.min(...vals), maxV = Math.max(...vals);
        const range = maxV - minV || 1;
        const pts = sparkData.map((h, i) => {
          const x = pad + (W - 2 * pad) * i / (sparkData.length - 1);
          const y = H - pad - (H - 2 * pad) * (h.val - minV) / range;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        const fillPts = `${pad},${H - pad} ` + pts.join(' ') + ` ${(W - pad).toFixed(1)},${H - pad}`;
        const labelFirst = sparkData[0].date.slice(0, 7).split('-').reverse().join('/');
        const labelLast  = sparkData[sparkData.length - 1].date.slice(0, 7).split('-').reverse().join('/');
        const minIdx = vals.indexOf(minV); const maxIdx = vals.indexOf(maxV);
        return `<svg viewBox="0 0 ${W} ${H + 14}" xmlns="http://www.w3.org/2000/svg" style="width:100%; display:block;">
          <defs><linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1E7A4A" stop-opacity="0.22"/><stop offset="100%" stop-color="#1E7A4A" stop-opacity="0.02"/></linearGradient></defs>
          <polygon points="${fillPts}" fill="url(#gS)"/>
          <polyline points="${pts.join(' ')}" fill="none" stroke="#1E7A4A" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          <circle cx="${pts[pts.length-1].split(',')[0]}" cy="${pts[pts.length-1].split(',')[1]}" r="3.5" fill="#1E7A4A"/>
          <circle cx="${pts[maxIdx].split(',')[0]}" cy="${pts[maxIdx].split(',')[1]}" r="2.5" fill="#1E7A4A" opacity="0.5"/>
          <circle cx="${pts[minIdx].split(',')[0]}" cy="${pts[minIdx].split(',')[1]}" r="2.5" fill="#C0392B" opacity="0.5"/>
          <text x="${pad}" y="${H + 11}" font-size="8" fill="#aaa">${labelFirst}</text>
          <text x="${W - pad}" y="${H + 11}" font-size="8" fill="#aaa" text-anchor="end">${labelLast}</text>
          <text x="${W/2}" y="${H + 11}" font-size="8" fill="#888" text-anchor="middle">min ${fmtPDF(minV)}  ·  max ${fmtPDF(maxV)}</text>
        </svg>`;
      })();

      // ── Répartition actifs ─────────────────────────────────
      const cats = [
        { label:'Liquidites & Devises',  val: calcLiquide(d.liquidites),  color:'#27AE60' },
        { label:'Argent en Banque',       val: calcBanque(d.banque),        color:'#2980B9' },
        { label:'Compte sur Carnet',      val: calcCarnet(d.carnet),        color:'#1ABC9C' },
        { label:'Compte PEA',             val: calcPEA(d.pea),              color:'#16A085' },
        { label:'Compte-Titre',           val: calcCT(d.ct),                color:'#8E44AD' },
        { label:'Or & Metaux Precieux',   val: calcOr(d.or, d.prixOr),     color:'#D4AC0D' },
        { label:'Immobilier & Terrains',  val: calcImmo(d.immobilier),      color:'#C0392B' },
        { label:'Biens de Transport',     val: calcTransport(d.transport),  color:'#7F8C8D' },
      ].filter(c => c.val > 0).sort((a, b) => b.val - a.val);

      // Donut compact 130px
      const donutSvg = (() => {
        if (total === 0 || cats.length === 0) return '';
        const cx = 65, cy = 65, R = 55, r = 32;
        let angle = -Math.PI / 2;
        const slices = cats.map(c => {
          const sweep = c.val / total * 2 * Math.PI;
          const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
          angle += sweep;
          const x2 = cx + R * Math.cos(angle), y2 = cy + R * Math.sin(angle);
          const xi1 = cx + r * Math.cos(angle - sweep), yi1 = cy + r * Math.sin(angle - sweep);
          const xi2 = cx + r * Math.cos(angle), yi2 = cy + r * Math.sin(angle);
          const lg = sweep > Math.PI ? 1 : 0;
          return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${lg} 1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xi2.toFixed(1)},${yi2.toFixed(1)} A${r},${r} 0 ${lg} 0 ${xi1.toFixed(1)},${yi1.toFixed(1)} Z" fill="${c.color}" opacity="0.9"/>`;
        }).join('');
        const totalK = total >= 1000000 ? (total/1000000).toFixed(1)+'M' : (total/1000).toFixed(0)+'k';
        return `<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg" width="130" height="130">${slices}<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="8" fill="#777">Total</text><text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="10" font-weight="bold" fill="#1a1a1a">${totalK}</text></svg>`;
      })();

      // Rows répartition (compact 9px — 3 colonnes seulement : cat | valeur | %)
      const repartRows = cats.map((c, i) => {
        const pct = total > 0 ? c.val / total * 100 : 0;
        return `<tr style="background:${i % 2 === 0 ? 'white' : '#FAFAFA'};">
          <td style="padding:4px 7px; font-size:9px; color:#333; border-bottom:1px solid #f0f0f0;">
            <span style="display:inline-block; width:7px; height:7px; border-radius:2px; background:${c.color}; vertical-align:middle; margin-right:4px;"></span>${c.label}
          </td>
          <td style="padding:4px 7px; text-align:right; font-size:10px; font-weight:700; color:${c.color}; border-bottom:1px solid #f0f0f0; white-space:nowrap;">${fmtPDF(c.val)}</td>
          <td style="padding:4px 7px; text-align:right; font-size:9px; font-weight:600; color:#555; border-bottom:1px solid #f0f0f0; white-space:nowrap;">${pct.toFixed(1)}%</td>
        </tr>`;
      }).join('');

      // ── Objectif ────────────────────────────────────────────
      const objPct = objectif && objectif.montant > 0 ? Math.min(100, total / objectif.montant * 100) : 0;
      const monthsToTarget = objectif && objectif.dateTarget ? (() => {
        try {
          const s = String(objectif.dateTarget).trim();
          const targetDate = s.length === 4 ? new Date(s + '-12-31') : new Date(s);
          return Math.max(0, (targetDate - new Date()) / (1000 * 60 * 60 * 24 * 30.44));
        } catch { return null; }
      })() : null;
      const monthlyNeeded = (objectif && monthsToTarget > 0) ? Math.max(0, objectif.montant - total) / monthsToTarget : null;

      // ── Performance actifs financiers ────────────────────────
      const peaVal  = calcPEA(d.pea);
      const peaCout = calcPEACout(d.pea);
      const peaPL   = peaVal - peaCout;
      const peaPct  = peaCout > 0 ? (peaPL / peaCout * 100) : null;
      const ctVal   = calcCT(d.ct);
      const ctCout  = calcCTCout(d.ct);
      const ctPL    = ctVal - ctCout;
      const ctPct   = ctCout > 0 ? (ctPL / ctCout * 100) : null;
      const orVal            = calcOr(d.or, d.prixOr);
      const totalActifsCout  = peaCout + ctCout;
      const totalActifsVal   = peaVal + ctVal;
      const totalActifsPL    = totalActifsVal - totalActifsCout;
      const totalActifsPct   = totalActifsCout > 0 ? (totalActifsPL / totalActifsCout * 100) : null;
      const immoVal  = calcImmo(d.immobilier);
      const transVal = calcTransport(d.transport);
      const moisStart    = startOfMonthEntry ? startOfMonthEntry.val : null;
      const rendMois     = moisStart ? total - moisStart : null;
      const rendMoisPct  = moisStart && moisStart > 0 ? (rendMois / moisStart * 100) : null;
      const hasActifsPerf = peaCout > 0 || ctCout > 0 || orVal > 0 || immoVal > 0 || transVal > 0;

      // ── Budget ─────────────────────────────────────────────
      const opsAll   = (d.operations || []);
      const opsFil   = opsAll.filter(op => {
        if (!pdfFrom || !pdfTo) return true;
        const opDate = (op.date || '').slice(0, 10);
        return opDate >= pdfFrom && opDate <= pdfTo;
      });
      const depenses     = opsFil.filter(o => o.type === 'depense');
      const revenuOps    = opsFil.filter(o => o.type === 'revenu');
      const epargneOps   = opsFil.filter(o => o.type === 'epargne');
      const totalDep     = depenses.reduce((s, o) => s + (o.montant || 0), 0);
      const totalRev     = revenuOps.reduce((s, o) => s + (o.montant || 0), 0);
      const totalEpargne = epargneOps.reduce((s, o) => s + (o.montant || 0), 0);
      const balance      = totalRev - totalDep + totalEpargne;
      const tauxEpargne  = (totalRev + totalEpargne) > 0 ? (totalEpargne / (totalRev + totalEpargne) * 100) : null;
      const opsPrevMois   = opsAll.filter(op => (op.date || '').slice(0, 7) === prevMonthStr && op.type === 'depense');
      const totalDepPrev  = opsPrevMois.reduce((s, o) => s + (o.montant || 0), 0);
      const varDepMois    = totalDepPrev > 0 ? totalDep - totalDepPrev : null;
      const varDepMoisPct = totalDepPrev > 0 ? (varDepMois / totalDepPrev * 100) : null;
      const budgetCibles     = d.budgetCibles || {};
      const totalBudgetCible = Object.values(budgetCibles).reduce((s, v) => s + (v || 0), 0);
      const budgetRestant    = totalBudgetCible > 0 ? totalBudgetCible - totalDep : null;
      const budgetPct        = totalBudgetCible > 0 ? Math.min(100, totalDep / totalBudgetCible * 100) : null;
      const byCat      = {};
      depenses.forEach(o => { byCat[o.categorie || 'autre'] = (byCat[o.categorie || 'autre'] || 0) + (o.montant || 0); });
      const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const CAT_COLORS = { alimentation:'#E74C3C', transport:'#2980B9', logement:'#8E44AD', loisirs:'#E67E22', sante:'#1ABC9C', education:'#F39C12', dividende:'#27AE60', autre:'#7F8C8D' };
      const periodLabel = pdfFrom && pdfTo ? `${fmtD(pdfFrom)} — ${fmtD(pdfTo)}` : opsFil.length > 0 ? 'Toutes les operations' : 'Ce mois';

      // Badges header (inline-block strict)
      const mkBadge = (label, pct, diff) => `<span style="display:inline-block; background:rgba(255,255,255,0.13); border-radius:5px; padding:5px 10px; margin-right:7px; margin-bottom:5px; vertical-align:top;"><div style="font-size:8px; opacity:0.65; text-transform:uppercase; letter-spacing:0.3px; margin-bottom:2px;">${label}</div><div style="font-size:12px; font-weight:700; color:${(parseFloat(pct) >= 0 ? '#8DECB4' : '#FFAAAA')};">${pct}</div><div style="font-size:9px; opacity:0.75;">${diff}</div></span>`;
      const badgesHtml = [
        varMoisPct !== null   ? mkBadge('vs mois precedent',  fmtPct(varMoisPct),  fmtDiff(varMois))   : '',
        varCreaPct !== null   ? mkBadge('depuis creation' + (dateCreation ? ' ('+dateCreation+')' : ''), fmtPct(varCreaPct), fmtDiff(varCreation)) : '',
        rendMoisPct !== null  ? mkBadge('variation ce mois',  fmtPct(rendMoisPct), fmtDiff(rendMois))  : '',
      ].filter(Boolean).join('');

      // ── HTML Patrimoine — Header + Répartition + Évolution + Objectif + Actifs ──
      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=595"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#1a1a1a; background:white; width:595px; }
  .page { width:595px; background:#fff; }
  .sec { padding:6px 14px; border-bottom:1px solid #EBEBEB; page-break-inside:avoid; }
  .sec-h { border-left:3px solid #1E7A4A; padding-left:7px; font-size:9.5px; font-weight:700; color:#111; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:7px; }
  th { font-weight:600; }
</style>
</head>
<body>
<div class="page">

<!-- ═══ EN-TÊTE ════════════════════════════════════════════ -->
<div style="background:#0D4220; color:white; padding:10px 14px 8px;">
  <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
    <tr>
      <td style="vertical-align:bottom;">
        <div style="font-size:18px; font-weight:800; letter-spacing:-0.5px;">PatriMoi</div>
        <div style="font-size:8px; opacity:0.5; margin-top:2px; letter-spacing:1px; text-transform:uppercase;">Rapport Patrimonial Confidentiel</div>
      </td>
      <td style="text-align:right; font-size:9px; opacity:0.65; line-height:1.7;">
        <div>${date}</div>
        ${nomComplet ? `<div style="font-weight:700; opacity:0.9;">${nomComplet}</div>` : ''}
      </td>
    </tr>
  </table>
  <div style="border-top:1px solid rgba(255,255,255,0.18); padding-top:10px;">
    <div style="font-size:8px; opacity:0.5; text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Patrimoine Net Total</div>
    <div style="font-size:30px; font-weight:800; letter-spacing:-0.5px; margin-bottom:8px;">${fmtPDF(total)}</div>
    <div>${badgesHtml || '<span style="font-size:8px; opacity:0.4;">Continuez a enregistrer votre patrimoine pour voir les variations</span>'}</div>
  </div>
</div>

<!-- ═══ RÉPARTITION ════════════════════════════════════════ -->
<div class="sec">
  <div class="sec-h">Repartition · ${cats.length} categorie${cats.length > 1 ? 's' : ''}</div>
  <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
    <colgroup><col style="width:132px;"/><col/></colgroup>
    <tr>
      <td style="vertical-align:top; padding-right:7px;">${donutSvg}</td>
      <td style="vertical-align:top;">
        <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
          <colgroup><col/><col style="width:115px;"/><col style="width:50px;"/></colgroup>
          <thead>
            <tr style="background:#1E7A4A;">
              <th style="padding:3px 5px; text-align:left; color:white; font-size:8px;">Categorie</th>
              <th style="padding:3px 5px; text-align:right; color:white; font-size:8px;">Valeur</th>
              <th style="padding:3px 5px; text-align:right; color:white; font-size:8px;">Part</th>
            </tr>
          </thead>
          <tbody>${repartRows}</tbody>
          <tfoot>
            <tr style="background:#EBF7EF;">
              <td style="padding:3px 5px; font-size:9px; font-weight:800; color:#1E7A4A;">TOTAL</td>
              <td style="padding:3px 5px; text-align:right; font-size:9px; font-weight:800; color:#1E7A4A;">${fmtPDF(total)}</td>
              <td style="padding:3px 5px; text-align:right; font-size:9px; font-weight:700; color:#1E7A4A;">100%</td>
            </tr>
          </tfoot>
        </table>
        <!-- Mini-barres en pourcentage (jamais en pixels fixes) -->
        <table style="width:100%; border-collapse:collapse; margin-top:5px; table-layout:fixed;">
          <colgroup><col style="width:75px;"/><col/><col style="width:28px;"/></colgroup>
          ${cats.slice(0, 5).map(c => {
            const pct = total > 0 ? c.val / total * 100 : 0;
            return `<tr>
              <td style="padding:1px 0; font-size:7.5px; color:#666; white-space:nowrap; overflow:hidden;">
                <span style="display:inline-block; width:5px; height:5px; border-radius:1px; background:${c.color}; vertical-align:middle; margin-right:3px;"></span>${c.label.split(' ')[0]}
              </td>
              <td style="padding:1px 3px;">
                <div style="background:#EBEBEB; border-radius:2px; height:4px;"><div style="background:${c.color}; border-radius:2px; height:4px; width:${pct.toFixed(0)}%;"></div></div>
              </td>
              <td style="padding:1px 0; text-align:right; font-size:7.5px; color:#888;">${pct.toFixed(0)}%</td>
            </tr>`;
          }).join('')}
        </table>
      </td>
    </tr>
  </table>
</div>

<!-- ═══ ÉVOLUTION ══════════════════════════════════════════ -->
${(firstEntry || varCreation !== null || varMois !== null) ? `
<div class="sec" style="background:#F7F9F7;">
  <div class="sec-h">Evolution${sparkData.length > 1 ? ' sur ' + sparkData.length + ' mois' : ''}</div>
  <table style="width:100%; border-collapse:collapse; margin-top:4px; border-top:1px solid #E8E8E8;">
    <tr>
      ${firstEntry ? `<td style="text-align:center; padding:6px 4px; border-right:1px solid #eee;">
        <div style="font-size:8px; color:#999; text-transform:uppercase; letter-spacing:0.3px; margin-bottom:2px;">Depuis ${fmtD(firstEntry.date)}</div>
        <div style="font-size:10px; font-weight:700; color:#555;">${fmtPDF(firstEntry.val)}</div>
      </td>` : ''}
      <td style="text-align:center; padding:6px 4px; border-right:1px solid #eee;">
        <div style="font-size:8px; color:#999; text-transform:uppercase; letter-spacing:0.3px; margin-bottom:2px;">Aujourd'hui</div>
        <div style="font-size:10px; font-weight:700; color:#1E7A4A;">${fmtPDF(total)}</div>
      </td>
      ${varCreation !== null ? `<td style="text-align:center; padding:6px 4px; border-right:1px solid #eee;">
        <div style="font-size:8px; color:#999; text-transform:uppercase; letter-spacing:0.3px; margin-bottom:2px;">Croissance totale</div>
        <div style="font-size:10px; font-weight:700; color:${diffColor(varCreation)};">${fmtPct(varCreaPct)}</div>
        <div style="font-size:8px; color:${diffColor(varCreation)};">${fmtDiff(varCreation)}</div>
      </td>` : ''}
      ${varMois !== null ? `<td style="text-align:center; padding:6px 4px;">
        <div style="font-size:8px; color:#999; text-transform:uppercase; letter-spacing:0.3px; margin-bottom:2px;">Variation M-1</div>
        <div style="font-size:10px; font-weight:700; color:${diffColor(varMois)};">${fmtPct(varMoisPct)}</div>
        <div style="font-size:8px; color:${diffColor(varMois)};">${fmtDiff(varMois)}</div>
      </td>` : ''}
    </tr>
  </table>
</div>` : ''}

<!-- ═══ OBJECTIF ═══════════════════════════════════════════ -->
${objectif ? `
<div class="sec">
  <div class="sec-h">Objectif patrimonial</div>
  <table style="width:100%; border-collapse:collapse; margin-bottom:7px;">
    <tr>
      <td style="vertical-align:middle;">
        <div style="font-size:13px; font-weight:800; color:#1E7A4A;">${fmtPDF(objectif.montant)}</div>
        <div style="font-size:9px; color:#888; margin-top:2px;">Cible : ${objectif.dateTarget}${monthsToTarget !== null ? ' · ' + Math.round(monthsToTarget) + ' mois restants' : ''}</div>
        ${monthlyNeeded !== null && monthlyNeeded > 0 ? `<div style="font-size:9px; color:#555; margin-top:1px;">Effort necessaire : <strong style="color:#1E7A4A;">${fmtPDF(Math.round(monthlyNeeded))}/mois</strong></div>` : ''}
        <div style="font-size:9px; color:#888; margin-top:1px;">Manquant : ${fmtPDF(Math.max(0, objectif.montant - total))}</div>
      </td>
      <td style="text-align:right; vertical-align:middle; width:80px;">
        <div style="font-size:22px; font-weight:800; color:${objPct >= 80 ? '#1E7A4A' : objPct >= 50 ? '#E67E22' : '#C0392B'};">${objPct.toFixed(1)}%</div>
        <div style="font-size:8px; color:#aaa;">atteint</div>
      </td>
    </tr>
  </table>
  <div style="background:#D5D5D5; border-radius:3px; height:7px;">
    <div style="background:${objPct >= 80 ? '#1E7A4A' : objPct >= 50 ? '#E67E22' : '#C0392B'}; border-radius:3px; height:7px; width:${Math.round(objPct)}%;"></div>
  </div>
</div>` : ''}

<!-- ═══ ACTIFS FINANCIERS ══════════════════════════════════ -->
${hasActifsPerf ? `
<div class="sec" style="background:#F7F9F7;">
  <div class="sec-h">Performance des actifs</div>
  <table style="width:100%; border-collapse:collapse; border:1px solid #E8E8E8;">
    <thead>
      <tr style="background:#F0F0F0;">
        <th style="padding:4px 7px; text-align:left; font-size:8px; color:#555;">Actif</th>
        <th style="padding:4px 7px; text-align:right; font-size:8px; color:#555;">Investi</th>
        <th style="padding:4px 7px; text-align:right; font-size:8px; color:#555;">Valeur actuelle</th>
        <th style="padding:4px 7px; text-align:right; font-size:8px; color:#555;">P&amp;L</th>
        <th style="padding:4px 7px; text-align:right; font-size:8px; color:#555;">Rdt.</th>
      </tr>
    </thead>
    <tbody>
      ${peaCout > 0 ? `<tr style="background:white; border-bottom:1px solid #F0F0F0;">
        <td style="padding:5px 7px; font-size:9px; font-weight:700; color:#16A085;">PEA — Bourse</td>
        <td style="padding:5px 7px; text-align:right; font-size:9px; color:#666;">${fmtPDF(peaCout)}</td>
        <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:700;">${fmtPDF(peaVal)}</td>
        <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:700; color:${diffColor(peaPL)};">${fmtDiff(peaPL)}</td>
        <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:700; color:${diffColor(peaPL)};">${peaPct !== null ? fmtPct(peaPct) : '—'}</td>
      </tr>` : ''}
      ${ctCout > 0 ? `<tr style="background:#FAFAFA; border-bottom:1px solid #F0F0F0;">
        <td style="padding:5px 7px; font-size:9px; font-weight:700; color:#8E44AD;">Compte-Titre</td>
        <td style="padding:5px 7px; text-align:right; font-size:9px; color:#666;">${fmtPDF(ctCout)}</td>
        <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:700;">${fmtPDF(ctVal)}</td>
        <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:700; color:${diffColor(ctPL)};">${fmtDiff(ctPL)}</td>
        <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:700; color:${diffColor(ctPL)};">${ctPct !== null ? fmtPct(ctPct) : '—'}</td>
      </tr>` : ''}
      ${orVal > 0 ? `<tr style="background:white; border-bottom:1px solid #F0F0F0;">
        <td style="padding:5px 7px; font-size:9px; font-weight:700; color:#D4AC0D;">Or &amp; Metaux</td>
        <td style="padding:5px 7px; text-align:right; font-size:9px; color:#aaa;">—</td>
        <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:700; color:#D4AC0D;">${fmtPDF(orVal)}</td>
        <td style="padding:5px 7px; text-align:right; font-size:9px; color:#aaa;">—</td>
        <td style="padding:5px 7px; text-align:right; font-size:9px; color:#aaa;">—</td>
      </tr>` : ''}
      ${immoVal > 0 ? `<tr style="background:#FAFAFA; border-bottom:1px solid #F0F0F0;">
        <td style="padding:5px 7px; font-size:9px; font-weight:700; color:#C0392B;">Immobilier</td>
        <td style="padding:5px 7px; text-align:right; font-size:9px; color:#aaa;">—</td>
        <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:700; color:#C0392B;">${fmtPDF(immoVal)}</td>
        <td style="padding:5px 7px; text-align:right; font-size:9px; color:#aaa;">—</td>
        <td style="padding:5px 7px; text-align:right; font-size:9px; color:#aaa;">—</td>
      </tr>` : ''}
      ${transVal > 0 ? `<tr style="background:white; border-bottom:1px solid #F0F0F0;">
        <td style="padding:5px 7px; font-size:9px; font-weight:700; color:#7F8C8D;">Transport</td>
        <td style="padding:5px 7px; text-align:right; font-size:9px; color:#aaa;">—</td>
        <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:700; color:#7F8C8D;">${fmtPDF(transVal)}</td>
        <td style="padding:5px 7px; text-align:right; font-size:9px; color:#aaa;">—</td>
        <td style="padding:5px 7px; text-align:right; font-size:9px; color:#aaa;">—</td>
      </tr>` : ''}
    </tbody>
    ${totalActifsCout > 0 ? `<tfoot><tr style="background:#EBF7EF;">
      <td style="padding:5px 7px; font-size:9px; font-weight:800; color:#1E7A4A;">FINANCIER (PEA + CT)</td>
      <td style="padding:5px 7px; text-align:right; font-size:9px; font-weight:700; color:#555;">${fmtPDF(totalActifsCout)}</td>
      <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:800; color:#1E7A4A;">${fmtPDF(totalActifsVal)}</td>
      <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:800; color:${diffColor(totalActifsPL)};">${fmtDiff(totalActifsPL)}</td>
      <td style="padding:5px 7px; text-align:right; font-size:10px; font-weight:800; color:${diffColor(totalActifsPL)};">${totalActifsPct !== null ? fmtPct(totalActifsPct) : '—'}</td>
    </tr></tfoot>` : ''}
  </table>
  ${rendMoisPct !== null ? `<table style="width:100%; border-collapse:collapse; margin-top:6px; background:#FFFAEB; border:1px solid #F0C040; border-radius:4px;"><tr>
    <td style="padding:5px 9px; font-size:9px; color:#8A6800;">Variation patrimoine total depuis debut du mois</td>
    <td style="padding:5px 9px; text-align:right; font-size:11px; font-weight:800; color:${diffColor(rendMois)}; white-space:nowrap;">${fmtPct(rendMoisPct)}  (${fmtDiff(rendMois)})</td>
  </tr></table>` : ''}
</div>` : ''}

<!-- ═══ PIED DE PAGE ════════════════════════════════════════ -->
<div style="padding:8px 18px; background:#F0F0F0; border-top:1px solid #DCDCDC;">
  <table style="width:100%; border-collapse:collapse;">
    <tr>
      <td style="font-size:8px; color:#AAA;">Document confidentiel — usage personnel uniquement</td>
      <td style="text-align:center; font-size:8px; color:#BBB;">PatriMoi v1.6</td>
      <td style="text-align:right; font-size:8px; color:#AAA;">${date}</td>
    </tr>
  </table>
</div>

</div>
</body>
</html>`;

      const result = await RNHTMLtoPDF.convert({
        html,
        fileName: `PatriMoi_Patrimoine_${new Date().toISOString().slice(0,10)}`,
        directory: Platform.OS === 'ios' ? 'Documents' : 'Download',
        base64: false,
        height: 841,
        width: 595,
      });

      if (!result?.filePath) throw new Error('Échec génération PDF');

      trackExportPDF('patrimoine');
      await Share.share({
        url: `file://${result.filePath}`,
        title: 'PatriMoi — Rapport Patrimoine',
      });

    } catch (e) {
      Alert.alert('Erreur', 'Impossible de générer le PDF : ' + (e.message || 'erreur inconnue'));
    } finally {
      setExportingPatrimoinePDF(false);
    }
  }, [data, objectif, nomComplet, history, trackingStartDate]); // eslint-disable-line

  // ── Export Budget PDF ──────────────────────────────────────────────────
  const handleExportBudgetPDF = useCallback(async () => {
    const d = data || INIT;
    setExportingBudgetPDF(true);
    try {
      const RNHTMLtoPDF = getPDFModule();

      if (!RNHTMLtoPDF) {
        const fmtT = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits:0 }) + ' DH';
        const opsAll = (d.operations || []);
        const opsFil = opsAll.filter(op => {
          if (!pdfFrom || !pdfTo) return true;
          const opDate = (op.date || '').slice(0, 10);
          return opDate >= pdfFrom && opDate <= pdfTo;
        });
        const totalRev_ = opsFil.filter(o => o.type === 'revenu').reduce((s, o) => s + (o.montant || 0), 0);
        const totalDep_ = opsFil.filter(o => o.type === 'depense').reduce((s, o) => s + (o.montant || 0), 0);
        const totalEp_  = opsFil.filter(o => o.type === 'epargne').reduce((s, o) => s + (o.montant || 0), 0);
        const lines = [
          '💰 PatriMoi — Budget & Revenus',
          `Date : ${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}`,
          '─'.repeat(38),
          `Revenus   ${fmtT(totalRev_)}`,
          `Depenses  ${fmtT(totalDep_)}`,
          `Epargne   ${fmtT(totalEp_)}`,
          `Balance   ${fmtT(totalRev_ - totalDep_ + totalEp_)}`,
          '', 'Généré par PatriMoi v1.6',
        ].join('\n');
        await Share.share({ message: lines, title: 'PatriMoi — Budget' });
        setExportingBudgetPDF(false);
        return;
      }

      // ── Helpers ──────────────────────────────────────────────────────
      const fmtPDF  = (n) => { if (!n && n !== 0) return '—'; return n.toLocaleString('fr-FR', { maximumFractionDigits:0 }) + ' DH'; };
      const fmtPct  = (v) => v > 0 ? '+' + v.toFixed(1) + '%' : v.toFixed(1) + '%';
      const fmtDiff = (v) => v > 0 ? '+' + Math.round(v).toLocaleString('fr-FR') + ' DH' : Math.round(v).toLocaleString('fr-FR') + ' DH';
      const fmtD    = (iso) => { if (!iso) return ''; const d = String(iso).slice(0, 10); const [yy,mm,dd] = d.split('-'); return `${dd||'?'}/${mm||'?'}/${yy||'?'}`; };
      const diffColor = (v) => v > 0 ? '#1E7A4A' : v < 0 ? '#C0392B' : '#888';

      const date = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
      const today = new Date().toISOString().slice(0, 10);
      const prevMonthDate = new Date(); prevMonthDate.setDate(1); prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const prevMonthStr  = prevMonthDate.toISOString().slice(0, 7);

      // ── Données budget ───────────────────────────────────────────────
      const opsAll   = (d.operations || []);
      const opsFil   = opsAll.filter(op => {
        if (!pdfFrom || !pdfTo) return true;
        const opDate = (op.date || '').slice(0, 10);
        return opDate >= pdfFrom && opDate <= pdfTo;
      });
      const depenses     = opsFil.filter(o => o.type === 'depense');
      const revenuOps    = opsFil.filter(o => o.type === 'revenu');
      const epargneOps   = opsFil.filter(o => o.type === 'epargne');
      const totalDep     = depenses.reduce((s, o) => s + (o.montant || 0), 0);
      const totalRev     = revenuOps.reduce((s, o) => s + (o.montant || 0), 0);
      const totalEpargne = epargneOps.reduce((s, o) => s + (o.montant || 0), 0);
      const balance      = totalRev - totalDep + totalEpargne;
      const tauxEpargne  = (totalRev + totalEpargne) > 0 ? (totalEpargne / (totalRev + totalEpargne) * 100) : null;
      const opsPrevMois  = opsAll.filter(op => (op.date || '').slice(0, 7) === prevMonthStr && op.type === 'depense');
      const totalDepPrev = opsPrevMois.reduce((s, o) => s + (o.montant || 0), 0);
      const varDepMois   = totalDepPrev > 0 ? totalDep - totalDepPrev : null;
      const varDepMoisPct = totalDepPrev > 0 ? (varDepMois / totalDepPrev * 100) : null;
      const budgetCibles     = d.budgetCibles || {};
      const totalBudgetCible = Object.values(budgetCibles).reduce((s, v) => s + (v || 0), 0);
      const budgetRestant    = totalBudgetCible > 0 ? totalBudgetCible - totalDep : null;
      const budgetPct        = totalBudgetCible > 0 ? Math.min(100, totalDep / totalBudgetCible * 100) : null;
      const byCat      = {};
      depenses.forEach(o => { byCat[o.categorie || 'autre'] = (byCat[o.categorie || 'autre'] || 0) + (o.montant || 0); });
      const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const CAT_COLORS = { alimentation:'#E74C3C', transport:'#2980B9', logement:'#8E44AD', loisirs:'#E67E22', sante:'#1ABC9C', education:'#F39C12', dividende:'#27AE60', autre:'#7F8C8D' };
      const periodLabel = pdfFrom && pdfTo ? `${fmtD(pdfFrom)} — ${fmtD(pdfTo)}` : opsFil.length > 0 ? 'Toutes les operations' : 'Ce mois';

      // ── Santé financière (score 0-3) ─────────────────────────────────
      let santeScore = 0;
      if (balance >= 0) santeScore++;
      if (tauxEpargne !== null && tauxEpargne >= 10) santeScore++;
      if (budgetPct === null || budgetPct <= 100) santeScore++;
      const santeLabel = santeScore === 3 ? 'Excellente gestion' : santeScore === 2 ? 'Bonne gestion' : santeScore === 1 ? 'Attention' : 'Alerte';
      const santeBg    = santeScore === 3 ? '#EBF7EF' : santeScore === 2 ? '#FFF9E6' : santeScore === 1 ? '#FFF3E0' : '#FDEDEC';
      const santeColor = santeScore === 3 ? '#1E7A4A' : santeScore === 2 ? '#B7800A' : santeScore === 1 ? '#E67E22' : '#C0392B';
      const santeEmoji = santeScore === 3 ? '●' : santeScore === 2 ? '●' : santeScore === 1 ? '●' : '●';

      // ── Tendances dépenses (6 derniers mois) ────────────────────────
      const trendMonths = [];
      for (let mi = 5; mi >= 0; mi--) {
        const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - mi);
        const mStr   = dt.toISOString().slice(0, 7);
        const mLabel = dt.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const mTotal = opsAll.filter(op => op.type === 'depense' && (op.date || '').slice(0, 7) === mStr)
                             .reduce((s, o) => s + (o.montant || 0), 0);
        trendMonths.push({ mStr, mLabel, mTotal });
      }
      const trendMax = Math.max(...trendMonths.map(m => m.mTotal), 1);
      const curMonthStr2 = new Date().toISOString().slice(0, 7);
      const trendSvg = (() => {
        const W = 567, H = 65, pad = 4, barW = Math.floor((W - pad * 2 - 5 * 6) / 6);
        return `<svg viewBox="0 0 ${W} ${H + 18}" xmlns="http://www.w3.org/2000/svg" style="width:100%; display:block;">
          ${trendMonths.map((m, i) => {
            const bh = trendMax > 0 ? Math.max(3, (m.mTotal / trendMax) * (H - 8)) : 3;
            const x  = pad + i * (barW + 6);
            const y  = H - bh;
            const isCur = m.mStr === curMonthStr2;
            const isPrev = m.mStr === prevMonthStr;
            const barC = isCur ? '#2471A3' : isPrev ? '#95B8D1' : '#C5D9E8';
            return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="2" fill="${barC}"/>
              ${m.mTotal > 0 ? `<text x="${x + barW/2}" y="${y - 2}" text-anchor="middle" font-size="7" fill="${isCur ? '#2471A3' : '#999'}" font-weight="${isCur ? 'bold' : 'normal'}">${(m.mTotal/1000).toFixed(0)}k</text>` : ''}
              <text x="${x + barW/2}" y="${H + 13}" text-anchor="middle" font-size="7.5" fill="${isCur ? '#2471A3' : '#AAA'}" font-weight="${isCur ? 'bold' : 'normal'}">${m.mLabel}</text>`;
          }).join('')}
          ${totalDepPrev > 0 ? `<line x1="${pad}" y1="${H - (totalDepPrev/trendMax)*(H-8)}" x2="${W-pad}" y2="${H - (totalDepPrev/trendMax)*(H-8)}" stroke="#C0392B" stroke-width="0.8" stroke-dasharray="3,2" opacity="0.5"/>` : ''}
        </svg>`;
      })();

      // ── Top 3 dépenses individuelles ───────────────────────────────
      const top3Dep = [...depenses].sort((a, b) => (b.montant || 0) - (a.montant || 0)).slice(0, 3);

      // ── Épargne : opérations + positions PEA/CT ─────────────────────
      const peaPositions = Array.isArray(d.pea) ? d.pea
        : Array.isArray(d.pea?.positions) ? d.pea.positions
        : Array.isArray(d.pea?.titres) ? d.pea.titres : [];
      const ctPositions  = Array.isArray(d.ct) ? d.ct
        : Array.isArray(d.ct?.positions) ? d.ct.positions
        : Array.isArray(d.ct?.titres) ? d.ct.titres : [];
      const allInvests = [
        ...peaPositions.map(p => ({ ...p, compte: 'PEA' })),
        ...ctPositions.map(p => ({ ...p, compte: 'CT' })),
      ].filter(p => p && (p.nom || p.ticker || p.name));

      // ── HTML Budget enrichi ──────────────────────────────────────────
      const htmlBudget = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=595"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#1a1a1a; background:white; width:595px; }
  .page { width:595px; background:#fff; }
  .sec { padding:8px 14px; border-bottom:1px solid #EBEBEB; }
  .sec-h { border-left:3px solid #2471A3; padding-left:7px; font-size:9.5px; font-weight:700; color:#111; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:7px; }
</style>
</head>
<body>
<div class="page">

<!-- EN-TÊTE BUDGET + SANTÉ -->
<div style="background:#0D2E4E; color:white; padding:10px 14px 8px;">
  <table style="width:100%; border-collapse:collapse; margin-bottom:7px;">
    <tr>
      <td style="vertical-align:middle;">
        <div style="font-size:18px; font-weight:800; letter-spacing:-0.5px;">PatriMoi</div>
        <div style="font-size:10px; font-weight:600; opacity:0.75; margin-top:2px;">Budget &amp; Revenus · ${periodLabel}</div>
      </td>
      <td style="text-align:right; font-size:9px; opacity:0.65;">
        <div>${date}</div>
        ${nomComplet ? `<div style="font-weight:700; opacity:0.9;">${nomComplet}</div>` : ''}
      </td>
    </tr>
  </table>
  <!-- Badge santé financière -->
  <div style="display:inline-block; background:${santeBg}; border-radius:5px; padding:4px 10px;">
    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${santeColor}; vertical-align:middle; margin-right:4px;"></span>
    <span style="font-size:9px; font-weight:700; color:${santeColor};">${santeLabel}</span>
    <span style="font-size:8px; color:${santeColor}; opacity:0.8; margin-left:6px;">${santeScore}/3</span>
  </div>
</div>

<!-- KPI 3 COLONNES -->
<div class="sec">
  <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
    <colgroup><col/><col/><col/></colgroup>
    <tr>
      <td style="padding-right:3px; vertical-align:top;">
        <div style="background:#EBF7EF; border-radius:5px; padding:7px 8px; text-align:center; border-top:3px solid #1E7A4A;">
          <div style="font-size:7.5px; color:#1E7A4A; font-weight:700; text-transform:uppercase; margin-bottom:3px;">Revenus</div>
          <div style="font-size:14px; font-weight:800; color:#1E7A4A;">${fmtPDF(totalRev)}</div>
          <div style="font-size:7.5px; color:#888; margin-top:2px;">${revenuOps.length} op.</div>
        </div>
      </td>
      <td style="padding:0 2px; vertical-align:top;">
        <div style="background:#FDEDEC; border-radius:5px; padding:7px 8px; text-align:center; border-top:3px solid #C0392B;">
          <div style="font-size:7.5px; color:#C0392B; font-weight:700; text-transform:uppercase; margin-bottom:3px;">Depenses</div>
          <div style="font-size:14px; font-weight:800; color:#C0392B;">${fmtPDF(totalDep)}</div>
          <div style="font-size:7.5px; color:${varDepMoisPct !== null ? diffColor(-varDepMois) : '#888'}; margin-top:2px;">${varDepMoisPct !== null ? fmtPct(-varDepMoisPct) + ' vs M-1' : depenses.length + ' op.'}</div>
        </div>
      </td>
      <td style="padding-left:3px; vertical-align:top;">
        <div style="background:#EEF3FF; border-radius:5px; padding:7px 8px; text-align:center; border-top:3px solid #2471A3;">
          <div style="font-size:7.5px; color:#2471A3; font-weight:700; text-transform:uppercase; margin-bottom:3px;">Epargne</div>
          <div style="font-size:14px; font-weight:800; color:#2471A3;">${fmtPDF(totalEpargne)}</div>
          <div style="font-size:7.5px; color:#2471A3; margin-top:2px;">${tauxEpargne !== null ? tauxEpargne.toFixed(1) + '% du rev.' : epargneOps.length + ' op.'}</div>
        </div>
      </td>
    </tr>
  </table>
  <!-- Balance inline -->
  <div style="background:${balance >= 0 ? '#EBF7EF' : '#FDEDEC'}; border-radius:4px; padding:5px 9px; margin-top:6px;">
    <table style="width:100%; border-collapse:collapse;"><tr>
      <td style="font-size:8.5px; color:#555; font-weight:600;">Balance nette</td>
      <td style="text-align:right; font-size:13px; font-weight:800; color:${balance >= 0 ? '#1E7A4A' : '#C0392B'}; white-space:nowrap;">${balance >= 0 ? '+' : ''}${fmtPDF(Math.abs(balance))}</td>
    </tr></table>
  </div>
</div>

<!-- TENDANCES DÉPENSES (6 derniers mois) -->
${trendMonths.some(m => m.mTotal > 0) ? `
<div class="sec">
  <div class="sec-h">Tendances des depenses (6 mois)</div>
  ${trendSvg}
  <div style="font-size:7.5px; color:#999; margin-top:2px; text-align:center;">
    <span style="display:inline-block; width:8px; height:8px; background:#2471A3; border-radius:1px; vertical-align:middle; margin-right:3px;"></span>Ce mois
    <span style="display:inline-block; width:8px; height:8px; background:#95B8D1; border-radius:1px; vertical-align:middle; margin:0 3px 0 8px;"></span>Mois precedent
    ${totalDepPrev > 0 ? '<span style="color:#C0392B;">  ─ ─  Ref M-1</span>' : ''}
  </div>
</div>` : ''}

${totalBudgetCible > 0 ? `
<!-- BUDGET VS CIBLES -->
<div class="sec">
  <div class="sec-h">Budget mensuel</div>
  <table style="width:100%; border-collapse:collapse; margin-bottom:4px;">
    <tr>
      <td style="font-size:9px; font-weight:600; color:#333;">Depenses vs objectif</td>
      <td style="text-align:right; font-size:11px; font-weight:800; color:${budgetPct > 100 ? '#C0392B' : budgetPct > 85 ? '#E67E22' : '#1E7A4A'};">${budgetPct.toFixed(0)}%</td>
    </tr>
  </table>
  <div style="background:#DDD; border-radius:3px; height:6px; margin-bottom:4px;">
    <div style="background:${budgetPct > 100 ? '#C0392B' : budgetPct > 85 ? '#E67E22' : '#1E7A4A'}; border-radius:3px; height:6px; width:${Math.min(100, budgetPct).toFixed(1)}%;"></div>
  </div>
  <table style="width:100%; border-collapse:collapse;"><tr>
    <td style="font-size:8px; color:#888;">Realise : ${fmtPDF(totalDep)}</td>
    <td style="text-align:center; font-size:8px; color:#888;">Cible : ${fmtPDF(totalBudgetCible)}</td>
    <td style="text-align:right; font-size:8.5px; font-weight:700; color:${budgetRestant >= 0 ? '#1E7A4A' : '#C0392B'};">${budgetRestant >= 0 ? 'Reste : '+fmtPDF(budgetRestant) : 'Depasse : +'+fmtPDF(Math.abs(budgetRestant))}</td>
  </tr></table>
</div>` : ''}

${catEntries.length > 0 ? `
<!-- DEPENSES PAR CATEGORIE -->
<div class="sec">
  <div class="sec-h">Depenses par categorie</div>
  <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
    <colgroup><col style="width:115px;"/><col style="width:88px;"/><col style="width:30px;"/><col/></colgroup>
    <thead><tr style="background:#0D2E4E;">
      <th style="padding:3px 5px; text-align:left; font-size:8px; color:white;">Categorie</th>
      <th style="padding:3px 5px; text-align:right; font-size:8px; color:white;">Montant</th>
      <th style="padding:3px 5px; text-align:right; font-size:8px; color:white;">%</th>
      <th style="padding:3px 5px; font-size:8px; color:white;">${totalBudgetCible > 0 ? 'vs Cible' : 'Part'}</th>
    </tr></thead>
    <tbody>
      ${catEntries.slice(0, 6).map(([cat, montant], i) => {
        const pct      = totalDep > 0 ? montant / totalDep * 100 : 0;
        const cible    = budgetCibles[cat] || 0;
        const vsObjPct = cible > 0 ? (montant / cible * 100) : null;
        const barColor = vsObjPct !== null ? (vsObjPct > 100 ? '#C0392B' : vsObjPct > 85 ? '#E67E22' : '#1E7A4A') : (CAT_COLORS[cat] || '#7F8C8D');
        return `<tr style="background:${i % 2 === 0 ? 'white' : '#FAFAFA'};">
          <td style="padding:3px 5px; font-size:8.5px; color:#333; border-bottom:1px solid #F0F0F0;">
            <span style="display:inline-block; width:6px; height:6px; border-radius:1px; background:${CAT_COLORS[cat] || '#7F8C8D'}; vertical-align:middle; margin-right:3px;"></span>${cat}
          </td>
          <td style="padding:3px 5px; text-align:right; font-size:9px; font-weight:700; color:${barColor}; border-bottom:1px solid #F0F0F0;">${fmtPDF(montant)}</td>
          <td style="padding:3px 5px; text-align:right; font-size:8px; color:#888; border-bottom:1px solid #F0F0F0;">${pct.toFixed(0)}%</td>
          <td style="padding:3px 5px; border-bottom:1px solid #F0F0F0; vertical-align:middle;">
            <div style="background:#E0E0E0; border-radius:2px; height:4px;"><div style="background:${barColor}; border-radius:2px; height:4px; width:${pct.toFixed(0)}%;"></div></div>
            ${vsObjPct !== null ? `<div style="font-size:7px; color:${barColor}; margin-top:1px;">${vsObjPct.toFixed(0)}% / ${fmtPDF(cible)}</div>` : ''}
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>` : ''}

${top3Dep.length > 0 ? `
<!-- TOP 3 DÉPENSES INDIVIDUELLES -->
<div class="sec">
  <div class="sec-h">Top depenses du mois</div>
  <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
    <colgroup><col style="width:60px;"/><col/><col style="width:90px;"/></colgroup>
    ${top3Dep.map((op, i) => `<tr style="background:${i % 2 === 0 ? 'white' : '#FAFAFA'};">
      <td style="padding:4px 5px; font-size:8px; color:#999; border-bottom:1px solid #F5F5F5;">${fmtD(op.date || '')}</td>
      <td style="padding:4px 5px; font-size:9px; color:#333; border-bottom:1px solid #F5F5F5; overflow:hidden;">
        <span style="display:inline-block; width:6px; height:6px; border-radius:1px; background:${CAT_COLORS[op.categorie] || '#7F8C8D'}; vertical-align:middle; margin-right:3px;"></span>
        ${op.description || op.categorie || 'Depense'}
      </td>
      <td style="padding:4px 5px; text-align:right; font-size:10px; font-weight:800; color:#C0392B; border-bottom:1px solid #F5F5F5; white-space:nowrap;">${fmtPDF(op.montant)}</td>
    </tr>`).join('')}
  </table>
</div>` : ''}

${revenuOps.length > 0 ? `
<!-- REVENUS DÉTAILLÉS -->
<div class="sec">
  <div class="sec-h">Detail des revenus</div>
  <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
    <colgroup><col style="width:60px;"/><col/><col style="width:90px;"/></colgroup>
    ${revenuOps.map((op, i) => `<tr style="background:${i % 2 === 0 ? 'white' : '#FAFAFA'};">
      <td style="padding:4px 5px; font-size:8px; color:#999; border-bottom:1px solid #F5F5F5;">${fmtD(op.date || '')}</td>
      <td style="padding:4px 5px; font-size:9px; color:#333; border-bottom:1px solid #F5F5F5; overflow:hidden;">${op.description || op.categorie || 'Revenu'}</td>
      <td style="padding:4px 5px; text-align:right; font-size:10px; font-weight:800; color:#1E7A4A; border-bottom:1px solid #F5F5F5; white-space:nowrap;">${fmtPDF(op.montant)}</td>
    </tr>`).join('')}
  </table>
</div>` : ''}

${(epargneOps.length > 0 || allInvests.length > 0) ? `
<!-- ÉPARGNE & INVESTISSEMENTS -->
<div class="sec">
  <div class="sec-h">Epargne &amp; Investissements</div>
  ${epargneOps.length > 0 ? `
  <table style="width:100%; border-collapse:collapse; margin-bottom:${allInvests.length > 0 ? '7' : '0'}px; table-layout:fixed;">
    <colgroup><col style="width:60px;"/><col/><col style="width:90px;"/></colgroup>
    ${epargneOps.map((op, i) => `<tr style="background:${i % 2 === 0 ? 'white' : '#FAFAFA'};">
      <td style="padding:4px 5px; font-size:8px; color:#999; border-bottom:1px solid #F5F5F5;">${fmtD(op.date || '')}</td>
      <td style="padding:4px 5px; font-size:9px; color:#333; border-bottom:1px solid #F5F5F5; overflow:hidden;">${op.description || op.categorie || 'Epargne'}</td>
      <td style="padding:4px 5px; text-align:right; font-size:10px; font-weight:800; color:#2471A3; border-bottom:1px solid #F5F5F5; white-space:nowrap;">${fmtPDF(op.montant)}</td>
    </tr>`).join('')}
  </table>` : ''}
  ${allInvests.length > 0 ? `
  <div style="font-size:7.5px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:4px;">Positions en portefeuille</div>
  <table style="width:100%; border-collapse:collapse; border:1px solid #E8E8E8; table-layout:fixed;">
    <colgroup><col/><col style="width:55px;"/><col style="width:70px;"/><col style="width:70px;"/></colgroup>
    <thead><tr style="background:#0D2E4E;">
      <th style="padding:3px 5px; text-align:left; font-size:8px; color:white;">Actif</th>
      <th style="padding:3px 5px; text-align:center; font-size:8px; color:white;">Qte</th>
      <th style="padding:3px 5px; text-align:right; font-size:8px; color:white;">Prix achat</th>
      <th style="padding:3px 5px; text-align:right; font-size:8px; color:white;">Valeur</th>
    </tr></thead>
    <tbody>
      ${allInvests.map((p, i) => {
        const nom     = p.nom || p.ticker || p.name || '—';
        const qte     = p.quantite || p.qty || p.shares || '—';
        const pxAchat = p.prixAchat || p.cout || p.buyPrice || null;
        const valeur  = p.valeurActuelle || p.valeur || p.currentValue || null;
        const pl      = (valeur && pxAchat && qte && typeof qte === 'number') ? valeur - pxAchat * qte : null;
        return `<tr style="background:${i % 2 === 0 ? 'white' : '#FAFAFA'};">
          <td style="padding:3px 5px; font-size:9px; font-weight:700; color:#333; border-bottom:1px solid #F0F0F0; overflow:hidden;">
            ${nom}
            <span style="font-size:7.5px; font-weight:400; color:#999; margin-left:3px;">${p.compte}</span>
          </td>
          <td style="padding:3px 5px; text-align:center; font-size:9px; color:#555; border-bottom:1px solid #F0F0F0;">${typeof qte === 'number' ? qte.toLocaleString('fr-FR') : qte}</td>
          <td style="padding:3px 5px; text-align:right; font-size:8.5px; color:#777; border-bottom:1px solid #F0F0F0;">${pxAchat ? fmtPDF(pxAchat) : '—'}</td>
          <td style="padding:3px 5px; text-align:right; font-size:9px; font-weight:700; border-bottom:1px solid #F0F0F0; color:${pl !== null ? (pl >= 0 ? '#1E7A4A' : '#C0392B') : '#333'};">${valeur ? fmtPDF(valeur) : '—'}${pl !== null ? `<div style="font-size:7.5px;">${pl >= 0 ? '+' : ''}${fmtPDF(Math.round(pl))}</div>` : ''}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>` : ''}
</div>` : ''}

<!-- PIED DE PAGE -->
<div style="padding:6px 14px; background:#F0F0F0; border-top:1px solid #DCDCDC;">
  <table style="width:100%; border-collapse:collapse;"><tr>
    <td style="font-size:8px; color:#AAA;">Document confidentiel — usage personnel</td>
    <td style="text-align:center; font-size:8px; color:#BBB;">PatriMoi v1.6</td>
    <td style="text-align:right; font-size:8px; color:#AAA;">${date}</td>
  </tr></table>
</div>

</div>
</body>
</html>`;

      const result = await RNHTMLtoPDF.convert({
        html: htmlBudget,
        fileName: `PatriMoi_Budget_${new Date().toISOString().slice(0,10)}`,
        directory: Platform.OS === 'ios' ? 'Documents' : 'Download',
        base64: false,
        height: 841,
        width: 595,
      });

      if (!result?.filePath) throw new Error('Échec génération PDF');

      trackExportPDF('budget');
      await Share.share({
        url: `file://${result.filePath}`,
        title: 'PatriMoi — Budget & Revenus',
      });

    } catch (e) {
      Alert.alert('Erreur', 'Impossible de générer le PDF : ' + (e.message || 'erreur inconnue'));
    } finally {
      setExportingBudgetPDF(false);
    }
  }, [data, nomComplet, pdfFrom, pdfTo]); // eslint-disable-line

  // ── Suppression de compte ─────────────────────────────────────────────────
  const handleDeleteAccount = useCallback(() => {
    if (demoMode) {
      Alert.alert(
        'Mode Démo',
        'La suppression de compte n\'est pas disponible en mode démo.\nCréez un compte pour accéder à cette option.',
        [{ text: 'OK' }]
      );
      return;
    }
    // Étape 1 — avertissement initial
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible.\n\nToutes vos données (patrimoine, historique, alertes) seront définitivement supprimées de nos serveurs.\n\nLes données locales sur cet appareil seront aussi effacées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          style: 'destructive',
          onPress: () => {
            // Étape 2 — confirmation finale
            Alert.alert(
              'Confirmation définitive',
              'Êtes-vous certain de vouloir supprimer définitivement votre compte PatriMoi ?\n\nCette action ne peut pas être annulée.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Supprimer définitivement',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingAccount(true);
                    const { error } = await deleteAccount();
                    setDeletingAccount(false);
                    if (error) {
                      Alert.alert('Erreur', `Impossible de supprimer le compte : ${error}`);
                      return;
                    }
                    // Nettoyage local
                    try { storage.set('@patrimoi_pin', null); } catch {}
                    try { storage.set(PREFS_KEY, null); } catch {}
                    // Déconnexion + reset store
                    onSignOut?.();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [demoMode, onSignOut]);

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
      { label:'À propos de PatriMoi',       right:'›', onPress: () => onNav?.('apropos') },
      { label:'Informations personnelles',  right:'›', onPress: handleEditProfile },
      { label:"Monnaie d'affichage",        right:'DH (MAD) ›', onPress:() => handleItem("Monnaie d'affichage") },
      { label:'Date de debut de suivi',     right:`${trackLabel} ›`, onPress:() => { setTrackInput(trackDate || ''); setEditTrack(true); } },
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
      {
        label: exportingPatrimoinePDF ? 'Generation...' : 'Exporter votre patrimoine en PDF',
        right: exportingPatrimoinePDF ? '⏳' : (isPremium ? '›' : '🔒'),
        onPress: exportingPatrimoinePDF ? null : (isPremium ? handleExportPatrimoinePDF : () => {
          trackPaywallViewed('pdf_export');
          Alert.alert('Fonctionnalité PatriMoi+', 'L\'export PDF est réservé aux abonnés PatriMoi+.\n\nL\'export CSV reste gratuit.', [
            { text: 'Export CSV (gratuit)', onPress: handleExportCSV },
            { text: 'Découvrir PatriMoi+', onPress: () => Alert.alert('PatriMoi+', 'Gestion de l\'abonnement disponible dans une prochaine version.') },
            { text: 'Fermer', style: 'cancel' },
          ]);
        }),
      },
      {
        label: exportingBudgetPDF ? 'Generation...' : 'Exporter votre budget en PDF',
        right: exportingBudgetPDF ? '⏳' : (isPremium ? '›' : '🔒'),
        onPress: exportingBudgetPDF ? null : (isPremium ? openPdfModal : () => {
          trackPaywallViewed('pdf_export');
          Alert.alert('Fonctionnalité PatriMoi+', 'L\'export PDF est réservé aux abonnés PatriMoi+.\n\nL\'export CSV reste gratuit.', [
            { text: 'Export CSV (gratuit)', onPress: handleExportCSV },
            { text: 'Découvrir PatriMoi+', onPress: () => Alert.alert('PatriMoi+', 'Gestion de l\'abonnement disponible dans une prochaine version.') },
            { text: 'Fermer', style: 'cancel' },
          ]);
        }),
      },
      { label:'Exporter en CSV',              right:'›',  onPress: handleExportCSV },
      { label:'Importer releve bancaire CSV', right:'📥', onPress: () => { setImportText(''); setImportResult(null); setImportVisible(true); } },
      { label: deletingAccount ? 'Suppression en cours…' : 'Supprimer mon compte', right: deletingAccount ? <ActivityIndicator size="small" color={C.sec}/> : <Text style={{ color:C.sec }}>›</Text>, onPress: deletingAccount ? null : handleDeleteAccount },
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
              <Text style={{ fontSize:11, fontWeight:'700', color:C.white }}>{demoMode ? 'Demo' : isPremium ? 'PatriMoi+' : 'Gratuit'}</Text>
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

        {/* Alertes Cours BVC */}
        <Text style={{ fontSize:11, fontWeight:'600', color:C.g3, marginTop:14, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Alertes Cours BVC</Text>
        <Card style={{ padding:14 }}>
          {bvcAlerts.length === 0 ? (
            <Text style={{ fontSize:12, color:C.g3, marginBottom:12, lineHeight:18 }}>
              Recevez une notification dès qu'un cours franchit un seuil que vous définissez.
            </Text>
          ) : (
            bvcAlerts.map((a, idx) => (
              <View key={a.id} style={{ flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth: idx < bvcAlerts.length - 1 ? 1 : 0, borderBottomColor:C.g1 }}>
                <View style={{ flex:1 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                    <View style={{ backgroundColor: a.enabled ? C.priL : C.g1, borderRadius:6, paddingHorizontal:8, paddingVertical:2 }}>
                      <Text style={{ fontSize:12, fontWeight:'700', color: a.enabled ? C.pri : C.g3 }}>{a.ticker}</Text>
                    </View>
                    {a.seuilHaut > 0 && <Text style={{ fontSize:11, color:C.gpos }}>▲ {a.seuilHaut.toLocaleString('fr-FR')} DH</Text>}
                    {a.seuilBas  > 0 && <Text style={{ fontSize:11, color:C.rneg }}>▼ {a.seuilBas.toLocaleString('fr-FR')} DH</Text>}
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleToggleAlert(idx)} style={{ marginRight:8 }}>
                  <Text style={{ fontSize:11, color: a.enabled ? C.gpos : C.g3 }}>{a.enabled ? '●' : '○'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleEditAlert(idx)} style={{ marginRight:10 }}>
                  <Text style={{ fontSize:11, color:C.pri }}>Éditer</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteAlert(idx)}>
                  <Text style={{ fontSize:11, color:C.sec }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          <TouchableOpacity
            onPress={handleOpenAddAlert}
            style={{ marginTop: bvcAlerts.length > 0 ? 10 : 0, backgroundColor:C.priL, borderRadius:8, paddingVertical:10, alignItems:'center' }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize:13, fontWeight:'600', color:C.pri }}>+ Ajouter une alerte</Text>
          </TouchableOpacity>
        </Card>

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
            <View style={{ flex:1 }}>
              <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>PatriMoi+ — Phase de lancement</Text>
              <Text style={{ fontSize:12, color:C.gpos, marginTop:2 }}>✓ Toutes les fonctionnalités incluses</Text>
            </View>
            <View style={{ alignItems:'flex-end', marginLeft:8 }}>
              <Text style={{ fontWeight:'700', fontSize:15, color:C.gpos, textDecorationLine:'line-through' }}>29 DH</Text>
              <Text style={{ fontSize:11, fontWeight:'700', color:C.pri }}>Gratuit</Text>
            </View>
          </View>
          <BtnSec
            style={{ marginTop:10 }}
            onPress={() => Alert.alert(
              'PatriMoi+ — Ce qui est prévu',
              '🎁 Pendant la phase de lancement (environ 6 mois), toutes les fonctionnalités sont gratuites pour les premiers utilisateurs.\n\n' +
              '📦 PatriMoi+ comprend :\n' +
              '• Historique & snapshots du patrimoine\n' +
              '• Export PDF (rapport complet)\n' +
              '• Alertes cours BVC personnalisées\n' +
              '• Sync cloud multi-appareils\n\n' +
              '💳 Après la phase de lancement, un abonnement à 29 DH/mois sera proposé. Les utilisateurs fidèles seront notifiés à l\'avance.',
              [{ text: 'Compris', style: 'default' }]
            )}
          >
            En savoir plus →
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
            <Text style={{ fontSize:11, color:C.g3, textAlign:'center', marginTop:12, lineHeight:16 }}>
              PIN oublié ? Supprimez et re-créez votre PIN.{'\n'}Les données locales restent intactes.
            </Text>
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

      {/* Modal — Alerte BVC */}
      <Modal visible={alertModal} transparent animationType="slide" onRequestClose={() => setAlertModal(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:C.white, borderTopLeftRadius:20, borderTopRightRadius:20, padding:24 }}>
            <Text style={{ fontWeight:'700', fontSize:15, color:C.dark, marginBottom:14 }}>
              {editAlertIdx >= 0 ? 'Modifier l\'alerte' : 'Nouvelle alerte BVC'}
            </Text>
            <Text style={{ fontSize:11, color:C.g3, marginBottom:6 }}>Ticker (ex : ATW, IAM, BCP)</Text>
            <TextInput
              value={alertTicker}
              onChangeText={t => setAlertTicker(t.toUpperCase())}
              placeholder="ATW"
              placeholderTextColor={C.g3}
              autoCapitalize="characters"
              style={{
                borderWidth:1.5, borderColor:C.g2, borderRadius:10,
                fontSize:14, paddingHorizontal:14, paddingVertical:12,
                color:C.dark, backgroundColor:C.g1, marginBottom:14,
              }}
            />
            <Text style={{ fontSize:11, color:C.g3, marginBottom:6 }}>Seuil haut — notifier si cours ≥ (laisser vide = aucun)</Text>
            <TextInput
              value={alertHaut}
              onChangeText={setAlertHaut}
              placeholder="ex : 150"
              placeholderTextColor={C.g3}
              keyboardType="decimal-pad"
              style={{
                borderWidth:1.5, borderColor:C.g2, borderRadius:10,
                fontSize:14, paddingHorizontal:14, paddingVertical:12,
                color:C.dark, backgroundColor:C.g1, marginBottom:14,
              }}
            />
            <Text style={{ fontSize:11, color:C.g3, marginBottom:6 }}>Seuil bas — notifier si cours ≤ (laisser vide = aucun)</Text>
            <TextInput
              value={alertBas}
              onChangeText={setAlertBas}
              placeholder="ex : 120"
              placeholderTextColor={C.g3}
              keyboardType="decimal-pad"
              style={{
                borderWidth:1.5, borderColor:C.g2, borderRadius:10,
                fontSize:14, paddingHorizontal:14, paddingVertical:12,
                color:C.dark, backgroundColor:C.g1, marginBottom:16,
              }}
            />
            <View style={{ flexDirection:'row', gap:8 }}>
              <TouchableOpacity
                onPress={() => setAlertModal(false)}
                style={{ flex:1, paddingVertical:13, borderRadius:10, alignItems:'center', backgroundColor:C.g1 }}
              >
                <Text style={{ color:C.g3, fontWeight:'600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveAlert}
                style={{ flex:2, paddingVertical:13, borderRadius:10, alignItems:'center', backgroundColor:C.pri }}
              >
                <Text style={{ color:C.white, fontWeight:'700' }}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal — Plage de dates export PDF */}
      <Modal visible={pdfModal} transparent animationType="slide" onRequestClose={() => setPdfModal(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:C.white, borderTopLeftRadius:20, borderTopRightRadius:20, padding:24 }}>
            <Text style={{ fontWeight:'700', fontSize:15, color:C.dark, marginBottom:4 }}>Export PDF — Plage de dates</Text>
            <Text style={{ fontSize:12, color:C.g3, marginBottom:16, lineHeight:18 }}>
              Filtrer les opérations budget/revenus incluses dans le rapport. Laissez vide pour tout inclure.
            </Text>
            <Text style={{ fontSize:11, color:C.g3, marginBottom:6 }}>De (YYYY-MM-DD)</Text>
            <TextInput
              value={pdfFrom}
              onChangeText={setPdfFrom}
              placeholder="2026-01-01"
              placeholderTextColor={C.g3}
              style={{
                borderWidth:1.5, borderColor:C.g2, borderRadius:10,
                fontSize:14, paddingHorizontal:14, paddingVertical:12,
                color:C.dark, backgroundColor:C.g1, marginBottom:14,
              }}
            />
            <Text style={{ fontSize:11, color:C.g3, marginBottom:6 }}>À (YYYY-MM-DD)</Text>
            <TextInput
              value={pdfTo}
              onChangeText={setPdfTo}
              placeholder="2026-12-31"
              placeholderTextColor={C.g3}
              style={{
                borderWidth:1.5, borderColor:C.g2, borderRadius:10,
                fontSize:14, paddingHorizontal:14, paddingVertical:12,
                color:C.dark, backgroundColor:C.g1, marginBottom:16,
              }}
            />
            <View style={{ flexDirection:'row', gap:8 }}>
              <TouchableOpacity
                onPress={() => setPdfModal(false)}
                style={{ flex:1, paddingVertical:13, borderRadius:10, alignItems:'center', backgroundColor:C.g1 }}
              >
                <Text style={{ color:C.g3, fontWeight:'600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setPdfModal(false); handleExportBudgetPDF(); }}
                style={{ flex:2, paddingVertical:13, borderRadius:10, alignItems:'center', backgroundColor:C.pri }}
              >
                <Text style={{ color:C.white, fontWeight:'700' }}>Générer le PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
