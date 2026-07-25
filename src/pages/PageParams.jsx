import React, { useState, useCallback, useEffect } from 'react';
import { usePatrimoineStore } from '../store/patrimoineStore';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, Share, Platform, Modal } from 'react-native';
import { storage } from '../utils/storage';
import { C } from '../constants/colors';
import { Card, BtnSec, BtnPri, Toggle, TopBar, Input, PickerModal } from '../components/shared';

import { isBiometricsAvailable, authenticateBiometric } from '../utils/biometrics';
import { updateProfile } from '../utils/auth';
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

  // ── Alertes BVC — CRUD ────────────────────────────────────
  const saveAlertsList = useCallback((updated) => {
    setBvcAlerts(updated);
    storage.set('@patrimoi_bvc_alerts', updated);
  }, []);

  const handleOpenAddAlert = useCallback(() => {
    setAlertTicker(''); setAlertHaut(''); setAlertBas(''); setEditAlertIdx(-1);
    setAlertModal(true);
  }, []);

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
  const [exportingPDF, setExportingPDF] = useState(false);

  const handleExportPDF = useCallback(async () => {
    const d = data || INIT;
    setExportingPDF(true);
    try {
      // ── Résolution module PDF ──────────────────────────────
      let RNHTMLtoPDF = null;
      try { const { NativeModules } = require('react-native'); const m = NativeModules?.RNPDFExport; if (m && typeof m.convert === 'function') RNHTMLtoPDF = m; } catch {}
      if (!RNHTMLtoPDF) { try { const { NativeModules } = require('react-native'); const m = NativeModules?.RNHTMLtoPDF || NativeModules?.HtmlToPdf; if (m && typeof m.convert === 'function') RNHTMLtoPDF = m; } catch {} }
      if (!RNHTMLtoPDF) { try { const { TurboModuleRegistry } = require('react-native'); const m = TurboModuleRegistry?.get?.('RNPDFExport') || TurboModuleRegistry?.get?.('HtmlToPdf') || TurboModuleRegistry?.get?.('RNHTMLtoPDF'); if (m && typeof m.convert === 'function') RNHTMLtoPDF = m; } catch {} }

      // Fallback texte
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
        setExportingPDF(false);
        return;
      }

      // ── Helpers ────────────────────────────────────────────
      const fmtPDF  = (n) => { if (!n && n !== 0) return '—'; return n.toLocaleString('fr-FR', { maximumFractionDigits:0 }) + ' DH'; };
      const fmtPct  = (v) => v > 0 ? '+' + v.toFixed(1) + '%' : v.toFixed(1) + '%';
      const fmtDiff = (v) => v > 0 ? '+' + Math.round(v).toLocaleString('fr-FR') + ' DH' : Math.round(v).toLocaleString('fr-FR') + ' DH';
      const fmtD    = (iso) => { if (!iso) return ''; const [yy,mm,dd] = iso.split('-'); return `${dd}/${mm}/${yy}`; };
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

      // ── Sparkline SVG 12 derniers mois ────────────────────
      const sparkData = sortedHist.slice(-13); // 13 points → 12 intervalles
      const sparkHtml = (() => {
        if (sparkData.length < 2) return '';
        const W = 480, H = 70, pad = 4;
        const vals = sparkData.map(h => h.val);
        const minV = Math.min(...vals), maxV = Math.max(...vals);
        const range = maxV - minV || 1;
        const pts = sparkData.map((h, i) => {
          const x = pad + (W - 2 * pad) * i / (sparkData.length - 1);
          const y = H - pad - (H - 2 * pad) * (h.val - minV) / range;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        const polyline = pts.join(' ');
        // Fill area under curve
        const fillPts = `${pad},${H - pad} ` + polyline + ` ${(W - pad).toFixed(1)},${H - pad}`;
        // Tick labels : premier et dernier mois
        const labelFirst = sparkData[0].date.slice(0, 7).split('-').reverse().join('/');
        const labelLast  = sparkData[sparkData.length - 1].date.slice(0, 7).split('-').reverse().join('/');
        return `
        <svg viewBox="0 0 ${W} ${H + 18}" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:90px;">
          <defs>
            <linearGradient id="grdSpark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#1E7A4A" stop-opacity="0.18"/>
              <stop offset="100%" stop-color="#1E7A4A" stop-opacity="0.02"/>
            </linearGradient>
          </defs>
          <polygon points="${fillPts}" fill="url(#grdSpark)"/>
          <polyline points="${polyline}" fill="none" stroke="#1E7A4A" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          <circle cx="${pts[pts.length-1].split(',')[0]}" cy="${pts[pts.length-1].split(',')[1]}" r="4" fill="#1E7A4A"/>
          <text x="${pad}" y="${H + 14}" font-size="9" fill="#aaa">${labelFirst}</text>
          <text x="${W - pad}" y="${H + 14}" font-size="9" fill="#aaa" text-anchor="end">${labelLast}</text>
          <text x="${W/2}" y="${H + 14}" font-size="9" fill="#aaa" text-anchor="middle">${fmtPDF(maxV)} max</text>
        </svg>`;
      })();

      // ── Répartition actifs ─────────────────────────────────
      const cats = [
        { label:'Liquidités & Devises', val: calcLiquide(d.liquidites),  icon:'💵', color:'#1E7A4A' },
        { label:'Argent en Banque',      val: calcBanque(d.banque),        icon:'🏦', color:'#1A4A9A' },
        { label:'Compte sur Carnet',     val: calcCarnet(d.carnet),        icon:'📒', color:'#0E7A6B' },
        { label:'Compte PEA',            val: calcPEA(d.pea),              icon:'📈', color:'#2E7A2A' },
        { label:'Compte-Titre',          val: calcCT(d.ct),                icon:'📊', color:'#4A3A9A' },
        { label:'Or & Métaux Précieux',  val: calcOr(d.or, d.prixOr),     icon:'🥇', color:'#B8860B' },
        { label:'Immobilier & Terrains', val: calcImmo(d.immobilier),      icon:'🏠', color:'#8B4513' },
        { label:'Biens de Transport',    val: calcTransport(d.transport),  icon:'🚗', color:'#4A4A6A' },
      ].filter(c => c.val > 0);

      // Donut SVG
      const donutHtml = (() => {
        if (total === 0 || cats.length === 0) return '';
        const cx = 90, cy = 90, R = 70, r = 42;
        let angle = -Math.PI / 2;
        const slices = cats.map(c => {
          const pct   = c.val / total;
          const sweep = pct * 2 * Math.PI;
          const x1    = cx + R * Math.cos(angle);
          const y1    = cy + R * Math.sin(angle);
          angle      += sweep;
          const x2    = cx + R * Math.cos(angle);
          const y2    = cy + R * Math.sin(angle);
          const xi1   = cx + r * Math.cos(angle - sweep);
          const yi1   = cy + r * Math.sin(angle - sweep);
          const xi2   = cx + r * Math.cos(angle);
          const yi2   = cy + r * Math.sin(angle);
          const lg    = sweep > Math.PI ? 1 : 0;
          return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${lg} 1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xi2.toFixed(1)},${yi2.toFixed(1)} A${r},${r} 0 ${lg} 0 ${xi1.toFixed(1)},${yi1.toFixed(1)} Z" fill="${c.color}" opacity="0.9"/>`;
        }).join('');
        return `<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" style="width:180px;height:180px;flex-shrink:0;">${slices}<text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="10" fill="#555">Total</text><text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#222">${(total/1000).toFixed(0)}k</text></svg>`;
      })();

      const rows = cats.map(c => {
        const pct  = total > 0 ? (c.val / total * 100).toFixed(1) : '0.0';
        const barW = total > 0 ? Math.max(2, Math.round(c.val / total * 160)) : 0;
        return `<tr>
          <td style="padding:9px 12px; font-size:12px; color:#333; border-bottom:1px solid #f3f3f3;">${c.icon} ${c.label}</td>
          <td style="padding:9px 12px; text-align:right; font-weight:700; font-size:12px; color:${c.color}; border-bottom:1px solid #f3f3f3; white-space:nowrap;">${fmtPDF(c.val)}</td>
          <td style="padding:9px 12px; text-align:right; color:#888; font-size:11px; border-bottom:1px solid #f3f3f3;">${pct}%</td>
          <td style="padding:9px 12px; border-bottom:1px solid #f3f3f3; vertical-align:middle; min-width:170px;">
            <div style="background:#eee; border-radius:4px; height:6px;">
              <div style="background:${c.color}; border-radius:4px; height:6px; width:${barW}px;"></div>
            </div>
          </td>
        </tr>`;
      }).join('');

      // ── Objectif ───────────────────────────────────────────
      const objPct     = objectif && objectif.montant > 0 ? Math.min(100, total / objectif.montant * 100) : 0;
      const objetifHtml = objectif ? `
        <div style="background:#F0FBF4; border:1.5px solid #1E7A4A; border-radius:12px; padding:16px 20px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div>
              <div style="font-size:10px; color:#555; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">Objectif patrimonial</div>
              <div style="font-size:16px; font-weight:700; color:#1E7A4A;">${fmtPDF(objectif.montant)} <span style="font-size:11px; font-weight:400; color:#888;">en ${objectif.dateTarget}</span></div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:22px; font-weight:800; color:#1E7A4A;">${objPct.toFixed(1)}%</div>
              <div style="font-size:10px; color:#888;">atteint</div>
            </div>
          </div>
          <div style="background:#ddd; border-radius:6px; height:10px;">
            <div style="background:linear-gradient(90deg,#1E7A4A,#27AE60); border-radius:6px; height:10px; width:${objPct.toFixed(1)}%;"></div>
          </div>
          <div style="font-size:10px; color:#888; margin-top:6px;">Il manque ${fmtPDF(Math.max(0, objectif.montant - total))} pour atteindre l'objectif</div>
        </div>` : '';

      // ── Performance actifs financiers ──────────────────────
      const peaVal  = calcPEA(d.pea);
      const peaCout = calcPEACout(d.pea);
      const peaPL   = peaVal - peaCout;
      const peaPct  = peaCout > 0 ? (peaPL / peaCout * 100) : null;

      const ctVal   = calcCT(d.ct);
      const ctCout  = calcCTCout(d.ct);
      const ctPL    = ctVal - ctCout;
      const ctPct   = ctCout > 0 ? (ctPL / ctCout * 100) : null;

      const orVal   = calcOr(d.or, d.prixOr);

      // Rendement global actifs financiers (PEA + CT)
      const totalActifsCout = peaCout + ctCout;
      const totalActifsVal  = peaVal + ctVal;
      const totalActifsPL   = totalActifsVal - totalActifsCout;
      const totalActifsPct  = totalActifsCout > 0 ? (totalActifsPL / totalActifsCout * 100) : null;

      // Rendement actifs depuis début du mois courant (via history)
      const moisStart   = startOfMonthEntry ? startOfMonthEntry.val : null;
      const rendMois    = moisStart ? total - moisStart : null;
      const rendMoisPct = moisStart && moisStart > 0 ? (rendMois / moisStart * 100) : null;

      const actifsPerfHtml = (peaCout > 0 || ctCout > 0) ? `
      <div style="margin-bottom:20px;">
        <div style="font-size:13px; font-weight:700; color:#222; margin-bottom:12px; padding-bottom:6px; border-bottom:1.5px solid #eee;">Performance des actifs financiers</div>
        ${totalActifsCout > 0 ? `
        <div style="background:#F8F9FA; border-radius:10px; padding:14px 16px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
          <div><div style="font-size:10px; color:#888; margin-bottom:3px;">TOTAL PEA + CT</div><div style="font-size:13px; font-weight:700; color:#222;">Investi : ${fmtPDF(totalActifsCout)}</div><div style="font-size:11px; color:#555; margin-top:2px;">Valeur actuelle : ${fmtPDF(totalActifsVal)}</div></div>
          <div style="text-align:right;"><div style="font-size:20px; font-weight:800; color:${diffColor(totalActifsPL)};">${totalActifsPct !== null ? fmtPct(totalActifsPct) : '—'}</div><div style="font-size:11px; color:${diffColor(totalActifsPL)};">${fmtDiff(totalActifsPL)}</div></div>
        </div>` : ''}
        <table style="width:100%; border-collapse:collapse; border:1px solid #eee; border-radius:8px; overflow:hidden;">
          ${peaCout > 0 ? `<tr style="background:#FAFFF8;"><td style="padding:10px 14px;"><div style="font-size:11px; font-weight:600; color:#2E7A2A;">📈 PEA</div><div style="font-size:10px; color:#888; margin-top:2px;">Coût : ${fmtPDF(peaCout)} · Valeur : ${fmtPDF(peaVal)}</div></td><td style="padding:10px 14px; text-align:right;"><div style="font-size:15px; font-weight:800; color:${diffColor(peaPL)};">${peaPct !== null ? fmtPct(peaPct) : '—'}</div><div style="font-size:10px; color:${diffColor(peaPL)};">${fmtDiff(peaPL)}</div></td></tr>` : ''}
          ${ctCout > 0 ? `<tr style="background:#FAFAF8; border-top:1px solid #f0f0f0;"><td style="padding:10px 14px;"><div style="font-size:11px; font-weight:600; color:#4A3A9A;">📊 Compte-Titre</div><div style="font-size:10px; color:#888; margin-top:2px;">Coût : ${fmtPDF(ctCout)} · Valeur : ${fmtPDF(ctVal)}</div></td><td style="padding:10px 14px; text-align:right;"><div style="font-size:15px; font-weight:800; color:${diffColor(ctPL)};">${ctPct !== null ? fmtPct(ctPct) : '—'}</div><div style="font-size:10px; color:${diffColor(ctPL)};">${fmtDiff(ctPL)}</div></td></tr>` : ''}
          ${orVal > 0 ? `<tr style="border-top:1px solid #f0f0f0;"><td style="padding:10px 14px;"><div style="font-size:11px; font-weight:600; color:#B8860B;">🥇 Or & Métaux</div><div style="font-size:10px; color:#888; margin-top:2px;">Valorisation actuelle</div></td><td style="padding:10px 14px; text-align:right;"><div style="font-size:15px; font-weight:700; color:#B8860B;">${fmtPDF(orVal)}</div></td></tr>` : ''}
        </table>
      </div>` : '';

      // ── Budget — filtré par plage PDF ──────────────────────
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
      const tauxEpargne  = (totalRev + totalEpargne) > 0
        ? (totalEpargne / (totalRev + totalEpargne) * 100)
        : null;

      // Dépenses mois précédent (comparaison)
      const opsPrevMois = opsAll.filter(op => {
        const opDate = (op.date || '').slice(0, 7);
        return opDate === prevMonthStr && op.type === 'depense';
      });
      const totalDepPrev = opsPrevMois.reduce((s, o) => s + (o.montant || 0), 0);
      const varDepMois    = totalDepPrev > 0 ? totalDep - totalDepPrev : null;
      const varDepMoisPct = totalDepPrev > 0 ? (varDepMois / totalDepPrev * 100) : null;

      // Budget cibles vs réalisé
      const budgetCibles = d.budgetCibles || {};
      const totalBudgetCible = Object.values(budgetCibles).reduce((s, v) => s + (v || 0), 0);
      const budgetRestant    = totalBudgetCible > 0 ? totalBudgetCible - totalDep : null;
      const budgetPct        = totalBudgetCible > 0 ? Math.min(150, totalDep / totalBudgetCible * 100) : null;

      // Dépenses par catégorie
      const byCat = {};
      depenses.forEach(o => { byCat[o.categorie || 'autre'] = (byCat[o.categorie || 'autre'] || 0) + (o.montant || 0); });
      const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const catIcons   = { alimentation:'🛒', transport:'🚗', logement:'🏠', loisirs:'🎭', sante:'💊', education:'📚', dividende:'💰', autre:'💼' };

      const periodLabel = pdfFrom && pdfTo
        ? `Période : Du ${fmtD(pdfFrom)} au ${fmtD(pdfTo)}`
        : opsFil.length > 0 ? 'Toutes les opérations enregistrées' : '';

      // Graphique dépenses catégories (barres horizontales)
      const catBarsHtml = catEntries.length > 0 ? `
        <div style="margin-top:14px;">
          <div style="font-size:10px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Dépenses par catégorie</div>
          ${catEntries.map(([cat, montant]) => {
            const pct      = totalDep > 0 ? montant / totalDep * 100 : 0;
            const cible    = budgetCibles[cat] || 0;
            const vsObjPct = cible > 0 ? (montant / cible * 100) : null;
            const barColor = vsObjPct !== null ? (vsObjPct > 100 ? '#E74C3C' : vsObjPct > 85 ? '#F39C12' : '#27AE60') : '#E74C3C';
            return `
            <div style="margin-bottom:10px;">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
                <span style="font-size:11px; color:#333;">${catIcons[cat] || '💼'} ${cat}</span>
                <span style="font-size:11px; font-weight:700; color:${barColor};">${fmtPDF(montant)}${cible > 0 ? ` <span style="font-size:9px; color:#888;">/ ${fmtPDF(cible)}</span>` : ''}</span>
              </div>
              <div style="background:#eee; border-radius:4px; height:7px;">
                <div style="background:${barColor}; border-radius:4px; height:7px; width:${pct.toFixed(1)}%;"></div>
              </div>
              ${vsObjPct !== null ? `<div style="font-size:9px; color:${barColor}; margin-top:2px; text-align:right;">${vsObjPct.toFixed(0)}% de l'objectif</div>` : ''}
            </div>`;
          }).join('')}
        </div>` : '';

      const budgetHtml = opsFil.length === 0 ? '' : `
      <!-- Section Budget -->
      <div style="background:#FAFAFA; border-radius:14px; padding:20px; margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <div style="font-size:14px; font-weight:700; color:#222;">Budget & Revenus</div>
            ${periodLabel ? `<div style="font-size:10px; color:#888; margin-top:2px;">${periodLabel}</div>` : ''}
          </div>
          ${varDepMoisPct !== null ? `<div style="background:${varDepMois > 0 ? '#FFF0F0' : '#F0FBF4'}; border-radius:8px; padding:6px 12px; text-align:center;"><div style="font-size:9px; color:#888;">vs mois préc.</div><div style="font-size:14px; font-weight:700; color:${diffColor(-varDepMois)};">${fmtPct(-varDepMoisPct)}</div></div>` : ''}
        </div>

        <!-- KPI Cards -->
        <div style="display:flex; gap:8px; margin-bottom:14px;">
          <div style="flex:1; background:white; border-radius:10px; padding:12px; text-align:center; border:1px solid #f0f0f0;">
            <div style="font-size:9px; color:#888; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.4px;">💚 Revenus</div>
            <div style="font-size:15px; font-weight:800; color:#1E7A4A;">${fmtPDF(totalRev)}</div>
          </div>
          <div style="flex:1; background:white; border-radius:10px; padding:12px; text-align:center; border:1px solid #f0f0f0;">
            <div style="font-size:9px; color:#888; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.4px;">❤️ Dépenses</div>
            <div style="font-size:15px; font-weight:800; color:#C0392B;">${fmtPDF(totalDep)}</div>
            ${totalDepPrev > 0 ? `<div style="font-size:9px; color:${diffColor(-varDepMois)}; margin-top:2px;">${fmtDiff(varDepMois)} vs M-1</div>` : ''}
          </div>
          <div style="flex:1; background:white; border-radius:10px; padding:12px; text-align:center; border:1px solid #f0f0f0;">
            <div style="font-size:9px; color:#888; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.4px;">💙 Épargne</div>
            <div style="font-size:15px; font-weight:800; color:#1A4A9A;">${fmtPDF(totalEpargne)}</div>
            ${tauxEpargne !== null ? `<div style="font-size:9px; color:#1A4A9A; margin-top:2px;">${tauxEpargne.toFixed(1)}% du revenu</div>` : ''}
          </div>
        </div>

        <!-- Balance -->
        <div style="background:${balance >= 0 ? '#F0FBF4' : '#FFF0F0'}; border-radius:10px; padding:12px 16px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:11px; color:#555; font-weight:600;">Balance nette (Revenus − Dépenses + Épargne)</div>
          <div style="font-size:16px; font-weight:800; color:${balance >= 0 ? '#1E7A4A' : '#C0392B'};">${balance >= 0 ? '+' : ''}${fmtPDF(Math.abs(balance))}</div>
        </div>

        <!-- Budget vs Cible -->
        ${totalBudgetCible > 0 ? `
        <div style="background:white; border-radius:10px; padding:12px 16px; margin-bottom:14px; border:1px solid #f0f0f0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:11px; font-weight:600; color:#333;">Budget dépenses (objectif mensuel)</div>
            <div style="font-size:12px; font-weight:700; color:${budgetPct > 100 ? '#C0392B' : '#F39C12'};">${budgetPct.toFixed(0)}% utilisé</div>
          </div>
          <div style="background:#eee; border-radius:6px; height:9px; margin-bottom:8px;">
            <div style="background:${budgetPct > 100 ? '#C0392B' : budgetPct > 85 ? '#F39C12' : '#27AE60'}; border-radius:6px; height:9px; width:${Math.min(100, budgetPct).toFixed(1)}%;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:10px; color:#888;">
            <span>Réalisé : ${fmtPDF(totalDep)}</span>
            <span>Cible : ${fmtPDF(totalBudgetCible)}</span>
            <span style="color:${budgetRestant >= 0 ? '#27AE60' : '#C0392B'}; font-weight:600;">${budgetRestant >= 0 ? 'Reste : ' + fmtPDF(budgetRestant) : 'Dépassement : ' + fmtPDF(Math.abs(budgetRestant))}</span>
          </div>
        </div>` : ''}

        ${catBarsHtml}
      </div>`;

      // ── HTML complet ───────────────────────────────────────
      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background:#F8FAFA; color:#222; }
  .page { max-width:680px; margin:0 auto; background:#fff; }
</style>
</head>
<body>
<div class="page">

  <!-- ── EN-TÊTE ── -->
  <div style="background:linear-gradient(135deg,#0F4B26 0%,#1E7A4A 55%,#27AE60 100%); padding:36px 36px 30px; color:white; position:relative; overflow:hidden;">
    <div style="position:absolute; right:-30px; top:-30px; width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,0.05);"></div>
    <div style="position:absolute; right:20px; bottom:-40px; width:120px; height:120px; border-radius:50%; background:rgba(255,255,255,0.04);"></div>
    <div style="display:flex; justify-content:space-between; align-items:flex-start; position:relative;">
      <div>
        <div style="font-size:26px; font-weight:800; letter-spacing:-0.5px;">PatriMoi</div>
        <div style="font-size:11px; opacity:0.7; margin-top:3px; letter-spacing:0.5px;">VOTRE PATRIMOINE · VOTRE AVENIR</div>
      </div>
      <div style="text-align:right; font-size:11px; opacity:0.75; line-height:1.6;">
        <div>${date}</div>
        ${nomComplet ? `<div style="font-weight:600;">${nomComplet}</div>` : ''}
      </div>
    </div>
    <div style="margin-top:28px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.2);">
      <div style="font-size:10px; opacity:0.7; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Patrimoine Total</div>
      <div style="font-size:42px; font-weight:800; letter-spacing:-1px;">${fmtPDF(total)}</div>
      <div style="display:flex; gap:20px; margin-top:12px; flex-wrap:wrap;">
        ${varMoisPct !== null ? `<div style="background:rgba(255,255,255,0.15); border-radius:8px; padding:8px 14px;"><div style="font-size:9px; opacity:0.75; margin-bottom:3px;">vs mois précédent</div><div style="font-size:15px; font-weight:700;">${fmtPct(varMoisPct)}</div><div style="font-size:10px; opacity:0.8;">${fmtDiff(varMois)}</div></div>` : ''}
        ${varCreaPct !== null ? `<div style="background:rgba(255,255,255,0.15); border-radius:8px; padding:8px 14px;"><div style="font-size:9px; opacity:0.75; margin-bottom:3px;">depuis création${dateCreation ? ' (' + dateCreation + ')' : ''}</div><div style="font-size:15px; font-weight:700;">${fmtPct(varCreaPct)}</div><div style="font-size:10px; opacity:0.8;">${fmtDiff(varCreation)}</div></div>` : ''}
        ${rendMoisPct !== null ? `<div style="background:rgba(255,255,255,0.15); border-radius:8px; padding:8px 14px;"><div style="font-size:9px; opacity:0.75; margin-bottom:3px;">variation ce mois</div><div style="font-size:15px; font-weight:700;">${fmtPct(rendMoisPct)}</div><div style="font-size:10px; opacity:0.8;">${fmtDiff(rendMois)}</div></div>` : ''}
      </div>
    </div>
  </div>

  <!-- ── CORPS ── -->
  <div style="padding:24px 28px;">

    <!-- Graphique évolution -->
    ${sparkHtml ? `
    <div style="background:#F8FAFA; border-radius:12px; padding:16px 20px; margin-bottom:24px;">
      <div style="font-size:12px; font-weight:600; color:#555; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <span>Évolution du patrimoine</span>
        <span style="font-size:10px; font-weight:400; color:#aaa;">${sparkData.length} mois</span>
      </div>
      ${sparkHtml}
    </div>` : ''}

    <!-- Objectif -->
    ${objetifHtml}

    <!-- Répartition actifs -->
    <div style="margin-bottom:24px;">
      <div style="font-size:13px; font-weight:700; color:#222; margin-bottom:14px; padding-bottom:6px; border-bottom:1.5px solid #eee;">Répartition du patrimoine</div>
      <div style="display:flex; gap:16px; align-items:flex-start;">
        ${donutHtml}
        <div style="flex:1;">
          <table style="width:100%; border-collapse:collapse; border-radius:10px; overflow:hidden; border:1px solid #eee;">
            <thead><tr style="background:#1E7A4A;"><th style="padding:8px 12px; text-align:left; color:white; font-size:11px; font-weight:600;">Catégorie</th><th style="padding:8px 12px; text-align:right; color:white; font-size:11px;">Valeur</th><th style="padding:8px 12px; text-align:right; color:white; font-size:11px;">%</th></tr></thead>
            <tbody>${cats.map(c => {
              const pct = total > 0 ? (c.val / total * 100).toFixed(1) : '0.0';
              return `<tr><td style="padding:8px 12px; font-size:11px; color:#333; border-bottom:1px solid #f3f3f3;">${c.icon} ${c.label}</td><td style="padding:8px 12px; text-align:right; font-weight:700; font-size:11px; color:${c.color}; border-bottom:1px solid #f3f3f3; white-space:nowrap;">${fmtPDF(c.val)}</td><td style="padding:8px 12px; text-align:right; color:#888; font-size:10px; border-bottom:1px solid #f3f3f3;">${pct}%</td></tr>`;
            }).join('')}</tbody>
            <tfoot><tr style="background:#F0FBF4;"><td style="padding:9px 12px; font-weight:800; font-size:12px; color:#1E7A4A;" colspan="2">TOTAL</td><td style="padding:9px 12px; text-align:right; font-weight:800; font-size:12px; color:#1E7A4A;">${fmtPDF(total)}</td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Performance actifs -->
    ${actifsPerfHtml}

    <!-- Budget & Revenus -->
    ${budgetHtml}

    <!-- Pied de page -->
    <div style="padding-top:20px; border-top:1.5px solid #eee; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:10px; color:#bbb;">Document confidentiel — usage personnel</div>
      <div style="font-size:10px; color:#bbb;">PatriMoi v1.6 · ${date}</div>
    </div>

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
  }, [data, objectif, nomComplet, history, trackingStartDate, pdfFrom, pdfTo]); // eslint-disable-line

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
      { label: exportingPDF ? 'Generation du PDF...' : 'Exporter en PDF', right: exportingPDF ? '⏳' : '›', onPress: exportingPDF ? null : openPdfModal },
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

        {demoMode && (
          <>
            {/* Notre mission */}
            <View style={{ backgroundColor:C.white, borderRadius:12, padding:16, marginTop:16, marginBottom:8, borderLeftWidth:4, borderLeftColor:C.gpos, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:4, elevation:2 }}>
              <Text style={{ fontSize:12, fontWeight:'700', color:C.gpos, marginBottom:6, letterSpacing:0.5, textTransform:'uppercase' }}>Notre mission</Text>
              <Text style={{ fontSize:13, color:C.dark, lineHeight:20 }}>
                Donner à chaque Marocain les outils pour comprendre, suivre et faire croître son patrimoine — simplement, en français ou en arabe, depuis son téléphone.
              </Text>
            </View>

            {/* Notre vision */}
            <View style={{ backgroundColor:'#FFFDE7', borderRadius:12, padding:16, marginBottom:24, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:4, elevation:2 }}>
              <Text style={{ fontSize:12, fontWeight:'700', color:'#D4900A', marginBottom:6, letterSpacing:0.5, textTransform:'uppercase' }}>Notre vision</Text>
              <Text style={{ fontSize:13, color:C.dark, lineHeight:20 }}>
                Avant PatriMoi, aucune application marocaine ne centralisait patrimoine financier, immobilier, or et devises en un seul endroit.{' '}
                <Text style={{ fontWeight:'800' }}>Nous l'avons créé.</Text>
              </Text>
            </View>
          </>
        )}
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
                onPress={() => { setPdfModal(false); handleExportPDF(); }}
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
