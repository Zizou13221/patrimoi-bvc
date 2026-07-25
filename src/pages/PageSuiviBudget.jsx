/**
 * PatriMoi — PageSuiviBudget v2
 *
 * Nouveautés v2 :
 *  - Mini bar chart 6 mois (tendance dépenses)
 *  - KPIs avec comparaison M-1 (↑↓ %)
 *  - Taux d'épargne
 *  - Budget cibles par catégorie (barres vertes/orange/rouges + modal config)
 *  - Édition d'une opération (tap → modal pré-rempli)
 *  - Suppression long press avec confirmation
 *  - React.memo sur ArcSlice pour les performances
 */

import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { usePatrimoineStore } from '../store/patrimoineStore';
import { C } from '../constants/colors';
import { fmt } from '../utils/fmt';
import { getBvcCache } from '../utils/api';
import { TopBar, Card, SectionTitle, BtnPri, BtnSec, Input, SelectInput, Toggle } from '../components/shared';

// ──────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ──────────────────────────────────────────────────────────────────────────────
const MOIS_LONG  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MOIS_COURT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

const CATEGORIES = [
  { id:'alimentation', label:'Alimentation', icon:'🛒', color:'#E74C3C' },
  { id:'transport',    label:'Transport',    icon:'🚗', color:'#3498DB' },
  { id:'logement',     label:'Logement',     icon:'🏠', color:'#9B59B6' },
  { id:'loisirs',      label:'Loisirs',      icon:'🎭', color:'#E67E22' },
  { id:'sante',        label:'Santé',        icon:'💊', color:'#1ABC9C' },
  { id:'education',    label:'Éducation',    icon:'📚', color:'#F39C12' },
  { id:'autre',        label:'Autre',        icon:'💼', color:'#95A5A6' },
];

const getCat    = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

const ACTIFS_INVEST = [
  { sub:'pea',        label:'PEA',        icon:'📈', color:'#1A6B3A' },
  { sub:'ct',         label:'Titres',     icon:'💹', color:'#9B59B6' },
  { sub:'or',         label:'Or',         icon:'🥇', color:'#F39C12' },
  { sub:'immobilier', label:'Immobilier', icon:'🏠', color:'#E74C3C' },
  { sub:'carnet',     label:'Carnet',     icon:'📒', color:'#1ABC9C' },
  { sub:'banque',     label:'Banque',     icon:'🏦', color:'#3498DB' },
  { sub:'liquide',    label:'Liquidités', icon:'💵', color:'#27AE60' },
  { sub:'transport',  label:'Transport',  icon:'🚗', color:'#95A5A6' },
];

// Actifs disponibles dans la modal budget (sans immo/transport)
const ACTIFS_BUDGET = [
  { sub:'pea',     label:'PEA',               icon:'📈', color:'#1A6B3A' },
  { sub:'ct',      label:'Titres',            icon:'💹', color:'#9B59B6' },
  { sub:'or',      label:'Or',               icon:'🥇', color:'#F39C12' },
  { sub:'carnet',  label:'Carnet',           icon:'📒', color:'#1ABC9C' },
  { sub:'banque',  label:'Banque',           icon:'🏦', color:'#3498DB' },
  { sub:'liquide', label:'Liquide (Zellige)',icon:'💵', color:'#27AE60' },
];

const getActif = sub => ACTIFS_INVEST.find(a => a.sub === sub) || { sub, label:sub, icon:'💼', color:'#95A5A6' };

// ── BVC — noms officiels Casablanca Bourse (sync avec PageActifs) ─────────────
const BVC_LIST = [
  'ADH - Addoha',
  'AFM - AFMA',
  'AFI - Afric Industries',
  'AFG - Afriquia Gaz',
  'AGM - AGMA SA',
  'AKT - Akdital',
  'ADI - Alliances',
  'ALM - Aluminium du Maroc',
  'ARD - Aradei Capital',
  'ATL - Atlantasanad',
  'ATW - Attijariwafa Bank',
  'ATH - Auto Hall',
  'NEJ - Auto Nejma',
  'BAL - Balima',
  'BOA - Bank of Africa',
  'BCP - Banque Centrale Populaire',
  'BMCI - BMCI',
  'CRS - Cartier Saada',
  'CAP - Cash Plus',
  'CFG - CFG Bank',
  'CIH - CIH Bank',
  'CMA - Ciments du Maroc',
  'CMG - CMGP Group',
  'COL - Colorado',
  'CMT - Compagnie Minière de Touissit',
  'CSR - Cosumar',
  'CDM - Crédit du Maroc',
  'CTM - CTM',
  'DARI - Dari Couspate',
  'DLM - Delattre Levivier Maroc',
  'DHO - Delta Holding',
  'DIS - Diac Salaf',
  'DYT - Disty Technologies',
  'DWAY - Disway',
  'NAKL - Ennakl',
  'EQD - Eqdom',
  'FBR - Fenie Brossette',
  'HOL - Holcim Maroc',
  'HPS - HPS',
  'IBMC - IB Maroc.com',
  'IMO - Immorente Invest',
  'INV - Involys',
  'JET - Jet Contractors',
  'LBV - Label Vie',
  'LES - Lesieur Cristal',
  'M2M - M2M Group',
  'MOX - Maghreb Oxygène',
  'MAB - Maghrebail',
  'MNG - Managem',
  'MLE - Maroc Leasing',
  'IAM - Maroc Telecom',
  'MSA - Marsa Maroc',
  'MDP - Med Paper',
  'MIC - Microdata',
  'MUT - Mutandis',
  'OUL - Oulmès',
  'PRO - Promopharm',
  'SRM - Réalisations Mécaniques',
  'REB - Rebab Company',
  'RDS - Résidences Dar Saada',
  'RIS - RISMA',
  'S2M - S2M',
  'SLF - Salafin',
  'SAM - Samir',
  'SAHM - Sanlam Maroc',
  'GTM - SGTM',
  'SMI - SMI',
  'SNP - SNEP',
  'SBM - Société des Boissons du Maroc',
  'SID - Sonasid',
  'SOT - Sothema',
  'SNA - Stokvis Nord Afrique',
  'STR - Stroc Industrie',
  'T2S - T2S Group Holding',
  'TQM - TAQA Morocco',
  'TGC - TGCC',
  'TMA - TotalEnergies Marketing Maroc',
  'UMR - Unimer',
  'VCN - Vicenne',
  'WAA - Wafa Assurance',
];
const coursFromBvc = (val) => {
  if (!val || val === 'Selectionner...') return null;
  const [tck] = val.split(' - ');
  const bvc = getBvcCache();
  return bvc?.data?.cours?.[tck]?.cours ?? null;
};

// Couleur épargne
const C_EPARGNE = '#8E44AD';
const prevYM    = (y, m) => m === 0 ? [y - 1, 11] : [y, m - 1];
const fmtKnum   = n => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(Math.round(n));

// ──────────────────────────────────────────────────────────────────────────────
// DONUT CHART — pur React Native, zéro SVG
// ──────────────────────────────────────────────────────────────────────────────
const DonutBudget = memo(({ segments, total }) => {
  if (!segments || segments.length === 0 || total <= 0) return null;

  // Trier du plus grand au plus petit pour un meilleur rendu visuel
  const sorted = [...segments].sort((a, b) => b.amount - a.amount);

  return (
    <View style={{ width:'100%', paddingHorizontal:4 }}>
      {/* Barre empilée 100% — exacte par construction */}
      <View style={{ flexDirection:'row', height:22, borderRadius:11, overflow:'hidden', marginBottom:10 }}>
        {sorted.map((s, i) => {
          const flex = s.amount / total;
          return (
            <View
              key={i}
              style={{ flex, backgroundColor:s.color, borderRightWidth: i < sorted.length-1 ? 1 : 0, borderRightColor:'rgba(255,255,255,0.3)' }}
            />
          );
        })}
      </View>
      {/* Total centré */}
      <View style={{ alignItems:'center' }}>
        <Text style={{ fontSize:20, fontWeight:'800', color:C.dark, letterSpacing:-0.5 }}>
          {fmtKnum(total)}
        </Text>
        <Text style={{ fontSize:10, color:C.g3, marginTop:1 }}>DH dépensés ce mois</Text>
      </View>
    </View>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// MINI BAR CHART — 6 mois de dépenses
// ──────────────────────────────────────────────────────────────────────────────
const MiniBarChart = memo(({ monthData }) => {
  const maxVal = Math.max(...monthData.map(d => d.total), 1);
  const BAR_H  = 56;

  return (
    <View style={{ flexDirection:'row', alignItems:'flex-end', gap:6, marginTop:4 }}>
      {monthData.map((d, i) => {
        const h = d.total > 0 ? Math.max((d.total / maxVal) * BAR_H, 5) : 0;
        return (
          <View key={i} style={{ flex:1, alignItems:'center' }}>
            {d.total > 0 && (
              <Text style={{ fontSize:8, color:d.isCurrent ? C.pri : C.g3, marginBottom:2, fontWeight:d.isCurrent ? '700' : '400' }}>
                {fmtKnum(d.total)}
              </Text>
            )}
            <View style={{ height:BAR_H, justifyContent:'flex-end', width:'100%' }}>
              <View style={{
                height:h || 2, width:'100%',
                backgroundColor:d.isCurrent ? C.pri : (h === 0 ? C.g1 : C.g2),
                borderRadius:4,
              }} />
            </View>
            <Text style={{ fontSize:9, color:d.isCurrent ? C.pri : C.g3, marginTop:4, fontWeight:d.isCurrent ? '700' : '400' }}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// TREND BADGE — comparaison M-1 sur KPIs
// ──────────────────────────────────────────────────────────────────────────────
const TrendBadge = ({ current, prev, goodWhenDown = false }) => {
  if (!prev || prev === 0 || current === 0) return null;
  const pct  = Math.round(Math.abs((current - prev) / prev * 100));
  if (pct === 0) return null;
  const isUp   = current > prev;
  const isGood = goodWhenDown ? !isUp : isUp;
  return (
    <Text style={{ fontSize:10, color:isGood ? C.gpos : C.rneg, marginTop:2 }}>
      {isUp ? '↑' : '↓'} {pct}% vs M-1
    </Text>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// HELPER — Sync épargne budget → patrimoine (v3)
// ──────────────────────────────────────────────────────────────────────────────
const applyEpargneSync = (data, actifSub, montant, details) => {
  const d = { ...data };
  const m = Number(montant) || 0;

  switch (actifSub) {
    case 'pea': {
      const { ticker = '', nom = '', pru = 0, cours = 0, qty = 0 } = details;
      if (qty <= 0) break;
      const t = ticker.toUpperCase();
      const existing = t ? (d.pea || []).find(p => p.ticker?.toUpperCase() === t) : null;
      if (existing) {
        const totalQty = existing.qty + qty;
        const newPru   = ((existing.pru * existing.qty) + (pru * qty)) / totalQty;
        d.pea = d.pea.map(p =>
          p.ticker?.toUpperCase() === t
            ? { ...p, pru: Math.round(newPru * 100) / 100, qty: totalQty, cours: cours || p.cours }
            : p
        );
      } else {
        d.pea = [...(d.pea || []), { ticker: t || 'NEW', nom: nom || t || 'Sans nom', pru: pru || m, cours: cours || pru || m, qty }];
      }
      break;
    }
    case 'ct': {
      if (details.ctType === 'actions') {
        const { ticker = '', nom = '', pru = 0, cours = 0, qty = 0 } = details;
        if (qty <= 0) break;
        const t = ticker.toUpperCase();
        const actions = d.ct?.actions || [];
        const existing = t ? actions.find(p => p.ticker?.toUpperCase() === t) : null;
        if (existing) {
          const totalQty = existing.qty + qty;
          const newPru   = ((existing.pru * existing.qty) + (pru * qty)) / totalQty;
          d.ct = { ...d.ct, actions: d.ct.actions.map(p =>
            p.ticker?.toUpperCase() === t
              ? { ...p, pru: Math.round(newPru * 100) / 100, qty: totalQty, cours: cours || p.cours }
              : p
          )};
        } else {
          d.ct = { ...d.ct, actions: [...actions, { ticker: t || 'NEW', nom: nom || t || 'Sans nom', pru: pru || m, cours: cours || pru || m, qty }] };
        }
      } else {
        const { code = '', nom = '', vl = 0, parts = 0, type = 'Actions' } = details;
        if (parts <= 0) break;
        d.ct = { ...d.ct, opcvm: [...(d.ct?.opcvm || []), { code, nom, vl, parts, type }] };
      }
      break;
    }
    case 'or': {
      const { nom = 'Or', quantite = 0, unite = 'g' } = details;
      if (quantite <= 0) break;
      const maxId = Math.max(0, ...(d.or || []).map(o => o.id || 0));
      d.or = [...(d.or || []), { id: maxId + 1, nom, quantite, unite, prixAchat: m, prixOffert: null }];
      break;
    }
    case 'banque': {
      const { banque = '', compte = 'Compte courant' } = details;
      if (!banque || !m) break;
      const existing = (d.banque || []).find(b => b.banque === banque);
      if (existing) {
        d.banque = d.banque.map(b => b.banque === banque ? { ...b, solde: b.solde + m } : b);
      } else {
        d.banque = [...(d.banque || []), { banque, solde: m, compte }];
      }
      break;
    }
    case 'carnet': {
      const { banque = '', taux = 0 } = details;
      if (!banque || !m) break;
      d.carnet = [...(d.carnet || []), { banque, solde: m, taux, rappel: { montant: 0, freq: 'Mensuel', prochaine: '' } }];
      break;
    }
    case 'liquide': {
      d.liquidites = { ...(d.liquidites || { dh: 0, devises: [] }), dh: (d.liquidites?.dh || 0) + m };
      break;
    }
    case 'immobilier': {
      const { nom = '', type = 'Bien bati', ville = '', surface = '0', unite = 'm2', prixM2 = '0' } = details;
      if (!nom || !m) break;
      const maxId = Math.max(0, ...(d.immobilier || []).map(o => o.id || 0));
      d.immobilier = [...(d.immobilier || []), {
        id: maxId + 1, nom, type, ville,
        surface: parseFloat(surface) || 0, unite,
        prixAchat: m, datAchat: String(new Date().getFullYear()),
        prixM2: parseFloat(prixM2) || 0, prixOffert: null, meth: 'estimatif',
      }];
      break;
    }
    case 'transport': {
      const { nom = '', type = 'Voiture', annee = '', immat = '' } = details;
      if (!nom || !m) break;
      const maxId = Math.max(0, ...(d.transport || []).map(o => o.id || 0));
      d.transport = [...(d.transport || []), {
        id: maxId + 1, nom, type,
        annee: parseInt(annee) || new Date().getFullYear(),
        immat, prixAchat: m, dateAchat: String(new Date().getFullYear()),
        valEstim: m, prixOffert: null, meth: 'estimatif',
      }];
      break;
    }
    default: break;
  }
  return d;
};

// ──────────────────────────────────────────────────────────────────────────────
// MODAL — Ajout / Édition d'opération
// ──────────────────────────────────────────────────────────────────────────────
const INIT_FORM = {
  type: 'depense', categorie: 'alimentation', actif: 'pea', montant: '', description: '', dividendeAction: '',
  ctType: 'actions',                                              // CT : 'actions' | 'opcvm'
  ticker: '', nom: '', pru: '', cours: '', qty: '', dateAchat: '', // PEA / CT actions
  code: '', vl: '', parts: '', opcvmType: 'Actions',  // CT OPCVM
  orNom: '', orQte: '', orUnite: 'g',                 // Or
  banqueNom: '', compte: 'Compte courant', taux: '',  // Banque / Carnet
  immoNom: '', immoType: 'Bien bati', immoVille: '', immoSurface: '', immoUnite: 'm2', immoPrixM2: '',
  veloNom: '', veloType: 'Voiture', veloAnnee: String(new Date().getFullYear()), veloImmat: '',
};

const ModalAjout = ({ visible, onClose, onSubmit, selYear, selMonth, editingOp }) => {
  const isEdit = !!editingOp;
  const [form, setForm] = useState(INIT_FORM);
  const sf = useCallback((patch) => setForm(f => ({ ...f, ...patch })), []);
  const data = usePatrimoineStore(s => s.data);

  // Pré-remplir si édition
  useEffect(() => {
    if (visible && editingOp) {
      setForm({ ...INIT_FORM, type: editingOp.type, categorie: editingOp.categorie || 'alimentation', actif: editingOp.actif || 'pea', montant: String(editingOp.montant), description: editingOp.description || '' });
    } else if (visible && !editingOp) {
      setForm(INIT_FORM);
    }
  }, [visible, editingOp]);

  // Auto-calcul montant : PRU × Qty (PEA / CT actions) ou VL × Parts (OPCVM)
  useEffect(() => {
    if (form.type !== 'epargne') return;
    if (form.actif === 'pea' || (form.actif === 'ct' && form.ctType === 'actions')) {
      const p = parseFloat(form.pru), q = parseFloat(form.qty);
      if (p > 0 && q > 0) setForm(f => ({ ...f, montant: String(Math.round(p * q)) }));
    } else if (form.actif === 'ct' && form.ctType === 'opcvm') {
      const v = parseFloat(form.vl), p = parseFloat(form.parts);
      if (v > 0 && p > 0) setForm(f => ({ ...f, montant: String(Math.round(v * p)) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pru, form.qty, form.vl, form.parts, form.actif, form.ctType]);

  const buildDetails = useCallback(() => {
    const parseBvc = (val) => {
      const [tck = '', ...rest] = (val || '').split(' - ');
      return { ticker: tck.trim().toUpperCase(), nom: rest.join(' - ').trim() || tck.trim() };
    };
    switch (form.actif) {
      case 'pea': {
        const { ticker, nom } = parseBvc(form.ticker);
        return { ticker, nom, pru: parseFloat(form.pru)||0, cours: parseFloat(form.cours)||parseFloat(form.pru)||0, qty: parseFloat(form.qty)||0, dateAchat: form.dateAchat||'' };
      }
      case 'ct': {
        if (form.ctType === 'actions') {
          const { ticker, nom } = parseBvc(form.ticker);
          return { ctType: 'actions', ticker, nom, pru: parseFloat(form.pru)||0, cours: parseFloat(form.cours)||parseFloat(form.pru)||0, qty: parseFloat(form.qty)||0, dateAchat: form.dateAchat||'' };
        }
        return { ctType: 'opcvm', code: form.code.trim(), nom: form.nom.trim(), vl: parseFloat(form.vl)||0, parts: parseFloat(form.parts)||0, type: form.opcvmType };
      }
      case 'or':     return { nom: form.orNom.trim() || 'Or', quantite: parseFloat(form.orQte) || 0, unite: form.orUnite };
      case 'banque': return { banque: form.banqueNom.trim(), compte: form.compte.trim() || 'Compte courant' };
      case 'carnet': return { banque: form.banqueNom.trim(), taux: parseFloat(form.taux) || 0 };
      case 'liquide':      return {};
      case 'immobilier':   return { nom: form.immoNom.trim(), type: form.immoType, ville: form.immoVille.trim(), surface: form.immoSurface, unite: form.immoUnite, prixM2: form.immoPrixM2 };
      case 'transport':    return { nom: form.veloNom.trim(), type: form.veloType, annee: form.veloAnnee, immat: form.veloImmat.trim() };
      default: return {};
    }
  }, [form]);

  const handleSubmit = useCallback(() => {
    const montant = parseFloat(form.montant.replace(',', '.'));
    if (!montant || montant <= 0 || isNaN(montant)) {
      Alert.alert('Montant invalide', 'Entrez un montant positif.');
      return;
    }
    const today = new Date();
    const day = (!isEdit && today.getFullYear() === selYear && today.getMonth() === selMonth)
      ? today.getDate() : (editingOp ? new Date(editingOp.date).getDate() : 1);
    const isEpargne = form.type === 'epargne';
    const actifInfo = isEpargne ? getActif(form.actif) : null;
    const op = {
      id:          editingOp?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date:        new Date(selYear, selMonth, day).toISOString(),
      montant,
      type:        form.type,
      categorie:   isEpargne ? form.actif : (form.type === 'depense' ? form.categorie : form.type === 'revenu' && form.categorie === 'dividende' ? 'dividende' : 'autre'),
      actif:       isEpargne ? form.actif : null,
      description: form.description.trim() || (isEpargne ? actifInfo.label : form.type === 'depense' ? getCat(form.categorie).label : form.type === 'revenu' && form.categorie === 'dividende' ? 'Dividendes' : 'Revenu'),
    };
    onSubmit(op, isEpargne && !isEdit ? buildDetails() : null);
    onClose();
  }, [form, editingOp, isEdit, selYear, selMonth, onSubmit, onClose, buildDetails]);

  // ── Champs spécifiques à l'actif ──────────────────────────────────────────
  const renderActifFields = () => {
    const iS  = [ms.input, { marginBottom: 8 }];
    const row = (children) => <View style={{ flexDirection: 'row', gap: 8 }}>{children}</View>;
    const col = (label, input) => (
      <View style={{ flex: 1 }}>
        <Text style={ms.fieldLabel}>{label}</Text>
        {input}
      </View>
    );
    const box = (header, children) => (
      <View style={ms.detailBox}>
        {header ? <Text style={ms.detailHeader}>{header}</Text> : null}
        {children}
      </View>
    );
    const OPCVM_TYPES = ['Actions', 'Obligataire', 'Diversifié', 'Monétaire'];
    const IMMO_TYPES  = ['Bien bati', 'Terrain', 'Appartement', 'Local', 'Villa'];
    const VEH_TYPES   = ['Voiture', 'Moto', 'Camion', 'Autre'];

    switch (form.actif) {
      case 'pea': {
        const peaList = data?.pea || [];
        const selTicker = (form.ticker || '').split(' - ')[0].toUpperCase();
        return box('POSITION PEA 📈',
          <>
            {peaList.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={ms.fieldLabel}>Positions existantes</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                  {peaList.map(pos => {
                    const isSel = selTicker === pos.ticker?.toUpperCase();
                    return (
                      <TouchableOpacity
                        key={pos.ticker}
                        onPress={() => {
                          const bvcEntry = BVC_LIST.find(b => b.startsWith(pos.ticker + ' ')) || `${pos.ticker} - ${pos.nom || pos.ticker}`;
                          const cachedCours = coursFromBvc(bvcEntry);
                          sf({ ticker: bvcEntry, cours: String(cachedCours != null ? cachedCours : (pos.cours || '')), pru: String(pos.pru || '') });
                        }}
                        style={{ backgroundColor: isSel ? '#1A6B3A' : C.g1, borderRadius: 10, padding: 10, marginHorizontal: 4, borderWidth: 1, borderColor: isSel ? '#1A6B3A' : C.g2, minWidth: 90 }}
                        activeOpacity={0.75}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isSel ? C.white : C.dark }}>{pos.ticker}</Text>
                        <Text style={{ fontSize: 11, color: isSel ? '#c8f5c8' : C.g3, marginBottom: 4 }} numberOfLines={1}>{pos.nom}</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: isSel ? C.white : '#1A6B3A' }}>Cours : {fmt(pos.cours)} DH</Text>
                        <Text style={{ fontSize: 11, color: isSel ? '#c8f5c8' : C.g3 }}>PRU : {fmt(pos.pru)} DH</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            <SelectInput
              label="Action cotée BVC"
              value={form.ticker}
              onChange={val => {
                const c = coursFromBvc(val);
                sf({ ticker: val, cours: c != null ? String(c) : '' });
              }}
              options={['Selectionner...'].concat(BVC_LIST)}
            />
            <Input label="Prix d'achat unitaire (DH)" value={form.pru} onChangeText={v => sf({ pru: v })} keyboardType="numeric" placeholder="124.50" />
            <Input label="Cours actuel (DH)" value={form.cours} onChangeText={v => sf({ cours: v })} keyboardType="numeric" placeholder="—" />
            <Input label="Quantité (actions)" value={form.qty} onChangeText={v => sf({ qty: v })} keyboardType="numeric" placeholder="80" />
            <Input label="Date d'achat (optionnel)" value={form.dateAchat} onChangeText={v => sf({ dateAchat: v })} placeholder="JJ/MM/AAAA" />
            {!!(form.pru && form.qty) && <Text style={ms.autoCalcHint}>✓ Montant calculé automatiquement</Text>}
          </>
        );
      }

      case 'ct': {
        const ctActions = data?.ct?.actions || [];
        const ctOpcvm   = data?.ct?.opcvm   || [];
        const selTicker = (form.ticker || '').split(' - ')[0].toUpperCase();
        const selCode   = form.code?.trim();
        return box('COMPTE TITRES 💹',
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {[{ id: 'actions', lbl: '📈 Actions' }, { id: 'opcvm', lbl: '📊 OPCVM' }].map(t => (
                <TouchableOpacity key={t.id} style={[ms.typeBtn, { flex: 1, paddingVertical: 9 }, form.ctType === t.id && { backgroundColor: '#9B59B6', borderColor: '#9B59B6' }]} onPress={() => sf({ ctType: t.id })} activeOpacity={0.8}>
                  <Text style={[ms.typeTxt, { fontSize: 13 }, form.ctType === t.id && { color: C.white }]}>{t.lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {form.ctType === 'actions' ? (
              <>
                {ctActions.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={ms.fieldLabel}>Positions existantes</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                      {ctActions.map(pos => {
                        const isSel = selTicker === pos.ticker?.toUpperCase();
                        return (
                          <TouchableOpacity
                            key={pos.ticker}
                            onPress={() => {
                              const bvcEntry = BVC_LIST.find(b => b.startsWith(pos.ticker + ' ')) || `${pos.ticker} - ${pos.nom || pos.ticker}`;
                              const cachedCours = coursFromBvc(bvcEntry);
                              sf({ ticker: bvcEntry, cours: String(cachedCours != null ? cachedCours : (pos.cours || '')), pru: String(pos.pru || '') });
                            }}
                            style={{ backgroundColor: isSel ? '#9B59B6' : C.g1, borderRadius: 10, padding: 10, marginHorizontal: 4, borderWidth: 1, borderColor: isSel ? '#9B59B6' : C.g2, minWidth: 90 }}
                            activeOpacity={0.75}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '700', color: isSel ? C.white : C.dark }}>{pos.ticker}</Text>
                            <Text style={{ fontSize: 11, color: isSel ? '#e8d5f5' : C.g3, marginBottom: 4 }} numberOfLines={1}>{pos.nom}</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: isSel ? C.white : '#9B59B6' }}>Cours : {fmt(pos.cours)} DH</Text>
                            <Text style={{ fontSize: 11, color: isSel ? '#e8d5f5' : C.g3 }}>PRU : {fmt(pos.pru)} DH</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
                <SelectInput
                  label="Action cotée BVC"
                  value={form.ticker}
                  onChange={val => {
                    const c = coursFromBvc(val);
                    sf({ ticker: val, cours: c != null ? String(c) : '' });
                  }}
                  options={['Selectionner...'].concat(BVC_LIST)}
                />
                <Input label="Prix d'achat unitaire (DH)" value={form.pru} onChangeText={v => sf({ pru: v })} keyboardType="numeric" placeholder="124.50" />
                <Input label="Cours actuel (DH)" value={form.cours} onChangeText={v => sf({ cours: v })} keyboardType="numeric" placeholder="—" />
                <Input label="Quantité (actions)" value={form.qty} onChangeText={v => sf({ qty: v })} keyboardType="numeric" placeholder="80" />
                <Input label="Date d'achat (optionnel)" value={form.dateAchat} onChangeText={v => sf({ dateAchat: v })} placeholder="JJ/MM/AAAA" />
                {!!(form.pru && form.qty) && <Text style={ms.autoCalcHint}>✓ Montant calculé automatiquement</Text>}
              </>
            ) : (
              <>
                {ctOpcvm.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={ms.fieldLabel}>Fonds existants</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                      {ctOpcvm.map(pos => {
                        const isSel = selCode === pos.code?.trim();
                        return (
                          <TouchableOpacity
                            key={pos.code || pos.nom}
                            onPress={() => sf({ code: pos.code || '', nom: pos.nom, vl: String(pos.vl || ''), opcvmType: pos.type || 'Actions' })}
                            style={{ backgroundColor: isSel ? '#9B59B6' : C.g1, borderRadius: 10, padding: 10, marginHorizontal: 4, borderWidth: 1, borderColor: isSel ? '#9B59B6' : C.g2, minWidth: 100 }}
                            activeOpacity={0.75}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: isSel ? C.white : C.dark }} numberOfLines={1}>{pos.nom}</Text>
                            <Text style={{ fontSize: 11, color: isSel ? '#e8d5f5' : C.g3, marginBottom: 4 }}>{pos.code}</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: isSel ? C.white : '#9B59B6' }}>VL : {fmt(pos.vl)} DH</Text>
                            <Text style={{ fontSize: 11, color: isSel ? '#e8d5f5' : C.g3 }}>{pos.type || 'OPCVM'}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
                {row(<>
                  {col('Code OPCVM', <TextInput style={iS} placeholder="OPC1" placeholderTextColor={C.g3} value={form.code} onChangeText={v => sf({ code: v })} />)}
                  {col('Nom du fonds', <TextInput style={iS} placeholder="BMCE Cap..." placeholderTextColor={C.g3} value={form.nom} onChangeText={v => sf({ nom: v })} />)}
                </>)}
                {row(<>
                  {col('VL (DH/part)', <TextInput style={iS} placeholder="0.00" placeholderTextColor={C.g3} keyboardType="decimal-pad" value={form.vl} onChangeText={v => sf({ vl: v })} />)}
                  {col('Nombre de parts', <TextInput style={iS} placeholder="0" placeholderTextColor={C.g3} keyboardType="decimal-pad" value={form.parts} onChangeText={v => sf({ parts: v })} />)}
                </>)}
                <Text style={ms.fieldLabel}>Type de fonds</Text>
                <View style={[ms.catGrid, { marginBottom: 4 }]}>
                  {OPCVM_TYPES.map(t => (
                    <TouchableOpacity key={t} style={[ms.catChip, form.opcvmType === t && { backgroundColor: '#9B59B6EE', borderColor: '#9B59B6' }]} onPress={() => sf({ opcvmType: t })} activeOpacity={0.8}>
                      <Text style={[ms.catTxt, form.opcvmType === t && { color: C.white }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!!(form.vl && form.parts) && <Text style={ms.autoCalcHint}>✓ Montant calculé automatiquement</Text>}
              </>
            )}
          </>
        );
      }

      case 'or':
        return box('ACHAT OR 🥇',
          <>
            <TextInput style={iS} placeholder="Désignation (Lingot 250g, Pièces 21K…)" placeholderTextColor={C.g3} value={form.orNom} onChangeText={v => sf({ orNom: v })} />
            {row(
              <>{col('Quantité', <TextInput style={iS} placeholder="0" placeholderTextColor={C.g3} keyboardType="decimal-pad" value={form.orQte} onChangeText={v => sf({ orQte: v })} />)}
                {col('Unité',
                  <View style={{ flexDirection: 'row', gap: 6, paddingTop: 2 }}>
                    {['g', 'kg', 'once'].map(u => (
                      <TouchableOpacity key={u} style={[ms.catChip, { paddingHorizontal: 10, paddingVertical: 6 }, form.orUnite === u && { backgroundColor: '#F39C12EE', borderColor: '#F39C12' }]} onPress={() => sf({ orUnite: u })} activeOpacity={0.8}>
                        <Text style={[ms.catTxt, form.orUnite === u && { color: C.white }]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}</>
            )}
          </>
        );

      case 'banque':
        return box('COMPTE BANCAIRE 🏦',
          <>
            <TextInput style={iS} placeholder="Nom de la banque (CIH, AWB, BP…)" placeholderTextColor={C.g3} value={form.banqueNom} onChangeText={v => sf({ banqueNom: v })} />
            <TextInput style={iS} placeholder="Type de compte (Courant, Épargne…)" placeholderTextColor={C.g3} value={form.compte} onChangeText={v => sf({ compte: v })} />
          </>
        );

      case 'carnet':
        return box("CARNET D'ÉPARGNE 📒",
          <>
            <TextInput style={iS} placeholder="Nom de la banque (CIH, BP…)" placeholderTextColor={C.g3} value={form.banqueNom} onChangeText={v => sf({ banqueNom: v })} />
            <Text style={ms.fieldLabel}>Taux d'intérêt (%)</Text>
            <TextInput style={iS} placeholder="3.0" placeholderTextColor={C.g3} keyboardType="decimal-pad" value={form.taux} onChangeText={v => sf({ taux: v })} />
          </>
        );

      case 'liquide':
        return (
          <View style={[ms.detailBox, { paddingVertical: 10 }]}>
            <Text style={{ fontSize: 13, color: C.g3 }}>💵 Le montant sera ajouté à vos liquidités DH.</Text>
          </View>
        );

      case 'immobilier':
        return box('BIEN IMMOBILIER 🏠',
          <>
            <TextInput style={iS} placeholder="Nom du bien (Appartement Gueliz…)" placeholderTextColor={C.g3} value={form.immoNom} onChangeText={v => sf({ immoNom: v })} />
            <Text style={ms.fieldLabel}>Type</Text>
            <View style={[ms.catGrid, { marginBottom: 8 }]}>
              {IMMO_TYPES.map(t => (
                <TouchableOpacity key={t} style={[ms.catChip, form.immoType === t && { backgroundColor: '#E74C3CEE', borderColor: '#E74C3C' }]} onPress={() => sf({ immoType: t })} activeOpacity={0.8}>
                  <Text style={[ms.catTxt, form.immoType === t && { color: C.white }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={iS} placeholder="Ville" placeholderTextColor={C.g3} value={form.immoVille} onChangeText={v => sf({ immoVille: v })} />
            {row(
              <>{col('Surface', <TextInput style={iS} placeholder="85" placeholderTextColor={C.g3} keyboardType="decimal-pad" value={form.immoSurface} onChangeText={v => sf({ immoSurface: v })} />)}
                {col('Unité', <View style={{ flexDirection: 'row', gap: 6, paddingTop: 2 }}>{['m2', 'ha'].map(u => <TouchableOpacity key={u} style={[ms.catChip, { paddingHorizontal: 10, paddingVertical: 6 }, form.immoUnite === u && { backgroundColor: '#E74C3CEE', borderColor: '#E74C3C' }]} onPress={() => sf({ immoUnite: u })} activeOpacity={0.8}><Text style={[ms.catTxt, form.immoUnite === u && { color: C.white }]}>{u}</Text></TouchableOpacity>)}</View>)}
                {col('Prix/m² (DH)', <TextInput style={iS} placeholder="8000" placeholderTextColor={C.g3} keyboardType="decimal-pad" value={form.immoPrixM2} onChangeText={v => sf({ immoPrixM2: v })} />)}</>
            )}
          </>
        );

      case 'transport':
        return box('VÉHICULE 🚗',
          <>
            <TextInput style={iS} placeholder="Nom (Dacia Logan, BMW R1200…)" placeholderTextColor={C.g3} value={form.veloNom} onChangeText={v => sf({ veloNom: v })} />
            <Text style={ms.fieldLabel}>Type</Text>
            <View style={[ms.catGrid, { marginBottom: 8 }]}>
              {VEH_TYPES.map(t => (
                <TouchableOpacity key={t} style={[ms.catChip, form.veloType === t && { backgroundColor: '#95A5A6EE', borderColor: '#95A5A6' }]} onPress={() => sf({ veloType: t })} activeOpacity={0.8}>
                  <Text style={[ms.catTxt, form.veloType === t && { color: C.white }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {row(
              <>{col('Année', <TextInput style={iS} placeholder={String(new Date().getFullYear())} placeholderTextColor={C.g3} keyboardType="number-pad" value={form.veloAnnee} onChangeText={v => sf({ veloAnnee: v })} />)}
                {col('Immatriculation', <TextInput style={iS} placeholder="A-123-456" placeholderTextColor={C.g3} value={form.veloImmat} onChangeText={v => sf({ veloImmat: v })} />)}</>
            )}
          </>
        );

      default: return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={onClose} />
        <ScrollView
          style={ms.sheetScroll}
          contentContainerStyle={{ paddingBottom: 40 }}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={ms.handle} />
          <Text style={ms.title}>{isEdit ? "Modifier l'opération" : 'Nouvelle opération'}</Text>

          {/* Type — 3 boutons */}
          <View style={ms.typeRow}>
            {[
              { id:'depense', label:'💸 Dépense', color:C.rneg },
              { id:'epargne', label:'🤑 Épargne',  color:C_EPARGNE },
              { id:'revenu',  label:'💰 Revenu',   color:C.gpos },
            ].map(t => (
              <TouchableOpacity
                key={t.id}
                style={[ms.typeBtn, form.type===t.id && { backgroundColor:t.color, borderColor:t.color }]}
                onPress={() => sf({ type: t.id })}
                activeOpacity={0.8}
              >
                <Text style={[ms.typeTxt, form.type===t.id && { color:C.white }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Catégories dépenses */}
          {form.type === 'depense' && (
            <View style={ms.catGrid}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[ms.catChip, form.categorie===c.id && { backgroundColor:c.color+'EE', borderColor:c.color }]}
                  onPress={() => sf({ categorie: c.id })}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize:13 }}>{c.icon}</Text>
                  <Text style={[ms.catTxt, form.categorie===c.id && { color:C.white }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Actifs épargne + champs détaillés */}
          {form.type === 'epargne' && (
            <>
              <Text style={{ fontSize:12, color:C.g3, marginBottom:10 }}>
                Dans quel actif épargnez-vous ?
              </Text>
              <View style={ms.catGrid}>
                {ACTIFS_BUDGET.map(a => (
                  <TouchableOpacity
                    key={a.sub}
                    style={[ms.catChip, form.actif===a.sub && { backgroundColor:a.color+'EE', borderColor:a.color }]}
                    onPress={() => sf({ actif: a.sub })}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize:13 }}>{a.icon}</Text>
                    <Text style={[ms.catTxt, form.actif===a.sub && { color:C.white }]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {renderActifFields()}
            </>
          )}

          {/* Revenus — sous-type + sélecteur action pour dividendes */}
          {form.type === 'revenu' && (() => {
            const isDivid = form.categorie === 'dividende';
            const allActions = [
              ...(data?.pea || []).map(p => ({ ticker: p.ticker, nom: p.nom, source: 'PEA' })),
              ...(data?.ct?.actions || []).map(p => ({ ticker: p.ticker, nom: p.nom, source: 'CT' })),
            ];
            return (
              <>
                <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                  {[{ id:'autre', label:'Autre revenu' }, { id:'dividende', label:'💹 Dividendes' }].map(t => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => sf({ categorie: t.id, dividendeAction: '', description: '' })}
                      style={{ flex:1, alignItems:'center', paddingVertical:10, borderRadius:10, backgroundColor: (isDivid ? 'dividende' : 'autre') === t.id ? C.gpos : C.g1, borderWidth:1, borderColor: (isDivid ? 'dividende' : 'autre') === t.id ? C.gpos : C.g2 }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize:12, fontWeight:'600', color: (isDivid ? 'dividende' : 'autre') === t.id ? C.white : C.dark }}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {isDivid && (
                  allActions.length === 0 ? (
                    <Text style={{ fontSize:12, color:C.g3, marginBottom:12 }}>Aucune action PEA ou CT enregistrée dans Actifs</Text>
                  ) : (
                    <>
                      <Text style={{ fontSize:12, fontWeight:'600', color:C.dark, marginBottom:8 }}>Action concernée</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}>
                        {allActions.map(a => {
                          const key = `${a.ticker}-${a.source}`;
                          const sel = form.dividendeAction === key;
                          return (
                            <TouchableOpacity
                              key={key}
                              onPress={() => sf({ dividendeAction: key, description: `${a.ticker} — ${a.nom}` })}
                              style={{ backgroundColor: sel ? '#1A6B3A' : C.g1, borderRadius:10, paddingHorizontal:14, paddingVertical:10, marginRight:8, borderWidth:1, borderColor: sel ? '#1A6B3A' : C.g2, minWidth:90 }}
                              activeOpacity={0.75}
                            >
                              <Text style={{ fontSize:13, fontWeight:'700', color: sel ? C.white : C.dark }}>{a.ticker}</Text>
                              <Text style={{ fontSize:10, color: sel ? '#c8f5c8' : C.g3 }} numberOfLines={1}>{a.nom}</Text>
                              <Text style={{ fontSize:9, color: sel ? 'rgba(255,255,255,0.7)' : C.g3 }}>{a.source}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </>
                  )
                )}
              </>
            );
          })()}

          {/* Montant */}
          <TextInput
            style={ms.input}
            placeholder="Montant en DH"
            placeholderTextColor={C.g3}
            keyboardType="decimal-pad"
            value={form.montant}
            onChangeText={v => sf({ montant: v })}
          />

          {/* Description */}
          <TextInput
            style={[ms.input, { marginTop:10 }]}
            placeholder="Description (optionnel)"
            placeholderTextColor={C.g3}
            value={form.description}
            onChangeText={v => sf({ description: v })}
            returnKeyType="done"
          />

          <BtnPri style={{ marginTop:18 }} onPress={handleSubmit}>
            {isEdit ? 'Enregistrer les modifications' : 'Enregistrer'}
          </BtnPri>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// MODAL — Revenu récurrent
// ──────────────────────────────────────────────────────────────────────────────
const TYPES_REVENU = ['Salaire', 'Loyer reçu', 'Pension', 'Autre'];

const ModalRevenu = ({ visible, onClose, onSave, onDelete, editingRevenu }) => {
  const data    = usePatrimoineStore(s => s.data);
  const [label,   setLabel]   = useState('Salaire');
  const [montant, setMontant] = useState('');
  const [jour,    setJour]    = useState('25');
  const [actif,   setActif]   = useState(true);
  const [bienId,  setBienId]  = useState(null);
  const [bienNom, setBienNom] = useState('');

  useEffect(() => {
    if (editingRevenu) {
      setLabel(editingRevenu.label || 'Salaire');
      setMontant(String(editingRevenu.montant || ''));
      setJour(String(editingRevenu.jour || '25'));
      setActif(editingRevenu.actif !== false);
      setBienId(editingRevenu.bienId ?? null);
      setBienNom(editingRevenu.bienNom ?? '');
    } else {
      setLabel('Salaire');
      setMontant('');
      setJour('25');
      setActif(true);
      setBienId(null);
      setBienNom('');
    }
  }, [visible, editingRevenu]);

  const handleSave = () => {
    const m = parseFloat((montant || '').replace(',', '.'));
    const j = parseInt(jour);
    if (!m || m <= 0) { Alert.alert('Montant invalide', 'Entrez un montant positif.'); return; }
    if (!j || j < 1 || j > 31) { Alert.alert('Jour invalide', 'Le jour doit être entre 1 et 31.'); return; }
    const extra = label === 'Loyer reçu' && bienId ? { bienId, bienNom } : {};
    onSave({ label: label.trim() || 'Revenu', montant: m, jour: j, actif, ...extra });
    onClose();
  };

  const immobilier = data?.immobilier || [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <TouchableOpacity style={{ flex:1 }} activeOpacity={1} onPress={onClose}/>
        <View style={{ backgroundColor:C.white, borderTopLeftRadius:20, borderTopRightRadius:20, padding:20 }}>
          <Text style={{ fontWeight:'700', fontSize:15, color:C.dark, marginBottom:14, textAlign:'center' }}>
            {editingRevenu ? 'Modifier le revenu' : '💰 Nouveau revenu récurrent'}
          </Text>

          <Text style={{ fontSize:12, fontWeight:'600', color:C.dark, marginBottom:8 }}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:14 }}>
            {TYPES_REVENU.map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => { setLabel(p); setBienId(null); setBienNom(''); }}
                style={{ backgroundColor: label === p ? C.gpos : C.g1, borderRadius:20, paddingHorizontal:14, paddingVertical:8, marginRight:8, borderWidth:1, borderColor: label === p ? C.gpos : C.g2 }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize:12, fontWeight:'600', color: label === p ? C.white : C.dark }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Loyer reçu → sélecteur de bien immobilier */}
          {label === 'Loyer reçu' ? (
            <>
              <Text style={{ fontSize:12, fontWeight:'600', color:C.dark, marginBottom:8 }}>Bien immobilier concerné</Text>
              {immobilier.length === 0 ? (
                <Text style={{ fontSize:12, color:C.g3, marginBottom:14 }}>Aucun bien enregistré dans Actifs → Immobilier</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:14 }}>
                  {immobilier.map(b => {
                    const sel = bienId === b.id;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        onPress={() => { setBienId(b.id); setBienNom(b.nom); }}
                        style={{ backgroundColor: sel ? C.pri : C.g1, borderRadius:10, paddingHorizontal:14, paddingVertical:10, marginRight:8, borderWidth:1, borderColor: sel ? C.pri : C.g2, minWidth:110 }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize:12, fontWeight:'700', color: sel ? C.white : C.dark }} numberOfLines={1}>{b.nom}</Text>
                        <Text style={{ fontSize:10, color: sel ? 'rgba(255,255,255,0.75)' : C.g3 }}>{b.type}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          ) : (
            <Input label="Description" value={label} onChangeText={setLabel} placeholder="Salaire mensuel…"/>
          )}

          <View style={{ flexDirection:'row', gap:8 }}>
            <View style={{ flex:2 }}>
              <Input label="Montant (DH)" value={montant} onChangeText={setMontant} keyboardType="numeric" placeholder="15 000"/>
            </View>
            <View style={{ flex:1 }}>
              <Input label="Jour du mois" value={jour} onChangeText={setJour} keyboardType="numeric" placeholder="25"/>
            </View>
          </View>

          {editingRevenu && (
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:C.g1, borderRadius:10, padding:12, marginBottom:12 }}>
              <Text style={{ fontSize:13, color:C.dark }}>Revenu actif</Text>
              <Toggle on={actif} onChange={setActif}/>
            </View>
          )}

          <BtnPri onPress={handleSave}>{editingRevenu ? 'Enregistrer' : 'Ajouter'}</BtnPri>

          {editingRevenu && (
            <TouchableOpacity
              onPress={() => { onDelete(editingRevenu.id); onClose(); }}
              style={{ marginTop:14, alignItems:'center' }}
            >
              <Text style={{ color:C.sec, fontSize:12, fontWeight:'600' }}>Supprimer ce revenu récurrent</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// MODAL — Configuration des budgets cibles
// ──────────────────────────────────────────────────────────────────────────────
const ModalBudgetCibles = ({ visible, onClose, onSave, currentCibles }) => {
  const [vals, setVals] = useState({});

  useEffect(() => {
    if (visible) setVals({ ...(currentCibles || {}) });
  }, [visible, currentCibles]);

  const handleSave = useCallback(() => {
    const cleaned = {};
    CATEGORIES.forEach(c => {
      const v = parseFloat(String(vals[c.id] || '').replace(',', '.'));
      if (v > 0) cleaned[c.id] = v;
    });
    onSave(cleaned);
    onClose();
  }, [vals, onSave, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <TouchableOpacity style={ms.overlay} activeOpacity={1} onPress={onClose} />
        <ScrollView style={ms.sheetScroll} contentContainerStyle={{ paddingBottom:40 }} bounces={false}>
          <View style={ms.handle} />
          <Text style={ms.title}>Budgets mensuels</Text>
          <Text style={{ fontSize:13, color:C.g3, marginBottom:20, marginTop:-10 }}>
            Définissez un plafond par catégorie pour suivre vos dépenses.
          </Text>

          {CATEGORIES.map(c => (
            <View key={c.id} style={bc.row}>
              <View style={[bc.iconBg, { backgroundColor:c.color+'22' }]}>
                <Text style={{ fontSize:16 }}>{c.icon}</Text>
              </View>
              <Text style={bc.label}>{c.label}</Text>
              <View style={bc.inputWrap}>
                <TextInput
                  style={bc.input}
                  placeholder="∞"
                  placeholderTextColor={C.g2}
                  keyboardType="decimal-pad"
                  value={vals[c.id] ? String(vals[c.id]) : ''}
                  onChangeText={v => setVals(prev => ({ ...prev, [c.id]:v }))}
                />
                <Text style={bc.dh}>DH</Text>
              </View>
            </View>
          ))}

          <View style={{ flexDirection:'row', gap:10, marginTop:20, paddingHorizontal:20 }}>
            <BtnSec style={{ flex:1 }} onPress={onClose}>Annuler</BtnSec>
            <BtnPri style={{ flex:2 }} onPress={handleSave}>Enregistrer</BtnPri>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// PAGE PRINCIPALE
// ──────────────────────────────────────────────────────────────────────────────
const PageSuiviBudget = ({ onNav }) => {
  const data           = usePatrimoineStore(s => s.data);
  const setData        = usePatrimoineStore(s => s.setData);
  const addOperation   = usePatrimoineStore(s => s.addOperation);
  const setOperations  = usePatrimoineStore(s => s.setOperations);
  const setBudgetCibles = usePatrimoineStore(s => s.setBudgetCibles);

  const operations   = data.operations   || [];
  const budgetCibles = data.budgetCibles || {};

  const today = new Date();
  const [selYear,  setSelYear]  = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth());

  const [modalOp,      setModalOp]      = useState(false);
  const [modalCibles,  setModalCibles]  = useState(false);
  const [editingOp,    setEditingOp]    = useState(null);
  const [modalRevenu,  setModalRevenu]  = useState(false);
  const [editRevenu,   setEditRevenu]   = useState(null);

  const revenus_recurrents = data.revenus_recurrents || [];

  // Auto-application des revenus récurrents dus ce mois
  useEffect(() => {
    const now     = new Date();
    const todayD  = now.getDate();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setData(d => {
      const recs = d.revenus_recurrents || [];
      const toApply = recs.filter(r => r.actif !== false && todayD >= r.jour && r.dernierAjout !== currentYM);
      if (toApply.length === 0) return d;
      const newOps = toApply.map(r => ({
        id:          `rec-${r.id}-${currentYM}`,
        date:        new Date(now.getFullYear(), now.getMonth(), r.jour).toISOString(),
        montant:     r.montant,
        type:        'revenu',
        categorie:   'autre',
        actif:       null,
        description: r.label,
      }));
      return {
        ...d,
        operations: [...(d.operations || []), ...newOps],
        revenus_recurrents: recs.map(r =>
          toApply.find(ta => ta.id === r.id) ? { ...r, dernierAjout: currentYM } : r
        ),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Navigation mois ─────────────────────────────────────
  const isCurrentMonth = selYear === today.getFullYear() && selMonth === today.getMonth();

  const prevMonth = useCallback(() => {
    const [ny, nm] = prevYM(selYear, selMonth);
    setSelYear(ny); setSelMonth(nm);
  }, [selYear, selMonth]);

  const nextMonth = useCallback(() => {
    if (isCurrentMonth) return;
    if (selMonth === 11) { setSelMonth(0); setSelYear(y => y + 1); }
    else setSelMonth(m => m + 1);
  }, [selMonth, isCurrentMonth]);

  // ── Totaux helper ────────────────────────────────────────
  const getTotaux = useCallback((y, m) => {
    const filtered = operations.filter(op => {
      const d = new Date(op.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
    const dep = filtered.filter(o => o.type === 'depense').reduce((a, o) => a + o.montant, 0);
    const rev = filtered.filter(o => o.type === 'revenu').reduce((a, o)  => a + o.montant, 0);
    return { dep, rev, filtered };
  }, [operations]);

  // ── Données mois sélectionné ─────────────────────────────
  const { totalDep, totalRev, totalEpargne, segments, recentOps } = useMemo(() => {
    const { dep, rev, filtered } = getTotaux(selYear, selMonth);
    const epargne = filtered.filter(o => o.type === 'epargne').reduce((a, o) => a + o.montant, 0);

    const byCat = {};
    filtered.filter(o => o.type === 'depense').forEach(o => {
      byCat[o.categorie] = (byCat[o.categorie] || 0) + o.montant;
    });
    // Catégories inconnues → "Autre"
    const knownIds = new Set(CATEGORIES.map(c => c.id));
    Object.entries(byCat).forEach(([catId, amt]) => {
      if (!knownIds.has(catId)) {
        byCat['autre'] = (byCat['autre'] || 0) + amt;
        delete byCat[catId];
      }
    });
    const segments = CATEGORIES
      .filter(c => byCat[c.id] > 0)
      .map(c => ({ ...c, amount:byCat[c.id] }))
      .sort((a, b) => b.amount - a.amount);

    const recentOps = [...filtered]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 12);

    return { totalDep:dep, totalRev:rev, totalEpargne:epargne, segments, recentOps };
  }, [operations, selYear, selMonth, getTotaux]);

  // ── Données M-1 ─────────────────────────────────────────
  const { prevDep, prevRev, prevEpargne } = useMemo(() => {
    const [py, pm] = prevYM(selYear, selMonth);
    const { dep, rev, filtered } = getTotaux(py, pm);
    const ep = filtered.filter(o => o.type === 'epargne').reduce((a, o) => a + o.montant, 0);
    return { prevDep:dep, prevRev:rev, prevEpargne:ep };
  }, [selYear, selMonth, getTotaux]);

  // ── 6 mois de dépenses ───────────────────────────────────
  const monthData = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      let m = selMonth - i;
      let y = selYear;
      while (m < 0) { m += 12; y--; }
      const { dep } = getTotaux(y, m);
      result.push({
        label:     MOIS_COURT[m],
        total:     dep,
        isCurrent: i === 0,
      });
    }
    return result;
  }, [selYear, selMonth, getTotaux]);

  const solde     = totalRev - totalDep - totalEpargne;
  const tauxEparg = totalRev > 0 ? Math.round((totalEpargne / totalRev) * 100) : null;

  // ── Notifications in-app ─────────────────────────────────
  const alertes = useMemo(() => {
    const now = new Date();
    const todayD = now.getDate();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const msgs = [];

    // Revenus récurrents : arrivée dans 1-2 jours
    revenus_recurrents.forEach(r => {
      if (r.actif === false) return;
      const daysUntil = r.jour - todayD;
      if (daysUntil === 1) msgs.push({ type:'info', text:`🔔 ${r.label} arrive demain (+${r.montant?.toLocaleString('fr-FR')} DH)` });
      if (daysUntil === 0 && r.dernierAjout !== currentYM) msgs.push({ type:'ok', text:`💰 ${r.label} a été enregistré aujourd'hui (+${r.montant?.toLocaleString('fr-FR')} DH)` });
    });

    // Budget dépassé ou proche (> 80%)
    segments.forEach(seg => {
      const cible = budgetCibles[seg.id];
      if (!cible || cible <= 0) return;
      const ratio = seg.amount / cible;
      if (ratio >= 1)    msgs.push({ type:'danger', text:`⚠ Budget ${seg.label} dépassé — ${Math.round(ratio*100)}% utilisé` });
      else if (ratio >= 0.8) msgs.push({ type:'warn',   text:`⚡ Budget ${seg.label} à ${Math.round(ratio*100)}% — encore ${(cible - seg.amount).toLocaleString('fr-FR')} DH` });
    });

    return msgs;
  }, [revenus_recurrents, segments, budgetCibles, selYear, selMonth]);

  // ── Gestion opérations ───────────────────────────────────
  const handleSubmit = useCallback((op, actifDetails) => {
    if (editingOp) {
      setOperations(ops => ops.map(o => o.id === editingOp.id ? op : o));
    } else if (op.type === 'epargne' && actifDetails) {
      // Mise à jour atomique : ajout opération + sync actif en un seul setData (1 seul enqueueSync)
      setData(d => applyEpargneSync(
        { ...d, operations: [...(d.operations || []), op] },
        op.actif, op.montant, actifDetails
      ));
    } else {
      addOperation(op);
    }
    setEditingOp(null);
    setModalOp(false);
  }, [editingOp, addOperation, setOperations, setData]);

  const handleEdit = useCallback((op) => {
    setEditingOp(op);
    setModalOp(true);
  }, []);

  const handleDelete = useCallback((id) => {
    Alert.alert('Supprimer', 'Supprimer cette opération ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive',
        onPress: () => setOperations(ops => ops.filter(o => o.id !== id)) },
    ]);
  }, [setOperations]);

  const openNewOp = useCallback(() => {
    setEditingOp(null);
    setModalOp(true);
  }, []);

  // ── Revenus récurrents ───────────────────────────────────
  const handleSaveRevenu = useCallback((revenu) => {
    setData(d => {
      const recs = d.revenus_recurrents || [];
      if (editRevenu) {
        return { ...d, revenus_recurrents: recs.map(r => r.id === editRevenu.id ? { ...r, ...revenu } : r) };
      }
      return { ...d, revenus_recurrents: [...recs, { ...revenu, id: `rev-${Date.now()}`, dernierAjout: '' }] };
    });
    setEditRevenu(null);
  }, [editRevenu, setData]);

  const handleDeleteRevenu = useCallback((id) => {
    setData(d => ({ ...d, revenus_recurrents: (d.revenus_recurrents || []).filter(r => r.id !== id) }));
    setEditRevenu(null);
  }, [setData]);

  // ── Budget cible helper ──────────────────────────────────
  const barColor = (amount, cible) => {
    if (!cible) return C.pri;
    const ratio = amount / cible;
    if (ratio >= 1)    return C.rneg;
    if (ratio >= 0.8)  return C.acc;
    return C.gpos;
  };

  return (
    <View style={{ flex:1, backgroundColor:C.g1 }}>
      <TopBar
        title="Suivi de budget"
        onBack={() => onNav('actifs')}
      />

      {/* ── Sélecteur de mois ── */}
      <View style={s.monthBar}>
        <TouchableOpacity onPress={prevMonth} style={s.monthArrow} activeOpacity={0.7}>
          <Text style={s.monthArrowTxt}>‹</Text>
        </TouchableOpacity>
        <View style={s.monthCenter}>
          <Text style={s.monthTxt}>{MOIS_LONG[selMonth]} {selYear}</Text>
          {isCurrentMonth && <View style={s.badge}><Text style={s.badgeTxt}>Mois actuel</Text></View>}
        </View>
        <TouchableOpacity
          onPress={nextMonth}
          style={[s.monthArrow, isCurrentMonth && { opacity:0.15 }]}
          activeOpacity={isCurrentMonth ? 1 : 0.7}
          disabled={isCurrentMonth}
        >
          <Text style={s.monthArrowTxt}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex:1 }}
        contentContainerStyle={{ padding:16, paddingBottom:110 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Tendance 6 mois ── */}
        <Card style={s.card}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <SectionTitle>Tendance 6 mois</SectionTitle>
          </View>
          <MiniBarChart monthData={monthData} />
        </Card>

        {/* ── Notifications in-app ── */}
        {alertes.length > 0 && alertes.map((a, i) => (
          <View key={i} style={{
            marginHorizontal:0, marginBottom:6,
            backgroundColor: a.type==='danger'?'#FFF0F0': a.type==='warn'?'#FFF8E1': a.type==='ok'?'#E8F5E9':'#E3F2FD',
            borderRadius:10, paddingVertical:10, paddingHorizontal:14,
            borderLeftWidth:3,
            borderLeftColor: a.type==='danger'?C.rneg: a.type==='warn'?'#D4900A': a.type==='ok'?C.gpos:'#1976D2',
          }}>
            <Text style={{ fontSize:12, color: a.type==='danger'?C.rneg: a.type==='warn'?'#D4900A': a.type==='ok'?C.gpos:'#1565C0', fontWeight:'600' }}>
              {a.text}
            </Text>
          </View>
        ))}

        {/* ── Revenus récurrents ── */}
        <Card style={s.card}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <SectionTitle>Revenus récurrents 💰</SectionTitle>
            <TouchableOpacity
              onPress={() => { setEditRevenu(null); setModalRevenu(true); }}
              style={s.gearBtn}
              activeOpacity={0.7}
            >
              <Text style={s.gearTxt}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
          {revenus_recurrents.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal:-4 }}>
              {revenus_recurrents.map(r => {
                const now = new Date();
                const currentYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                const recu   = r.dernierAjout === currentYM;
                const inactif = r.actif === false;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => { setEditRevenu(r); setModalRevenu(true); }}
                    style={{ backgroundColor: inactif ? '#F5F5F5' : C.g1, borderRadius:10, padding:10, marginHorizontal:4, borderWidth:1, borderColor: recu ? C.gpos : C.g2, minWidth:115 }}
                    activeOpacity={0.75}
                  >
                    <Text style={{ fontSize:12, fontWeight:'700', color: inactif ? C.g3 : C.dark }} numberOfLines={1}>{r.label}</Text>
                    {r.bienNom ? <Text style={{ fontSize:10, color:C.g3, marginTop:1 }} numberOfLines={1}>🏠 {r.bienNom}</Text> : null}
                    <Text style={{ fontSize:15, fontWeight:'800', color: inactif ? C.g3 : C.gpos, marginTop:3 }}>+{fmt(r.montant)}</Text>
                    <Text style={{ fontSize:10, color:C.g3, marginTop:2 }}>Le {r.jour} de chaque mois</Text>
                    <View style={{ marginTop:6, backgroundColor: inactif ? '#EEEEEE' : recu ? '#E8F5E9' : '#FFF8E1', borderRadius:6, paddingVertical:3, paddingHorizontal:4 }}>
                      <Text style={{ fontSize:9, fontWeight:'600', color: inactif ? C.g3 : recu ? C.gpos : '#D4900A', textAlign:'center' }}>
                        {inactif ? 'Inactif' : recu ? '✓ Reçu ce mois' : `⏳ Prévu le ${r.jour}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <TouchableOpacity
              onPress={() => { setEditRevenu(null); setModalRevenu(true); }}
              style={{ paddingVertical:18, alignItems:'center', backgroundColor:C.g1, borderRadius:10, borderWidth:1, borderColor:C.g2, borderStyle:'dashed' }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize:13, color:C.g3, marginBottom:4 }}>Aucun revenu récurrent configuré</Text>
              <Text style={{ fontSize:12, color:C.pri, fontWeight:'600' }}>+ Configurer un salaire ou loyer reçu</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* ── KPIs 2×2 ── */}
        <View style={s.kpiRow}>
          <View style={[s.kpiCard, { borderLeftColor:C.gpos }]}>
            <Text style={s.kpiLabel}>Revenus</Text>
            <Text style={[s.kpiVal, { color:C.gpos }]}>{fmt(totalRev)}</Text>
            <TrendBadge current={totalRev} prev={prevRev} />
          </View>
          <View style={[s.kpiCard, { borderLeftColor:C.rneg }]}>
            <Text style={s.kpiLabel}>Dépenses</Text>
            <Text style={[s.kpiVal, { color:C.rneg }]}>{fmt(totalDep)}</Text>
            <TrendBadge current={totalDep} prev={prevDep} goodWhenDown />
          </View>
        </View>
        <View style={[s.kpiRow, { marginBottom:12 }]}>
          <View style={[s.kpiCard, { borderLeftColor:C_EPARGNE }]}>
            <Text style={s.kpiLabel}>Épargne</Text>
            <Text style={[s.kpiVal, { color:C_EPARGNE }]}>{fmt(totalEpargne)}</Text>
            <TrendBadge current={totalEpargne} prev={prevEpargne} />
            {tauxEparg !== null && (
              <Text style={{ fontSize:10, color:C.g3, marginTop:2 }}>
                {tauxEparg >= 20 ? '✓ ' : tauxEparg >= 10 ? '' : '⚠ '}{tauxEparg}% des revenus
              </Text>
            )}
          </View>
          <View style={[s.kpiCard, { borderLeftColor: solde >= 0 ? C.gpos : C.rneg }]}>
            <Text style={s.kpiLabel}>Solde libre</Text>
            <Text style={[s.kpiVal, { color: solde >= 0 ? C.gpos : C.rneg }]}>
              {solde >= 0 ? '+' : ''}{fmt(solde)}
            </Text>
            <Text style={{ fontSize:10, color:C.g3, marginTop:2 }}>
              Rev − Dép − Épargne
            </Text>
          </View>
        </View>

        {/* ── Structure des dépenses ── */}
        <Card style={s.card}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <SectionTitle>Structure des dépenses</SectionTitle>
            <TouchableOpacity
              onPress={() => setModalCibles(true)}
              style={s.gearBtn}
              activeOpacity={0.7}
            >
              <Text style={s.gearTxt}>⚙ Budgets</Text>
            </TouchableOpacity>
          </View>

          {segments.length > 0 ? (
            <>
              <View style={{ marginTop:4, marginBottom:20 }}>
                <DonutBudget segments={segments} total={totalDep} />
              </View>

              {segments.map((seg, i) => {
                const pct   = totalDep > 0 ? (seg.amount / totalDep * 100) : 0;
                const cible = budgetCibles[seg.id];
                const ratio = cible ? seg.amount / cible : null;
                const barCol = barColor(seg.amount, cible);

                return (
                  <View key={i} style={s.legendRow}>
                    <View style={[s.legendDot, { backgroundColor:seg.color }]} />
                    <View style={{ flex:1 }}>
                      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:5 }}>
                        <Text style={s.legendLabel}>{seg.icon} {seg.label}</Text>
                        <View style={{ alignItems:'flex-end' }}>
                          <Text style={s.legendAmt}>{fmt(seg.amount)}</Text>
                          {cible && (
                            <Text style={{ fontSize:10, color: ratio >= 1 ? C.rneg : C.g3 }}>
                              / {fmt(cible)} {ratio >= 1 ? '⚠' : ''}
                            </Text>
                          )}
                        </View>
                      </View>
                      {/* Barre = toujours % des dépenses totales (cohérence visuelle) */}
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { width:`${Math.round(pct)}%`, backgroundColor: barCol }]} />
                      </View>
                      {cible && (
                        <Text style={{ fontSize:9, color: ratio >= 1 ? C.rneg : C.g3, marginTop:3 }}>
                          {ratio !== null ? Math.round(ratio * 100) : 0}% du budget alloué
                        </Text>
                      )}
                    </View>
                    <Text style={s.legendPct}>{Math.round(pct)}%</Text>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📊</Text>
              <Text style={s.emptyTxt}>Aucune dépense ce mois</Text>
              <Text style={s.emptySub}>Appuyez sur + pour commencer</Text>
            </View>
          )}
        </Card>

        {/* ── Derniers enregistrements ── */}
        <Card style={s.card}>
          <SectionTitle>Derniers enregistrements</SectionTitle>
          {recentOps.length > 0 ? (
            recentOps.map((op, i) => {
              const isEpargne    = op.type === 'epargne';
              const display      = isEpargne
                ? getActif(op.categorie)
                : op.type === 'depense'
                  ? getCat(op.categorie)
                  : { icon:'💰', label:'Revenu', color:C.gpos };
              const d            = new Date(op.date);
              const dateStr      = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
              const isLast       = i === recentOps.length - 1;
              const montantColor = isEpargne ? C_EPARGNE : op.type === 'depense' ? C.rneg : C.gpos;
              const montantSign  = op.type === 'revenu' ? '+' : '−';
              const pillLabel    = isEpargne ? 'Épargne' : op.type === 'depense' ? 'Dépense' : 'Revenu';

              return (
                <TouchableOpacity
                  key={op.id}
                  style={[s.opRow, !isLast && s.opBorder]}
                  activeOpacity={0.55}
                  onPress={() => handleEdit(op)}
                  onLongPress={() => handleDelete(op.id)}
                  delayLongPress={600}
                >
                  <View style={[s.opIconBg, { backgroundColor:display.color+'22' }]}>
                    <Text style={s.opIconTxt}>{display.icon}</Text>
                  </View>
                  <View style={{ flex:1, marginLeft:12 }}>
                    <Text style={s.opDesc} numberOfLines={1}>
                      {op.description || display.label}
                    </Text>
                    <View style={{ flexDirection:'row', alignItems:'center', flexWrap:'wrap' }}>
                      <Text style={s.opMeta}>{display.label} · {dateStr}</Text>
                      {isEpargne && (
                        <TouchableOpacity
                          onPress={() => onNav('actifs', op.actif || op.categorie)}
                          hitSlop={{ top:6, bottom:6, left:4, right:4 }}
                          activeOpacity={0.6}
                        >
                          <Text style={[s.opMeta, { color:C_EPARGNE }]}>{' '}→ voir actif</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems:'flex-end' }}>
                    <Text style={[s.opMontant, { color:montantColor }]}>
                      {montantSign}{fmt(op.montant)}
                    </Text>
                    <View style={[s.pill, { backgroundColor:montantColor+'18' }]}>
                      <Text style={[s.pillTxt, { color:montantColor }]}>{pillLabel}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📋</Text>
              <Text style={s.emptyTxt}>Aucun enregistrement</Text>
              <Text style={s.emptySub}>Appuyez sur + · Tap pour éditer · Appui long pour supprimer</Text>
            </View>
          )}
        </Card>

      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={s.fab} onPress={openNewOp} activeOpacity={0.85}>
        <Text style={s.fabTxt}>+</Text>
      </TouchableOpacity>

      {/* ── Modals ── */}
      <ModalAjout
        visible={modalOp}
        onClose={() => { setModalOp(false); setEditingOp(null); }}
        onSubmit={handleSubmit}
        selYear={selYear}
        selMonth={selMonth}
        editingOp={editingOp}
      />
      <ModalBudgetCibles
        visible={modalCibles}
        onClose={() => setModalCibles(false)}
        onSave={setBudgetCibles}
        currentCibles={budgetCibles}
      />
      <ModalRevenu
        visible={modalRevenu}
        onClose={() => { setModalRevenu(false); setEditRevenu(null); }}
        onSave={handleSaveRevenu}
        onDelete={handleDeleteRevenu}
        editingRevenu={editRevenu}
      />
    </View>
  );
};

export default PageSuiviBudget;

// ──────────────────────────────────────────────────────────────────────────────
// STYLES
// ──────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  monthBar:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:C.white, paddingHorizontal:12, paddingVertical:11, borderBottomWidth:1, borderBottomColor:C.g1 },
  monthArrow:   { padding:10 },
  monthArrowTxt:{ fontSize:28, color:C.pri, fontWeight:'300', lineHeight:30 },
  monthCenter:  { alignItems:'center', gap:4 },
  monthTxt:     { fontSize:17, fontWeight:'700', color:C.dark },
  badge:        { backgroundColor:C.priL, borderRadius:10, paddingHorizontal:8, paddingVertical:2 },
  badgeTxt:     { fontSize:10, color:C.pri, fontWeight:'600' },
  card:         { marginBottom:12 },
  kpiRow:       { flexDirection:'row', gap:8, marginBottom:8 },
  kpiCard:      { flex:1, backgroundColor:C.white, borderRadius:12, padding:12, borderLeftWidth:3 },
  kpiLabel:     { fontSize:10, color:C.g3, marginBottom:4, fontWeight:'500' },
  kpiVal:       { fontSize:14, fontWeight:'800', letterSpacing:-0.3 },
  gearBtn:      { flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:5, borderRadius:20, backgroundColor:C.priL },
  gearTxt:      { fontSize:12, color:C.pri, fontWeight:'600' },
  legendRow:    { flexDirection:'row', alignItems:'flex-start', gap:10, paddingVertical:10, borderTopWidth:1, borderTopColor:C.g1 },
  legendDot:    { width:10, height:10, borderRadius:3, marginTop:3 },
  legendLabel:  { fontSize:13, color:C.dark, fontWeight:'500' },
  legendAmt:    { fontSize:12, color:C.dark, fontWeight:'700' },
  legendPct:    { fontSize:13, fontWeight:'700', color:C.g3, minWidth:32, textAlign:'right', marginTop:3 },
  barTrack:     { height:5, backgroundColor:C.g1, borderRadius:3 },
  barFill:      { height:5, borderRadius:3 },
  empty:        { alignItems:'center', paddingVertical:36 },
  emptyIcon:    { fontSize:38, marginBottom:10 },
  emptyTxt:     { fontSize:15, fontWeight:'600', color:C.dark, marginBottom:4 },
  emptySub:     { fontSize:12, color:C.g3, textAlign:'center', paddingHorizontal:24 },
  opRow:        { flexDirection:'row', alignItems:'center', paddingVertical:12 },
  opBorder:     { borderBottomWidth:1, borderBottomColor:C.g1 },
  opIconBg:     { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center' },
  opIconTxt:    { fontSize:19 },
  opDesc:       { fontSize:14, fontWeight:'600', color:C.dark },
  opMeta:       { fontSize:11, color:C.g3, marginTop:2 },
  opMontant:    { fontSize:14, fontWeight:'800', letterSpacing:-0.3 },
  pill:         { borderRadius:6, paddingHorizontal:6, paddingVertical:2, marginTop:3 },
  pillTxt:      { fontSize:9, fontWeight:'700' },
  fab:          { position:'absolute', bottom:86, right:20, width:56, height:56, borderRadius:28, backgroundColor:C.pri, alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.22, shadowRadius:10, elevation:8 },
  fabTxt:       { fontSize:30, color:C.white, lineHeight:34, fontWeight:'300' },
});

const ms = StyleSheet.create({
  overlay:      { flex:1, backgroundColor:'rgba(0,0,0,0.38)' },
  sheet:        { backgroundColor:C.white, borderTopLeftRadius:24, borderTopRightRadius:24, paddingHorizontal:20, paddingTop:14, paddingBottom:40 },
  sheetScroll:  { backgroundColor:C.white, borderTopLeftRadius:24, borderTopRightRadius:24, paddingHorizontal:20, paddingTop:14, maxHeight:'90%' },
  handle:       { width:40, height:4, borderRadius:2, backgroundColor:C.g2, alignSelf:'center', marginBottom:18 },
  title:        { fontSize:20, fontWeight:'800', color:C.dark, marginBottom:20 },
  typeRow:      { flexDirection:'row', gap:10, marginBottom:18 },
  typeBtn:      { flex:1, paddingVertical:12, borderRadius:12, borderWidth:1.5, borderColor:C.g2, alignItems:'center', backgroundColor:C.g1 },
  typeTxt:      { fontSize:14, fontWeight:'600', color:C.dark },
  catGrid:      { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:18 },
  catChip:      { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:8, borderRadius:20, borderWidth:1.5, borderColor:C.g2, backgroundColor:C.g1 },
  catTxt:       { fontSize:12, fontWeight:'500', color:C.dark },
  input:        { backgroundColor:C.g1, borderRadius:12, padding:14, fontSize:15, color:C.dark, borderWidth:1, borderColor:C.g2 },
  // Actif detail fields
  detailBox:    { backgroundColor:C.g1, borderRadius:14, padding:14, marginBottom:14, borderWidth:1, borderColor:C.g2 },
  detailHeader: { fontSize:11, fontWeight:'700', color:C.g3, letterSpacing:0.6, marginBottom:10 },
  fieldLabel:   { fontSize:11, color:C.g3, marginBottom:4, fontWeight:'500' },
  autoCalcHint: { fontSize:11, color:C.gpos, marginTop:-2, marginBottom:8, fontWeight:'600' },
});

const bc = StyleSheet.create({
  row:      { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.g1 },
  iconBg:   { width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center' },
  label:    { flex:1, fontSize:14, fontWeight:'500', color:C.dark },
  inputWrap:{ flexDirection:'row', alignItems:'center', gap:6 },
  input:    { width:90, backgroundColor:C.g1, borderRadius:10, paddingHorizontal:10, paddingVertical:8, fontSize:14, color:C.dark, textAlign:'right', borderWidth:1, borderColor:C.g2 },
  dh:       { fontSize:13, color:C.g3, fontWeight:'500' },
});
