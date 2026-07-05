import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { C } from '../constants/colors';
import { PROVERBES } from '../constants/data';
import { totalPatrimoine, calcPEA, calcCT, calcBanque, calcCarnet, calcLiquide, calcImmo, calcOr } from '../utils/calc';
import { fmt } from '../utils/fmt';
import { Card, SectionTitle } from '../components/shared';

const PageProverbe = React.memo(function PageProverbe({ onNav, data }) {
  const today     = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const prv       = PROVERBES[dayOfYear % PROVERBES.length];
  const initials  = prv.a.split(' ').map(w => w[0]).slice(0, 2).join('');
  const total     = useMemo(() => totalPatrimoine(data), [data]);

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor:C.pri, padding:16 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
          <View>
            <Text style={{ color:C.white, fontWeight:'700', fontSize:16 }}>Bonjour, Mohammed !</Text>
            <Text style={{ color:'rgba(255,255,255,0.75)', fontSize:11, marginTop:3 }}>
              {today.toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </Text>
          </View>
          <View style={{ backgroundColor:'rgba(255,255,255,0.15)', borderRadius:8, paddingHorizontal:10, paddingVertical:5, alignItems:'flex-end' }}>
            <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:10 }}>Patrimoine total</Text>
            <Text style={{ color:C.white, fontWeight:'700', fontSize:15 }}>{fmt(total)}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => onNav('actifs')}
          style={{ marginTop:12, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:10, padding:10, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection:'row', gap:6, alignItems:'center' }}>
            {[
              { label:'Financier', val: calcPEA(data.pea) + calcCT(data.ct) + calcBanque(data.banque) + calcCarnet(data.carnet) + calcLiquide(data.liquidites), col:'#6EE7A0' },
              { label:'Immo',      val: calcImmo(data.immobilier),   col:C.acc },
              { label:'Or',        val: calcOr(data.or, data.prixOr), col:'#FFD700' },
            ].map((cat, i) => (
              <View key={i} style={{ alignItems:'center' }}>
                <Text style={{ color:cat.col, fontWeight:'700', fontSize:12 }}>{total > 0 ? Math.round(cat.val / total * 100) : 0}%</Text>
                <Text style={{ color:'rgba(255,255,255,0.6)', fontSize:9 }}>{cat.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color:'rgba(255,255,255,0.8)', fontSize:12 }}>Voir mes actifs →</Text>
        </TouchableOpacity>
      </View>

      {/* Proverbe */}
      <View style={{ backgroundColor:C.priD, margin:12, borderRadius:16, padding:16 }}>
        <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:11, fontWeight:'600', marginBottom:6 }}>
          Proverbe du Jour - {dayOfYear}/366
        </Text>
        <Text style={{ color:C.white, fontSize:15, fontWeight:'700', lineHeight:22, marginBottom:12 }}>
          {'"'}{prv.q}{'"'}
        </Text>
        <View style={{ backgroundColor:'rgba(255,255,255,0.08)', height:1, marginBottom:12 }}/>
        <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:12 }}>
          <View style={{ width:50, height:50, borderRadius:25, backgroundColor:C.acc, alignItems:'center', justifyContent:'center' }}>
            <Text style={{ color:C.white, fontWeight:'700', fontSize:16 }}>{initials}</Text>
          </View>
          <View style={{ flex:1 }}>
            <Text style={{ color:C.white, fontWeight:'700', fontSize:13 }}>{prv.a}</Text>
            <Text style={{ color:'rgba(160,210,180,0.9)', fontSize:11 }}>{prv.d}</Text>
          </View>
        </View>
        <View style={{ backgroundColor:'rgba(20,90,45,0.9)', borderRadius:10, padding:12, borderLeftWidth:4, borderLeftColor:C.acc }}>
          <Text style={{ color:C.acc, fontWeight:'700', fontSize:11, marginBottom:4 }}>PatriMoi dit :</Text>
          <Text style={{ color:'rgba(200,240,210,0.95)', fontSize:12, lineHeight:18 }}>{prv.comment}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onNav('dashboard')}
          style={{ marginTop:12, backgroundColor:C.acc, borderRadius:8, paddingVertical:9, paddingHorizontal:18, alignSelf:'flex-start' }}
          activeOpacity={0.8}
        >
          <Text style={{ color:C.white, fontWeight:'700', fontSize:12 }}>Voir mon patrimoine →</Text>
        </TouchableOpacity>
      </View>

      {/* Temoignages */}
      <View style={{ paddingHorizontal:12 }}>
        <SectionTitle>Ils font confiance a PatriMoi</SectionTitle>
        {[
          { ini:'RM', nom:'Rachid M.', ville:'Casablanca', avis:'Enfin une app marocaine qui comprend nos actifs ! PEA et immobilier en meme temps, parfait.', stars:5 },
          { ini:'SB', nom:'Sara B.',   ville:'Rabat',       avis:"Super intuitif. Mes DH ne dorment plus. Merci PatriMoi !", stars:5 },
          { ini:'KA', nom:'Karim A.',  ville:'Marrakech',   avis:"Le suivi de l'or et la barre de poids des actions sont excellents.", stars:5 },
        ].map((t, i) => (
          <Card key={i}>
            <View style={{ flexDirection:'row', gap:10, marginBottom:8, alignItems:'center' }}>
              <View style={{ width:40, height:40, borderRadius:20, backgroundColor:C.priL, alignItems:'center', justifyContent:'center' }}>
                <Text style={{ color:C.pri, fontWeight:'700', fontSize:14 }}>{t.ini}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>{t.nom}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>{t.ville}</Text>
              </View>
              <Text style={{ fontSize:13 }}>{'*'.repeat(t.stars)}</Text>
            </View>
            <Text style={{ fontSize:12, color:C.g3, fontStyle:'italic' }}>{'"'}{t.avis}{'"'}</Text>
          </Card>
        ))}

        <TouchableOpacity
          style={{ paddingVertical:11, borderRadius:10, borderWidth:1.5, borderColor:C.pri, backgroundColor:C.priL, alignItems:'center', marginTop:4 }}
          activeOpacity={0.8}
        >
          <Text style={{ color:C.pri, fontWeight:'700', fontSize:13 }}>Voir tous les avis →</Text>
        </TouchableOpacity>

        <View style={{ backgroundColor:C.pri, borderRadius:16, marginVertical:16, padding:20, alignItems:'center' }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:13, marginBottom:4 }}>Utilisateurs actifs</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:44 }}>+12 400</Text>
          <Text style={{ color:'rgba(180,230,200,0.75)', fontSize:12, marginTop:4 }}>et ca grandit chaque jour</Text>
        </View>
      </View>
    </ScrollView>
  );
});

export default PageProverbe;
