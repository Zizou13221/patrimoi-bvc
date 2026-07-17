import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { C } from '../constants/colors';
import { Card, IconBox, SectionTitle, TopBar } from '../components/shared';

export default function PageAPropos() {
  return (
    <View style={{ flex:1 }}>
      <TopBar title="À propos de PatriMoi" subtitle="Made in Morocco, For Morocco"/>
      <ScrollView style={{ flex:1, backgroundColor:C.g1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ alignItems:'center', paddingVertical:20 }}>
          <View style={{ width:80, height:80, borderRadius:24, backgroundColor:C.priL, alignItems:'center', justifyContent:'center', marginBottom:10 }}>
            <Text style={{ fontWeight:'700', fontSize:22, color:C.pri }}>PAT</Text>
            <Text style={{ fontWeight:'700', fontSize:12, color:C.acc }}>RIMOI</Text>
          </View>
          <Text style={{ fontWeight:'700', fontSize:20, color:C.pri }}>PatriMoi</Text>
          <Text style={{ fontSize:12, color:C.g3, marginTop:4 }}>Votre Patrimoine. Votre Avenir.</Text>
        </View>

        <Card style={{ borderLeftWidth:4, borderLeftColor:C.pri }}>
          <Text style={{ fontWeight:'700', fontSize:14, color:C.pri, marginBottom:6 }}>Notre mission</Text>
          <Text style={{ fontSize:13, color:C.dark, lineHeight:20 }}>
            Donner à chaque Marocain les outils pour comprendre, suivre et faire croître son patrimoine — simplement, en français ou en arabe, depuis son téléphone.
          </Text>
        </Card>

        <Card style={{ borderLeftWidth:4, borderLeftColor:C.acc, backgroundColor:C.accL }}>
          <Text style={{ fontWeight:'700', fontSize:14, color:C.goldD, marginBottom:6 }}>Notre vision</Text>
          <Text style={{ fontSize:13, color:C.dark, lineHeight:20 }}>
            Avant PatriMoi, aucune application marocaine ne centralisait patrimoine financier, immobilier, or et devises en un seul endroit.{' '}
            <Text style={{ fontWeight:'700' }}>Nous l'avons créé.</Text>
          </Text>
        </Card>

        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          {[['100%','Made in Morocco'],['8','Catégories'],['75+','Titres BVC'],['v1.6','Version']].map(([v,l], i) => (
            <Card key={i} style={{ flex:1, minWidth:'22%', alignItems:'center', padding:12, margin:0 }}>
              <Text style={{ fontWeight:'700', fontSize:15, color:C.pri }}>{v}</Text>
              <Text style={{ fontSize:9, color:C.g3, marginTop:4 }}>{l}</Text>
            </Card>
          ))}
        </View>

        <SectionTitle>Contactez-nous</SectionTitle>
        {[
          { abbr:'MAL', col:C.navy, val:'zineddine.othmane1@gmail.com', sub:'Support & questions', href:'mailto:zineddine.othmane1@gmail.com' },
          { abbr:'IG',  col:C.sec,  val:'@patrimoi.app',              sub:'Instagram & réseaux', href:'https://www.instagram.com/patrimoi.app' },
        ].map((c, i) => (
          <TouchableOpacity key={i} onPress={() => Alert.alert('Ouvrir', `Quitter PatriMoi pour ouvrir : ${c.val} ?`, [{ text:'Annuler', style:'cancel' }, { text:'Ouvrir', onPress:() => Linking.openURL(c.href).catch(() => Alert.alert('Erreur','Impossible d\'ouvrir le lien.')) }])} activeOpacity={0.8}>
            <Card style={{ padding:10 }}>
              <View style={{ flexDirection:'row', gap:10, alignItems:'center' }}>
                <IconBox label={c.abbr} bg={c.col} size={34} fs={8}/>
                <View style={{ flex:1 }}>
                  <Text style={{ fontWeight:'600', fontSize:13 }}>{c.val}</Text>
                  <Text style={{ fontSize:11, color:C.g3 }}>{c.sub}</Text>
                </View>
                <Text style={{ color:C.g2, fontSize:20 }}>›</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
        <View style={{ backgroundColor:C.pri, borderRadius:12, padding:14, alignItems:'center', marginTop:8 }}>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:15 }}>PatriMoi v1.6</Text>
          <Text style={{ color:'rgba(180,230,200,0.85)', fontSize:11, marginTop:4 }}>Made in Morocco — 2026</Text>
        </View>
      </ScrollView>
    </View>
  );
}
