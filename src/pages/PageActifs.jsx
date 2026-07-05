import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { C } from '../constants/colors';
import {
  calcLiquide, calcBanque, calcCarnet, calcPEA, calcPEACout,
  calcCT, calcCTCout, calcOr, calcImmo, calcTransport,
  valImmo, valTransport, valOr,
} from '../utils/calc';
import { fmt, fmtN, pctDiff } from '../utils/fmt';
import {
  Card, BtnPri, BtnSec, PLBadge, IconBox,
  SectionTitle, InfoRow, MethodSelector, Input, SelectInput, TopBar, BarH,
} from '../components/shared';

// ─── Sous-pages ─────────────────────────────────────────────

function SubLiquide({ data, setData, onBack }) {
  const liq   = data.liquidites;
  const total = calcLiquide(liq);
  const [showAdd, setShowAdd] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [nom,     setNom]     = useState('');
  const [qty,     setQty]     = useState('');
  const [taux,    setTaux]    = useState('');
  const COLS = ['#005090','#003280','#640064','#006440','#804000'];

  function addDevise() {
    if (!devCode || !qty || !taux) return;
    setData(d => ({ ...d, liquidites:{ ...d.liquidites, devises:[...d.liquidites.devises,
      { code:devCode.toUpperCase(), nom:nom||devCode.toUpperCase(), quantite:parseFloat(qty), taux:parseFloat(taux), variation:0 },
    ]}}));
    setShowAdd(false); setDevCode(''); setNom(''); setQty(''); setTaux('');
  }

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
            <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>{fmt(liq.dh)}</Text>
          </View>
        </Card>
        <SectionTitle>Devises etrangeres</SectionTitle>
        {liq.devises.map((dv, i) => (
          <Card key={i}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'flex-start' }}>
              <IconBox label={dv.code} bg={COLS[i%COLS.length]} size={38} fs={9}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'600', fontSize:13 }}>{dv.nom}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>{fmtN(dv.quantite)} {dv.code} - 1 {dv.code} = {dv.taux.toFixed(2)} DH</Text>
                <Text style={{ fontSize:10, color:C.g2, marginTop:2 }}>Source : Bank Al-Maghrib</Text>
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Text style={{ fontWeight:'700', fontSize:13 }}>{fmt(dv.quantite*dv.taux)}</Text>
                <Text style={{ fontSize:11, color:dv.variation>=0?C.gpos:C.rneg }}>{dv.variation>=0?'+':''}{dv.variation.toFixed(2)}%</Text>
              </View>
            </View>
          </Card>
        ))}
        {showAdd ? (
          <Card style={{ borderWidth:1.5, borderColor:C.gpos }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>Ajouter une devise</Text>
            <Input label="Code (ex: USD)" value={devCode} onChangeText={setDevCode} placeholder="USD"/>
            <Input label="Nom complet"    value={nom}     onChangeText={setNom}     placeholder="Dollar US"/>
            <Input label="Quantite"       value={qty}     onChangeText={setQty}     placeholder="1000" keyboardType="numeric"/>
            <Input label="Cours (DH)"     value={taux}    onChangeText={setTaux}    placeholder="10.22" keyboardType="numeric" unit="DH"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={() => setShowAdd(false)} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={addDevise} style={{ flex:1 }}>Ajouter</BtnPri>
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

function SubBanque({ data, setData, onBack }) {
  const total = calcBanque(data.banque);
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
          </Card>
        ))}
        <BtnPri onPress={() => setData(d => ({ ...d, banque:[...d.banque, { banque:'Nouvelle banque', solde:0, compte:'Compte courant' }] }))}>
          + Ajouter un compte
        </BtnPri>
      </ScrollView>
    </View>
  );
}

function SubCarnet({ data, onBack }) {
  const total = calcCarnet(data.carnet);
  const proj  = (n) => data.carnet.reduce((s, c) => s + c.solde*(Math.pow(1+c.taux/100,n)-1), 0);
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
                <Text style={{ fontSize:11, color:C.g3 }}>Taux : {c.taux}% - +{fmt(c.solde*c.taux/100)}/an</Text>
              </View>
              <Text style={{ fontWeight:'700', fontSize:14 }}>{fmt(c.solde)}</Text>
            </View>
            <View style={{ backgroundColor:C.tealL, borderRadius:8, padding:10 }}>
              <Text style={{ fontSize:11, fontWeight:'700', color:C.teal, marginBottom:3 }}>Rappel d'epargne</Text>
              <Text style={{ fontSize:11, color:C.dark }}>Investir {fmt(c.rappel.montant)} - {c.rappel.freq}</Text>
              <Text style={{ fontSize:10, color:C.acc, marginTop:2 }}>Prochain : {c.rappel.prochaine}</Text>
            </View>
          </Card>
        ))}
        <Card style={{ backgroundColor:C.g1 }}>
          <Text style={{ fontWeight:'700', fontSize:12, marginBottom:10 }}>Projection des interets</Text>
          <View style={{ flexDirection:'row' }}>
            {[[1,'1 an'],[3,'3 ans'],[5,'5 ans']].map(([n,label]) => (
              <View key={n} style={{ flex:1, alignItems:'center' }}>
                <Text style={{ fontSize:11, color:C.g3 }}>{label}</Text>
                <Text style={{ fontSize:14, fontWeight:'700', color:C.gpos, marginTop:3 }}>+{fmt(proj(n))}</Text>
              </View>
            ))}
          </View>
        </Card>
        <BtnPri>+ Nouveau rappel d'epargne</BtnPri>
      </ScrollView>
    </View>
  );
}

const BVC_LIST = ['ATW - Attijariwafa Bank','BCP - Banque Centrale Pop.','CIH - CIH Bank','IAM - Maroc Telecom','ATL - Attijari Leasing','LHM - Label Vie','BOA - Bank of Africa','ADH - Alliances','CMA - Ciments du Maroc','HPS - HPS','WAA - Wafa Assurance','MNG - Managem'];
const PEA_COLORS = [C.priD,'#006A50',C.pri,C.gpos,C.teal,'#4A8050'];

function SubPEA({ data, setData, onBack }) {
  const pea   = data.pea;
  const total = calcPEA(pea);
  const cout  = calcPEACout(pea);
  const [showAdd, setShowAdd] = useState(false);
  const [ticker, setTicker]   = useState('');
  const [pru,    setPru]      = useState('');
  const [qty,    setQty]      = useState('');
  const [cours,  setCours]    = useState('');

  function addTitre() {
    if (!ticker || !pru || !qty || !cours) return;
    const [tck, ...rest] = ticker.split(' - ');
    setData(d => ({ ...d, pea:[...d.pea, { ticker:tck, nom:rest.join(' '), pru:parseFloat(pru), cours:parseFloat(cours), qty:parseInt(qty,10) }] }));
    setShowAdd(false); setTicker(''); setPru(''); setQty(''); setCours('');
  }

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Compte PEA" subtitle="Bourse de Casablanca" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.pri, borderRadius:16, padding:16, marginBottom:12 }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Valeur du portefeuille</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26, marginVertical:4 }}>{fmt(total)}</Text>
          <View style={{ backgroundColor:C.priD, borderRadius:8, paddingHorizontal:10, paddingVertical:5, alignSelf:'flex-start' }}>
            <Text style={{ color:'#6EE7A0', fontSize:12, fontWeight:'600' }}>
              P&L : {cout>0?(total>=cout?'+':'')+fmt(total-cout)+' ('+pctDiff(total,cout).toFixed(1)+'%)':'N/A'}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor:C.accL, borderRadius:10, padding:12, borderLeftWidth:4, borderLeftColor:C.acc, marginBottom:12 }}>
          <Text style={{ fontWeight:'700', fontSize:12, color:C.goldD }}>Avantages du Compte PEA au Maroc</Text>
          <Text style={{ fontSize:11, color:C.goldD, marginTop:4 }}>Exoneration totale d'impot apres 5 ans - Plafond : 600 000 DH - Titres BVC uniquement</Text>
        </View>
        <Card style={{ padding:0, overflow:'hidden' }}>
          <View style={{ backgroundColor:C.pri, padding:8, flexDirection:'row' }}>
            {['Titre','PRU','Cours','P&L','Poids'].map((h, i) => (
              <Text key={i} style={{ flex:i===0?2.5:1, fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.85)', textAlign:i===0?'left':'right' }}>{h}</Text>
            ))}
          </View>
          {pea.map((t, i) => {
            const val   = t.cours * t.qty;
            const base  = t.pru   * t.qty;
            const diff  = val - base;
            const poids = total > 0 ? val / total * 100 : 0;
            return (
              <View key={i} style={{ padding:10, borderBottomWidth:1, borderBottomColor:C.g1, flexDirection:'row', alignItems:'center', gap:4 }}>
                <View style={{ flex:2.5 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                    <IconBox label={t.ticker} bg={PEA_COLORS[i%PEA_COLORS.length]} size={24} fs={7}/>
                    <Text style={{ fontSize:11, color:C.dark, fontWeight:'600' }}>{t.ticker}</Text>
                  </View>
                  <Text style={{ fontSize:9, color:C.g3, marginTop:2 }}>{t.qty} titres</Text>
                </View>
                <Text style={{ flex:1, textAlign:'right', fontSize:10, color:C.g3 }}>{t.pru.toFixed(0)}</Text>
                <Text style={{ flex:1, textAlign:'right', fontSize:10, fontWeight:'600' }}>{t.cours.toFixed(0)}</Text>
                <Text style={{ flex:1, textAlign:'right', fontSize:11, fontWeight:'700', color:diff>=0?C.gpos:C.rneg }}>
                  {diff>=0?'+':''}{pctDiff(val,base).toFixed(1)}%
                </Text>
                <View style={{ flex:1, alignItems:'flex-end' }}>
                  <View style={{ backgroundColor:C.priL, borderRadius:4, paddingHorizontal:4, paddingVertical:2 }}>
                    <Text style={{ fontSize:9, fontWeight:'700', color:C.pri }}>{poids.toFixed(1)}%</Text>
                  </View>
                  <View style={{ marginTop:3 }}>
                    <BarH pct={Math.min(poids*4,100)} color={PEA_COLORS[i%PEA_COLORS.length]} height={3}/>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
        {showAdd ? (
          <Card style={{ borderWidth:1.5, borderColor:C.pri, marginTop:8 }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:12 }}>Ajouter un titre BVC</Text>
            <SelectInput label="Action cotee BVC" value={ticker} onChange={setTicker} options={['Selectionner...'].concat(BVC_LIST)}/>
            <Input label="Prix d'achat unitaire (DH)" value={pru}   onChangeText={setPru}   keyboardType="numeric" placeholder="124.50"/>
            <Input label="Cours actuel (DH)"          value={cours} onChangeText={setCours} keyboardType="numeric" placeholder="128.20"/>
            <Input label="Quantite (actions)"         value={qty}   onChangeText={setQty}   keyboardType="numeric" placeholder="80"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={() => setShowAdd(false)} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={addTitre} disabled={!ticker||!pru||!qty||!cours} style={{ flex:1 }}>Ajouter</BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)} style={{ marginTop:8 }}>+ Ajouter un actif financier</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

function SubCT({ data, onBack }) {
  const ct    = data.ct;
  const total = calcCT(ct);
  const cout  = calcCTCout(ct);
  const [tab, setTab] = useState('actions');
  const CT_COLORS  = [C.navy,'#2850B0','#3060C0'];
  const OPC_COLORS = [C.pri, C.teal, C.gpos];

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Compte-Titre" subtitle="Actions & OPCVM" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.navy, borderRadius:16, padding:16, marginBottom:12 }}>
          <Text style={{ color:'rgba(180,190,230,0.9)', fontSize:12 }}>Valeur du portefeuille</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:24, marginVertical:4 }}>{fmt(total)}</Text>
          <View style={{ backgroundColor:'rgba(20,40,110,0.8)', borderRadius:8, paddingHorizontal:10, paddingVertical:5, alignSelf:'flex-start' }}>
            <Text style={{ color:'#90B8FF', fontSize:12, fontWeight:'600' }}>
              P&L : {cout>0?(total>=cout?'+':'')+fmt(total-cout)+' ('+pctDiff(total,cout).toFixed(1)+'%)':'N/A'}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor:'#FEE8E8', borderRadius:10, padding:10, borderLeftWidth:4, borderLeftColor:C.sec, marginBottom:12 }}>
          <Text style={{ fontSize:12, fontWeight:'700', color:C.sec }}>Compte fiscalise</Text>
          <Text style={{ fontSize:11, color:'#800020', marginTop:3 }}>Les plus-values sont soumises a l'IR marocain. Pas d'exoneration fiscale contrairement au PEA apres 5 ans.</Text>
        </View>
        <View style={{ flexDirection:'row', backgroundColor:C.g1, borderRadius:8, padding:3, marginBottom:14 }}>
          {[['actions','Actions ('+ct.actions.length+')'],['opcvm','OPCVM ('+ct.opcvm.length+')']].map(([id,label]) => (
            <TouchableOpacity key={id} onPress={() => setTab(id)}
              style={{ flex:1, paddingVertical:8, alignItems:'center', borderRadius:6, backgroundColor:tab===id?C.navy:C.g1 }} activeOpacity={0.8}>
              <Text style={{ fontWeight:tab===id?'700':'400', fontSize:12, color:tab===id?C.white:C.g3 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {tab==='actions' && ct.actions.map((t, i) => {
          const val=t.cours*t.qty, base=t.pru*t.qty, poids=total>0?val/total*100:0;
          return (
            <Card key={i} style={{ paddingHorizontal:14, paddingVertical:10 }}>
              <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                <IconBox label={t.ticker} bg={CT_COLORS[i%CT_COLORS.length]} size={32} fs={8}/>
                <View style={{ flex:1 }}>
                  <Text style={{ fontWeight:'600', fontSize:12 }}>{t.nom}</Text>
                  <Text style={{ fontSize:10, color:C.g3 }}>Qte: {t.qty} - PRU: {t.pru} - Cours: {t.cours}</Text>
                  <View style={{ marginTop:4 }}>
                    <BarH pct={Math.min(poids*4,100)} color={CT_COLORS[i%CT_COLORS.length]} height={3}/>
                  </View>
                </View>
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:val>=base?C.gpos:C.rneg }}>{val>=base?'+':''}{pctDiff(val,base).toFixed(1)}%</Text>
                  <View style={{ backgroundColor:C.navyL, borderRadius:4, paddingHorizontal:5, paddingVertical:1, marginTop:3 }}>
                    <Text style={{ fontSize:9, fontWeight:'700', color:C.navy }}>{poids.toFixed(1)}% poids</Text>
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
        {tab==='opcvm' && ct.opcvm.map((o, i) => {
          const val=o.vl*o.parts, poids=total>0?val/total*100:0;
          return (
            <Card key={i} style={{ padding:10 }}>
              <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                <IconBox label="OPC" bg={OPC_COLORS[i%OPC_COLORS.length]} size={32} fs={7}/>
                <View style={{ flex:1 }}>
                  <Text style={{ fontWeight:'600', fontSize:12 }}>{o.nom}</Text>
                  <Text style={{ fontSize:10, color:C.g3 }}>{o.parts} parts - VL: {fmt(o.vl)}/part - {o.type}</Text>
                </View>
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={{ fontWeight:'700', fontSize:12 }}>{fmt(val)}</Text>
                  <View style={{ backgroundColor:C.priL, borderRadius:4, paddingHorizontal:5, paddingVertical:1, marginTop:3 }}>
                    <Text style={{ fontSize:9, fontWeight:'700', color:C.pri }}>{poids.toFixed(1)}% poids</Text>
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
        <BtnPri style={{ marginTop:8 }}>+ Ajouter un actif financier</BtnPri>
      </ScrollView>
    </View>
  );
}

function SubOr({ data, setData, onBack }) {
  const or     = data.or;
  const prixOr = data.prixOr;
  const total  = calcOr(or, prixOr);
  const [showAdd, setShowAdd] = useState(false);
  const [nom, setNom] = useState('');
  const [qty, setQty] = useState('');
  const [pa,  setPa]  = useState('');
  const [po,  setPo]  = useState('');

  function addOr() {
    if (!nom || !qty || !pa) return;
    setData(d => ({ ...d, or:[...d.or, { id:Date.now(), nom, quantite:parseFloat(qty), unite:'g', prixAchat:parseFloat(pa), prixOffert:po?parseFloat(po):null }] }));
    setShowAdd(false); setNom(''); setQty(''); setPa(''); setPo('');
  }

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
          <Text style={{ fontSize:10, color:C.goldD, marginTop:2 }}>Source : BAM + LBMA - 1 kg = {fmt(prixOr*1000)}</Text>
        </View>
        <SectionTitle>Mes stocks d'or</SectionTitle>
        {or.map((o, i) => {
          const ve=o.quantite*prixOr, vr=Math.max(ve,o.prixOffert||0);
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
              <InfoRow label="Prix d'achat"            value={fmt(o.prixAchat)}/>
              <InfoRow label="Valeur estimative (cours J)" value={fmt(ve)}/>
              {o.prixOffert ? <InfoRow label="Prix offert" value={fmt(o.prixOffert)}/> : null}
              <View style={{ backgroundColor:C.goldL, borderRadius:6, padding:8, marginTop:6, flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ fontSize:12, fontWeight:'700', color:C.goldD }}>Valeur retenue</Text>
                <Text style={{ fontSize:13, fontWeight:'700', color:C.gold }}>{fmt(vr)}</Text>
              </View>
            </Card>
          );
        })}
        {showAdd ? (
          <Card style={{ borderWidth:1.5, borderColor:C.gold }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>Ajouter un stock d'or</Text>
            <Input label="Designation"           value={nom} onChangeText={setNom} placeholder="Lingot 100g, Pieces 18K..."/>
            <Input label="Quantite (grammes)"    value={qty} onChangeText={setQty} keyboardType="numeric" placeholder="100" unit="g"/>
            <Input label="Prix d'achat (DH)"     value={pa}  onChangeText={setPa}  keyboardType="numeric" placeholder="85000"/>
            <Input label="Prix offert (optionnel)" value={po} onChangeText={setPo} keyboardType="numeric" placeholder="Laisser vide"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={() => setShowAdd(false)} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={addOr} disabled={!nom||!qty||!pa} style={{ flex:1, backgroundColor:C.gold }}>Ajouter</BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)} style={{ marginTop:8, backgroundColor:C.gold }}>+ Ajouter un stock d'or</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

function SubImmobilier({ data, setData, onBack }) {
  const immo  = data.immobilier;
  const total = calcImmo(immo);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nom:'', type:'Bien bati', ville:'', surface:'', prixAchat:'', prixM2:'', prixOffert:'', meth:'estimatif' });
  const up = (k, v) => setForm(f => ({...f, [k]:v}));

  function addBien() {
    if (!form.nom || !form.prixAchat) return;
    setData(d => ({ ...d, immobilier:[...d.immobilier, {
      id:Date.now(), ...form,
      surface:parseFloat(form.surface)||0, prixAchat:parseFloat(form.prixAchat)||0,
      prixM2:parseFloat(form.prixM2)||0, prixOffert:form.prixOffert?parseFloat(form.prixOffert):null,
      datAchat:new Date().getFullYear().toString(), unite:'m2',
    }] }));
    setShowAdd(false);
    setForm({ nom:'', type:'Bien bati', ville:'', surface:'', prixAchat:'', prixM2:'', prixOffert:'', meth:'estimatif' });
  }

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Immobilier & Terrains" subtitle={immo.length+' bien(s)'} onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.pri, borderRadius:14, padding:14, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Valeur totale</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26 }}>{fmt(total)}</Text>
        </View>
        {immo.map((b, i) => {
          const ve=b.prixM2*b.surface, vr=valImmo(b);
          return (
            <Card key={i}>
              <View style={{ backgroundColor:C.priL, borderRadius:8, padding:10, flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                  <IconBox label={b.type==='Terrain'?'TRN':'APP'} bg={'#B46428'} size={34} fs={8}/>
                  <View>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.pri }}>{b.nom}</Text>
                    <Text style={{ fontSize:11, color:C.g3 }}>{b.type} - {b.ville} - {b.surface} {b.unite||'m2'}</Text>
                  </View>
                </View>
                <PLBadge value={vr} base={b.prixAchat}/>
              </View>
              <InfoRow label="Prix d'achat"      value={fmt(b.prixAchat)} sub={'Acquis en '+b.datAchat}/>
              <InfoRow label="Valeur estimative" value={fmt(ve)}           sub="Prix/m2 x Surface"/>
              <InfoRow label="Prix offert"       value={b.prixOffert?fmt(b.prixOffert):'N/A'} sub="Meilleure offre recue"/>
              <View style={{ backgroundColor:C.priL, borderRadius:6, padding:8, marginVertical:6, flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ fontSize:12, fontWeight:'700', color:C.pri }}>Valeur retenue</Text>
                <Text style={{ fontSize:13, fontWeight:'700', color:C.pri }}>{fmt(vr)}</Text>
              </View>
              <MethodSelector value={b.meth} onChange={m => setData(d => ({...d, immobilier:d.immobilier.map((x,j) => j===i?{...x,meth:m}:x)}))}/>
            </Card>
          );
        })}
        {showAdd ? (
          <Card style={{ borderWidth:1.5, borderColor:C.pri }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>Ajouter un bien</Text>
            <Input label="Designation"             value={form.nom}        onChangeText={v=>up('nom',v)}        placeholder="Appartement Gueliz"/>
            <SelectInput label="Type"              value={form.type}       onChange={v=>up('type',v)}           options={['Bien bati','Terrain']}/>
            <Input label="Ville"                   value={form.ville}      onChangeText={v=>up('ville',v)}      placeholder="Casablanca"/>
            <Input label="Surface (m2)"            value={form.surface}    onChangeText={v=>up('surface',v)}    keyboardType="numeric" unit="m2"/>
            <Input label="Prix d'achat (DH)"       value={form.prixAchat}  onChangeText={v=>up('prixAchat',v)}  keyboardType="numeric"/>
            <Input label="Prix au m2 du secteur"   value={form.prixM2}     onChangeText={v=>up('prixM2',v)}     keyboardType="numeric" unit="DH/m2"/>
            <Input label="Prix offert (optionnel)" value={form.prixOffert} onChangeText={v=>up('prixOffert',v)} keyboardType="numeric"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={() => setShowAdd(false)} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={addBien} disabled={!form.nom||!form.prixAchat} style={{ flex:1 }}>Ajouter</BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)}>+ Ajouter un bien</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

function SubTransport({ data, setData, onBack }) {
  const transport = data.transport;
  const total     = calcTransport(transport);
  return (
    <View style={{ flex:1 }}>
      <TopBar title="Biens de Transport" subtitle={transport.length+' vehicule(s)'} onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:'#50506A', borderRadius:14, padding:14, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(190,190,220,0.9)', fontSize:12 }}>Valeur totale</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26 }}>{fmt(total)}</Text>
        </View>
        <View style={{ backgroundColor:C.accL, borderRadius:10, padding:10, borderLeftWidth:4, borderLeftColor:C.acc, marginBottom:12 }}>
          <Text style={{ fontSize:11, color:C.goldD }}>Les vehicules perdent en moyenne 15-25% de valeur par an.</Text>
        </View>
        {transport.map((t, i) => {
          const vr = valTransport(t);
          return (
            <Card key={i}>
              <View style={{ backgroundColor:'#EAEAF0', borderRadius:8, padding:10, flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                  <IconBox label="VEH" bg={'#50506A'} size={34} fs={8}/>
                  <View>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>{t.nom}</Text>
                    <Text style={{ fontSize:11, color:C.g3 }}>{t.type} - {t.annee} - {t.immat}</Text>
                  </View>
                </View>
                <PLBadge value={vr} base={t.prixAchat}/>
              </View>
              <InfoRow label="Prix d'achat"             value={fmt(t.prixAchat)}   sub={'Achete en '+t.dateAchat}/>
              <InfoRow label="Valeur estimative marche" value={fmt(t.valEstim)}/>
              {t.prixOffert ? <InfoRow label="Prix offert" value={fmt(t.prixOffert)}/> : null}
              <View style={{ backgroundColor:'#EAEAF0', borderRadius:6, padding:8, marginVertical:6, flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ fontSize:12, fontWeight:'700', color:'#50506A' }}>Valeur retenue</Text>
                <Text style={{ fontSize:13, fontWeight:'700', color:'#50506A' }}>{fmt(vr)}</Text>
              </View>
              <MethodSelector value={t.meth} onChange={m => setData(d => ({...d, transport:d.transport.map((x,j) => j===i?{...x,meth:m}:x)}))}/>
            </Card>
          );
        })}
        <BtnPri style={{ backgroundColor:'#50506A' }}>+ Ajouter un vehicule</BtnPri>
      </ScrollView>
    </View>
  );
}

// ─── Page principale ─────────────────────────────────────────

const PageActifs = React.memo(function PageActifs({ data, setData, sub, setSub }) {
  const cats = useMemo(() => [
    { id:'liquide',    section:'Liquidites & Epargne',       label:'Argent Liquide & Devises', abbr:'LIQ', col:C.gpos,    val:calcLiquide(data.liquidites),    detail:'DH + '+data.liquidites.devises.length+' devises' },
    { id:'banque',     section:'Liquidites & Epargne',       label:'Argent en Banque',          abbr:'BNQ', col:C.navy,    val:calcBanque(data.banque),          detail:data.banque.length+' compte(s)' },
    { id:'carnet',     section:'Liquidites & Epargne',       label:'Compte sur Carnet',         abbr:'CRT', col:C.teal,    val:calcCarnet(data.carnet),          detail:'Rappels actifs' },
    { id:'pea',        section:'Investissements financiers',  label:'Compte PEA',                abbr:'PEA', col:C.pri,     val:calcPEA(data.pea),                detail:data.pea.length+' titres BVC' },
    { id:'ct',         section:'Investissements financiers',  label:'Compte-Titre',              abbr:'CT',  col:C.navy,    val:calcCT(data.ct),                  detail:data.ct.actions.length+' actions - '+data.ct.opcvm.length+' OPCVM' },
    { id:'or',         section:'Actifs reels',                label:'Or & Metaux Precieux',      abbr:'OR',  col:C.gold,    val:calcOr(data.or,data.prixOr),      detail:data.or.reduce((s,o)=>s+o.quantite,0)+' g au total' },
    { id:'immobilier', section:'Actifs reels',                label:'Immobilier & Terrains',     abbr:'IMM', col:'#B46428', val:calcImmo(data.immobilier),         detail:data.immobilier.length+' bien(s)' },
    { id:'transport',  section:'Actifs reels',                label:'Biens de Transport',        abbr:'VEH', col:'#50506A', val:calcTransport(data.transport),     detail:data.transport.length+' vehicule(s)' },
  ], [data]);

  const total = useMemo(() => cats.reduce((s, c) => s + c.val, 0), [cats]);

  if (sub==='liquide')    return <SubLiquide    data={data} setData={setData} onBack={() => setSub(null)}/>;
  if (sub==='banque')     return <SubBanque     data={data} setData={setData} onBack={() => setSub(null)}/>;
  if (sub==='carnet')     return <SubCarnet     data={data}                   onBack={() => setSub(null)}/>;
  if (sub==='pea')        return <SubPEA        data={data} setData={setData} onBack={() => setSub(null)}/>;
  if (sub==='ct')         return <SubCT         data={data}                   onBack={() => setSub(null)}/>;
  if (sub==='or')         return <SubOr         data={data} setData={setData} onBack={() => setSub(null)}/>;
  if (sub==='immobilier') return <SubImmobilier data={data} setData={setData} onBack={() => setSub(null)}/>;
  if (sub==='transport')  return <SubTransport  data={data} setData={setData} onBack={() => setSub(null)}/>;

  const sections = ['Liquidites & Epargne','Investissements financiers','Actifs reels'];
  return (
    <View style={{ flex:1 }}>
      <View style={{ backgroundColor:C.pri, padding:14 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Total patrimoine</Text>
          <Text style={{ color:'#6EE7A0', fontSize:11 }}>+14 200 DH (+0,74%)</Text>
        </View>
        <Text style={{ color:C.white, fontWeight:'700', fontSize:22 }}>{fmt(total)}</Text>
      </View>
      <ScrollView style={{ flex:1, backgroundColor:C.g1 }} contentContainerStyle={{ padding:12 }}>
        {sections.map(sec => (
          <View key={sec}>
            <Text style={{ fontSize:11, fontWeight:'600', color:C.g3, marginTop:14, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>{sec}</Text>
            {cats.filter(c => c.section===sec).map((c, i) => (
              <Card key={i} onPress={() => setSub(c.id)} style={{ padding:12 }}>
                <View style={{ flexDirection:'row', gap:10, alignItems:'center' }}>
                  <IconBox label={c.abbr} bg={c.col} size={38} fs={9}/>
                  <View style={{ flex:1 }}>
                    <Text style={{ fontWeight:'600', fontSize:13, color:C.dark }}>{c.label}</Text>
                    <Text style={{ fontSize:11, color:C.g3, marginTop:2 }}>{c.detail}</Text>
                  </View>
                  <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>{fmt(c.val)}</Text>
                  <Text style={{ color:C.g2, fontSize:20 }}>›</Text>
                </View>
              </Card>
            ))}
          </View>
        ))}
        <BtnPri style={{ marginTop:8 }}>+ Ajouter un actif</BtnPri>
      </ScrollView>
    </View>
  );
});

export default PageActifs;
