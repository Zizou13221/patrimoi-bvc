import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Modal, Platform, StyleSheet,
} from 'react-native';
import { C } from '../constants/colors';
import { fmtN, pctDiff } from '../utils/fmt';

// =========================================================
// STYLES PARTAGÉS
// =========================================================
export const sh = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios:     { shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:6 },
      android: { elevation: 3 },
    }),
  },
  row:    { flexDirection:'row', alignItems:'center' },
  center: { alignItems:'center', justifyContent:'center' },
  flex1:  { flex: 1 },
  bold:   { fontWeight:'700' },
  italic: { fontStyle:'italic' },
});

// =========================================================
// COMPOSANTS UI
// =========================================================

export const Card = ({ children, style, onPress }) => (
  <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress} style={[sh.card, style]}>
    {children}
  </TouchableOpacity>
);

export const BtnPri = ({ children, onPress, style, disabled }) => (
  <TouchableOpacity
    onPress={onPress} disabled={disabled}
    style={[{ backgroundColor:disabled?C.g2:C.pri, borderRadius:10, paddingVertical:13, alignItems:'center' }, style]}
    activeOpacity={0.8}
  >
    <Text style={{ color:C.white, fontWeight:'700', fontSize:14 }}>{children}</Text>
  </TouchableOpacity>
);

export const BtnSec = ({ children, onPress, style }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[{ backgroundColor:C.priL, borderRadius:10, paddingVertical:11, alignItems:'center', borderWidth:1.5, borderColor:C.pri }, style]}
    activeOpacity={0.8}
  >
    <Text style={{ color:C.pri, fontWeight:'700', fontSize:13 }}>{children}</Text>
  </TouchableOpacity>
);

export const PLBadge = ({ value, base }) => {
  const diff = value - base;
  const p    = pctDiff(value, base);
  const pos  = diff >= 0;
  return (
    <View style={{ alignItems:'flex-end' }}>
      <Text style={{ color:pos?C.gpos:C.rneg, fontWeight:'700', fontSize:12 }}>
        {pos?'+':''}{fmtN(diff)} DH
      </Text>
      <Text style={{ color:pos?C.gpos:C.rneg, fontSize:11 }}>
        {pos?'▲':'▼'} {Math.abs(p).toFixed(1)}%
      </Text>
    </View>
  );
};

export const Toggle = ({ on, onChange }) => (
  <TouchableOpacity
    onPress={() => onChange(!on)}
    style={{ width:46, height:26, borderRadius:13, backgroundColor:on?C.gpos:C.g2, justifyContent:'center' }}
    activeOpacity={0.9}
  >
    <View style={{
      width:20, height:20, borderRadius:10, backgroundColor:C.white,
      position:'absolute', left:on?23:3,
      ...Platform.select({
        ios:     { shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.2, shadowRadius:2 },
        android: { elevation:2 },
      }),
    }}/>
  </TouchableOpacity>
);

export const IconBox = ({ label, bg, size=34, fs=10 }) => (
  <View style={{ width:size, height:size, borderRadius:Math.round(size*0.35), backgroundColor:bg, alignItems:'center', justifyContent:'center' }}>
    <Text style={{ color:C.white, fontWeight:'700', fontSize:fs }}>{label}</Text>
  </View>
);

export const SectionLabel = ({ children }) => (
  <Text style={{ fontSize:11, fontWeight:'600', color:C.g3, marginTop:14, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>
    {children}
  </Text>
);

export const SectionTitle = ({ children, action, onAction }) => (
  <View style={[sh.row, { justifyContent:'space-between', marginTop:16, marginBottom:8 }]}>
    <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>{children}</Text>
    {action && (
      <TouchableOpacity onPress={onAction}>
        <Text style={{ color:C.pri, fontSize:12 }}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

export const InfoRow = ({ label, sub: subLabel, value }) => (
  <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', paddingVertical:7, borderBottomWidth:1, borderBottomColor:C.g1 }}>
    <View>
      <Text style={{ fontSize:12, color:C.g3 }}>{label}</Text>
      {subLabel ? <Text style={{ fontSize:10, color:C.g2, marginTop:1 }}>{subLabel}</Text> : null}
    </View>
    <Text style={{ fontSize:13, fontWeight:'500', color:C.dark, textAlign:'right', marginLeft:8, flexShrink:1 }}>{value}</Text>
  </View>
);

export const MethodSelector = ({ value, onChange }) => (
  <View style={{ flexDirection:'row', gap:6, marginTop:8 }}>
    {[['estimatif','Valeur estimative'],['offert','Prix offert']].map(([m, label]) => (
      <TouchableOpacity
        key={m} onPress={() => onChange(m)}
        style={{ flex:1, paddingVertical:7, borderRadius:7, alignItems:'center', backgroundColor:value===m?C.pri:C.g1 }}
        activeOpacity={0.8}
      >
        <Text style={{ fontWeight:'600', fontSize:11, color:value===m?C.white:C.g3 }}>{label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

export const Input = ({ label, value, onChangeText, placeholder, keyboardType, unit }) => (
  <View style={{ marginBottom:12 }}>
    {label ? <Text style={{ fontSize:12, fontWeight:'600', color:C.dark, marginBottom:4 }}>{label}</Text> : null}
    <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:C.g1, borderRadius:8, paddingHorizontal:12, borderWidth:1, borderColor:C.g2 }}>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={C.g3} keyboardType={keyboardType || 'default'}
        style={{ flex:1, paddingVertical:10, fontSize:13, color:C.dark }}
      />
      {unit ? <Text style={{ color:C.g3, fontSize:12 }}>{unit}</Text> : null}
    </View>
  </View>
);

export const PickerModal = ({ visible, options, onSelect, onClose, title }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={onClose}>
      <View style={{ position:'absolute', bottom:0, left:0, right:0, backgroundColor:C.white, borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:'60%' }}>
        <View style={{ padding:16, borderBottomWidth:1, borderBottomColor:C.g1, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ fontWeight:'700', fontSize:15, color:C.dark }}>{title || 'Choisir'}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color:C.pri, fontWeight:'700', fontSize:15 }}>Fermer</Text>
          </TouchableOpacity>
        </View>
        <ScrollView>
          {options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => { onSelect(typeof opt === 'object' ? opt.value : opt); onClose(); }}
              style={{ paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.g1 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize:14, color:C.dark }}>{typeof opt === 'object' ? opt.label : opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </TouchableOpacity>
  </Modal>
);

export const SelectInput = ({ label, value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const display = options.find(o => (o.value || o) === value);
  return (
    <View style={{ marginBottom:12 }}>
      {label ? <Text style={{ fontSize:12, fontWeight:'600', color:C.dark, marginBottom:4 }}>{label}</Text> : null}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:C.g1, borderRadius:8, paddingHorizontal:12, paddingVertical:12, borderWidth:1, borderColor:C.g2 }}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize:13, color:value ? C.dark : C.g3 }}>
          {display ? (display.label || display) : 'Selectionner...'}
        </Text>
        <Text style={{ color:C.g3, fontSize:16 }}>v</Text>
      </TouchableOpacity>
      <PickerModal visible={open} options={options} onSelect={onChange} onClose={() => setOpen(false)} title={label}/>
    </View>
  );
};

export const TopBar = ({ title, subtitle, onBack }) => (
  <View style={{ backgroundColor:C.pri, paddingHorizontal:16, paddingTop:Platform.OS==='ios'?16:12, paddingBottom:12 }}>
    <View style={{ flexDirection:'row', alignItems:'center' }}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ paddingRight:10 }} activeOpacity={0.7}>
          <Text style={{ color:C.white, fontSize:24, lineHeight:28 }}>‹</Text>
        </TouchableOpacity>
      )}
      <View style={{ flex:1, alignItems:onBack?'flex-start':'center' }}>
        <Text style={{ color:C.white, fontWeight:'700', fontSize:16 }}>{title}</Text>
        {subtitle ? <Text style={{ color:'rgba(255,255,255,0.75)', fontSize:11, marginTop:1 }}>{subtitle}</Text> : null}
      </View>
    </View>
  </View>
);

export const Sparkline = ({ data, color }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  return (
    <View style={{ flexDirection:'row', alignItems:'flex-end', height:50, gap:2 }}>
      {data.map((v, i) => {
        const h = Math.max(((v - min) / range) * 46 + 4, 4);
        return <View key={i} style={{ flex:1, height:h, backgroundColor:color||C.acc, borderRadius:2, opacity:0.7+(i/data.length)*0.3 }}/>;
      })}
    </View>
  );
};

export const BarH = ({ pct, color, height=5 }) => (
  <View style={{ height, backgroundColor:C.g1, borderRadius:height/2, overflow:'hidden' }}>
    <View style={{ width:`${Math.min(pct,100)}%`, height:'100%', backgroundColor:color, borderRadius:height/2 }}/>
  </View>
);

export const DonutSimple = ({ cats, total }) => (
  <View>
    <View style={{ flexDirection:'row', height:16, borderRadius:8, overflow:'hidden', gap:1 }}>
      {cats.map((c, i) => {
        const poids = total > 0 ? c.val / total * 100 : 0;
        return <View key={i} style={{ flex:poids, backgroundColor:c.col }}/>;
      })}
    </View>
    <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:10 }}>
      {cats.slice(0,6).map((c, i) => (
        <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <View style={{ width:9, height:9, borderRadius:2, backgroundColor:c.col }}/>
          <Text style={{ fontSize:9, color:C.dark }}>{c.abbr} {total>0?Math.round(c.val/total*100):0}%</Text>
        </View>
      ))}
    </View>
  </View>
);

const NAV_ITEMS = [
  { id:'proverbe',  label:'Accueil',  abbr:'PG1' },
  { id:'dashboard', label:'Dashboard',abbr:'DBD' },
  { id:'actifs',    label:'Actifs',   abbr:'ACT' },
  { id:'conseils',  label:'Conseils', abbr:'CNS' },
  { id:'apropos',   label:'A propos', abbr:'APR' },
  { id:'params',    label:'Params',   abbr:'PRM' },
];

export const NavBar = ({ active, onChange }) => (
  <View style={{ flexDirection:'row', backgroundColor:C.white, borderTopWidth:1, borderTopColor:C.g2 }}>
    {NAV_ITEMS.map(n => {
      const isA = active === n.id;
      return (
        <TouchableOpacity key={n.id} onPress={() => onChange(n.id)} style={{ flex:1, alignItems:'center', paddingVertical:7 }} activeOpacity={0.7}>
          <View style={{ backgroundColor:isA?C.pri:C.g1, borderRadius:5, paddingHorizontal:4, paddingVertical:2, marginBottom:2, minWidth:26, alignItems:'center' }}>
            <Text style={{ fontSize:7.5, fontWeight:'700', color:isA?C.white:C.g3 }}>{n.abbr}</Text>
          </View>
          <Text style={{ fontSize:8.5, fontWeight:isA?'700':'400', color:isA?C.pri:C.g3 }}>{n.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);
