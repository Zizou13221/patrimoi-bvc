import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { C } from '../constants/colors';
import { generateConseils } from '../utils/conseils';
import { calcOr, calcImmo, calcPEA, calcCT, calcCarnet, calcLiquide, calcBanque } from '../utils/calc';
import { fmt } from '../utils/fmt';
import { Card, IconBox, BarH, SectionTitle, TopBar } from '../components/shared';

const PageConseils = React.memo(function PageConseils({ data, onNav }) {
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
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                    <View style={{ width:28, height:28, borderRadius:14, backgroundColor:c.couleur, alignItems:'center', justifyContent:'center' }}>
                      <Text style={{ color:C.white, fontWeight:'700', fontSize:12 }}>{c.icon}</Text>
                    </View>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, flex:1, flexShrink:1 }}>{c.titre}</Text>
                  </View>
                  <View style={{ backgroundColor:c.couleur+'22', borderRadius:6, paddingHorizontal:7, paddingVertical:2 }}>
                    <Text style={{ fontSize:9, fontWeight:'700', color:c.couleur }}>{priorityLabel(c.priority)}</Text>
                  </View>
                </View>
                <Text style={{ fontSize:12, color:C.dark, lineHeight:18, marginBottom:10 }}>{c.corps}</Text>
                {c.action && (
                  <TouchableOpacity
                    onPress={() => onNav(c.nav, c.sub)}
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
        <Card style={{ marginBottom:14 }}>
          <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, marginBottom:10 }}>Score de santé de votre patrimoine</Text>
          {[
            { label:'Diversification',      pct:Math.min(100,(calcOr(data.or,data.prixOr)>0?25:0)+(calcImmo(data.immobilier)>0?25:0)+(calcPEA(data.pea)>0?25:0)+(calcCT(data.ct)>0?25:0)), col:C.pri },
            { label:'Épargne réglementée',  pct:Math.min(100,calcCarnet(data.carnet)>0?80:10), col:C.teal },
            { label:'Investissements BVC',  pct:Math.min(100,total>0?(calcPEA(data.pea)+calcCT(data.ct))/total*300:0), col:C.navy },
            { label:'Liquidité optimale',   pct:Math.min(100,total>0?Math.max(0,100-Math.abs(((calcLiquide(data.liquidites)+calcBanque(data.banque))/total*100)-15)*4):0), col:C.gpos },
          ].map((s, i) => (
            <View key={i} style={{ marginBottom:8 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:3 }}>
                <Text style={{ fontSize:11, color:C.dark }}>{s.label}</Text>
                <Text style={{ fontSize:11, fontWeight:'700', color:s.col }}>{Math.round(s.pct)}%</Text>
              </View>
              <BarH pct={s.pct} color={s.col} height={6}/>
            </View>
          ))}
        </Card>

        {/* Guides thématiques */}
        <SectionTitle>Guides thématiques</SectionTitle>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:14 }}>
          {[
            { abbr:'BVC', col:C.pri,    title:'Investir à la BVC',      sub:'Débutant à Confirmé' },
            { abbr:'IMM', col:'#B46428',title:'Fiscalité immobilière',   sub:'Calculer vos plus-values' },
            { abbr:'OPC', col:C.teal,   title:'Comprendre les OPCVM',   sub:'Fonds, VL, rendements' },
            { abbr:'EPN', col:C.acc,    title:'Optimiser votre épargne', sub:'PEA, Carnet, intérêts' },
          ].map((g, i) => (
            <Card key={i} style={{ width:'47%', margin:0 }}>
              <IconBox label={g.abbr} bg={g.col} size={32} fs={9}/>
              <Text style={{ fontWeight:'700', fontSize:12, marginTop:8 }}>{g.title}</Text>
              <Text style={{ fontSize:10, color:C.g3 }}>{g.sub}</Text>
            </Card>
          ))}
        </View>

        {/* Sources officielles */}
        <SectionTitle>Sources officielles</SectionTitle>
        {[
          { abbr:'BVC', col:C.pri,  url:'casablanca-bourse.com', desc:'Cours officiels BVC' },
          { abbr:'AMC', col:C.sec,  url:'ammc.ma',               desc:'Régulateur des marchés' },
          { abbr:'BAM', col:C.navy, url:'bkam.ma',               desc:'Bank Al-Maghrib' },
          { abbr:'IMB', col:C.teal, url:'mubawab.ma',            desc:'Prix immobilier Maroc' },
          { abbr:'OPC', col:C.priD, url:'opcvm.ma',              desc:'Valeurs liquidatives OPCVM' },
        ].map((s, i) => (
          <Card key={i} style={{ padding:10 }}>
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
