import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Share, Alert } from 'react-native';
import { C } from '../constants/colors';
import {
  calcLiquide, calcBanque, calcCarnet, calcPEA, calcPEACout,
  calcCT, calcCTCout, calcOr, calcImmo, calcTransport, totalCout,
} from '../utils/calc';
import { fmt, pctDiff } from '../utils/fmt';
import { Card, IconBox, BarH, SparklineInteractive, DonutSimple } from '../components/shared';
import { usePatrimoineStore } from '../store/patrimoineStore';
import { getBvcCache } from '../utils/api';

const PageDashboard = React.memo(function PageDashboard({
  onNav, onRefreshOr, onRefreshBVC,
}) {
  const data                = usePatrimoineStore(s => s.data);
  const isRefreshing        = usePatrimoineStore(s => s.isRefreshing);
  const bvcStatus           = usePatrimoineStore(s => s.bvcStatus);
  const history             = usePatrimoineStore(s => s.history);
  const discret             = usePatrimoineStore(s => s.discret);
  const isOffline           = usePatrimoineStore(s => s.isOffline);
  const objectif            = usePatrimoineStore(s => s.objectif);
  const demoMode            = usePatrimoineStore(s => s.demoMode);
  const trackingStartDate   = usePatrimoineStore(s => s.trackingStartDate);
  const [period, setPeriod] = useState('1A');

  const peaVal  = useMemo(() => calcPEA(data.pea),            [data.pea]);
  const peaCout = useMemo(() => calcPEACout(data.pea),        [data.pea]);
  const ctVal   = useMemo(() => calcCT(data.ct),              [data.ct]);
  const ctCout  = useMemo(() => calcCTCout(data.ct),          [data.ct]);
  const orVal   = useMemo(() => calcOr(data.or, data.prixOr), [data.or, data.prixOr]);

  const cats = useMemo(() => [
    { id:'liquide',    label:'Argent Liquide',       val:calcLiquide(data.liquidites), col:C.gpos,    abbr:'LIQ', plPct:null },
    { id:'banque',     label:'Argent en Banque',      val:calcBanque(data.banque),       col:C.navy,    abbr:'BNQ', plPct:null },
    { id:'carnet',     label:'Compte sur Carnet',     val:calcCarnet(data.carnet),       col:C.teal,    abbr:'CRT', plPct:null },
    { id:'pea',        label:'Compte PEA',            val:peaVal,                        col:C.pri,     abbr:'PEA', plPct:pctDiff(peaVal, peaCout) },
    { id:'ct',         label:'Compte-Titre',          val:ctVal,                         col:C.navy,    abbr:'CT',  plPct:pctDiff(ctVal, ctCout) },
    { id:'or',         label:'Or & Métaux Précieux',   val:orVal,                         col:C.gold,    abbr:'OR',  plPct:null },
    { id:'immobilier', label:'Immobilier & Terrains', val:calcImmo(data.immobilier),     col:'#B46428', abbr:'IMM', plPct:null },
    { id:'transport',  label:'Biens de Transport',    val:calcTransport(data.transport), col:'#50506A', abbr:'VEH', plPct:null },
  ].sort((a, b) => b.val - a.val), [data, peaVal, peaCout, ctVal, ctCout, orVal]);

  const total    = useMemo(() => cats.reduce((s, c) => s + c.val, 0), [cats]);
  const cost     = useMemo(() => totalCout(data), [data]);
  const pl       = total - cost;
  const plPct    = cost > 0 ? ((pl / cost) * 100) : 0;
  const activeCats = cats.filter(c => c.val > 0).length;

  // Données fictives pour le graphique en mode démo (quand historique vide)
  const demoSparkData = useMemo(() => {
    if (!demoMode) return null;
    const base = 850000;
    const today = new Date();
    const pts = [];
    const dates = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const noise = (Math.sin(i * 0.7) * 18000) + (Math.cos(i * 1.3) * 12000) + (i < 15 ? (15 - i) * 800 : 0);
      pts.push(Math.round(base + noise));
      dates.push(d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }));
    }
    return { pts, dates, isDemo: true };
  }, [demoMode]);

  const sparkData = useMemo(() => {
    if (!history || history.length < 2) return null;
    const now = new Date();
    let cut = new Date(now);
    if      (period==='1S')  cut.setDate(now.getDate()-7);
    else if (period==='1M')  cut.setMonth(now.getMonth()-1);
    else if (period==='3M')  cut.setMonth(now.getMonth()-3);
    else if (period==='6M')  cut.setMonth(now.getMonth()-6);
    else if (period==='1A')  cut.setFullYear(now.getFullYear()-1);
    else if (trackingStartDate) cut = new Date(trackingStartDate); // MAX depuis date de début (AN_014)
    else                     cut.setFullYear(2000);
    const filtered = history
      .filter(h => new Date(h.date) >= cut)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (filtered.length < 2) return null;
    return {
      pts:   filtered.map(h => h.val),
      dates: filtered.map(h => {
        const d = new Date(h.date);
        return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
      }),
    };
  }, [history, period, total, trackingStartDate]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: [
          '🏦 Mon patrimoine PatriMoi',
          `Total : ${fmt(total)}`,
          cost > 0 ? `P&L global : ${pl >= 0 ? '+' : ''}${fmt(pl)} (${pl >= 0 ? '+' : ''}${plPct.toFixed(1)}%)` : '',
          '',
          ...cats.slice(0, 5).map(c => `• ${c.label} : ${fmt(c.val)}`),
          '',
          'Gérez votre patrimoine avec PatriMoi !',
        ].filter(Boolean).join('\n'),
      });
    } catch {}
  }, [total, cost, pl, plPct, cats]);

  // Progrès objectif + simulation
  const objPct = objectif && objectif.montant > 0
    ? Math.min(100, (total / objectif.montant) * 100)
    : null;

  // P&L global depuis le début d'utilisation
  const plGlobal = useMemo(() => {
    if (!history || history.length < 2) return null;
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0].val;
    if (!first || first === 0) return null;
    const diff = total - first;
    const pct  = (diff / first) * 100;
    return { diff, pct, since: sorted[0].date };
  }, [history, total]);

  // MASI depuis le cache BVC
  const masi = useMemo(() => {
    const cache = getBvcCache();
    const m = cache?.data?.cours?.MASI;
    if (!m) return null;
    return { cours: m.cours, var: m.var_pct ?? m.var ?? null };
  }, [bvcStatus]); // eslint-disable-line

  // Dernière mise à jour BVC (timestamp du workflow GH Actions dans le JSON)
  const bvcUpdated = useMemo(() => {
    const cache = getBvcCache();
    const u = cache?.data?.updated;
    if (!u) return null;
    try {
      const d = new Date(u);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mn = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm} ${hh}:${mn}`;
    } catch { return null; }
  }, [bvcStatus]); // eslint-disable-line

  const objSimulation = useMemo(() => {
    if (!objectif || !objectif.montant || total >= objectif.montant) return null;
    if (!history || history.length < 7) return null;
    // Calcul de la croissance moyenne sur les 30 derniers points disponibles
    const pts = [...history].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    if (pts.length < 2) return null;
    const first = pts[0], last = pts[pts.length - 1];
    const days = Math.max(1, (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24));
    const dailyGrowth = (last.val - first.val) / days; // DH/jour
    if (dailyGrowth <= 0) return null;
    const remaining = objectif.montant - total;
    const daysToReach = remaining / dailyGrowth;
    const months = Math.ceil(daysToReach / 30.44);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysToReach);
    const monthStr = targetDate.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });
    return { months, monthStr, dailyGrowth: Math.round(dailyGrowth) };
  }, [objectif, total, history]);

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.g1 }}>

      {/* Bannière offline */}
      {isOffline && (
        <View style={{ backgroundColor:'#FFF3CD', paddingHorizontal:14, paddingVertical:8, flexDirection:'row', alignItems:'center', gap:8 }}>
          <Text style={{ fontSize:13 }}>⚠</Text>
          <Text style={{ fontSize:12, color:'#856404', flex:1 }}>Hors ligne — données affichées en cache</Text>
        </View>
      )}

      {/* Hero */}
      <View style={{ backgroundColor:C.pri, padding:16, paddingBottom:18 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Patrimoine Total</Text>
          <View style={{ flexDirection:'row', gap:6 }}>
            <TouchableOpacity
              onPress={onRefreshOr} disabled={isRefreshing}
              style={{ backgroundColor:C.priD, borderRadius:6, paddingHorizontal:8, paddingVertical:3, alignItems:'center' }}
              activeOpacity={0.7}
            >
              {isRefreshing
                ? <ActivityIndicator size="small" color="rgba(180,230,200,0.9)"/>
                : <>
                    <Text style={{ fontSize:10, color:'rgba(180,230,200,0.9)' }}>↻ Or</Text>
                    {data.lastUpdate ? (
                      <Text style={{ fontSize:7, color:'rgba(180,230,200,0.5)', textAlign:'center' }}>{data.lastUpdate}</Text>
                    ) : null}
                  </>
              }
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRefreshBVC}
              style={{ backgroundColor:C.priD, borderRadius:6, paddingHorizontal:8, paddingVertical:3, alignItems:'center' }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize:10, color:bvcStatus==='ok'?'#6EE7A0':bvcStatus==='error'?C.acc:'rgba(180,230,200,0.9)' }}>
                {bvcStatus==='ok'?'✓ BVC':bvcStatus==='error'?'⚠ BVC':'↻ BVC'}
              </Text>
              {bvcUpdated ? (
                <Text style={{ fontSize:7, color:'rgba(180,230,200,0.5)', textAlign:'center' }}>{bvcUpdated}</Text>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={{ color:C.white, fontWeight:'700', fontSize:28 }}>
          {discret ? '•••• DH' : fmt(total)}
        </Text>

        {/* P&L global */}
        {cost > 0 && !discret && (
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:4 }}>
            <View style={{ backgroundColor:'rgba(0,0,0,0.2)', borderRadius:6, paddingHorizontal:8, paddingVertical:3 }}>
              <Text style={{ fontSize:11, color:pl >= 0 ? '#6EE7A0' : C.acc, fontWeight:'600' }}>
                P&L global : {pl >= 0 ? '+' : ''}{fmt(pl)} ({pl >= 0 ? '+' : ''}{plPct.toFixed(1)}%)
              </Text>
            </View>
          </View>
        )}

        {data.lastUpdate ? (
          <Text style={{ fontSize:11, color:'rgba(180,230,200,0.7)', marginTop:6 }}>
            Mis à jour : {data.lastUpdate}
          </Text>
        ) : null}

        {/* Sparkline ou message vide */}
        <View style={{ marginTop:10 }}>
          {(sparkData || demoSparkData) ? (
            <>
              <SparklineInteractive data={(sparkData || demoSparkData).pts} dates={(sparkData || demoSparkData).dates} color={C.acc}/>
              {demoSparkData && !sparkData && (
                <Text style={{ color:'rgba(180,230,200,0.55)', fontSize:9, textAlign:'center', marginTop:2 }}>
                  Aperçu démo — vos données apparaîtront après quelques jours
                </Text>
              )}
            </>
          ) : (
            <View style={{ height:48, alignItems:'center', justifyContent:'center', borderRadius:8, borderWidth:1, borderColor:'rgba(255,255,255,0.1)', borderStyle:'dashed' }}>
              <Text style={{ color:'rgba(180,230,200,0.45)', fontSize:11 }}>
                Graphique disponible après quelques jours d'utilisation
              </Text>
            </View>
          )}
        </View>

        {/* Filtres période */}
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

        {/* Objectif patrimonial */}
        {objectif && objPct !== null && (
          <Card style={{ borderLeftWidth:4, borderLeftColor:C.acc, marginBottom:10 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>
                Objectif {objectif.dateTarget}
              </Text>
              <Text style={{ fontSize:12, fontWeight:'700', color:objPct >= 100 ? C.gpos : C.pri }}>
                {Math.round(objPct)}%
              </Text>
            </View>
            <BarH pct={objPct} color={objPct >= 100 ? C.gpos : C.acc} height={7}/>
            <Text style={{ fontSize:11, color:C.g3, marginTop:5 }}>
              {discret ? '•••• DH' : fmt(total)} / {discret ? '•••• DH' : fmt(objectif.montant)}
              {objPct >= 100 ? '  ✓ Objectif atteint !' : `  — ${discret ? '••••' : fmt(objectif.montant - total)} restants`}
            </Text>
            {objSimulation && !discret && (
              <View style={{ marginTop:6, backgroundColor:C.accL, borderRadius:6, padding:7, flexDirection:'row', alignItems:'center', gap:6 }}>
                <Text style={{ fontSize:10 }}>📈</Text>
                <Text style={{ fontSize:11, color:C.goldD, flex:1 }}>
                  À ce rythme (+{fmt(objSimulation.dailyGrowth)}/j) : atteint en <Text style={{ fontWeight:'700' }}>{objSimulation.months} mois</Text> ({objSimulation.monthStr})
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Bilan du jour */}
        <Card style={{ backgroundColor:C.priL, borderLeftWidth:4, borderLeftColor:C.pri, marginBottom:10 }}>
          <Text style={{ fontWeight:'700', fontSize:13, color:C.pri, marginBottom:8 }}>Bilan du jour</Text>
          <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
            <View style={{ alignItems:'center', flex:1 }}>
              <Text style={{ fontSize:9, color:C.g3 }}>Or / gramme</Text>
              <Text style={{ fontWeight:'700', fontSize:12, color:C.gold }}>{data.prixOr > 0 ? data.prixOr + ' DH' : 'N/A'}</Text>
            </View>
            <View style={{ width:1, backgroundColor:C.g2 }}/>
            <View style={{ alignItems:'center', flex:1 }}>
              <Text style={{ fontSize:9, color:C.g3 }}>P&L total</Text>
              {plGlobal ? (
                <Text style={{ fontWeight:'700', fontSize:12, color:plGlobal.diff>=0?C.gpos:C.rneg }}>
                  {plGlobal.diff>=0?'+':''}{plGlobal.pct.toFixed(1)}%
                </Text>
              ) : (
                <Text style={{ fontWeight:'700', fontSize:12, color:C.g3 }}>N/A</Text>
              )}
              {plGlobal && !discret && (
                <Text style={{ fontSize:8, color:C.g3 }}>depuis le {new Date(plGlobal.since).toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})}</Text>
              )}
            </View>
            <View style={{ width:1, backgroundColor:C.g2 }}/>
            <View style={{ alignItems:'center', flex:1 }}>
              <Text style={{ fontSize:9, color:C.g3 }}>MASI</Text>
              {masi ? (
                <>
                  <Text style={{ fontWeight:'700', fontSize:12, color:C.dark }}>{masi.cours?.toLocaleString('fr-FR',{maximumFractionDigits:0})}</Text>
                  {masi.var != null && (
                    <Text style={{ fontSize:9, color:masi.var>=0?C.gpos:C.rneg }}>{masi.var>=0?'+':''}{masi.var.toFixed(2)}%</Text>
                  )}
                </>
              ) : (
                <Text style={{ fontWeight:'700', fontSize:12, color:C.g3 }}>N/A</Text>
              )}
            </View>
            <View style={{ width:1, backgroundColor:C.g2 }}/>
            <View style={{ alignItems:'center', flex:1 }}>
              <Text style={{ fontSize:9, color:C.g3 }}>Actifs</Text>
              <Text style={{ fontWeight:'700', fontSize:12, color:C.dark }}>
                {activeCats} cat.
              </Text>
            </View>
          </View>
        </Card>

        {/* Repartition */}
        <Card>
          <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, marginBottom:10 }}>Répartition du patrimoine</Text>
          <DonutSimple cats={cats} total={total}/>
        </Card>

        {/* Header categories + bouton partager */}
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:14, marginBottom:8 }}>
          <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>Détail par catégorie</Text>
          <TouchableOpacity
            onPress={handleShare}
            style={{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor:C.priL, borderRadius:8, paddingHorizontal:10, paddingVertical:5 }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize:11, color:C.pri, fontWeight:'600' }}>↑ Partager</Text>
          </TouchableOpacity>
        </View>

        {cats.map((c, i) => (
          <Card key={i} style={{ padding:12 }} onPress={() => { onNav('actifs', c.id); }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
              <IconBox label={c.abbr} bg={c.col} size={36} fs={9}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'600', fontSize:13, color:C.dark }}>{c.label}</Text>
                <View style={{ marginTop:4 }}>
                  <BarH pct={total>0?c.val/total*100:0} color={c.col}/>
                </View>
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Text style={{ fontWeight:'700', fontSize:12, color:C.dark }}>{discret ? '••••' : fmt(c.val)}</Text>
                {c.plPct != null && (
                  <Text style={{ fontSize:11, color:c.plPct>=0?C.gpos:C.rneg }}>
                    {c.plPct>=0?'▲':'▼'} {Math.abs(c.plPct).toFixed(1)}%
                  </Text>
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
