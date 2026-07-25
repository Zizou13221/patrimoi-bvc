import React, { useState, useMemo, useEffect } from 'react';
import { usePatrimoineStore } from '../store/patrimoineStore';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { C } from '../constants/colors';
import {
  calcLiquide, calcBanque, calcCarnet, calcPEA, calcPEACout,
  calcCT, calcCTCout, calcOr, calcImmo, calcTransport,
  valImmo, valTransport, valOr,
} from '../utils/calc';
import { fmt, fmtN, pctDiff } from '../utils/fmt';
import { getBvcCache, fetchPrixOr, fetchDevises } from '../utils/api';
import {
  Card, BtnPri, BtnSec, PLBadge, IconBox,
  SectionTitle, InfoRow, MethodSelector, Input, SelectInput, TopBar, BarH, SparklineInteractive,
} from '../components/shared';

// ─── Helpers ────────────────────────────────────────────────
const isNum = (v) => String(v).trim() !== '' && !isNaN(parseFloat(v));

// Calcule le nombre de mois depuis une date "JJ/MM/AAAA"
const detentionMois = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const dt = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  if (isNaN(dt.getTime())) return null;
  return Math.floor((Date.now() - dt) / (1000 * 60 * 60 * 24 * 30.44));
};

// Auto-remplit le cours depuis le cache BVC pour un ticker donné
const coursFromCache = (tickerVal) => {
  if (!tickerVal || tickerVal === 'Selectionner...') return null;
  const [tck] = tickerVal.split(' - ');
  const bvc = getBvcCache();
  return bvc?.data?.cours?.[tck]?.cours ?? null;
};

// Dépréciation auto des véhicules
const TAUX_DEP = { Voiture: 0.15, Moto: 0.12, Camion: 0.10, Autre: 0.10 };
const valeurDepreciee = (pa, annee, type) => {
  const age = Math.max(0, new Date().getFullYear() - Number(annee));
  const taux = TAUX_DEP[type] || 0.15;
  return Math.round(pa * Math.pow(1 - taux, age));
};

// ─── Liste BVC — ordre alphabétique par nom de société ───────────────────────
// Source : bvc_batch.py (ISINs vérifiés) + casablanca-bourse.com (noms officiels)
const BVC_LIST = [
  'ADH - Addoha',
  'AFM - AFMA',
  'AFI - Afric Industries',
  'AFG - Afriquia Gaz',
  'AGM - AGMA Lahlou-Tazi',
  'AKT - Akdital',
  'ALM - Alliances',
  'ADI - Alliances Développement Immobilier',
  'ARD - Aradei Capital',
  'ATL - Atlantasanad',
  'ATW - Attijariwafa Bank',
  'ATH - Auto Hall',
  'NEJ - Auto Nejma',
  'BAL - Balima',
  'BOA - Bank of Africa',
  'BCP - Banque Centrale Populaire',
  'BMCI - BMCI',
  'SBM - Brasseries du Maroc',
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
  'REB - Rebab Company',
  'RIS - RISMA',
  'RDS - Résidences Dar Saada',
  'S2M - S2M',
  'SLF - Salafin',
  'SAM - Samir',
  'SAHM - Sanlam Maroc',
  'GTM - SGTM',
  'SMI - SMI',
  'SNP - SNEP',
  'SID - Sonasid',
  'SOT - Sothema',
  'SRM - Stokvis Maroc',
  'SNA - Stokvis Nord Afrique',
  'STR - Stroc Industrie',
  'T2S - T2S Group Holding',
  'TQM - TAQA Morocco',
  'TGC - TGCC',
  'TMA - TotalEnergies Marketing Maroc',
  'UMR - Unimer',
  'VCN - Vicenne',
  'WAA - Wafa Assurance',
  'ZDJ - Zellidja',
];

// ─── Boutons Modifier / Supprimer / Détails ─────────────────
function ActionBtns({ onEdit, onDelete, onDetail }) {
  return (
    <View style={{ flexDirection:'row', gap:8, marginTop:10, justifyContent:'flex-end' }}>
      {onDetail && (
        <TouchableOpacity onPress={onDetail}
          style={{ paddingHorizontal:12, paddingVertical:5, borderRadius:7, backgroundColor:'#EEF0FF' }}>
          <Text style={{ fontSize:11, color:'#4040C0', fontWeight:'600' }}>◎ Détails</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onEdit}
        style={{ paddingHorizontal:12, paddingVertical:5, borderRadius:7, backgroundColor:C.priL }}>
        <Text style={{ fontSize:11, color:C.pri, fontWeight:'600' }}>✏ Modifier</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete}
        style={{ paddingHorizontal:12, paddingVertical:5, borderRadius:7, backgroundColor:'#FFF0F0' }}>
        <Text style={{ fontSize:11, color:C.sec, fontWeight:'600' }}>✕ Supprimer</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Options devises (AN_008) ───────────────────────────────
const DEVISE_OPTIONS = [
  { value:'EUR', label:'EUR — Euro' },
  { value:'USD', label:'USD — Dollar US' },
  { value:'GBP', label:'GBP — Livre Sterling' },
  { value:'CHF', label:'CHF — Franc Suisse' },
  { value:'CAD', label:'CAD — Dollar Canadien' },
  { value:'AED', label:'AED — Dirham EAU' },
  { value:'SAR', label:'SAR — Riyal Saoudien' },
  { value:'QAR', label:'QAR — Riyal Qatari' },
  { value:'KWD', label:'KWD — Dinar Koweitien' },
  { value:'TND', label:'TND — Dinar Tunisien' },
  { value:'DZD', label:'DZD — Dinar Algerien' },
  { value:'EGP', label:'EGP — Livre Egyptienne' },
  { value:'TRY', label:'TRY — Livre Turque' },
  { value:'JPY', label:'JPY — Yen Japonais' },
  { value:'CNY', label:'CNY — Yuan Chinois' },
  { value:'AUD', label:'AUD — Dollar Australien' },
  { value:'SEK', label:'SEK — Couronne Suedoise' },
  { value:'NOK', label:'NOK — Couronne Norvegienne' },
];
const DEVISE_NOM = {
  EUR:'Euro', USD:'Dollar US', GBP:'Livre Sterling', CHF:'Franc Suisse',
  CAD:'Dollar Canadien', AED:'Dirham EAU', SAR:'Riyal Saoudien',
  QAR:'Riyal Qatari', KWD:'Dinar Koweitien', TND:'Dinar Tunisien',
  DZD:'Dinar Algerien', EGP:'Livre Egyptienne', TRY:'Livre Turque',
  JPY:'Yen Japonais', CNY:'Yuan Chinois', AUD:'Dollar Australien',
  SEK:'Couronne Suedoise', NOK:'Couronne Norvegienne',
};

// ─── SubLiquide ─────────────────────────────────────────────
function SubLiquide({ data, setData, onBack }) {
  const liq   = data.liquidites;
  const total = calcLiquide(liq);
  const [showAdd, setShowAdd]   = useState(false);
  const [editIdx, setEditIdx]   = useState(-1);
  const [dhEdit, setDhEdit]     = useState(false);
  const [dhVal,  setDhVal]      = useState('');
  const [devCode, setDevCode]   = useState('');
  const [nom,     setNom]       = useState('');
  const [qty,     setQty]       = useState('');
  const [taux,    setTaux]      = useState('');
  const [devisesUpdatedAt, setDevisesUpdatedAt] = useState(null);
  const [devisesLoading,   setDevisesLoading]   = useState(false);
  const COLS = ['#005090','#003280','#640064','#006440','#804000'];

  // ── Auto-fetch taux BAM au montage ──────────────────────────
  useEffect(() => {
    const codes = (liq.devises || []).map(d => d.code);
    if (codes.length === 0) return;
    setDevisesLoading(true);
    fetchDevises(codes).then(res => {
      setDevisesLoading(false);
      if (!res) return;
      setData(d => ({
        ...d,
        liquidites: {
          ...d.liquidites,
          devises: (d.liquidites.devises || []).map(dv => {
            const taux = res[dv.code];
            return taux ? { ...dv, taux: parseFloat(taux.toFixed(4)), variation: 0 } : dv;
          }),
        },
      }));
      setDevisesUpdatedAt(new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }));
    });
  }, []);

  function startEdit(i) {
    const dv = liq.devises[i];
    setDevCode(dv.code); setNom(dv.nom);
    setQty(String(dv.quantite)); setTaux(String(dv.taux));
    setEditIdx(i); setShowAdd(false);
  }

  function resetForm() {
    setDevCode(''); setNom(''); setQty(''); setTaux('');
    setEditIdx(-1); setShowAdd(false);
  }

  function saveDevise() {
    if (!devCode || !isNum(qty) || !isNum(taux)) return;
    const entry = {
      code: devCode.toUpperCase(),
      nom: nom || DEVISE_NOM[devCode.toUpperCase()] || devCode.toUpperCase(),
      quantite: parseFloat(qty),
      taux: parseFloat(taux),
      variation: 0,
    };
    if (editIdx >= 0) {
      // Modifier une devise existante (par index)
      setData(d => ({ ...d, liquidites:{ ...d.liquidites,
        devises: d.liquidites.devises.map((x, i) => i === editIdx ? entry : x),
      }}));
    } else {
      // Ajouter : si le code existe déjà → cumul des quantités (AN_009)
      setData(d => {
        const arr = d.liquidites.devises;
        const existIdx = arr.findIndex(x => x.code === entry.code);
        if (existIdx >= 0) {
          return { ...d, liquidites: { ...d.liquidites,
            devises: arr.map((x, i) => i === existIdx
              ? { ...x, quantite: x.quantite + entry.quantite, taux: entry.taux }
              : x
            ),
          }};
        }
        return { ...d, liquidites: { ...d.liquidites,
          devises: [...arr, entry],
        }};
      });
    }
    resetForm();
  }

  function deleteDevise(i) {
    Alert.alert('Supprimer', 'Retirer cette devise ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:() =>
        setData(d => ({ ...d, liquidites:{ ...d.liquidites,
          devises: d.liquidites.devises.filter((_, j) => j !== i),
        }}))
      },
    ]);
  }

  const showForm = showAdd || editIdx >= 0;

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Argent Liquide & Devises" subtitle="Liquidites totales" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.gpos, borderRadius:16, padding:16, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(255,255,255,0.85)', fontSize:12 }}>Total (en DH)</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:30, marginVertical:4 }}>{fmt(total)}</Text>
          <Text style={{ color:'rgba(200,255,200,0.85)', fontSize:11 }}>Mis a jour : {new Date().toLocaleDateString('fr-FR')}</Text>
        </View>

        <SectionTitle>Especes en Dirhams</SectionTitle>
        <Card>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'center' }}>
              <IconBox label="DH" bg={C.pri} size={36} fs={9}/>
              <View>
                <Text style={{ fontWeight:'600', fontSize:13 }}>Especes DH</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>Domicile / Coffre-fort</Text>
              </View>
            </View>
            {dhEdit ? (
              <View style={{ flexDirection:'row', gap:6, alignItems:'center' }}>
                <Input value={dhVal} onChangeText={setDhVal} keyboardType="numeric"
                  style={{ width:100, marginBottom:0 }} placeholder="Montant"/>
                <BtnPri onPress={() => {
                  if (!isNum(dhVal)) return;
                  setData(d => ({ ...d, liquidites:{ ...d.liquidites, dh:parseFloat(dhVal) }}));
                  setDhEdit(false);
                }} style={{ paddingHorizontal:10, paddingVertical:5 }}>OK</BtnPri>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setDhVal(String(liq.dh)); setDhEdit(true); }}>
                <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>{fmt(liq.dh)} <Text style={{ fontSize:11, color:C.pri }}>✏</Text></Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        <SectionTitle>Devises etrangeres</SectionTitle>
        {liq.devises.map((dv, i) => (
          <Card key={i}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'flex-start' }}>
              <IconBox label={dv.code} bg={COLS[i % COLS.length]} size={38} fs={9}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'600', fontSize:13 }}>{dv.nom}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>{fmtN(dv.quantite)} {dv.code} — 1 {dv.code} = {dv.taux.toFixed(2)} DH</Text>
                <Text style={{ fontSize:10, color:C.g2, marginTop:2 }}>
                  {devisesLoading ? '⟳ Mise à jour des taux…' : devisesUpdatedAt ? `✓ BAM — mis à jour à ${devisesUpdatedAt}` : 'Source : Bank Al-Maghrib'}
                </Text>
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Text style={{ fontWeight:'700', fontSize:13 }}>{fmt(dv.quantite * dv.taux)}</Text>
                <Text style={{ fontSize:11, color:dv.variation >= 0 ? C.gpos : C.rneg }}>
                  {dv.variation >= 0 ? '+' : ''}{dv.variation.toFixed(2)}%
                </Text>
              </View>
            </View>
            <ActionBtns onEdit={() => startEdit(i)} onDelete={() => deleteDevise(i)}/>
          </Card>
        ))}

        {showForm ? (
          <Card style={{ borderWidth:1.5, borderColor:C.gpos }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>
              {editIdx >= 0 ? 'Modifier la devise' : 'Ajouter une devise'}
            </Text>
            <SelectInput
              label="Devise"
              value={devCode}
              onChange={v => { setDevCode(v); if (!nom || nom === DEVISE_NOM[devCode]) setNom(DEVISE_NOM[v] || v); }}
              options={DEVISE_OPTIONS}
            />
            <Input label="Quantite"   value={qty}  onChangeText={setQty}  placeholder="1000" keyboardType="numeric"/>
            <Input label="Cours (DH)" value={taux} onChangeText={setTaux} placeholder="10.22" keyboardType="numeric" unit="DH"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={resetForm} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={saveDevise} disabled={!devCode || !isNum(qty) || !isNum(taux)} style={{ flex:1 }}>
                {editIdx >= 0 ? 'Enregistrer' : 'Ajouter'}
              </BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)} style={{ marginTop:4 }}>+ Ajouter une devise</BtnPri>
        )}

        <View style={{ backgroundColor:C.priL, borderRadius:10, padding:12, marginTop:14, borderLeftWidth:4, borderLeftColor:C.pri }}>
          <Text style={{ fontSize:11, color:C.pri, fontStyle:'italic' }}>
            PatriMoi conseille de limiter les liquidites a 3 mois de depenses et d'investir le surplus dans un compte PEA.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── SubBanque ──────────────────────────────────────────────
function SubBanque({ data, setData, onBack }) {
  const total = calcBanque(data.banque);
  const [showAdd, setShowAdd] = useState(false);
  const [editIdx, setEditIdx] = useState(-1);
  const [banque,  setBanque]  = useState('');
  const [compte,  setCompte]  = useState('');
  const [solde,   setSolde]   = useState('');

  function startEdit(i) {
    const b = data.banque[i];
    setBanque(b.banque); setCompte(b.compte); setSolde(String(b.solde));
    setEditIdx(i); setShowAdd(false);
  }

  function resetForm() {
    setBanque(''); setCompte(''); setSolde('');
    setEditIdx(-1); setShowAdd(false);
  }

  function saveCompte() {
    if (!banque || !isNum(solde)) return;
    const entry = { banque, compte: compte || 'Compte courant', solde: parseFloat(solde) };
    if (editIdx >= 0) {
      setData(d => ({ ...d, banque: d.banque.map((x, i) => i === editIdx ? entry : x) }));
    } else {
      setData(d => ({ ...d, banque: [...d.banque, entry] }));
    }
    resetForm();
  }

  function deleteCompte(i) {
    Alert.alert('Supprimer', 'Retirer ce compte bancaire ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:() =>
        setData(d => ({ ...d, banque: d.banque.filter((_, j) => j !== i) }))
      },
    ]);
  }

  const showForm = showAdd || editIdx >= 0;

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Argent en Banque" subtitle="Comptes courants" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.navy, borderRadius:14, padding:14, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(180,190,230,0.9)', fontSize:12 }}>Solde total</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26 }}>{fmt(total)}</Text>
          <Text style={{ color:'rgba(180,190,230,0.75)', fontSize:11 }}>{data.banque.length} compte(s)</Text>
        </View>

        {data.banque.map((b, i) => (
          <Card key={i}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'center' }}>
              <IconBox label="BNQ" bg={C.navy} size={36} fs={8}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', fontSize:13 }}>{b.banque}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>{b.compte}</Text>
              </View>
              <Text style={{ fontWeight:'700', fontSize:14 }}>{fmt(b.solde)}</Text>
            </View>
            <ActionBtns onEdit={() => startEdit(i)} onDelete={() => deleteCompte(i)}/>
          </Card>
        ))}

        {showForm ? (
          <Card style={{ borderWidth:1.5, borderColor:C.navy }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>
              {editIdx >= 0 ? 'Modifier le compte' : 'Ajouter un compte'}
            </Text>
            <Input label="Banque"           value={banque}  onChangeText={setBanque}  placeholder="CIH Bank, Banque Populaire..."/>
            <Input label="Type de compte"   value={compte}  onChangeText={setCompte}  placeholder="Compte courant, Livret..."/>
            <Input label="Solde (DH)"       value={solde}   onChangeText={setSolde}   keyboardType="numeric" placeholder="50000"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={resetForm} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={saveCompte} disabled={!banque || !isNum(solde)} style={{ flex:1 }}>
                {editIdx >= 0 ? 'Enregistrer' : 'Ajouter'}
              </BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)}>+ Ajouter un compte</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

// ─── SubCarnet ──────────────────────────────────────────────
function SubCarnet({ data, setData, onBack }) {
  const total = calcCarnet(data.carnet);
  const [showAdd, setShowAdd] = useState(false);
  const [editIdx, setEditIdx] = useState(-1);
  const [banque,  setBanque]  = useState('');
  const [solde,   setSolde]   = useState('');
  const [taux,    setTaux]    = useState('3');
  const [montant, setMontant] = useState('500');
  const [freq,    setFreq]    = useState('Mensuel');

  // Projection gains + versements
  const proj = (n) => data.carnet.reduce((s, c) => {
    const r = c.taux / 100;
    const interets = c.solde * (Math.pow(1 + r, n) - 1);
    // Gains des versements périodiques
    const rm = c.taux / 1200;
    const nM = n * 12;
    const freqMult = c.rappel?.freq === 'Mensuel' ? 1 : c.rappel?.freq === 'Trimestriel' ? 3 : 12;
    const nPer = Math.floor(nM / freqMult);
    const rPer = Math.pow(1 + rm, freqMult) - 1;
    const pmt = c.rappel?.montant || 0;
    const gainsVers = rPer > 0 && nPer > 0
      ? pmt * ((Math.pow(1 + rPer, nPer) - 1) / rPer)
      : pmt * nPer;
    return s + interets + gainsVers;
  }, 0);

  function startEdit(i) {
    const c = data.carnet[i];
    setBanque(c.banque); setSolde(String(c.solde));
    setTaux(String(c.taux)); setMontant(String(c.rappel?.montant || 500));
    setFreq(c.rappel?.freq || 'Mensuel');
    setEditIdx(i); setShowAdd(false);
  }

  function resetForm() {
    setBanque(''); setSolde(''); setTaux('3'); setMontant('500'); setFreq('Mensuel');
    setEditIdx(-1); setShowAdd(false);
  }

  function saveCarnet() {
    if (!banque || !isNum(solde)) return;
    const today = new Date(); today.setFullYear(today.getFullYear() + 1);
    const prochaine = today.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
    const entry = {
      banque, solde: parseFloat(solde), taux: parseFloat(taux),
      rappel: { montant: parseFloat(montant), freq, prochaine },
    };
    if (editIdx >= 0) {
      setData(d => ({ ...d, carnet: d.carnet.map((x, i) => i === editIdx ? { ...entry, rappel:{ ...entry.rappel, prochaine: x.rappel?.prochaine || prochaine } } : x) }));
    } else {
      setData(d => ({ ...d, carnet: [...d.carnet, entry] }));
    }
    resetForm();
  }

  function deleteCarnet(i) {
    Alert.alert('Supprimer', 'Retirer ce carnet d\'epargne ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:() =>
        setData(d => ({ ...d, carnet: d.carnet.filter((_, j) => j !== i) }))
      },
    ]);
  }

  const showForm = showAdd || editIdx >= 0;

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Compte sur Carnet" subtitle="Epargne reglementee" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.teal, borderRadius:14, padding:14, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(200,240,240,0.9)', fontSize:12 }}>Solde total</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26 }}>{fmt(total)}</Text>
          <Text style={{ color:'rgba(200,240,240,0.8)', fontSize:11 }}>{data.carnet.length} carnet(s)</Text>
        </View>

        {data.carnet.map((c, i) => (
          <Card key={i}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'center', marginBottom:8 }}>
              <IconBox label="CRT" bg={C.teal} size={36} fs={8}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', fontSize:13 }}>{c.banque}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>Taux : {c.taux}% — +{fmt(c.solde * c.taux / 100)}/an</Text>
              </View>
              <Text style={{ fontWeight:'700', fontSize:14 }}>{fmt(c.solde)}</Text>
            </View>
            <View style={{ backgroundColor:C.tealL, borderRadius:8, padding:10 }}>
              <Text style={{ fontSize:11, fontWeight:'700', color:C.teal, marginBottom:3 }}>Rappel d'epargne</Text>
              <Text style={{ fontSize:11, color:C.dark }}>Investir {fmt(c.rappel?.montant || 0)} — {c.rappel?.freq || 'Mensuel'}</Text>
              <Text style={{ fontSize:10, color:C.acc, marginTop:2 }}>Prochain : {c.rappel?.prochaine || '—'}</Text>
            </View>
            <ActionBtns onEdit={() => startEdit(i)} onDelete={() => deleteCarnet(i)}/>
          </Card>
        ))}

        <Card style={{ backgroundColor:C.g1 }}>
          <Text style={{ fontWeight:'700', fontSize:12, marginBottom:10 }}>Projection (interets + versements)</Text>
          <View style={{ flexDirection:'row' }}>
            {[[1,'1 an'],[3,'3 ans'],[5,'5 ans']].map(([n, label]) => (
              <View key={n} style={{ flex:1, alignItems:'center' }}>
                <Text style={{ fontSize:11, color:C.g3 }}>{label}</Text>
                <Text style={{ fontSize:14, fontWeight:'700', color:C.gpos, marginTop:3 }}>+{fmt(proj(n))}</Text>
              </View>
            ))}
          </View>
        </Card>

        {showForm ? (
          <Card style={{ borderWidth:1.5, borderColor:C.teal }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>
              {editIdx >= 0 ? 'Modifier le carnet' : 'Ajouter un carnet'}
            </Text>
            <Input label="Banque"                value={banque}  onChangeText={setBanque}  placeholder="CIH Bank, Banque Populaire..."/>
            <Input label="Solde (DH)"            value={solde}   onChangeText={setSolde}   keyboardType="numeric" placeholder="30000"/>
            <Input label="Taux annuel (%)"       value={taux}    onChangeText={setTaux}    keyboardType="numeric" placeholder="3"/>
            <Input label="Montant rappel (DH)"   value={montant} onChangeText={setMontant} keyboardType="numeric" placeholder="500"/>
            <SelectInput label="Frequence" value={freq} options={['Mensuel','Trimestriel','Annuel']} onChange={setFreq}/>
            <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
              <BtnSec onPress={resetForm} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={saveCarnet} disabled={!banque || !isNum(solde)} style={{ flex:1, backgroundColor:C.teal }}>
                {editIdx >= 0 ? 'Enregistrer' : 'Ajouter'}
              </BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)} style={{ backgroundColor:C.teal }}>+ Nouveau carnet d'epargne</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Camembert (Donut Chart) ─────────────────────────────────
// Fonctionne en pur React Native (pas de dépendance SVG)
// RN 0.74+ supporte transformOrigin
function PieSlice({ color, startAngle, sliceAngle, size }) {
  const r = size / 2;
  if (sliceAngle <= 0) return null;
  return (
    <View style={{
      position:'absolute', width:size, height:size,
      borderRadius:r, overflow:'hidden',
      transform:[{rotate:`${startAngle}deg`}],
    }}>
      {sliceAngle <= 180 ? (
        // Demi-droite pivotée pour ne montrer que `sliceAngle` degrés
        <View style={{
          position:'absolute', top:0, left:r, width:r, height:size,
          backgroundColor:color,
          transform:[{rotate:`${sliceAngle - 180}deg`}],
          transformOrigin:'0% 50%',
        }}/>
      ) : (
        <>
          {/* Demi-droite entière (0° → 180°) */}
          <View style={{ position:'absolute', top:0, left:r, width:r, height:size, backgroundColor:color }}/>
          {/* Complément gauche (180° → sliceAngle) */}
          <View style={{
            position:'absolute', top:0, left:0, width:r, height:size,
            backgroundColor:color,
            transform:[{rotate:`${sliceAngle - 360}deg`}],
            transformOrigin:'100% 50%',
          }}/>
        </>
      )}
    </View>
  );
}

function DonutChart({ segments, size=130, thickness=28, label }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (!total || segments.length === 0) {
    return <View style={{ width:size, height:size, borderRadius:size/2, backgroundColor:'#E8EAF0' }}/>;
  }
  const r     = size / 2;
  const holeR = r - thickness;
  const GAP   = segments.length > 1 ? 2 : 0;
  let cum = 0;
  const slices = segments.map(d => {
    const sa = cum;
    const sl = (d.value / total) * (360 - GAP * segments.length);
    cum += sl + GAP;
    return { ...d, startAngle:sa, sliceAngle:sl };
  });
  return (
    <View style={{ width:size, height:size }}>
      <View style={{ position:'absolute', width:size, height:size, borderRadius:r, backgroundColor:'#E8EAF0' }}/>
      {slices.map((s, i) => (
        <PieSlice key={i} color={s.color} startAngle={s.startAngle} sliceAngle={s.sliceAngle} size={size}/>
      ))}
      <View style={{
        position:'absolute', top:r-holeR, left:r-holeR,
        width:holeR*2, height:holeR*2, borderRadius:holeR,
        backgroundColor:C.white, alignItems:'center', justifyContent:'center', padding:4,
      }}>
        {label ? <Text style={{ fontSize:10, fontWeight:'700', color:C.dark, textAlign:'center' }}>{label}</Text> : null}
      </View>
    </View>
  );
}

// Palette contrastée pour les camemberts (identique PEA et CT)
const CHART_COLORS = ['#2563EB','#DC2626','#D97706','#059669','#7C3AED','#DB2777','#0891B2','#65A30D'];

const PEA_COLORS = [C.priD,'#006A50',C.pri,C.gpos,C.teal,'#4A8050'];

// ─── SubPEA ─────────────────────────────────────────────────
function SubPEA({ data, setData, onBack }) {
  const pea   = data.pea;
  const total = calcPEA(pea);
  const cout  = calcPEACout(pea);
  const [showAdd,       setShowAdd]       = useState(false);
  const [editIdx,       setEditIdx]       = useState(-1);
  const [ticker,        setTicker]        = useState('');
  const [pru,           setPru]           = useState('');
  const [qty,           setQty]           = useState('');
  const [cours,         setCours]         = useState('');
  const [dateAchat,     setDateAchat]     = useState('');
  const [detailIdx,     setDetailIdx]     = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Segments pour les camemberts (couleurs contrastées communes)
  const costSegs = useMemo(() =>
    pea.map((t, i) => ({ value: t.pru * t.qty, color: CHART_COLORS[i % CHART_COLORS.length] })),
  [pea]);
  const valSegs = useMemo(() =>
    pea.map((t, i) => ({ value: t.cours * t.qty, color: CHART_COLORS[i % CHART_COLORS.length] })),
  [pea]);

  // Données évolution depuis le premier achat
  const evo = useMemo(() => {
    if (!pea.length) return { values:[], labels:[] };
    const parseDMY = (s) => { const [d,m,y] = s.split('/'); return +new Date(+y,+m-1,+d); };
    const sorted = [...pea].filter(t => t.dateAchat).sort((a,b) => parseDMY(a.dateAchat) - parseDMY(b.dateAchat));
    if (!sorted.length) return { values:[Math.round(cout), Math.round(total)], labels:['Achat','Aujourd\'hui'] };
    const values = [], labels = [];
    let run = 0;
    sorted.forEach(t => { run += t.pru * t.qty; values.push(Math.round(run)); labels.push(t.dateAchat); });
    values.push(Math.round(total)); labels.push('Aujourd\'hui');
    return { values, labels };
  }, [pea, cout, total]);

  function handleTickerPEA(val) {
    setTicker(val);
    const c = coursFromCache(val);
    if (c) setCours(String(c));
  }

  function startEdit(i) {
    const t = pea[i];
    setTicker(t.ticker + (t.nom ? ' - ' + t.nom : ''));
    setPru(String(t.pru)); setQty(String(t.qty)); setCours(String(t.cours));
    setDateAchat(t.dateAchat || '');
    setEditIdx(i); setShowAdd(false);
  }

  function resetForm() {
    setTicker(''); setPru(''); setQty(''); setCours(''); setDateAchat('');
    setEditIdx(-1); setShowAdd(false);
  }

  function saveTitre() {
    const tickerVal = ticker === 'Selectionner...' ? '' : ticker;
    if (!tickerVal || !isNum(pru) || !isNum(qty) || !isNum(cours)) return;
    const [tck, ...rest] = tickerVal.split(' - ');
    const newQty = parseInt(qty, 10);
    const newPru = parseFloat(pru);
    const newCours = parseFloat(cours);
    if (editIdx >= 0) {
      // Mode édition — remplacement direct
      setData(d => ({ ...d, pea: d.pea.map((x, i) => i === editIdx
        ? { ticker:tck, nom:rest.join(' '), pru:newPru, cours:newCours, qty:newQty, dateAchat: dateAchat || null }
        : x) }));
    } else {
      setData(d => {
        const existIdx = d.pea.findIndex(x => x.ticker === tck);
        if (existIdx >= 0) {
          // Fusion — PRU pondéré
          const ex = d.pea[existIdx];
          const totalQty = ex.qty + newQty;
          const pruPond  = Math.round((ex.qty * ex.pru + newQty * newPru) / totalQty * 100) / 100;
          return { ...d, pea: d.pea.map((x, i) => i === existIdx
            ? { ...x, qty: totalQty, pru: pruPond, cours: newCours, dateAchat: dateAchat || x.dateAchat }
            : x) };
        }
        return { ...d, pea: [...d.pea, { ticker:tck, nom:rest.join(' '), pru:newPru, cours:newCours, qty:newQty, dateAchat: dateAchat || null }] };
      });
    }
    resetForm();
  }

  function deleteTitre(i) {
    Alert.alert('Supprimer', 'Retirer ce titre du PEA ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:() =>
        setData(d => ({ ...d, pea: d.pea.filter((_, j) => j !== i) }))
      },
    ]);
  }

  const tickerValid = ticker && ticker !== 'Selectionner...';
  const showForm = showAdd || editIdx >= 0;

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Compte PEA" subtitle="Bourse de Casablanca" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.pri, borderRadius:16, padding:16, marginBottom:12 }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Valeur du portefeuille</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26, marginVertical:4 }}>{fmt(total)}</Text>
          <View style={{ backgroundColor:C.priD, borderRadius:8, paddingHorizontal:10, paddingVertical:5, alignSelf:'flex-start' }}>
            <Text style={{ color:'#6EE7A0', fontSize:12, fontWeight:'600' }}>
              P&L : {cout > 0 ? (total >= cout ? '+' : '') + fmt(total - cout) + ' (' + pctDiff(total, cout).toFixed(1) + '%)' : 'N/A'}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor:C.accL, borderRadius:10, padding:12, borderLeftWidth:4, borderLeftColor:C.acc, marginBottom:12 }}>
          <Text style={{ fontWeight:'700', fontSize:12, color:C.goldD }}>Avantages du Compte PEA au Maroc</Text>
          <Text style={{ fontSize:11, color:C.goldD, marginTop:4 }}>Exoneration totale d'impot apres 5 ans — Plafond : 600 000 DH — Titres BVC uniquement</Text>
        </View>

        {/* ── Toggle analytiques ── */}
        <TouchableOpacity
          onPress={() => setShowAnalytics(a => !a)}
          style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8, paddingHorizontal:2 }}
          activeOpacity={0.7}
        >
          <Text style={{ fontWeight:'700', fontSize:12, color:C.dark }}>📊 Analytiques</Text>
          <Text style={{ color:C.pri, fontSize:12 }}>{showAnalytics ? '▲ Réduire' : '▼ Afficher'}</Text>
        </TouchableOpacity>

        {showAnalytics && pea.length > 0 && (
          <Card style={{ marginBottom:12 }}>
            {/* Camemberts */}
            <Text style={{ fontWeight:'700', fontSize:11, color:C.dark, marginBottom:10 }}>Répartition du portefeuille</Text>
            <View style={{ flexDirection:'row', justifyContent:'space-around', marginBottom:10 }}>
              <View style={{ alignItems:'center', gap:6 }}>
                <DonutChart segments={costSegs} size={112} thickness={26} label={'Investi\n' + fmt(cout)}/>
                <Text style={{ fontSize:10, color:C.g3, fontWeight:'600' }}>Investissement initial</Text>
              </View>
              <View style={{ alignItems:'center', gap:6 }}>
                <DonutChart segments={valSegs} size={112} thickness={26} label={'Actuel\n' + fmt(total)}/>
                <Text style={{ fontSize:10, color:C.g3, fontWeight:'600' }}>Valeur de marché</Text>
              </View>
            </View>
            {/* Légende avec % initial ET % actuel */}
            <View style={{ paddingTop:8, borderTopWidth:1, borderTopColor:C.g1, marginBottom:12 }}>
              <View style={{ flexDirection:'row', paddingBottom:4 }}>
                <Text style={{ flex:2, fontSize:9, color:C.g3, fontWeight:'700' }}>TITRE</Text>
                <Text style={{ flex:1, fontSize:9, color:C.g3, fontWeight:'700', textAlign:'right' }}>INVESTI</Text>
                <Text style={{ flex:1, fontSize:9, color:C.dark, fontWeight:'700', textAlign:'right' }}>ACTUEL</Text>
              </View>
              {pea.map((t, i) => {
                const cPct = cout  > 0 ? (t.pru   * t.qty / cout  * 100).toFixed(1) : '—';
                const vPct = total > 0 ? (t.cours  * t.qty / total * 100).toFixed(1) : '—';
                return (
                  <View key={i} style={{ flexDirection:'row', alignItems:'center', paddingVertical:3 }}>
                    <View style={{ flex:2, flexDirection:'row', alignItems:'center', gap:6 }}>
                      <View style={{ width:10, height:10, borderRadius:3, backgroundColor:CHART_COLORS[i % CHART_COLORS.length] }}/>
                      <Text style={{ fontSize:11, color:C.dark, fontWeight:'600' }}>{t.ticker}</Text>
                    </View>
                    <Text style={{ flex:1, fontSize:11, color:C.g3, textAlign:'right' }}>{cPct}%</Text>
                    <Text style={{ flex:1, fontSize:11, color:C.dark, fontWeight:'700', textAlign:'right' }}>{vPct}%</Text>
                  </View>
                );
              })}
            </View>
            {/* Graphe évolution */}
            {evo.values.length >= 2 && (
              <>
                <Text style={{ fontWeight:'700', fontSize:11, color:C.dark, marginBottom:8 }}>Évolution depuis le 1er achat</Text>
                <View style={{ backgroundColor:C.priD, borderRadius:10, padding:12 }}>
                  <SparklineInteractive data={evo.values} dates={evo.labels} color={C.gpos}/>
                </View>
              </>
            )}
          </Card>
        )}

        <Card style={{ padding:0, overflow:'hidden' }}>
          {/* En-tête tableau PEA */}
          <View style={{ backgroundColor:C.pri, paddingHorizontal:14, paddingVertical:8, flexDirection:'row', justifyContent:'space-between' }}>
            <Text style={{ fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.85)' }}>TITRE</Text>
            <View style={{ flexDirection:'row', gap:16 }}>
              <Text style={{ fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.85)' }}>VALEUR</Text>
              <Text style={{ fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.85)' }}>P&L</Text>
            </View>
          </View>
          {pea.length === 0 && (
            <View style={{ padding:24, alignItems:'center' }}>
              <Text style={{ color:C.g3, fontSize:13 }}>Aucun titre dans le PEA</Text>
            </View>
          )}
          {pea.map((t, i) => {
            const val   = t.cours * t.qty;
            const base  = t.pru   * t.qty;
            const diff  = val - base;
            const pct   = pctDiff(val, base);
            const pos   = diff >= 0;
            const poids = total > 0 ? val / total * 100 : 0;
            const mois  = t.dateAchat ? detentionMois(t.dateAchat) : null;
            return (
              <View key={i} style={{ borderBottomWidth:1, borderBottomColor:C.g1, borderLeftWidth:3, borderLeftColor: pos ? C.gpos : C.rneg }}>
                {/* Ligne principale */}
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', paddingHorizontal:12, paddingTop:10, paddingBottom:4 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8, flex:1 }}>
                    <IconBox label={t.ticker} bg={PEA_COLORS[i % PEA_COLORS.length]} size={32} fs={8}/>
                    <View style={{ flex:1 }}>
                      <Text style={{ fontSize:12, fontWeight:'700', color:C.dark }}>{t.ticker}</Text>
                      {t.nom ? <Text style={{ fontSize:10, color:C.g3, marginTop:1 }} numberOfLines={1}>{t.nom}</Text> : null}
                    </View>
                  </View>
                  <View style={{ alignItems:'flex-end', minWidth:110 }}>
                    <Text style={{ fontSize:13, fontWeight:'700', color:C.dark }}>{fmt(val)}</Text>
                    <Text style={{ fontSize:11, fontWeight:'600', color: pos ? C.gpos : C.rneg }}>
                      {pos?'+':''}{fmt(diff)}  ({pos?'+':''}{pct.toFixed(1)}%)
                    </Text>
                  </View>
                </View>
                {/* Ligne détails */}
                <View style={{ paddingHorizontal:12, paddingBottom:6 }}>
                  <Text style={{ fontSize:10, color:C.g3 }}>
                    {t.qty} titres · PRU {t.pru.toFixed(2)} · Cours {t.cours.toFixed(2)}
                    {mois !== null ? `  ·  ${mois} mois${mois >= 60 ? ' ✓ Exo.' : ''}` : ''}
                  </Text>
                </View>
                {/* Barre de poids */}
                <View style={{ paddingHorizontal:12, paddingBottom:8, flexDirection:'row', alignItems:'center', gap:8 }}>
                  <View style={{ flex:1, height:4, backgroundColor:C.g1, borderRadius:2, overflow:'hidden' }}>
                    <View style={{ width:`${Math.min(poids,100)}%`, height:'100%', backgroundColor:PEA_COLORS[i % PEA_COLORS.length], borderRadius:2 }}/>
                  </View>
                  <Text style={{ fontSize:9, color:C.g3, minWidth:34, textAlign:'right' }}>{poids.toFixed(1)}%</Text>
                </View>
                <ActionBtns
                  onEdit={() => startEdit(i)}
                  onDelete={() => deleteTitre(i)}
                  onDetail={() => setDetailIdx(detailIdx === i ? null : i)}
                />
                {/* Panel de détails */}
                {detailIdx === i && (() => {
                  const valPos  = t.cours * t.qty;
                  const coutPos = t.pru   * t.qty;
                  const diffPos = valPos - coutPos;
                  const pctPos  = pctDiff(valPos, coutPos);
                  const mois    = t.dateAchat ? detentionMois(t.dateAchat) : null;
                  const exo     = mois !== null && mois >= 60;
                  return (
                    <View style={{ backgroundColor:'#F0F4FF', borderTopWidth:1, borderTopColor:'#D0D8FF', padding:12, gap:5 }}>
                      <Text style={{ fontWeight:'700', fontSize:12, color:'#2020A0', marginBottom:4 }}>
                        {t.nom || t.ticker} — Détails de la position
                      </Text>
                      <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                        <Text style={{ fontSize:11, color:C.g3 }}>Quantité</Text>
                        <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{t.qty} titres</Text>
                      </View>
                      <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                        <Text style={{ fontSize:11, color:C.g3 }}>PRU (coût moy. pondéré)</Text>
                        <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{t.pru.toFixed(2)} DH</Text>
                      </View>
                      <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                        <Text style={{ fontSize:11, color:C.g3 }}>Cours actuel</Text>
                        <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{t.cours.toFixed(2)} DH</Text>
                      </View>
                      <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                        <Text style={{ fontSize:11, color:C.g3 }}>Coût de revient</Text>
                        <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{fmt(coutPos)}</Text>
                      </View>
                      <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                        <Text style={{ fontSize:11, color:C.g3 }}>Valeur de marché</Text>
                        <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{fmt(valPos)}</Text>
                      </View>
                      <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                        <Text style={{ fontSize:11, color:C.g3 }}>Plus-value latente</Text>
                        <Text style={{ fontSize:12, fontWeight:'700', color: diffPos >= 0 ? C.gpos : C.rneg }}>
                          {diffPos >= 0?'+':''}{fmt(diffPos)}  ({diffPos >= 0?'+':''}{pctPos.toFixed(2)}%)
                        </Text>
                      </View>
                      {t.dateAchat && (
                        <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                          <Text style={{ fontSize:11, color:C.g3 }}>1re acquisition</Text>
                          <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{t.dateAchat} · {mois} mois</Text>
                        </View>
                      )}
                      <View style={{ marginTop:4, backgroundColor:'#FFF3CD', borderRadius:6, padding:7 }}>
                        <Text style={{ fontSize:10, fontWeight:'700', color:'#7A5800' }}>
                          ℹ Fiscalité PEA — Exonération totale après 5 ans de détention (60 mois)
                        </Text>
                      </View>
                    </View>
                  );
                })()}
                <View style={{ height:4 }}/>
              </View>
            );
          })}
        </Card>
        {showForm ? (
          <Card style={{ borderWidth:1.5, borderColor:C.pri, marginTop:8 }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:12 }}>
              {editIdx >= 0 ? 'Modifier le titre' : 'Ajouter un titre BVC'}
            </Text>
            <SelectInput label="Action cotee BVC" value={ticker} onChange={handleTickerPEA} options={['Selectionner...'].concat(BVC_LIST)}/>
            <Input label="Prix d'achat unitaire (DH)" value={pru}   onChangeText={setPru}   keyboardType="numeric" placeholder="124.50"/>
            <Input label="Cours actuel (DH)" value={cours} keyboardType="numeric" placeholder="—" editable={false}/>
            <Input label="Quantite (actions)"         value={qty}   onChangeText={setQty}   keyboardType="numeric" placeholder="80"/>
            <Input label="Date d'achat (optionnel)" value={dateAchat} onChangeText={setDateAchat} placeholder="JJ/MM/AAAA"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={resetForm} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={saveTitre} disabled={!tickerValid || !isNum(pru) || !isNum(qty) || !isNum(cours)} style={{ flex:1 }}>
                {editIdx >= 0 ? 'Enregistrer' : 'Ajouter'}
              </BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)} style={{ marginTop:8 }}>+ Ajouter un actif financier</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

// ─── SubCT ──────────────────────────────────────────────────
function SubCT({ data, setData, onBack }) {
  const ct    = data.ct;
  const total = calcCT(ct);
  const cout  = calcCTCout(ct);
  const [tab, setTab] = useState('actions');
  const CT_COLORS  = [C.navy,'#2850B0','#3060C0','#1A3A90','#4070D0','#6090E0'];
  const OPC_COLORS = [C.pri, C.teal, C.gpos];

  const [showAdd,       setShowAdd]       = useState(false);
  const [editIdx,       setEditIdx]       = useState(-1);
  const [detailIdx,     setDetailIdx]     = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Segments pour les camemberts CT (même palette contrastée)
  const costSegs = useMemo(() =>
    ct.actions.map((t, i) => ({ value: t.pru * t.qty, color: CHART_COLORS[i % CHART_COLORS.length] })),
  [ct.actions]);
  const valSegs = useMemo(() =>
    ct.actions.map((t, i) => ({ value: t.cours * t.qty, color: CHART_COLORS[i % CHART_COLORS.length] })),
  [ct.actions]);

  // Évolution CT
  const evo = useMemo(() => {
    const actions = ct.actions;
    if (!actions.length) return { values:[], labels:[] };
    const parseDMY = (s) => { const [d,m,y] = s.split('/'); return +new Date(+y,+m-1,+d); };
    const sorted = [...actions].filter(t => t.dateAchat).sort((a,b) => parseDMY(a.dateAchat) - parseDMY(b.dateAchat));
    const coutTotal = actions.reduce((s,t) => s + t.pru*t.qty, 0);
    const valTotal  = actions.reduce((s,t) => s + t.cours*t.qty, 0);
    if (!sorted.length) return { values:[Math.round(coutTotal), Math.round(valTotal)], labels:['Achat','Aujourd\'hui'] };
    const values = [], labels = [];
    let run = 0;
    sorted.forEach(t => { run += t.pru * t.qty; values.push(Math.round(run)); labels.push(t.dateAchat); });
    values.push(Math.round(valTotal)); labels.push('Aujourd\'hui');
    return { values, labels };
  }, [ct.actions]);

  // Actions
  const [ticker,    setTicker]    = useState('');
  const [pru,       setPru]       = useState('');
  const [qty,       setQty]       = useState('');
  const [cours,     setCours]     = useState('');
  const [dateAchat, setDateAchat] = useState('');
  // OPCVM
  const [oNom,   setONom]   = useState('');
  const [oVl,    setOVl]    = useState('');
  const [oParts, setOParts] = useState('');
  const [oType,  setOType]  = useState('Actions');

  function handleTickerCT(val) {
    setTicker(val);
    const c = coursFromCache(val);
    if (c) setCours(String(c));
  }

  function startEditAction(i) {
    const t = ct.actions[i];
    setTicker(t.ticker + (t.nom ? ' - ' + t.nom : ''));
    setPru(String(t.pru)); setQty(String(t.qty)); setCours(String(t.cours));
    setDateAchat(t.dateAchat || '');
    setEditIdx(i); setShowAdd(false);
  }

  function startEditOpcvm(i) {
    const o = ct.opcvm[i];
    setONom(o.nom); setOVl(String(o.vl)); setOParts(String(o.parts)); setOType(o.type || 'Actions');
    setEditIdx(i); setShowAdd(false);
  }

  function resetForm() {
    setTicker(''); setPru(''); setQty(''); setCours(''); setDateAchat('');
    setONom(''); setOVl(''); setOParts(''); setOType('Actions');
    setEditIdx(-1); setShowAdd(false);
  }

  function saveAction() {
    const tickerVal = ticker === 'Selectionner...' ? '' : ticker;
    if (!tickerVal || !isNum(pru) || !isNum(qty) || !isNum(cours)) return;
    const [tck, ...rest] = tickerVal.split(' - ');
    const newQty  = parseInt(qty, 10);
    const newPru  = parseFloat(pru);
    const newCours = parseFloat(cours);
    if (editIdx >= 0) {
      // Mode édition — remplacement direct
      setData(d => ({ ...d, ct:{ ...d.ct, actions: d.ct.actions.map((x, i) => i === editIdx
        ? { ticker:tck, nom:rest.join(' ') || tck, pru:newPru, cours:newCours, qty:newQty, dateAchat: dateAchat || null }
        : x) }}));
    } else {
      setData(d => {
        const existIdx = d.ct.actions.findIndex(x => x.ticker === tck);
        if (existIdx >= 0) {
          // Fusion — PRU pondéré
          const ex = d.ct.actions[existIdx];
          const totalQty = ex.qty + newQty;
          const pruPond  = Math.round((ex.qty * ex.pru + newQty * newPru) / totalQty * 100) / 100;
          return { ...d, ct: { ...d.ct, actions: d.ct.actions.map((x, i) => i === existIdx
            ? { ...x, qty: totalQty, pru: pruPond, cours: newCours, dateAchat: dateAchat || x.dateAchat }
            : x) }};
        }
        return { ...d, ct: { ...d.ct, actions: [...d.ct.actions,
          { ticker:tck, nom:rest.join(' ') || tck, pru:newPru, cours:newCours, qty:newQty, dateAchat: dateAchat || null }
        ]}};
      });
    }
    resetForm();
  }

  function saveOpcvm() {
    if (!oNom || !isNum(oVl) || !isNum(oParts)) return;
    const entry = { code:'OPC' + (ct.opcvm.length + 1), nom:oNom, vl:parseFloat(oVl), parts:parseFloat(oParts), type:oType, vl_achat:parseFloat(oVl) };
    if (editIdx >= 0) {
      setData(d => ({ ...d, ct:{ ...d.ct, opcvm: d.ct.opcvm.map((x, i) => i === editIdx ? { ...x, nom:oNom, vl:parseFloat(oVl), parts:parseFloat(oParts), type:oType } : x) }}));
    } else {
      setData(d => ({ ...d, ct:{ ...d.ct, opcvm: [...d.ct.opcvm, entry] }}));
    }
    resetForm();
  }

  function deleteAction(i) {
    Alert.alert('Supprimer', 'Retirer cette action du compte-titre ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:() =>
        setData(d => ({ ...d, ct:{ ...d.ct, actions: d.ct.actions.filter((_, j) => j !== i) }}))
      },
    ]);
  }

  function deleteOpcvm(i) {
    Alert.alert('Supprimer', 'Retirer cet OPCVM ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:() =>
        setData(d => ({ ...d, ct:{ ...d.ct, opcvm: d.ct.opcvm.filter((_, j) => j !== i) }}))
      },
    ]);
  }

  const tickerValid = ticker && ticker !== 'Selectionner...';
  const showForm = showAdd || editIdx >= 0;

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Compte Titres" subtitle="Portefeuille boursier" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.navy, borderRadius:16, padding:16, marginBottom:12 }}>
          <Text style={{ color:'rgba(180,190,230,0.9)', fontSize:12 }}>Valeur du portefeuille</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:24, marginVertical:4 }}>{fmt(total)}</Text>
          <View style={{ backgroundColor:'rgba(20,40,110,0.8)', borderRadius:8, paddingHorizontal:10, paddingVertical:5, alignSelf:'flex-start' }}>
            <Text style={{ color:'#90B8FF', fontSize:12, fontWeight:'600' }}>
              P&L : {cout > 0 ? (total >= cout ? '+' : '') + fmt(total - cout) + ' (' + pctDiff(total, cout).toFixed(1) + '%)' : 'N/A'}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor:'#FEE8E8', borderRadius:10, padding:10, borderLeftWidth:4, borderLeftColor:C.sec, marginBottom:12 }}>
          <Text style={{ fontSize:12, fontWeight:'700', color:C.sec }}>Compte fiscalise</Text>
          <Text style={{ fontSize:11, color:'#800020', marginTop:3 }}>Les plus-values sont soumises a l'IR marocain. Pas d'exoneration fiscale contrairement au PEA apres 5 ans.</Text>
        </View>
        <View style={{ flexDirection:'row', backgroundColor:C.g1, borderRadius:8, padding:3, marginBottom:8 }}>
          {[['actions','Actions (' + ct.actions.length + ')'], ['opcvm','OPCVM (' + ct.opcvm.length + ')']].map(([id, label]) => (
            <TouchableOpacity key={id} onPress={() => { setTab(id); resetForm(); setDetailIdx(null); }}
              style={{ flex:1, paddingVertical:8, alignItems:'center', borderRadius:6, backgroundColor:tab===id?C.navy:C.g1 }} activeOpacity={0.8}>
              <Text style={{ fontWeight:tab===id?'700':'400', fontSize:12, color:tab===id?C.white:C.g3 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Toggle analytiques CT ── */}
        {tab === 'actions' && ct.actions.length > 0 && (
          <>
            <TouchableOpacity
              onPress={() => setShowAnalytics(a => !a)}
              style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8, paddingHorizontal:2 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontWeight:'700', fontSize:12, color:C.dark }}>📊 Analytiques</Text>
              <Text style={{ color:C.navy, fontSize:12 }}>{showAnalytics ? '▲ Réduire' : '▼ Afficher'}</Text>
            </TouchableOpacity>
            {showAnalytics && (
              <Card style={{ marginBottom:12 }}>
                <Text style={{ fontWeight:'700', fontSize:11, color:C.dark, marginBottom:10 }}>Répartition du portefeuille</Text>
                <View style={{ flexDirection:'row', justifyContent:'space-around', marginBottom:10 }}>
                  <View style={{ alignItems:'center', gap:6 }}>
                    <DonutChart segments={costSegs} size={112} thickness={26} label={'Investi\n' + fmt(cout)}/>
                    <Text style={{ fontSize:10, color:C.g3, fontWeight:'600' }}>Investissement initial</Text>
                  </View>
                  <View style={{ alignItems:'center', gap:6 }}>
                    <DonutChart segments={valSegs} size={112} thickness={26} label={'Actuel\n' + fmt(total)}/>
                    <Text style={{ fontSize:10, color:C.g3, fontWeight:'600' }}>Valeur de marché</Text>
                  </View>
                </View>
                <View style={{ paddingTop:8, borderTopWidth:1, borderTopColor:C.g1, marginBottom:12 }}>
                  <View style={{ flexDirection:'row', paddingBottom:4 }}>
                    <Text style={{ flex:2, fontSize:9, color:C.g3, fontWeight:'700' }}>TITRE</Text>
                    <Text style={{ flex:1, fontSize:9, color:C.g3, fontWeight:'700', textAlign:'right' }}>INVESTI</Text>
                    <Text style={{ flex:1, fontSize:9, color:C.dark, fontWeight:'700', textAlign:'right' }}>ACTUEL</Text>
                  </View>
                  {ct.actions.map((t, i) => {
                    const coutCT  = ct.actions.reduce((s, x) => s + x.pru  * x.qty, 0);
                    const totalCT = ct.actions.reduce((s, x) => s + x.cours * x.qty, 0);
                    const cPct = coutCT  > 0 ? (t.pru   * t.qty / coutCT  * 100).toFixed(1) : '—';
                    const vPct = totalCT > 0 ? (t.cours  * t.qty / totalCT * 100).toFixed(1) : '—';
                    return (
                      <View key={i} style={{ flexDirection:'row', alignItems:'center', paddingVertical:3 }}>
                        <View style={{ flex:2, flexDirection:'row', alignItems:'center', gap:6 }}>
                          <View style={{ width:10, height:10, borderRadius:3, backgroundColor:CHART_COLORS[i % CHART_COLORS.length] }}/>
                          <Text style={{ fontSize:11, color:C.dark, fontWeight:'600' }}>{t.ticker}</Text>
                        </View>
                        <Text style={{ flex:1, fontSize:11, color:C.g3, textAlign:'right' }}>{cPct}%</Text>
                        <Text style={{ flex:1, fontSize:11, color:C.dark, fontWeight:'700', textAlign:'right' }}>{vPct}%</Text>
                      </View>
                    );
                  })}
                </View>
                {evo.values.length >= 2 && (
                  <>
                    <Text style={{ fontWeight:'700', fontSize:11, color:C.dark, marginBottom:8 }}>Évolution depuis le 1er achat</Text>
                    <View style={{ backgroundColor:C.navy, borderRadius:10, padding:12 }}>
                      <SparklineInteractive data={evo.values} dates={evo.labels} color={'#90C8FF'}/>
                    </View>
                  </>
                )}
              </Card>
            )}
          </>
        )}

        {tab === 'actions'
          ? (
            <Card style={{ padding:0, overflow:'hidden' }}>
              {/* En-tête tableau CT */}
              <View style={{ backgroundColor:C.navy, paddingHorizontal:14, paddingVertical:8, flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.85)' }}>TITRE</Text>
                <View style={{ flexDirection:'row', gap:16 }}>
                  <Text style={{ fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.85)' }}>VALEUR</Text>
                  <Text style={{ fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.85)' }}>P&L</Text>
                </View>
              </View>
              {ct.actions.length === 0 && (
                <View style={{ padding:24, alignItems:'center' }}>
                  <Text style={{ color:C.g3, fontSize:13 }}>Aucun titre dans le compte-titres</Text>
                </View>
              )}
              {ct.actions.map((t, i) => {
                const val   = t.cours * t.qty;
                const base  = t.pru   * t.qty;
                const diff  = val - base;
                const pct   = pctDiff(val, base);
                const pos   = diff >= 0;
                const poids = total > 0 ? val / total * 100 : 0;
                const mois  = t.dateAchat ? detentionMois(t.dateAchat) : null;
                return (
                  <View key={i} style={{ borderBottomWidth:1, borderBottomColor:C.g1, borderLeftWidth:3, borderLeftColor: pos ? C.gpos : C.rneg }}>
                    {/* Ligne principale */}
                    <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', paddingHorizontal:12, paddingTop:10, paddingBottom:4 }}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:8, flex:1 }}>
                        <IconBox label={t.ticker} bg={CT_COLORS[i % CT_COLORS.length]} size={32} fs={8}/>
                        <View style={{ flex:1 }}>
                          <Text style={{ fontSize:12, fontWeight:'700', color:C.dark }}>{t.ticker}</Text>
                          {t.nom && t.nom !== t.ticker ? <Text style={{ fontSize:10, color:C.g3, marginTop:1 }} numberOfLines={1}>{t.nom}</Text> : null}
                        </View>
                      </View>
                      <View style={{ alignItems:'flex-end', minWidth:110 }}>
                        <Text style={{ fontSize:13, fontWeight:'700', color:C.dark }}>{fmt(val)}</Text>
                        <Text style={{ fontSize:11, fontWeight:'600', color: pos ? C.gpos : C.rneg }}>
                          {pos?'+':''}{fmt(diff)}  ({pos?'+':''}{pct.toFixed(1)}%)
                        </Text>
                      </View>
                    </View>
                    {/* Ligne détails */}
                    <View style={{ paddingHorizontal:12, paddingBottom:6 }}>
                      <Text style={{ fontSize:10, color:C.g3 }}>
                        {t.qty} titres · PRU {t.pru.toFixed(2)} · Cours {t.cours.toFixed(2)}
                        {mois !== null ? `  ·  ${mois} mois` : ''}
                      </Text>
                    </View>
                    {/* Barre de poids */}
                    <View style={{ paddingHorizontal:12, paddingBottom:8, flexDirection:'row', alignItems:'center', gap:8 }}>
                      <View style={{ flex:1, height:4, backgroundColor:C.g1, borderRadius:2, overflow:'hidden' }}>
                        <View style={{ width:`${Math.min(poids,100)}%`, height:'100%', backgroundColor:CT_COLORS[i % CT_COLORS.length], borderRadius:2 }}/>
                      </View>
                      <Text style={{ fontSize:9, color:C.g3, minWidth:34, textAlign:'right' }}>{poids.toFixed(1)}%</Text>
                    </View>
                    <ActionBtns
                      onEdit={() => startEditAction(i)}
                      onDelete={() => deleteAction(i)}
                      onDetail={() => setDetailIdx(detailIdx === i ? null : i)}
                    />
                    {/* Panel de détails CT */}
                    {detailIdx === i && (() => {
                      const valPos  = t.cours * t.qty;
                      const coutPos = t.pru   * t.qty;
                      const diffPos = valPos - coutPos;
                      const pctPos  = pctDiff(valPos, coutPos);
                      return (
                        <View style={{ backgroundColor:'#EEF2FF', borderTopWidth:1, borderTopColor:'#C0CCF0', padding:12, gap:5 }}>
                          <Text style={{ fontWeight:'700', fontSize:12, color:C.navy, marginBottom:4 }}>
                            {t.nom && t.nom !== t.ticker ? t.nom : t.ticker} — Détails de la position
                          </Text>
                          <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                            <Text style={{ fontSize:11, color:C.g3 }}>Quantité</Text>
                            <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{t.qty} titres</Text>
                          </View>
                          <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                            <Text style={{ fontSize:11, color:C.g3 }}>PRU (coût moy. pondéré)</Text>
                            <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{t.pru.toFixed(2)} DH</Text>
                          </View>
                          <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                            <Text style={{ fontSize:11, color:C.g3 }}>Cours actuel</Text>
                            <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{t.cours.toFixed(2)} DH</Text>
                          </View>
                          <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                            <Text style={{ fontSize:11, color:C.g3 }}>Coût de revient</Text>
                            <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{fmt(coutPos)}</Text>
                          </View>
                          <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                            <Text style={{ fontSize:11, color:C.g3 }}>Valeur de marché</Text>
                            <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{fmt(valPos)}</Text>
                          </View>
                          <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                            <Text style={{ fontSize:11, color:C.g3 }}>Plus-value latente</Text>
                            <Text style={{ fontSize:12, fontWeight:'700', color: diffPos >= 0 ? C.gpos : C.rneg }}>
                              {diffPos >= 0?'+':''}{fmt(diffPos)}  ({diffPos >= 0?'+':''}{pctPos.toFixed(2)}%)
                            </Text>
                          </View>
                          {t.dateAchat && (
                            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                              <Text style={{ fontSize:11, color:C.g3 }}>1re acquisition</Text>
                              <Text style={{ fontSize:11, fontWeight:'600', color:C.dark }}>{t.dateAchat} · {mois} mois</Text>
                            </View>
                          )}
                          <View style={{ marginTop:4, backgroundColor:'#FFF3CD', borderRadius:6, padding:7 }}>
                            <Text style={{ fontSize:10, fontWeight:'700', color:'#7A5800' }}>
                              ⚠ Compte Titres — Plus-values soumises à l'IR marocain (15% sur personnes physiques)
                            </Text>
                          </View>
                        </View>
                      );
                    })()}
                    <View style={{ height:4 }}/>
                  </View>
                );
              })}
            </Card>
          )
          : ct.opcvm.map((o, i) => {
              const val = o.vl * o.parts, poids = total > 0 ? val / total * 100 : 0;
              return (
                <Card key={i} style={{ padding:10, marginBottom:8 }}>
                  <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                    <IconBox label="OPC" bg={OPC_COLORS[i % OPC_COLORS.length]} size={32} fs={7}/>
                    <View style={{ flex:1 }}>
                      <Text style={{ fontWeight:'600', fontSize:12 }}>{o.nom}</Text>
                      <Text style={{ fontSize:10, color:C.g3 }}>{o.parts} parts — VL: {fmt(o.vl)}/part — {o.type}</Text>
                    </View>
                    <View style={{ alignItems:'flex-end' }}>
                      <Text style={{ fontWeight:'700', fontSize:12 }}>{fmt(val)}</Text>
                      <View style={{ backgroundColor:C.priL, borderRadius:4, paddingHorizontal:5, paddingVertical:1, marginTop:3 }}>
                        <Text style={{ fontSize:9, fontWeight:'700', color:C.pri }}>{poids.toFixed(1)}% poids</Text>
                      </View>
                    </View>
                  </View>
                  <ActionBtns onEdit={() => startEditOpcvm(i)} onDelete={() => deleteOpcvm(i)}/>
                </Card>
              );
            })
        }
        {showForm ? (
          <Card style={{ borderWidth:1.5, borderColor:C.navy, marginTop:8 }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>
              {editIdx >= 0
                ? (tab === 'actions' ? 'Modifier l\'action' : 'Modifier l\'OPCVM')
                : (tab === 'actions' ? 'Ajouter une action' : 'Ajouter un OPCVM')}
            </Text>
            {tab === 'actions' ? (<>
              <SelectInput label="Action cotee BVC" value={ticker} options={['Selectionner...'].concat(BVC_LIST)} onChange={handleTickerCT}/>
              <Input label="Prix d'achat unitaire (DH)" value={pru}   onChangeText={setPru}   keyboardType="numeric" placeholder="265.00"/>
              <Input label="Cours actuel (DH)" value={cours} keyboardType="numeric" placeholder="—" editable={false}/>
              <Input label="Quantite (actions)" value={qty}   onChangeText={setQty}   keyboardType="numeric" placeholder="20"/>
              <Input label="Date d'achat (optionnel)" value={dateAchat} onChangeText={setDateAchat} placeholder="JJ/MM/AAAA"/>
              <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
                <BtnSec onPress={resetForm} style={{ flex:1 }}>Annuler</BtnSec>
                <BtnPri onPress={saveAction} disabled={!tickerValid || !isNum(pru) || !isNum(qty) || !isNum(cours)} style={{ flex:1 }}>
                  {editIdx >= 0 ? 'Enregistrer' : 'Ajouter'}
                </BtnPri>
              </View>
            </>) : (<>
              <Input label="Nom du fonds"     value={oNom}   onChangeText={setONom}   placeholder="BMCE Cap. Actions..."/>
              <Input label="VL actuelle (DH)" value={oVl}    onChangeText={setOVl}    keyboardType="numeric" placeholder="1230"/>
              <Input label="Nombre de parts"  value={oParts} onChangeText={setOParts} keyboardType="numeric" placeholder="5"/>
              <SelectInput label="Type" value={oType} options={['Actions','Obligataire','Diversifie','Monetaire']} onChange={setOType}/>
              <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
                <BtnSec onPress={resetForm} style={{ flex:1 }}>Annuler</BtnSec>
                <BtnPri onPress={saveOpcvm} disabled={!oNom || !isNum(oVl) || !isNum(oParts)} style={{ flex:1 }}>
                  {editIdx >= 0 ? 'Enregistrer' : 'Ajouter'}
                </BtnPri>
              </View>
            </>)}
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)} style={{ marginTop:8 }}>+ Ajouter un actif financier</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

// ─── SubOr ──────────────────────────────────────────────────
function SubOr({ data, setData, onBack }) {
  const or     = data.or;
  const prixOr = data.prixOr;
  const total  = calcOr(or, prixOr);
  const [showAdd, setShowAdd] = useState(false);
  const [editIdx, setEditIdx] = useState(-1);
  const [nom, setNom] = useState('');
  const [qty, setQty] = useState('');
  const [pa,  setPa]  = useState('');
  const [po,  setPo]  = useState('');

  // ── Auto-fetch prix or au montage ───────────────────────────
  useEffect(() => {
    fetchPrixOr().then(prix => {
      if (prix) setData(d => ({ ...d, prixOr: prix }));
    });
  }, []);

  function startEdit(i) {
    const o = or[i];
    setNom(o.nom); setQty(String(o.quantite)); setPa(String(o.prixAchat));
    setPo(o.prixOffert ? String(o.prixOffert) : '');
    setEditIdx(i); setShowAdd(false);
  }

  function resetForm() {
    setNom(''); setQty(''); setPa(''); setPo('');
    setEditIdx(-1); setShowAdd(false);
  }

  function saveOr() {
    if (!nom || !isNum(qty) || !isNum(pa)) return;
    const entry = {
      id: editIdx >= 0 ? or[editIdx].id : Date.now(),
      nom, quantite: parseFloat(qty), unite:'g',
      prixAchat: parseFloat(pa),
      prixOffert: po ? parseFloat(po) : null,
    };
    if (editIdx >= 0) {
      setData(d => ({ ...d, or: d.or.map((x, i) => i === editIdx ? entry : x) }));
    } else {
      setData(d => ({ ...d, or: [...d.or, entry] }));
    }
    resetForm();
  }

  function deleteOr(i) {
    Alert.alert('Supprimer', 'Retirer ce stock d\'or ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:() =>
        setData(d => ({ ...d, or: d.or.filter((_, j) => j !== i) }))
      },
    ]);
  }

  function vendreOr(i) {
    const o = or[i];
    const valEstim = Math.round(o.quantite * prixOr);
    Alert.alert(
      `Vente — ${o.nom}`,
      `Valeur estimée au cours actuel :\n${valEstim.toLocaleString('fr-FR')} DH\n\nEnregistrer cette vente dans votre budget ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer sans enregistrer', style: 'destructive', onPress: () =>
          setData(d => ({ ...d, or: d.or.filter((_, j) => j !== i) }))
        },
        { text: `✓ Vendre (+${valEstim.toLocaleString('fr-FR')} DH)`, onPress: () =>
          setData(d => ({
            ...d,
            or: d.or.filter((_, j) => j !== i),
            operations: [...(d.operations || []), {
              id: `vente-or-${Date.now()}`,
              date: new Date().toISOString(),
              montant: valEstim,
              type: 'revenu',
              categorie: 'autre',
              actif: null,
              description: `Vente Or — ${o.nom}`,
            }],
          }))
        },
      ]
    );
  }

  const showForm = showAdd || editIdx >= 0;

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Or & Metaux Precieux" subtitle="Patrimoine physique" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.gold, borderRadius:16, padding:16, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(255,240,200,0.9)', fontSize:12 }}>Valeur totale de votre or</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:28, marginVertical:4 }}>{fmt(total)}</Text>
        </View>
        <View style={{ backgroundColor:C.goldL, borderRadius:10, padding:12, borderLeftWidth:4, borderLeftColor:C.gold, marginBottom:12 }}>
          <Text style={{ fontWeight:'700', fontSize:12, color:C.goldD }}>Prix de l'or aujourd'hui (Maroc)</Text>
          <Text style={{ color:C.gold, fontSize:15, fontWeight:'700', marginTop:4 }}>1 gramme = {prixOr} DH</Text>
          <Text style={{ fontSize:10, color:C.goldD, marginTop:2 }}>Source : BAM + LBMA — 1 kg = {fmt(prixOr * 1000)}</Text>
        </View>
        <SectionTitle>Mes stocks d'or</SectionTitle>
        {or.map((o, i) => {
          const ve = o.quantite * prixOr, vr = Math.max(ve, o.prixOffert || 0);
          return (
            <Card key={i}>
              <View style={{ backgroundColor:C.goldL, borderRadius:8, padding:10, flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                  <IconBox label="OR" bg={C.gold} size={34} fs={8}/>
                  <View>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.goldD }}>{o.nom}</Text>
                    <Text style={{ fontSize:11, color:C.g3 }}>{o.quantite} {o.unite}</Text>
                  </View>
                </View>
                <PLBadge value={vr} base={o.prixAchat}/>
              </View>
              <InfoRow label="Prix d'achat"                value={fmt(o.prixAchat)}/>
              <InfoRow label="Valeur estimative (cours J)" value={fmt(ve)}/>
              {o.prixOffert ? <InfoRow label="Prix offert" value={fmt(o.prixOffert)}/> : null}
              <View style={{ backgroundColor:C.goldL, borderRadius:6, padding:8, marginTop:6, flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ fontSize:12, fontWeight:'700', color:C.goldD }}>Valeur retenue</Text>
                <Text style={{ fontSize:13, fontWeight:'700', color:C.gold }}>{fmt(vr)}</Text>
              </View>
              <ActionBtns onEdit={() => startEdit(i)} onDelete={() => deleteOr(i)}/>
              <TouchableOpacity
                onPress={() => vendreOr(i)}
                style={{ marginTop:6, backgroundColor:'#E8F5E9', borderRadius:8, paddingVertical:8, alignItems:'center', borderWidth:1, borderColor:C.gpos }}
                activeOpacity={0.75}
              >
                <Text style={{ color:C.gpos, fontWeight:'700', fontSize:12 }}>💰 Enregistrer la vente dans le budget</Text>
              </TouchableOpacity>
            </Card>
          );
        })}
        {showForm ? (
          <Card style={{ borderWidth:1.5, borderColor:C.gold }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>
              {editIdx >= 0 ? 'Modifier le stock d\'or' : 'Ajouter un stock d\'or'}
            </Text>
            <Input label="Designation"            value={nom} onChangeText={setNom} placeholder="Lingot 100g, Pieces 18K..."/>
            <Input label="Quantite (grammes)"     value={qty} onChangeText={setQty} keyboardType="numeric" placeholder="100" unit="g"/>
            <Input label="Prix d'achat (DH)"      value={pa}  onChangeText={setPa}  keyboardType="numeric" placeholder="85000"/>
            <Input label="Prix offert (optionnel)" value={po}  onChangeText={setPo}  keyboardType="numeric" placeholder="Laisser vide"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={resetForm} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={saveOr} disabled={!nom || !isNum(qty) || !isNum(pa)} style={{ flex:1, backgroundColor:C.gold }}>
                {editIdx >= 0 ? 'Enregistrer' : 'Ajouter'}
              </BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)} style={{ marginTop:8, backgroundColor:C.gold }}>+ Ajouter un stock d'or</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

// ─── SubImmobilier ──────────────────────────────────────────
function SubImmobilier({ data, setData, onBack }) {
  const immo  = data.immobilier;
  const total = calcImmo(immo);
  const EMPTY_FORM = { nom:'', type:'Bien bati', ville:'', surface:'', prixAchat:'', prixM2:'', prixOffert:'', meth:'estimatif', loyerMontant:'', loyerJour:'1' };
  const [showAdd, setShowAdd] = useState(false);
  const [editIdx, setEditIdx] = useState(-1);
  const [form, setForm] = useState(EMPTY_FORM);
  const up = (k, v) => setForm(f => ({ ...f, [k]:v }));

  function startEdit(i) {
    const b = immo[i];
    setForm({
      nom: b.nom, type: b.type, ville: b.ville,
      surface: String(b.surface), prixAchat: String(b.prixAchat),
      prixM2: String(b.prixM2), prixOffert: b.prixOffert ? String(b.prixOffert) : '',
      meth: b.meth || 'estimatif',
    });
    setEditIdx(i); setShowAdd(false);
  }

  function resetForm() {
    setForm(EMPTY_FORM); setEditIdx(-1); setShowAdd(false);
  }

  function saveBien() {
    if (!form.nom || !isNum(form.prixAchat)) return;
    const { loyerMontant, loyerJour, ...formRest } = form;
    const entry = {
      id: editIdx >= 0 ? immo[editIdx].id : Date.now(),
      ...formRest,
      surface: parseFloat(formRest.surface) || 0,
      prixAchat: parseFloat(formRest.prixAchat) || 0,
      prixM2: parseFloat(formRest.prixM2) || 0,
      prixOffert: formRest.prixOffert ? parseFloat(formRest.prixOffert) : null,
      datAchat: editIdx >= 0 ? immo[editIdx].datAchat : new Date().getFullYear().toString(),
      unite: 'm2',
    };
    if (editIdx >= 0) {
      setData(d => ({ ...d, immobilier: d.immobilier.map((x, i) => i === editIdx ? entry : x) }));
    } else if (form.type === 'Bien locatif') {
      // Nouveau bien locatif : créer loyer récurrent atomiquement si montant renseigné
      const loyerM = parseFloat(loyerMontant) || 0;
      const loyerJ = parseInt(loyerJour) || 1;
      const revenu = loyerM > 0 ? {
        id: `loyer-${Date.now()}`,
        label: `Loyer — ${form.nom}`,
        montant: loyerM,
        jour: loyerJ,
        actif: true,
        dernierAjout: '',
      } : null;
      setData(d => ({
        ...d,
        immobilier: [...d.immobilier, entry],
        revenus_recurrents: revenu
          ? [...(d.revenus_recurrents || []), revenu]
          : (d.revenus_recurrents || []),
      }));
      if (loyerM > 0) {
        Alert.alert(
          '🏠 Loyer créé automatiquement',
          `Un revenu récurrent "${form.nom}" a été ajouté dans Budget → Revenus récurrents.\n\n${loyerM.toLocaleString('fr-FR')} DH le ${loyerJ} de chaque mois.`
        );
      }
    } else {
      setData(d => ({ ...d, immobilier: [...d.immobilier, entry] }));
    }
    resetForm();
  }

  function deleteBien(i) {
    Alert.alert('Supprimer', 'Retirer ce bien immobilier ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:() =>
        setData(d => ({ ...d, immobilier: d.immobilier.filter((_, j) => j !== i) }))
      },
    ]);
  }

  const showForm = showAdd || editIdx >= 0;

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Immobilier & Terrains" subtitle={immo.length + ' bien(s)'} onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.pri, borderRadius:14, padding:14, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Valeur totale</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26 }}>{fmt(total)}</Text>
        </View>

        {immo.map((b, i) => {
          const ve = b.prixM2 * b.surface, vr = valImmo(b);
          const loyerLie = b.type === 'Bien locatif'
            ? (data.revenus_recurrents || []).find(r => r.label?.includes(b.nom))
            : null;
          return (
            <Card key={i}>
              <View style={{ backgroundColor:C.priL, borderRadius:8, padding:10, flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                  <IconBox label={b.type === 'Terrain' ? 'TRN' : b.type === 'Bien locatif' ? 'LOC' : 'APP'} bg={'#B46428'} size={34} fs={8}/>
                  <View>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.pri }}>{b.nom}</Text>
                    <Text style={{ fontSize:11, color:C.g3 }}>{b.type} — {b.ville} — {b.surface} {b.unite || 'm2'}</Text>
                  </View>
                </View>
                <PLBadge value={vr} base={b.prixAchat}/>
              </View>
              {b.type === 'Bien locatif' && (
                <View style={{ backgroundColor: loyerLie ? '#E8F5E9' : '#FFF8E1', borderRadius:8, padding:8, flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <Text style={{ fontSize:11, color: loyerLie ? C.gpos : '#D4900A', fontWeight:'600' }}>
                    {loyerLie ? `🔄 Loyer récurrent : +${loyerLie.montant?.toLocaleString('fr-FR')} DH / mois` : '⚠ Aucun loyer récurrent configuré'}
                  </Text>
                </View>
              )}
              <InfoRow label="Prix d'achat"      value={fmt(b.prixAchat)} sub={'Acquis en ' + b.datAchat}/>
              <InfoRow label="Valeur estimative" value={fmt(ve)}           sub="Prix/m2 x Surface"/>
              <InfoRow label="Prix offert"       value={b.prixOffert ? fmt(b.prixOffert) : 'N/A'} sub="Meilleure offre recue"/>
              <View style={{ backgroundColor:C.priL, borderRadius:6, padding:8, marginVertical:6, flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ fontSize:12, fontWeight:'700', color:C.pri }}>Valeur retenue</Text>
                <Text style={{ fontSize:13, fontWeight:'700', color:C.pri }}>{fmt(vr)}</Text>
              </View>
              <MethodSelector value={b.meth} onChange={m => setData(d => ({ ...d, immobilier: d.immobilier.map((x, j) => j === i ? { ...x, meth:m } : x) }))}/>
              <ActionBtns onEdit={() => startEdit(i)} onDelete={() => deleteBien(i)}/>
            </Card>
          );
        })}

        {showForm ? (
          <Card style={{ borderWidth:1.5, borderColor:C.pri }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>
              {editIdx >= 0 ? 'Modifier le bien' : 'Ajouter un bien'}
            </Text>
            <Input label="Designation"             value={form.nom}        onChangeText={v=>up('nom',v)}        placeholder="Appartement Gueliz"/>
            <SelectInput label="Type"              value={form.type}       onChange={v=>up('type',v)}           options={['Bien bati','Terrain','Bien locatif']}/>
            <Input label="Ville"                   value={form.ville}      onChangeText={v=>up('ville',v)}      placeholder="Casablanca"/>
            <Input label="Surface (m2)"            value={form.surface}    onChangeText={v=>up('surface',v)}    keyboardType="numeric" unit="m2"/>
            <Input label="Prix d'achat (DH)"       value={form.prixAchat}  onChangeText={v=>up('prixAchat',v)}  keyboardType="numeric"/>
            <Input label="Prix au m2 du secteur"   value={form.prixM2}     onChangeText={v=>up('prixM2',v)}     keyboardType="numeric" unit="DH/m2"/>
            <Input label="Prix offert (optionnel)" value={form.prixOffert} onChangeText={v=>up('prixOffert',v)} keyboardType="numeric"/>
            {form.type === 'Bien locatif' && editIdx < 0 && (
              <View style={{ backgroundColor:'#E8F5E9', borderRadius:10, padding:12, marginTop:6, borderLeftWidth:3, borderLeftColor:C.gpos }}>
                <Text style={{ fontSize:12, fontWeight:'700', color:C.gpos, marginBottom:8 }}>🔄 Loyer récurrent (optionnel)</Text>
                <View style={{ flexDirection:'row', gap:8 }}>
                  <View style={{ flex:2 }}>
                    <Input label="Montant loyer (DH)" value={form.loyerMontant} onChangeText={v=>up('loyerMontant',v)} keyboardType="numeric" placeholder="5000"/>
                  </View>
                  <View style={{ flex:1 }}>
                    <Input label="Jour du mois" value={form.loyerJour} onChangeText={v=>up('loyerJour',v)} keyboardType="numeric" placeholder="1"/>
                  </View>
                </View>
                <Text style={{ fontSize:10, color:C.g3, marginTop:4 }}>Sera ajouté automatiquement dans Budget → Revenus récurrents</Text>
              </View>
            )}
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={resetForm} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={saveBien} disabled={!form.nom || !isNum(form.prixAchat)} style={{ flex:1 }}>
                {editIdx >= 0 ? 'Enregistrer' : 'Ajouter'}
              </BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)}>+ Ajouter un bien</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

// ─── SubTransport ────────────────────────────────────────────
function SubTransport({ data, setData, onBack }) {
  const transport = data.transport;
  const total     = calcTransport(transport);
  const [showAdd, setShowAdd] = useState(false);
  const [editIdx, setEditIdx] = useState(-1);
  const [nom,    setNom]    = useState('');
  const [type,   setType]   = useState('Voiture');
  const [annee,  setAnnee]  = useState('');
  const [pa,     setPa]     = useState('');
  const [valEst, setValEst] = useState('');

  // Calcul auto dépréciation quand annee/pa/type change
  function autoDepreciation(anneeVal, paVal, typeVal) {
    if (isNum(paVal) && isNum(anneeVal)) {
      const dep = valeurDepreciee(parseFloat(paVal), parseInt(anneeVal, 10), typeVal || type);
      setValEst(String(dep));
    }
  }

  function startEdit(i) {
    const t = transport[i];
    setNom(t.nom); setType(t.type || 'Voiture'); setAnnee(String(t.annee));
    setPa(String(t.prixAchat)); setValEst(String(t.valEstim));
    setEditIdx(i); setShowAdd(false);
  }

  function resetForm() {
    setNom(''); setType('Voiture'); setAnnee(''); setPa(''); setValEst('');
    setEditIdx(-1); setShowAdd(false);
  }

  function saveVehicule() {
    if (!nom || !isNum(annee) || !isNum(pa) || !isNum(valEst)) return;
    const entry = {
      id: editIdx >= 0 ? transport[editIdx].id : Date.now(),
      nom, type, annee: parseInt(annee, 10),
      immat: editIdx >= 0 ? transport[editIdx].immat : '',
      prixAchat: parseFloat(pa),
      dateAchat: String(annee),
      valEstim: parseFloat(valEst),
      prixOffert: editIdx >= 0 ? transport[editIdx].prixOffert : null,
      meth: editIdx >= 0 ? transport[editIdx].meth : 'estimatif',
    };
    if (editIdx >= 0) {
      setData(d => ({ ...d, transport: d.transport.map((x, i) => i === editIdx ? entry : x) }));
    } else {
      setData(d => ({ ...d, transport: [...d.transport, entry] }));
    }
    resetForm();
  }

  function deleteVehicule(i) {
    Alert.alert('Supprimer', 'Retirer ce vehicule ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:() =>
        setData(d => ({ ...d, transport: d.transport.filter((_, j) => j !== i) }))
      },
    ]);
  }

  const showForm = showAdd || editIdx >= 0;

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Biens de Transport" subtitle={transport.length + ' vehicule(s)'} onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:'#50506A', borderRadius:14, padding:14, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(190,190,220,0.9)', fontSize:12 }}>Valeur totale</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26 }}>{fmt(total)}</Text>
        </View>

        <View style={{ backgroundColor:C.accL, borderRadius:10, padding:10, borderLeftWidth:4, borderLeftColor:C.acc, marginBottom:12 }}>
          <Text style={{ fontSize:11, color:C.goldD }}>Les vehicules perdent en moyenne 15-25% de valeur par an. La depreciation est calculee automatiquement.</Text>
        </View>

        {transport.map((t, i) => {
          const vr = valTransport(t);
          const depAuto = valeurDepreciee(t.prixAchat, t.annee, t.type);
          return (
            <Card key={i}>
              <View style={{ backgroundColor:'#EAEAF0', borderRadius:8, padding:10, flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                  <IconBox label="VEH" bg={'#50506A'} size={34} fs={8}/>
                  <View>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>{t.nom}</Text>
                    <Text style={{ fontSize:11, color:C.g3 }}>{t.type} — {t.annee} — {t.immat || 'Sans immat'}</Text>
                  </View>
                </View>
                <PLBadge value={vr} base={t.prixAchat}/>
              </View>
              <InfoRow label="Prix d'achat"             value={fmt(t.prixAchat)}   sub={'Achete en ' + t.dateAchat}/>
              <InfoRow label="Depreciation auto"        value={fmt(depAuto)}        sub={`Calcul base sur ${new Date().getFullYear() - t.annee} an(s) a ${Math.round((TAUX_DEP[t.type]||0.15)*100)}%/an`}/>
              <InfoRow label="Valeur estimative marche" value={fmt(t.valEstim)}/>
              {t.prixOffert ? <InfoRow label="Prix offert" value={fmt(t.prixOffert)}/> : null}
              <View style={{ backgroundColor:'#EAEAF0', borderRadius:6, padding:8, marginVertical:6, flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ fontSize:12, fontWeight:'700', color:'#50506A' }}>Valeur retenue</Text>
                <Text style={{ fontSize:13, fontWeight:'700', color:'#50506A' }}>{fmt(vr)}</Text>
              </View>
              <MethodSelector value={t.meth} onChange={m => setData(d => ({ ...d, transport: d.transport.map((x, j) => j === i ? { ...x, meth:m } : x) }))}/>
              <ActionBtns onEdit={() => startEdit(i)} onDelete={() => deleteVehicule(i)}/>
            </Card>
          );
        })}

        {showForm ? (
          <Card style={{ borderWidth:1.5, borderColor:'#50506A' }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>
              {editIdx >= 0 ? 'Modifier le vehicule' : 'Ajouter un vehicule'}
            </Text>
            <Input label="Designation" value={nom} onChangeText={setNom} placeholder="Dacia Logan, BMW Serie 3..."/>
            <SelectInput label="Type" value={type} options={['Voiture','Moto','Camion','Autre']} onChange={v => {
              setType(v);
              autoDepreciation(annee, pa, v);
            }}/>
            <Input label="Annee" value={annee} onChangeText={v => {
              setAnnee(v);
              autoDepreciation(v, pa, type);
            }} keyboardType="numeric" placeholder="2022"/>
            <Input label="Prix d'achat (DH)" value={pa} onChangeText={v => {
              setPa(v);
              autoDepreciation(annee, v, type);
            }} keyboardType="numeric" placeholder="180000"/>
            <Input
              label={`Valeur estimative (DH) — auto: ${isNum(pa) && isNum(annee) ? fmt(valeurDepreciee(parseFloat(pa), parseInt(annee,10), type)) : '?'}`}
              value={valEst}
              onChangeText={setValEst}
              keyboardType="numeric"
              placeholder="Calculee automatiquement"
            />
            <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
              <BtnSec onPress={resetForm} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={saveVehicule} disabled={!nom || !isNum(annee) || !isNum(pa) || !isNum(valEst)} style={{ flex:1, backgroundColor:'#50506A' }}>
                {editIdx >= 0 ? 'Enregistrer' : 'Ajouter'}
              </BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)} style={{ backgroundColor:'#50506A' }}>+ Ajouter un vehicule</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Page principale ─────────────────────────────────────────
const PageActifs = React.memo(function PageActifs({ onNav }) {
  const data      = usePatrimoineStore(s => s.data);
  const setData   = usePatrimoineStore(s => s.setData);
  const discret   = usePatrimoineStore(s => s.discret);
  // Bug 2&3 fix : sub lu directement depuis le store Zustand (subscription continue)
  // setPage('actifs', 'or') → sub devient 'or' → PageActifs re-render → SubOr affiché
  const sub       = usePatrimoineStore(s => s.sub);
  const setPage   = usePatrimoineStore(s => s.setPage);
  const setSub    = (id) => setPage('actifs', id);

  const cats = useMemo(() => [
    { id:'liquide',    section:'Liquidites & Epargne',       label:'Argent Liquide & Devises', abbr:'LIQ', col:C.gpos,    val:calcLiquide(data.liquidites),    detail:'DH + ' + data.liquidites.devises.length + ' devises' },
    { id:'banque',     section:'Liquidites & Epargne',       label:'Argent en Banque',          abbr:'BNQ', col:C.navy,    val:calcBanque(data.banque),          detail:data.banque.length + ' compte(s)' },
    { id:'carnet',     section:'Liquidites & Epargne',       label:'Compte sur Carnet',         abbr:'CRT', col:C.teal,    val:calcCarnet(data.carnet),          detail:'Rappels actifs' },
    { id:'pea',        section:'Investissements financiers',  label:'Compte PEA',                abbr:'PEA', col:C.pri,     val:calcPEA(data.pea),                detail:data.pea.length + ' titres BVC' },
    { id:'ct',         section:'Investissements financiers',  label:'Compte-Titre',              abbr:'CT',  col:C.navy,    val:calcCT(data.ct),                  detail:data.ct.actions.length + ' actions — ' + data.ct.opcvm.length + ' OPCVM' },
    { id:'or',         section:'Actifs reels',                label:'Or & Metaux Precieux',      abbr:'OR',  col:C.gold,    val:calcOr(data.or, data.prixOr),     detail:data.or.reduce((s, o) => s + o.quantite, 0) + ' g au total' },
    { id:'immobilier', section:'Actifs reels',                label:'Immobilier & Terrains',     abbr:'IMM', col:'#B46428', val:calcImmo(data.immobilier),         detail:data.immobilier.length + ' bien(s)' },
    { id:'transport',  section:'Actifs reels',                label:'Biens de Transport',        abbr:'VEH', col:'#50506A', val:calcTransport(data.transport),     detail:data.transport.length + ' vehicule(s)' },
  ], [data]);

  const total = useMemo(() => cats.reduce((s, c) => s + c.val, 0), [cats]);

  if (sub === 'liquide')    return <SubLiquide    data={data} setData={setData} onBack={() => setPage('actifs', null)}/>;
  if (sub === 'banque')     return <SubBanque     data={data} setData={setData} onBack={() => setPage('actifs', null)}/>;
  if (sub === 'carnet')     return <SubCarnet     data={data} setData={setData} onBack={() => setPage('actifs', null)}/>;
  if (sub === 'pea')        return <SubPEA        data={data} setData={setData} onBack={() => setPage('actifs', null)}/>;
  if (sub === 'ct')         return <SubCT         data={data} setData={setData} onBack={() => setPage('actifs', null)}/>;
  if (sub === 'or')         return <SubOr         data={data} setData={setData} onBack={() => setPage('actifs', null)}/>;
  if (sub === 'immobilier') return <SubImmobilier data={data} setData={setData} onBack={() => setPage('actifs', null)}/>;
  if (sub === 'transport')  return <SubTransport  data={data} setData={setData} onBack={() => setPage('actifs', null)}/>;

  const sections = ['Liquidites & Epargne','Investissements financiers','Actifs reels'];
  return (
    <View style={{ flex:1, minHeight:0 }}>
      <View style={{ backgroundColor:C.pri, padding:14 }}>
        <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Total patrimoine</Text>
        <Text style={{ color:C.white, fontWeight:'700', fontSize:22 }}>{discret ? '•••• DH' : fmt(total)}</Text>
      </View>
      <ScrollView
        style={{ flex:1, backgroundColor:C.g1 }}
        contentContainerStyle={{ padding:12, paddingBottom:20 }}
      >
        {sections.map(sec => (
          <View key={sec}>
            <Text style={{ fontSize:11, fontWeight:'600', color:C.g3, marginTop:12, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>{sec}</Text>
            {cats.filter(c => c.section === sec).map((c, i) => (
              <Card key={i} onPress={() => setSub(c.id)} style={{ padding:12 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <IconBox label={c.abbr} bg={c.col} size={36} fs={9}/>
                  <View style={{ flex:1 }}>
                    <Text style={{ fontWeight:'600', fontSize:13, color:C.dark }}>{c.label}</Text>
                    <Text style={{ fontSize:11, color:C.g3, marginTop:1 }}>{c.detail}</Text>
                    <View style={{ marginTop:5 }}>
                      <BarH pct={total > 0 ? c.val / total * 100 : 0} color={c.col}/>
                    </View>
                  </View>
                  <View style={{ alignItems:'flex-end' }}>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>{discret ? '••••' : fmt(c.val)}</Text>
                    <Text style={{ fontSize:10, color:C.g3, marginTop:2 }}>{total > 0 ? (c.val / total * 100).toFixed(1) : '0.0'}%</Text>
                  </View>
                  <Text style={{ color:C.g2, fontSize:18 }}>›</Text>
                </View>
              </Card>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

export default PageActifs;
