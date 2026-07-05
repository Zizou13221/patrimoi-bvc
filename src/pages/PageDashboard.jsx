import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { C } from '../constants/colors';
import {
  calcLiquide, calcBanque, calcCarnet, calcPEA, calcPEACout,
  calcCT, calcCTCout, calcOr, calcImmo, calcTransport,
} from '../utils/calc';
import { fmt, pctDiff } from '../utils/fmt';
import { Card, IconBox, BarH, Sparkline, DonutSimple } from '../components/shared';

const PageDashboard = React.memo(function PageDashboard({ data, onNav, onRefreshOr, isRefreshing, onRefreshBVC, bvcStatus }) {
  const [period, setPeriod] = useState('1A');

  const peaVal  = useMemo(() => calcPEA(data.pea),            [data.pea]);
  const peaCout = useMemo(() => calcPEACout(data.pea),        [data.pea]);
  const ctVal   = useMemo(() => calcCT(data.ct),              [data.ct]);
  const ctCout  = useMemo(() => calcCTCout(data.ct),          [data.ct]);
  const orVal   = useMemo(() => calcOr(data.or, data.prixOr), [data.or, data.prixOr]);

  const cats = useMemo(() => [
    { id:'liquide',    label:'Argent Liquide',      val:calcLiquide(data.liquidites), col:C.gpos,    abbr:'LIQ', plPct:null },
    { id:'banque',     label:'Argent en Banque',     val:calcBanque(data.banque),       col:C.navy,    abbr:'BNQ', plPct:null },
    { id:'carnet',     label:'Compte sur Carnet',    val:calcCarnet(data.carnet),       col:C.teal,    abbr:'CRT', plPct:null },
    { id:'pea',        label:'Compte PEA',           val:peaVal,                        col:C.pri,     abbr:'PEA', plPct:pctDiff(peaVal, peaCout) },
    { id:'ct',         label:'Compte-Titre',         val:ctVal,                         col:C.navy,    abbr:'CT',  plPct:pctDiff(ctVal, ctCout) },
    { id:'or',         label:'Or & Metaux Precieux', val:orVal,                         col:C.gold,    abbr:'OR',  plPct:null },
    { id:'immobilier', label:'Immobilier & Terrains',val:calcImmo(data.immobilier),     col:'#B46428', abbr:'IMM', plPct:null },
    { id:'transport',  label:'Biens de Transport',   val:calcTransport(data.transport), col:'#50506A', abbr:'VEH', plPct:null },
  ].sort((a, b) => b.val - a.val), [data, peaVal, peaCout, ctVal, ctCout, orVal]);

  const total = useMemo(() => cats.reduce((s, c) => s + c.val, 0), [cats]);

  const sparkData = [1.60,1.65,1.58,1.72,1.70,1.78,1.82,1.86,1.89,1.934].map(v => v * 1e6);

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.g1 }}>
      {/* Hero */}
      <View style={{ backgroundColor:C.pri, padding:16, paddingBottom:18 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Patrimoine Total</Text>
          <View style={{ flexDirection:'row', gap:6 }}>
            <TouchableOpacity
              onPress={onRefreshOr} disabled={isRefreshing}
              style={{ backgroundColor:C.priD, borderRadius:6, paddingHorizontal:8, paddingVertical:3, flexDirection:'row', alignItems:'center', gap:4 }}
              activeOpacity={0.7}
            >
              {isRefreshing
                ? <ActivityIndicator size="small" color="rgba(180,230,200,0.9)"/>
                : <Text style={{ fontSize:10, color:'rgba(180,230,200,0.9)' }}>↻ Or {data.lastUpdate}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRefreshBVC}
              style={{ backgroundColor:C.priD, borderRadius:6, paddingHorizontal:8, paddingVertical:3, flexDirection:'row', alignItems:'center', gap:4 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize:10, color:bvcStatus==='ok'?'#6EE7A0':bvcStatus==='error'?C.acc:'rgba(180,230,200,0.9)' }}>
                {bvcStatus==='ok'?'✓ BVC':bvcStatus==='error'?'⚠ BVC':'↻ BVC'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={{ color:C.white, fontWeight:'700', fontSize:28 }}>{fmt(total)}</Text>
        <View style={{ backgroundColor:'rgba(255,255,255,0.12)', borderRadius:8, paddingHorizontal:10, paddingVertical:5, alignSelf:'flex-start', marginTop:6 }}>
          <Text style={{ fontSize:12, color:'#6EE7A0' }}>+14 200 DH  -  +0,74% aujourd'hui</Text>
        </View>
        <View style={{ marginTop:10 }}>
          <Sparkline data={sparkData} color={C.acc}/>
        </View>
        <View style={{ flexDirection:'row', backgroundColor:'rgba(0,0,0,0.15)', borderRadius:8, marginTop:8, padding:2 }}>
          {['1S','1M','3M','6M','1A','MAX'].map(p => (
            <TouchableOpacity key={p} onPress={() => setPeriod(p)}
              style={{ flex:1, paddingVertical:5, alignItems:'center', borderRadius:6, backgroundColor:period===p?C.pri:'transparent' }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize:11, fontWeight:period===p?'700':'400', color:period===p?C.white:'rgba(255,255,255,0.7)' }}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ padding:12 }}>
        {/* Bilan du jour */}
        <Card style={{ backgroundColor:C.priL, borderLeftWidth:4, borderLeftColor:C.pri, marginBottom:10 }}>
          <Text style={{ fontWeight:'700', fontSize:13, color:C.pri, marginBottom:8 }}>Bilan du jour</Text>
          <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
            <View style={{ alignItems:'center' }}>
              <Text style={{ fontSize:10, color:C.g3 }}>Or / gramme</Text>
              <Text style={{ fontWeight:'700', fontSize:13, color:C.gold }}>{data.prixOr} DH</Text>
            </View>
            <View style={{ width:1, backgroundColor:C.g2 }}/>
            <View style={{ alignItems:'center' }}>
              <Text style={{ fontSize:10, color:C.g3 }}>PEA P&L</Text>
              <Text style={{ fontWeight:'700', fontSize:13, color:peaVal>=peaCout?C.gpos:C.rneg }}>
                {peaCout>0?(pctDiff(peaVal,peaCout)>=0?'+':'')+pctDiff(peaVal,peaCout).toFixed(1)+'%':'N/A'}
              </Text>
            </View>
            <View style={{ width:1, backgroundColor:C.g2 }}/>
            <View style={{ alignItems:'center' }}>
              <Text style={{ fontSize:10, color:C.g3 }}>Actifs</Text>
              <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>8 catégories</Text>
            </View>
          </View>
        </Card>

        {/* Repartition */}
        <Card>
          <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, marginBottom:10 }}>Repartition du patrimoine</Text>
          <DonutSimple cats={cats} total={total}/>
        </Card>

        {/* Liste categories */}
        <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, marginTop:14, marginBottom:8 }}>Detail par categorie</Text>
        {cats.map((c, i) => (
          <Card key={i} style={{ padding:12 }} onPress={() => onNav('actifs', c.id)}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
              <IconBox label={c.abbr} bg={c.col} size={36} fs={9}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'600', fontSize:13, color:C.dark }}>{c.label}</Text>
                <View style={{ marginTop:4 }}>
                  <BarH pct={Math.min(total>0?c.val/total*100*3:0,90)} color={c.col}/>
                </View>
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Text style={{ fontWeight:'700', fontSize:12, color:C.dark }}>{fmt(c.val)}</Text>
                {c.plPct != null && (
                  <Text style={{ fontSize:11, color:c.plPct>=0?C.gpos:C.rneg }}>{c.plPct>=0?'▲':'▼'} {Math.abs(c.plPct).toFixed(1)}%</Text>
                )}
              </View>
              <Text style={{ color:C.g2, fontSize:18 }}>›</Text>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
});

export default PageDashboard;
