import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { C } from '../constants/colors';
import { Card, BtnSec, Toggle, TopBar } from '../components/shared';

export default function PageParams() {
  const [bio,     setBio]     = useState(true);
  const [discret, setDiscret] = useState(false);
  const [rappels, setRappels] = useState(true);
  const [alertes, setAlertes] = useState(true);
  const [hebdo,   setHebdo]   = useState(false);

  const sections = [
    { title:'Mon compte', items:[
      { label:'Informations personnelles', right:'›' },
      { label:'Monnaie d\'affichage',       right:'DH (MAD) ›' },
      { label:'Date de debut de suivi',    right:'01/01/2023 ›' },
    ]},
    { title:'Securite', items:[
      { label:'Auth. biometrique (Face ID)',    right:<Toggle on={bio}     onChange={setBio}/> },
      { label:'Code PIN 6 chiffres',            right:'›' },
      { label:'Verrouillage automatique',       right:'5 min ›' },
      { label:'Mode discret (masquer montants)',right:<Toggle on={discret} onChange={setDiscret}/> },
    ]},
    { title:'Notifications', items:[
      { label:'Rappels d\'epargne',     right:<Toggle on={rappels} onChange={setRappels}/> },
      { label:'Alertes de performance', right:<Toggle on={alertes} onChange={setAlertes}/> },
      { label:'Synthese hebdo marches', right:<Toggle on={hebdo}   onChange={setHebdo}/> },
    ]},
    { title:'Donnees & Export', items:[
      { label:'Exporter en PDF', right:'›' },
      { label:'Exporter en CSV', right:'›' },
      { label:'Supprimer mon compte', right:<Text style={{ color:C.sec }}>›</Text> },
    ]},
  ];

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Parametres" subtitle="PatriMoi v1.3"/>
      <ScrollView style={{ flex:1, backgroundColor:C.g1 }} contentContainerStyle={{ padding:12 }}>
        <Card style={{ backgroundColor:C.pri, padding:14, marginBottom:14 }}>
          <View style={{ flexDirection:'row', gap:12, alignItems:'center' }}>
            <View style={{ width:50, height:50, borderRadius:25, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color:C.white, fontWeight:'700', fontSize:18 }}>MA</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ color:C.white, fontWeight:'700', fontSize:15 }}>Mohammed Alami</Text>
              <Text style={{ color:'rgba(180,230,200,0.85)', fontSize:12 }}>m.alami@gmail.com</Text>
            </View>
            <View style={{ backgroundColor:C.acc, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}>
              <Text style={{ fontSize:11, fontWeight:'700', color:C.white }}>PatriMoi+</Text>
            </View>
          </View>
        </Card>

        {sections.map((sec, si) => (
          <View key={si}>
            <Text style={{ fontSize:11, fontWeight:'600', color:C.g3, marginTop:14, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>{sec.title}</Text>
            <Card style={{ padding:0, overflow:'hidden' }}>
              {sec.items.map((it, ii) => (
                <View key={ii} style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:13, borderBottomWidth:ii<sec.items.length-1?1:0, borderBottomColor:C.g1 }}>
                  <Text style={{ flex:1, fontSize:13, color:C.dark }}>{it.label}</Text>
                  {typeof it.right === 'string'
                    ? <Text style={{ fontSize:12, color:C.g3 }}>{it.right}</Text>
                    : it.right
                  }
                </View>
              ))}
            </Card>
          </View>
        ))}

        <Text style={{ fontSize:11, fontWeight:'600', color:C.g3, marginTop:14, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Abonnement</Text>
        <Card style={{ borderLeftWidth:4, borderLeftColor:C.pri }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <View>
              <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>Plan PatriMoi+</Text>
              <Text style={{ fontSize:12, color:C.g3, marginTop:2 }}>Comptes illimites - Temps reel - Export</Text>
            </View>
            <View style={{ alignItems:'flex-end' }}>
              <Text style={{ fontWeight:'700', fontSize:16, color:C.pri }}>49 DH</Text>
              <Text style={{ fontSize:10, color:C.g3 }}>/mois</Text>
            </View>
          </View>
          <BtnSec style={{ marginTop:10 }}>Gerer mon abonnement →</BtnSec>
        </Card>
      </ScrollView>
    </View>
  );
}
