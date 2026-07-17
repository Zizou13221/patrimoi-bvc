import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { C } from '../constants/colors';
import { generateConseils } from '../utils/conseils';
import { calcOr, calcImmo, calcPEA, calcCT, calcCarnet, calcLiquide, calcBanque } from '../utils/calc';
import { fmt } from '../utils/fmt';
import { Card, IconBox, BarH, SectionTitle, TopBar } from '../components/shared';
import { usePatrimoineStore } from '../store/patrimoineStore';

const PageConseils = React.memo(function PageConseils({ onNav }) {
  const data                = usePatrimoineStore(s => s.data);
  // generateConseils retourne { conseils, total } — un seul useMemo
  const { conseils, total } = useMemo(() => generateConseils(data), [data]);

  const priorityLabel = (p) => p === 1 ? 'Urgent' : p === 2 ? 'Important' : 'À considérer';
  const priorityBg    = (p) => p === 1 ? '#FFF0F0' : p === 2 ? '#FFF8E8' : '#F0F8FF';

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Conseils & Ressources" subtitle="Basés sur votre vrai portfolio"/>
      <ScrollView style={{ flex:1, backgroundColor:C.g1 }} contentContainerStyle={{ padding:12 }}>

        {conseils.length > 0 ? (
          <>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 }}>
              <View style={{ width:8, height:8, borderRadius:4, backgroundColor:C.gpos }}/>
              <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>
                {conseils.length} recommandation{conseils.length > 1 ? 's' : ''} pour vous
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

        {/* Score de santé patrimoine */}
        {(() => {
          const orVal    = calcOr(data.or, data.prixOr);
          const immoVal  = calcImmo(data.immobilier);
          const peaVal   = calcPEA(data.pea);
          const ctVal    = calcCT(data.ct);
          const carnetV  = calcCarnet(data.carnet);
          const liqV     = calcLiquide(data.liquidites) + calcBanque(data.banque);

          // Diversification : 25 pts par classe présente, pondérée par le poids (max 100%)
          const divScore = Math.min(100,
            (orVal > 0    ? Math.min(25, 10 + (orVal/total)*150)    : 0) +
            (immoVal > 0  ? Math.min(25, 10 + (immoVal/total)*50)   : 0) +
            (peaVal > 0   ? Math.min(25, 10 + (peaVal/total)*150)   : 0) +
            (ctVal > 0    ? Math.min(25, 10 + (ctVal/total)*150)    : 0)
          );
          // Épargne réglementée : cible 10% du patrimoine en carnet
          const carnRatio  = total > 0 ? carnetV / total : 0;
          const carnScore  = Math.min(100, carnRatio >= 0.10 ? 100 : (carnRatio / 0.10) * 100);
          // Investissements BVC : cible 15% en PEA+CT
          const bvcRatio   = total > 0 ? (peaVal + ctVal) / total : 0;
          const bvcScore   = Math.min(100, bvcRatio >= 0.15 ? 100 : (bvcRatio / 0.15) * 100);
          // Liquidité optimale : cible 10-20%, pénalité symétrique
          const liqRatio   = total > 0 ? liqV / total : 0;
          const liqTarget  = 0.15;
          const liqScore   = Math.min(100, Math.max(0, 100 - Math.abs(liqRatio - liqTarget) / liqTarget * 100));

          const scores = [
            { label:'Diversification',     pct: divScore,  col: C.pri,  hint: `${[orVal>0?'Or':null,immoVal>0?'Immo':null,peaVal>0?'PEA':null,ctVal>0?'CT':null].filter(Boolean).join(', ')||'Aucune classe'}` },
            { label:'Épargne réglementée', pct: carnScore, col: C.teal, hint: `${(carnRatio*100).toFixed(1)}% / objectif 10%` },
            { label:'Investissements BVC', pct: bvcScore,  col: C.navy, hint: `${(bvcRatio*100).toFixed(1)}% / objectif 15%` },
            { label:'Liquidité optimale',  pct: liqScore,  col: C.gpos, hint: `${(liqRatio*100).toFixed(1)}% / cible 10-20%` },
          ];
          const globalScore = Math.round(scores.reduce((s, x) => s + x.pct, 0) / scores.length);
          const scoreColor  = globalScore >= 75 ? C.gpos : globalScore >= 50 ? C.gold : C.rneg;
          const scoreLabel  = globalScore >= 75 ? 'Excellent' : globalScore >= 50 ? 'Passable' : 'À améliorer';

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
