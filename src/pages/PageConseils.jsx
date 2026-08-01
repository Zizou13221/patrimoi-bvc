import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { C } from '../constants/colors';
import { generateConseils } from '../utils/conseils';
import { calcOr, calcImmo, calcPEA, calcCT, calcCarnet, calcLiquide, calcBanque } from '../utils/calc';
import { fmt } from '../utils/fmt';
import { Card, IconBox, BarH, SectionTitle, TopBar } from '../components/shared';
import { usePatrimoineStore } from '../store/patrimoineStore';
import { trackScoreSanteViewed } from '../utils/analytics';

const PageConseils = React.memo(function PageConseils({ onNav }) {
  const data                = usePatrimoineStore(s => s.data);
  // generateConseils retourne { conseils, total } — un seul useMemo
  const { conseils, total } = useMemo(() => generateConseils(data), [data]);

  // E12 — tracker le score santé une fois par session (pas à chaque re-render)
  const scoreFired = useRef(false);
  useEffect(() => {
    if (scoreFired.current || total === 0) return;
    scoreFired.current = true;
    try {
      const { calcOr: cO, calcImmo: cI, calcPEA: cP, calcCT: cC, calcCarnet: cCa, calcLiquide: cL, calcBanque: cB } = require('../utils/calc');
      const orVal = cO(data.or, data.prixOr), immoVal = cI(data.immobilier);
      const peaVal = cP(data.pea), ctVal = cC(data.ct), carnetV = cCa(data.carnet);
      const liqV = cL(data.liquidites) + cB(data.banque);
      const bvcTotal = peaVal + ctVal;
      const classes4 = [orVal, immoVal, bvcTotal, liqV + carnetV];
      const presence  = classes4.filter(v => v > 0).length * 25;
      const maxCR     = total > 0 ? Math.max(...classes4.map(v => v / total)) : 0;
      const divScore  = Math.max(0, Math.min(100, presence - (maxCR > 0.65 ? ((maxCR - 0.65) / 0.35) * 45 : 0)));
      const liqRatio  = total > 0 ? liqV / total : 0;
      const liqScore  = liqRatio >= 0.10 && liqRatio <= 0.20 ? 100 : liqRatio < 0.10 ? (liqRatio / 0.10) * 100 : Math.max(0, 100 - (liqRatio - 0.20) / 0.20 * 100);
      const carnRatio = total > 0 ? carnetV / total : 0;
      const epScore   = Math.min(100, carnRatio >= 0.10 ? 100 : (carnRatio / 0.10) * 100);
      const bvcRatio  = total > 0 ? bvcTotal / total : 0;
      const bvcScore  = Math.min(100, bvcRatio >= 0.15 ? 100 : (bvcRatio / 0.15) * 100);
      // rendement passif + budget : valeurs neutres pour l'analytics (évite dépendances complexes)
      const globalScore = Math.round(divScore*0.25 + liqScore*0.20 + epScore*0.20 + bvcScore*0.15 + 37.5*0.15 + 50*0.05);
      trackScoreSanteViewed(globalScore);
    } catch {}
  }, [data, total]); // eslint-disable-line

  const priorityLabel = (p) => p === 1 ? 'Urgent' : p === 2 ? 'Important' : 'À considérer';
  const priorityBg    = (p) => p === 1 ? '#FFF0F0' : p === 2 ? '#FFF8E8' : '#F0F8FF';

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Conseils & Ressources" subtitle="Basés sur votre vrai portfolio"/>

      {/* ── Disclaimer AMMC ───────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: 'rgba(231,76,60,0.07)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(231,76,60,0.18)',
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}>
        <Text style={{ fontSize: 11, color: '#C0392B', lineHeight: 17 }}>
          ⚠️ À titre informatif uniquement — non constitutif d'un conseil en investissement au sens de la réglementation AMMC. Consultez un professionnel avant toute décision financière.
        </Text>
      </View>

      <ScrollView style={{ flex:1, backgroundColor:C.g1 }} contentContainerStyle={{ padding:12 }}>

        {conseils.length > 0 ? (
          <>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 }}>
              <View style={{ width:8, height:8, borderRadius:4, backgroundColor:C.gpos }}/>
              <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>
                {conseils.length} piste{conseils.length > 1 ? 's' : ''} d'optimisation
              </Text>
            </View>
            {conseils.map((c) => (
              <Card key={c.id} style={{ borderLeftWidth:4, borderLeftColor:c.couleur, backgroundColor:priorityBg(c.priority), marginBottom:10 }}>
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8, flex:1, marginRight:8 }}>
                    <View style={{ width:28, height:28, borderRadius:14, backgroundColor:c.couleur, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Text style={{ color:C.white, fontWeight:'700', fontSize:12 }}>{c.icon}</Text>
                    </View>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, flex:1 }} numberOfLines={2}>{c.titre}</Text>
                  </View>
                  <View style={{ backgroundColor:c.couleur+'22', borderRadius:6, paddingHorizontal:7, paddingVertical:2, flexShrink:0 }}>
                    <Text style={{ fontSize:9, fontWeight:'700', color:c.couleur }} numberOfLines={1}>{priorityLabel(c.priority)}</Text>
                  </View>
                </View>
                <Text style={{ fontSize:12, color:C.dark, lineHeight:18, marginBottom:10 }}>{c.corps}</Text>
                {c.action && (
                  <TouchableOpacity
                    onPress={() => { onNav(c.nav, c.sub); }}
                    style={{ backgroundColor:c.couleur, borderRadius:8, paddingVertical:8, alignItems:'center' }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color:C.white, fontWeight:'700', fontSize:12 }}>{c.action} →</Text>
                  </TouchableOpacity>
                )}
              </Card>
            ))}
          </>
        ) : (
          <Card style={{ backgroundColor:C.priL, borderLeftWidth:4, borderLeftColor:C.pri, marginBottom:14 }}>
            <Text style={{ fontWeight:'700', fontSize:13, color:C.pri, marginBottom:4 }}>Excellent travail !</Text>
            <Text style={{ fontSize:12, color:C.dark }}>Votre portfolio est bien équilibré. Continuez à alimenter votre PEA et à diversifier.</Text>
          </Card>
        )}

        {/* Score de santé patrimoniale — 6 dimensions pondérées */}
        {(() => {
          const orVal   = calcOr(data.or, data.prixOr);
          const immoVal = calcImmo(data.immobilier);
          const peaVal  = calcPEA(data.pea);
          const ctVal   = calcCT(data.ct);
          const carnetV = calcCarnet(data.carnet);
          const liqV    = calcLiquide(data.liquidites) + calcBanque(data.banque);
          const now     = new Date();

          // ── 1. Diversification : présence × 25 pts – pénalité si 1 classe > 65 % ──
          const bvcTotal = peaVal + ctVal;
          const defVal   = liqV + carnetV;                  // actifs défensifs (liquid + carnet)
          const classes4 = [orVal, immoVal, bvcTotal, defVal];
          const nClasses = classes4.filter(v => v > 0).length;
          const presence = nClasses * 25;
          const maxCR    = total > 0 ? Math.max(...classes4.map(v => v / total)) : 0;
          const concentP = maxCR > 0.65 ? ((maxCR - 0.65) / 0.35) * 45 : 0;
          const divScore = Math.max(0, Math.min(100, presence - concentP));

          // ── 2. Liquidité optimale : [10 %–20 %] = 100, pénalité hors plage ──
          const liqRatio = total > 0 ? liqV / total : 0;
          let liqScore;
          if (liqRatio >= 0.10 && liqRatio <= 0.20)  liqScore = 100;
          else if (liqRatio < 0.10)                   liqScore = (liqRatio / 0.10) * 100;
          else                                         liqScore = Math.max(0, 100 - (liqRatio - 0.20) / 0.20 * 100);

          // ── 3. Épargne de précaution : mois couverts (cible 3–6 mois) ──
          const threeMAgo  = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          const recentDeps = (data.operations || []).filter(op =>
            op.type === 'depense' && new Date(op.date) >= threeMAgo
          );
          const avgMonDep   = recentDeps.length > 0
            ? recentDeps.reduce((s, op) => s + Math.abs(op.montant || 0), 0) / 3
            : 0;
          const moisCouv    = avgMonDep > 0 ? defVal / avgMonDep : null;
          const carnRatio   = total > 0 ? carnetV / total : 0;
          let epargneScore;
          if (moisCouv !== null) {
            if (moisCouv >= 6)      epargneScore = 100;
            else if (moisCouv >= 3) epargneScore = 70 + ((moisCouv - 3) / 3) * 30;
            else                    epargneScore = Math.max(0, (moisCouv / 3) * 70);
          } else {
            epargneScore = Math.min(100, carnRatio >= 0.10 ? 100 : (carnRatio / 0.10) * 100);
          }

          // ── 4. Investissements BVC — PEA + CT, cible 15 % ──
          const bvcRatio = total > 0 ? bvcTotal / total : 0;
          const bvcScore = Math.min(100, bvcRatio >= 0.15 ? 100 : (bvcRatio / 0.15) * 100);

          // ── 5. Rendement passif : (intérêts + loyers + dividendes) / total, cible ≥ 3 % ──
          const interets   = (data.carnet || []).reduce((s, c) => s + (c.solde || 0) * ((c.taux || 0) / 100), 0);
          const loyers     = (data.revenus_recurrents || [])
            .filter(r => r.actif !== false && r.label?.toLowerCase().includes('loyer'))
            .reduce((s, r) => s + (r.montant || 0) * 12, 0);
          const dividendes = (data.operations || [])
            .filter(op => op.type === 'revenu' && op.categorie === 'dividende' && new Date(op.date).getFullYear() === now.getFullYear())
            .reduce((s, op) => s + Math.abs(op.montant || 0), 0);
          const revPassif  = interets + loyers + dividendes;
          const rendPct    = total > 0 ? (revPassif / total) * 100 : 0;
          let rendScore;
          if (rendPct >= 5)      rendScore = 100;
          else if (rendPct >= 3) rendScore = 75 + ((rendPct - 3) / 2) * 25;
          else                   rendScore = (rendPct / 3) * 75;

          // ── 6. Équilibre budgétaire : solde du mois précédent ──
          const lastMS = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const thisMS = new Date(now.getFullYear(), now.getMonth(), 1);
          const opsLM  = (data.operations || []).filter(op => {
            const d = new Date(op.date);
            return d >= lastMS && d < thisMS;
          });
          let budgetScore = 50; // neutre si pas de données
          if (opsLM.length > 0) {
            const revM = opsLM.filter(op => op.type === 'revenu').reduce((s, op)  => s + Math.abs(op.montant || 0), 0);
            const depM = opsLM.filter(op => op.type === 'depense').reduce((s, op) => s + Math.abs(op.montant || 0), 0);
            if (depM > 0) {
              const sR = (revM - depM) / depM;
              if (sR >= 0.20)   budgetScore = 100;
              else if (sR >= 0) budgetScore = 50 + (sR / 0.20) * 50;
              else              budgetScore = Math.max(0, 50 + (sR / 0.30) * 50);
            } else if (revM > 0) budgetScore = 100;
          }
          const budgetHint = opsLM.length > 0
            ? (budgetScore >= 75 ? 'Excédentaire ✓' : budgetScore >= 50 ? 'Équilibré' : 'Déficitaire ⚠')
            : 'Données insuffisantes';

          // ── Score global pondéré ──
          // Div 25 % · Liq 20 % · Épargne 20 % · BVC 15 % · Rendement 15 % · Budget 5 %
          const globalScore = Math.round(
            divScore     * 0.25 +
            liqScore     * 0.20 +
            epargneScore * 0.20 +
            bvcScore     * 0.15 +
            rendScore    * 0.15 +
            budgetScore  * 0.05
          );
          const scoreColor = globalScore >= 80 ? C.gpos : globalScore >= 65 ? C.pri : globalScore >= 50 ? C.gold : C.rneg;
          const scoreLabel = globalScore >= 80 ? 'Excellent' : globalScore >= 65 ? 'Très bien' : globalScore >= 50 ? 'Passable' : 'À améliorer';

          const scores = [
            { label:'Diversification',      pct: divScore,     col: C.pri,     hint: `${nClasses}/4 classes${maxCR > 0.65 ? ` · ⚠ conc. ${(maxCR*100).toFixed(0)}%` : ''}` },
            { label:'Liquidité optimale',    pct: liqScore,     col: C.gpos,    hint: `${(liqRatio*100).toFixed(1)}% / cible 10–20%` },
            { label:'Épargne de précaution', pct: epargneScore, col: C.teal,    hint: moisCouv !== null ? `${moisCouv.toFixed(1)} mois couverts (cible 3–6)` : `${(carnRatio*100).toFixed(1)}% patrimoine` },
            { label:'Investissements BVC',   pct: bvcScore,     col: C.navy,    hint: `${(bvcRatio*100).toFixed(1)}% / objectif 15%` },
            { label:'Rendement passif',      pct: rendScore,    col: '#8B4BD4', hint: `${rendPct.toFixed(2)}% / an (cible ≥ 3%)` },
            { label:'Équilibre budgétaire',  pct: budgetScore,  col: C.acc,     hint: budgetHint },
          ];

          return (
            <Card style={{ marginBottom:14 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>Score de santé patrimoniale</Text>
                <View style={{ backgroundColor: scoreColor + '22', borderRadius:10, paddingHorizontal:10, paddingVertical:4, alignItems:'center' }}>
                  <Text style={{ fontWeight:'800', fontSize:18, color:scoreColor }}>{globalScore}</Text>
                  <Text style={{ fontSize:9, fontWeight:'600', color:scoreColor }}>{scoreLabel}</Text>
                </View>
              </View>
              {scores.map((s, i) => (
                <View key={i} style={{ marginBottom:8 }}>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:2 }}>
                    <Text style={{ fontSize:11, color:C.dark }}>{s.label}</Text>
                    <Text style={{ fontSize:10, color:C.g3 }}>{s.hint}</Text>
                  </View>
                  <BarH pct={s.pct} color={s.col} height={6}/>
                </View>
              ))}
            </Card>
          );
        })()}

        {/* Guides thématiques */}
        <SectionTitle>Guides thématiques</SectionTitle>
        <View style={{ flexDirection:'row', gap:10, marginBottom:6 }}>
          {[
            { abbr:'BVC', col:C.pri,    title:'Investir à la BVC',      sub:'Débutant à Confirmé',    url:'https://www.casablanca-bourse.com' },
            { abbr:'IMM', col:'#B46428',title:'Fiscalité immobilière',   sub:'Calculer vos plus-values', url:'https://www.mubawab.ma' },
          ].map((g, i) => (
            <Card key={i} style={{ flex:1, marginBottom:0 }} onPress={() => Alert.alert('Ouvrir le lien', `Vous allez quitter PatriMoi pour aller sur ${g.url}`, [{ text:'Annuler', style:'cancel' }, { text:'Ouvrir', onPress:() => Linking.openURL(g.url).catch(() => Alert.alert('Erreur','Impossible d\'ouvrir le lien.')) }])}>
              <IconBox label={g.abbr} bg={g.col} size={32} fs={9}/>
              <Text style={{ fontWeight:'700', fontSize:12, marginTop:8 }}>{g.title}</Text>
              <Text style={{ fontSize:10, color:C.g3 }}>{g.sub}</Text>
            </Card>
          ))}
        </View>
        <View style={{ flexDirection:'row', gap:10, marginBottom:14 }}>
          {[
            { abbr:'OPC', col:C.teal,   title:'Comprendre les OPCVM',   sub:'Fonds, VL, rendements',  url:'https://www.opcvm.ma' },
            { abbr:'EPN', col:C.acc,    title:'Optimiser votre épargne', sub:'PEA, Carnet, intérêts',  url:'https://www.bkam.ma' },
          ].map((g, i) => (
            <Card key={i} style={{ flex:1, marginBottom:0 }} onPress={() => Alert.alert('Ouvrir le lien', `Vous allez quitter PatriMoi pour aller sur ${g.url}`, [{ text:'Annuler', style:'cancel' }, { text:'Ouvrir', onPress:() => Linking.openURL(g.url).catch(() => Alert.alert('Erreur','Impossible d\'ouvrir le lien.')) }])}>
              <IconBox label={g.abbr} bg={g.col} size={32} fs={9}/>
              <Text style={{ fontWeight:'700', fontSize:12, marginTop:8 }}>{g.title}</Text>
              <Text style={{ fontSize:10, color:C.g3 }}>{g.sub}</Text>
            </Card>
          ))}
        </View>

        {/* Sources officielles */}
        <SectionTitle>Sources officielles</SectionTitle>
        {[
          { abbr:'BVC', col:C.pri,     url:'casablanca-bourse.com', href:'https://www.casablanca-bourse.com', desc:'Cours officiels BVC' },
          { abbr:'AMC', col:C.sec,     url:'ammc.ma',               href:'https://www.ammc.ma',              desc:'Régulateur des marchés' },
          { abbr:'BAM', col:C.navy,    url:'bkam.ma',               href:'https://www.bkam.ma',              desc:'Bank Al-Maghrib' },
          { abbr:'IMB', col:C.teal,    url:'mubawab.ma',            href:'https://www.mubawab.ma',           desc:'Prix immobilier Maroc' },
          { abbr:'OPC', col:C.priD,    url:'opcvm.ma',              href:'https://www.opcvm.ma',             desc:'Valeurs liquidatives OPCVM' },
          { abbr:'YAK', col:'#1A6B3C', url:'yakeey.ma',             href:'https://www.yakeey.ma',            desc:'Immobilier Maroc — Yakeey' },
        ].map((s, i) => (
          <Card key={i} style={{ padding:10 }} onPress={() => Alert.alert('Ouvrir le lien', `Vous allez quitter PatriMoi pour ${s.url}`, [{ text:'Annuler', style:'cancel' }, { text:'Ouvrir', onPress:() => Linking.openURL(s.href).catch(() => Alert.alert('Erreur','Impossible d\'ouvrir le lien.')) }])}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'center' }}>
              <IconBox label={s.abbr} bg={s.col} size={34} fs={8}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'600', fontSize:13 }}>{s.url}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>{s.desc}</Text>
              </View>
              <Text style={{ color:C.g2, fontSize:20 }}>›</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
});

export default PageConseils;
