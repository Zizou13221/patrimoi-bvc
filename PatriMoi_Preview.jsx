/**
 * PatriMoi — Web Preview (React, no React Native)
 * Aperçu fidèle de l'UI pour le navigateur
 */
import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer } from "recharts";

// ── Palette ──────────────────────────────────────────────
const C = {
  pri:'#1A6B3A', priL:'#E8F5EE', priD:'#0F4B26',
  sec:'#C8102E', acc:'#F5A623', accL:'#FEF7DC',
  navy:'#1E3C82', navyL:'#E1E8FA',
  teal:'#008080', tealL:'#E0F4F4',
  gold:'#B88E30', goldL:'#FFF8DC', goldD:'#785A14',
  gpos:'#27AE60', rneg:'#E74C3C',
  g1:'#F1F3F5', g2:'#CED4DA', g3:'#868E96',
  dark:'#1C2833', bg:'#F8FAFA', white:'#FFFFFF',
};

// ── Données initiales ────────────────────────────────────
const INIT = {
  liquidites: { dh:7500, devises:[
    {code:'USD',nom:'Dollar US',quantite:1500,taux:10.22,variation:+0.12},
    {code:'EUR',nom:'Euro',quantite:1000,taux:10.81,variation:+0.05},
    {code:'GBP',nom:'Livre Sterling',quantite:200,taux:12.65,variation:+0.21},
    {code:'SAR',nom:'Riyal Saoudien',quantite:1000,taux:2.72,variation:-0.03},
  ]},
  banque:[
    {banque:'CIH Bank',solde:130000,compte:'Compte courant'},
    {banque:'Attijariwafa Bank',solde:85000,compte:'Compte courant'},
  ],
  carnet:[
    {banque:'CIH Bank',solde:30000,taux:3.0},
    {banque:'Banque Populaire',solde:15000,taux:2.5},
  ],
  pea:[
    {ticker:'ATW',nom:'Attijariwafa Bank',pru:124.50,cours:128.20,qty:80},
    {ticker:'BCP',nom:'Banque Centrale Pop.',pru:290.00,cours:312.50,qty:100},
    {ticker:'ATL',nom:'Attijari Leasing',pru:156.00,cours:162.40,qty:60},
    {ticker:'IAM',nom:'Maroc Telecom',pru:140.00,cours:136.80,qty:60},
    {ticker:'CIH',nom:'CIH Bank',pru:320.00,cours:345.00,qty:45},
  ],
  ct:{
    actions:[
      {ticker:'MNG',nom:'Managem',pru:265,cours:290,qty:20},
      {ticker:'WAA',nom:'Wafa Assurance',pru:3800,cours:4100,qty:5},
      {ticker:'HPS',nom:'HPS',pru:5200,cours:4950,qty:3},
    ],
    opcvm:[
      {code:'OPC1',nom:'BMCE Cap. Actions',vl:1230,parts:5},
      {code:'OPC2',nom:'CDG Oblig.',vl:1050,parts:10},
      {code:'OPC3',nom:'Wafa Diversifié',vl:2310,parts:3},
    ],
  },
  immobilier:[
    {nom:'Appt. Guéliz',type:'Bien bati',ville:'Marrakech',surface:85,prixM2:8000,prixOffert:720000,meth:'offert'},
    {nom:'Terrain Benslimane',type:'Terrain',ville:'Benslimane',surface:2000,prixM2:130,prixOffert:null,meth:'estimatif'},
  ],
  transport:[
    {nom:'Dacia Logan',annee:2019,valEstim:92000,prixOffert:95000,meth:'offert'},
  ],
  or:[
    {nom:'Lingot 250g',quantite:250,prixOffert:null},
    {nom:'Pièces 21K',quantite:125,prixOffert:null},
  ],
  prixOr:905,
  lastUpdate:'20/03/2025 09:30',
};

const PROVERBES = [
  {q:"L'argent est un bon serviteur mais un mauvais maître.",a:"Francis Bacon",d:"Philosophe (1561-1626)",comment:"Laissez votre patrimoine travailler pour vous !"},
  {q:"Ne remettez pas à demain ce que vous pouvez investir aujourd'hui.",a:"Benjamin Franklin",d:"Fondateur et économiste (1706-1790)",comment:"Chaque jour sans investir, c'est un intérêt composé de perdu."},
  {q:"Le risque vient de ne pas savoir ce que vous faites.",a:"Warren Buffett",d:"Investisseur milliardaire (1930-)",comment:"Connaissez vos actifs. PatriMoi vous aide à y voir clair."},
  {q:"Un investissement dans la connaissance rapporte le meilleur intérêt.",a:"Benjamin Franklin",d:"Fondateur (1706-1790)",comment:"Lisez, apprenez, et votre portefeuille vous remerciera."},
  {q:"La richesse, c'est savoir faire durer son argent.",a:"Proverbe marocain",d:"Sagesse populaire",comment:"Le dirham qui dort, c'est le dirham qui maigrit."},
  {q:"Ce n'est pas combien vous gagnez qui compte, c'est combien vous gardez.",a:"Robert Kiyosaki",d:"Auteur (1947-)",comment:"Suivez chaque dirham. PatriMoi est là pour vous."},
];

// ── Fonctions de calcul ──────────────────────────────────
const calcLiquide   = (liq) => liq.dh + liq.devises.reduce((s,d)=>s+d.quantite*d.taux,0);
const calcBanque    = (arr) => arr.reduce((s,b)=>s+b.solde,0);
const calcCarnet    = (arr) => arr.reduce((s,c)=>s+c.solde,0);
const calcPEA       = (arr) => arr.reduce((s,t)=>s+t.cours*t.qty,0);
const calcPEACout   = (arr) => arr.reduce((s,t)=>s+t.pru*t.qty,0);
const calcCT        = (ct)  => ct.actions.reduce((s,t)=>s+t.cours*t.qty,0)+ct.opcvm.reduce((s,o)=>s+o.vl*o.parts,0);
const calcCTCout    = (ct)  => ct.actions.reduce((s,t)=>s+t.pru*t.qty,0)+ct.opcvm.reduce((s,o)=>s+o.vl*o.parts*0.95,0);
const valImmo       = (b)   => b.meth==='estimatif'?b.prixM2*b.surface:(b.prixOffert||b.prixM2*b.surface);
const calcImmo      = (arr) => arr.reduce((s,b)=>s+valImmo(b),0);
const valTransport  = (t)   => t.meth==='estimatif'?t.valEstim:(t.prixOffert||t.valEstim);
const calcTransport = (arr) => arr.reduce((s,t)=>s+valTransport(t),0);
const valOr         = (o,px)=> Math.max(o.quantite*px,o.prixOffert||0);
const calcOr        = (arr,px)=>arr.reduce((s,o)=>s+valOr(o,px),0);
const totalPatrimoine=(d)=>calcLiquide(d.liquidites)+calcBanque(d.banque)+calcCarnet(d.carnet)+calcPEA(d.pea)+calcCT(d.ct)+calcImmo(d.immobilier)+calcTransport(d.transport)+calcOr(d.or,d.prixOr);

const fmt    = (n) => new Intl.NumberFormat('fr-MA',{style:'currency',currency:'MAD',maximumFractionDigits:0}).format(n);
const pctDiff= (v,c)=>c>0?((v-c)/c*100):0;

// ── Composants partagés ──────────────────────────────────
const Card = ({children, style={}, onClick}) => (
  <div onClick={onClick} style={{background:C.white,borderRadius:12,padding:'12px 14px',marginBottom:8,border:`1px solid ${C.g2}`,cursor:onClick?'pointer':'default',...style}}>
    {children}
  </div>
);

const IconBox = ({label,bg,size=36,fs=9}) => (
  <div style={{width:size,height:size,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
    <span style={{color:'#fff',fontWeight:700,fontSize:fs}}>{label}</span>
  </div>
);

const BarH = ({pct,color=C.pri,height=5}) => (
  <div style={{background:C.g1,borderRadius:4,height,overflow:'hidden'}}>
    <div style={{background:color,height:'100%',width:`${Math.min(100,pct)}%`,borderRadius:4,transition:'width 0.3s'}}/>
  </div>
);

const Toggle = ({on,onChange}) => (
  <div onClick={()=>onChange(!on)} style={{width:42,height:24,borderRadius:12,background:on?C.pri:C.g2,cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
    <div style={{position:'absolute',top:2,left:on?18:2,width:20,height:20,borderRadius:10,background:'#fff',transition:'left 0.2s'}}/>
  </div>
);

const TopBar = ({title,subtitle}) => (
  <div style={{background:C.pri,padding:'14px 16px'}}>
    <div style={{color:C.white,fontWeight:700,fontSize:15}}>{title}</div>
    {subtitle&&<div style={{color:'rgba(180,230,200,0.85)',fontSize:11,marginTop:2}}>{subtitle}</div>}
  </div>
);

// ── Page Proverbe ────────────────────────────────────────
function PageProverbe({onNav,data}) {
  const today    = new Date();
  const dayOfYear= Math.floor((today-new Date(today.getFullYear(),0,0))/86400000);
  const prv      = PROVERBES[dayOfYear%PROVERBES.length];
  const initials = prv.a.split(' ').map(w=>w[0]).slice(0,2).join('');
  const total    = useMemo(()=>totalPatrimoine(data),[data]);
  const financier= calcPEA(data.pea)+calcCT(data.ct)+calcBanque(data.banque)+calcCarnet(data.carnet)+calcLiquide(data.liquidites);
  const immo     = calcImmo(data.immobilier);
  const or       = calcOr(data.or,data.prixOr);

  return (
    <div style={{flex:1,overflowY:'auto',background:C.bg}}>
      {/* Header */}
      <div style={{background:C.pri,padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{color:C.white,fontWeight:700,fontSize:16}}>Bonjour, Mohammed !</div>
            <div style={{color:'rgba(255,255,255,0.75)',fontSize:11,marginTop:3}}>
              {today.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </div>
          </div>
          <div style={{background:'rgba(255,255,255,0.15)',borderRadius:8,padding:'5px 10px',textAlign:'right'}}>
            <div style={{color:'rgba(180,230,200,0.9)',fontSize:10}}>Patrimoine total</div>
            <div style={{color:C.white,fontWeight:700,fontSize:15}}>{fmt(total)}</div>
          </div>
        </div>
        <div onClick={()=>onNav('actifs')} style={{marginTop:12,background:'rgba(255,255,255,0.12)',borderRadius:10,padding:10,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
          <div style={{display:'flex',gap:16}}>
            {[{label:'Financier',val:financier,col:'#6EE7A0'},{label:'Immo',val:immo,col:C.acc},{label:'Or',val:or,col:'#FFD700'}].map((cat,i)=>(
              <div key={i} style={{textAlign:'center'}}>
                <div style={{color:cat.col,fontWeight:700,fontSize:12}}>{total>0?Math.round(cat.val/total*100):0}%</div>
                <div style={{color:'rgba(255,255,255,0.6)',fontSize:9}}>{cat.label}</div>
              </div>
            ))}
          </div>
          <div style={{color:'rgba(255,255,255,0.8)',fontSize:12}}>Voir mes actifs →</div>
        </div>
      </div>

      {/* Proverbe */}
      <div style={{background:C.priD,margin:12,borderRadius:16,padding:16}}>
        <div style={{color:'rgba(180,230,200,0.9)',fontSize:11,fontWeight:600,marginBottom:6}}>Proverbe du Jour — {dayOfYear}/366</div>
        <div style={{color:C.white,fontSize:15,fontWeight:700,lineHeight:1.5,marginBottom:12}}>"{prv.q}"</div>
        <div style={{background:'rgba(255,255,255,0.08)',height:1,marginBottom:12}}/>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <div style={{width:50,height:50,borderRadius:25,background:C.acc,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <span style={{color:C.white,fontWeight:700,fontSize:16}}>{initials}</span>
          </div>
          <div>
            <div style={{color:C.white,fontWeight:700,fontSize:13}}>{prv.a}</div>
            <div style={{color:'rgba(160,210,180,0.9)',fontSize:11}}>{prv.d}</div>
          </div>
        </div>
        <div style={{background:'rgba(20,90,45,0.9)',borderRadius:10,padding:12,borderLeft:`4px solid ${C.acc}`}}>
          <div style={{color:C.acc,fontWeight:700,fontSize:11,marginBottom:4}}>PatriMoi dit :</div>
          <div style={{color:'rgba(200,240,210,0.95)',fontSize:12,lineHeight:1.6}}>{prv.comment}</div>
        </div>
        <button onClick={()=>onNav('dashboard')} style={{marginTop:12,background:C.acc,border:'none',borderRadius:8,padding:'9px 18px',color:C.white,fontWeight:700,fontSize:12,cursor:'pointer'}}>
          Voir mon patrimoine →
        </button>
      </div>

      {/* Témoignages */}
      <div style={{padding:'0 12px'}}>
        <div style={{fontWeight:700,fontSize:13,color:C.dark,margin:'8px 0'}}>Ils font confiance à PatriMoi</div>
        {[
          {ini:'RM',nom:'Rachid M.',ville:'Casablanca',avis:'Enfin une app marocaine qui comprend nos actifs !',stars:5},
          {ini:'SB',nom:'Sara B.',ville:'Rabat',avis:'Super intuitif. Mes DH ne dorment plus. Merci PatriMoi !',stars:5},
          {ini:'KA',nom:'Karim A.',ville:'Marrakech',avis:"Le suivi de l'or et la BVC sont excellents.",stars:5},
        ].map((t,i)=>(
          <Card key={i}>
            <div style={{display:'flex',gap:10,marginBottom:8,alignItems:'center'}}>
              <div style={{width:40,height:40,borderRadius:20,background:C.priL,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{color:C.pri,fontWeight:700,fontSize:14}}>{t.ini}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13,color:C.dark}}>{t.nom}</div>
                <div style={{fontSize:11,color:C.g3}}>{t.ville}</div>
              </div>
              <span style={{fontSize:12,color:C.acc}}>{'★'.repeat(t.stars)}</span>
            </div>
            <div style={{fontSize:12,color:C.g3,fontStyle:'italic'}}>"{t.avis}"</div>
          </Card>
        ))}
        <div style={{background:C.pri,borderRadius:16,margin:'12px 0 16px',padding:20,textAlign:'center'}}>
          <div style={{color:'rgba(180,230,200,0.9)',fontSize:13,marginBottom:4}}>Utilisateurs actifs</div>
          <div style={{color:C.white,fontWeight:700,fontSize:40}}>+12 400</div>
          <div style={{color:'rgba(180,230,200,0.75)',fontSize:12,marginTop:4}}>et ça grandit chaque jour</div>
        </div>
      </div>
    </div>
  );
}

// ── Page Dashboard ───────────────────────────────────────
function PageDashboard({data,onNav}) {
  const [period,setPeriod] = useState('1A');
  const peaVal  = useMemo(()=>calcPEA(data.pea),[data.pea]);
  const peaCout = useMemo(()=>calcPEACout(data.pea),[data.pea]);
  const ctVal   = useMemo(()=>calcCT(data.ct),[data.ct]);
  const ctCout  = useMemo(()=>calcCTCout(data.ct),[data.ct]);
  const orVal   = useMemo(()=>calcOr(data.or,data.prixOr),[data.or,data.prixOr]);

  const cats = useMemo(()=>[
    {id:'liquide',   label:'Argent Liquide',       val:calcLiquide(data.liquidites), col:C.gpos,    abbr:'LIQ', plPct:null},
    {id:'banque',    label:'Argent en Banque',      val:calcBanque(data.banque),       col:C.navy,    abbr:'BNQ', plPct:null},
    {id:'carnet',    label:'Compte sur Carnet',     val:calcCarnet(data.carnet),       col:C.teal,    abbr:'CRT', plPct:null},
    {id:'pea',       label:'Compte PEA',            val:peaVal,                        col:C.pri,     abbr:'PEA', plPct:pctDiff(peaVal,peaCout)},
    {id:'ct',        label:'Compte-Titre',          val:ctVal,                         col:C.navy,    abbr:'CT',  plPct:pctDiff(ctVal,ctCout)},
    {id:'or',        label:'Or & Métaux Précieux',  val:orVal,                         col:C.gold,    abbr:'OR',  plPct:null},
    {id:'immobilier',label:'Immobilier & Terrains', val:calcImmo(data.immobilier),     col:'#B46428', abbr:'IMM', plPct:null},
    {id:'transport', label:'Biens de Transport',    val:calcTransport(data.transport), col:'#50506A', abbr:'VEH', plPct:null},
  ].sort((a,b)=>b.val-a.val),[data,peaVal,peaCout,ctVal,ctCout,orVal]);

  const total = useMemo(()=>cats.reduce((s,c)=>s+c.val,0),[cats]);
  const sparkData = [1.60,1.65,1.58,1.72,1.70,1.78,1.82,1.86,1.89,1.934].map(v=>({v:v*1e6}));

  return (
    <div style={{flex:1,overflowY:'auto',background:C.g1}}>
      {/* Hero */}
      <div style={{background:C.pri,padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <span style={{color:'rgba(180,230,200,0.9)',fontSize:12}}>Patrimoine Total</span>
          <div style={{display:'flex',gap:6}}>
            <span style={{background:C.priD,borderRadius:6,padding:'3px 8px',fontSize:10,color:'rgba(180,230,200,0.9)'}}>↻ Or {data.lastUpdate}</span>
            <span style={{background:C.priD,borderRadius:6,padding:'3px 8px',fontSize:10,color:'#6EE7A0'}}>✓ BVC</span>
          </div>
        </div>
        <div style={{color:C.white,fontWeight:700,fontSize:28}}>{fmt(total)}</div>
        <div style={{background:'rgba(255,255,255,0.12)',borderRadius:8,padding:'5px 10px',display:'inline-block',marginTop:6}}>
          <span style={{fontSize:12,color:'#6EE7A0'}}>+14 200 DH — +0,74% aujourd'hui</span>
        </div>
        <div style={{marginTop:10,height:50}}>
          <ResponsiveContainer width="100%" height={50}>
            <AreaChart data={sparkData} margin={{top:0,bottom:0,left:0,right:0}}>
              <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.acc} stopOpacity={0.3}/><stop offset="95%" stopColor={C.acc} stopOpacity={0}/></linearGradient></defs>
              <Area type="monotone" dataKey="v" stroke={C.acc} strokeWidth={2} fill="url(#sg)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{display:'flex',background:'rgba(0,0,0,0.15)',borderRadius:8,marginTop:8,padding:2}}>
          {['1S','1M','3M','6M','1A','MAX'].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{flex:1,padding:'5px 0',border:'none',borderRadius:6,background:period===p?C.pri:'transparent',color:period===p?C.white:'rgba(255,255,255,0.7)',fontSize:11,fontWeight:period===p?700:400,cursor:'pointer'}}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:12}}>
        {/* Bilan du jour */}
        <Card style={{background:C.priL,borderLeft:`4px solid ${C.pri}`}}>
          <div style={{fontWeight:700,fontSize:13,color:C.pri,marginBottom:8}}>Bilan du jour</div>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:10,color:C.g3}}>Or / gramme</div>
              <div style={{fontWeight:700,fontSize:13,color:C.gold}}>{data.prixOr} DH</div>
            </div>
            <div style={{width:1,background:C.g2}}/>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:10,color:C.g3}}>PEA P&L</div>
              <div style={{fontWeight:700,fontSize:13,color:peaVal>=peaCout?C.gpos:C.rneg}}>
                {peaCout>0?(pctDiff(peaVal,peaCout)>=0?'+':'')+pctDiff(peaVal,peaCout).toFixed(1)+'%':'N/A'}
              </div>
            </div>
            <div style={{width:1,background:C.g2}}/>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:10,color:C.g3}}>Actifs</div>
              <div style={{fontWeight:700,fontSize:13,color:C.dark}}>8 catégories</div>
            </div>
          </div>
        </Card>

        {/* Donut */}
        <Card>
          <div style={{fontWeight:700,fontSize:13,color:C.dark,marginBottom:10}}>Répartition du patrimoine</div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <PieChart width={140} height={140}>
              <Pie data={cats} dataKey="val" cx={65} cy={65} innerRadius={45} outerRadius={65} paddingAngle={2}>
                {cats.map((c,i)=><Cell key={i} fill={c.col}/>)}
              </Pie>
            </PieChart>
            <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {cats.slice(0,6).map((c,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:8,height:8,borderRadius:2,background:c.col,flexShrink:0}}/>
                  <span style={{fontSize:9,color:C.g3}}>{c.abbr}</span>
                  <span style={{fontSize:9,fontWeight:700,color:C.dark,marginLeft:'auto'}}>{total>0?Math.round(c.val/total*100):0}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Liste catégories */}
        <div style={{fontWeight:700,fontSize:13,color:C.dark,margin:'8px 0'}}>Détail par catégorie</div>
        {cats.map((c,i)=>(
          <Card key={i} onClick={()=>onNav('actifs')} style={{padding:12}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <IconBox label={c.abbr} bg={c.col} size={36} fs={9}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,color:C.dark}}>{c.label}</div>
                <div style={{marginTop:4}}>
                  <BarH pct={Math.min(total>0?c.val/total*100*3:0,90)} color={c.col}/>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:700,fontSize:12,color:C.dark}}>{fmt(c.val)}</div>
                {c.plPct!=null&&<div style={{fontSize:11,color:c.plPct>=0?C.gpos:C.rneg}}>{c.plPct>=0?'▲':'▼'} {Math.abs(c.plPct).toFixed(1)}%</div>}
              </div>
              <span style={{color:C.g2,fontSize:18}}>›</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Page Actifs (simplifiée) ─────────────────────────────
function PageActifs({data,setData}) {
  const [sub,setSub] = useState(null);
  const categories = [
    {id:'liquide',   label:'Argent Liquide',       val:calcLiquide(data.liquidites), col:C.gpos, abbr:'LIQ'},
    {id:'banque',    label:'Argent en Banque',      val:calcBanque(data.banque),      col:C.navy, abbr:'BNQ'},
    {id:'carnet',    label:'Compte sur Carnet',     val:calcCarnet(data.carnet),      col:C.teal, abbr:'CRT'},
    {id:'pea',       label:'Compte PEA',            val:calcPEA(data.pea),            col:C.pri,  abbr:'PEA'},
    {id:'ct',        label:'Compte-Titre',          val:calcCT(data.ct),              col:C.navy, abbr:'CT'},
    {id:'or',        label:'Or & Métaux Précieux',  val:calcOr(data.or,data.prixOr),  col:C.gold, abbr:'OR'},
    {id:'immobilier',label:'Immobilier & Terrains', val:calcImmo(data.immobilier),    col:'#B46428',abbr:'IMM'},
    {id:'transport', label:'Biens de Transport',    val:calcTransport(data.transport),col:'#50506A',abbr:'VEH'},
  ];
  const total = categories.reduce((s,c)=>s+c.val,0);

  if (sub) {
    const cat = categories.find(c=>c.id===sub);
    return (
      <div style={{flex:1,overflowY:'auto',background:C.g1}}>
        <TopBar title={cat.label} subtitle={fmt(cat.val)}/>
        <div style={{padding:12}}>
          <button onClick={()=>setSub(null)} style={{background:'none',border:`1px solid ${C.pri}`,borderRadius:8,padding:'6px 14px',color:C.pri,fontWeight:600,fontSize:12,cursor:'pointer',marginBottom:10}}>
            ← Retour aux actifs
          </button>
          {sub==='pea'&&data.pea.map((t,i)=>(
            <Card key={i} style={{padding:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:C.dark}}>{t.ticker}</div>
                  <div style={{fontSize:11,color:C.g3}}>{t.nom} — {t.qty} titres</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontWeight:700,fontSize:13}}>{fmt(t.cours*t.qty)}</div>
                  <div style={{fontSize:11,color:t.cours>=t.pru?C.gpos:C.rneg}}>{t.cours>=t.pru?'▲':'▼'} {Math.abs(pctDiff(t.cours,t.pru)).toFixed(1)}%</div>
                </div>
              </div>
            </Card>
          ))}
          {sub==='banque'&&data.banque.map((b,i)=>(
            <Card key={i} style={{padding:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:C.dark}}>{b.banque}</div>
                  <div style={{fontSize:11,color:C.g3}}>{b.compte}</div>
                </div>
                <div style={{fontWeight:700,fontSize:13}}>{fmt(b.solde)}</div>
              </div>
            </Card>
          ))}
          {sub==='immobilier'&&data.immobilier.map((b,i)=>(
            <Card key={i} style={{padding:12}}>
              <div style={{fontWeight:700,fontSize:13,color:C.dark}}>{b.nom}</div>
              <div style={{fontSize:11,color:C.g3}}>{b.ville} — {b.surface} m²</div>
              <div style={{fontWeight:700,fontSize:14,color:C.pri,marginTop:6}}>{fmt(valImmo(b))}</div>
            </Card>
          ))}
          {sub==='or'&&data.or.map((o,i)=>(
            <Card key={i} style={{padding:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:C.dark}}>{o.nom}</div>
                  <div style={{fontSize:11,color:C.g3}}>{o.quantite}g × {data.prixOr} DH/g</div>
                </div>
                <div style={{fontWeight:700,fontSize:13,color:C.gold}}>{fmt(valOr(o,data.prixOr))}</div>
              </div>
            </Card>
          ))}
          {['liquide','carnet','ct','transport'].includes(sub)&&(
            <Card style={{background:C.priL,padding:14,textAlign:'center'}}>
              <div style={{fontWeight:700,fontSize:32,color:C.pri}}>{fmt(cat.val)}</div>
              <div style={{fontSize:12,color:C.g3,marginTop:4}}>Valeur totale {cat.label}</div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{flex:1,overflowY:'auto',background:C.g1}}>
      <TopBar title="Mes Actifs" subtitle={`${fmt(total)} — 8 catégories`}/>
      <div style={{padding:12}}>
        {categories.map((c,i)=>(
          <Card key={i} onClick={()=>setSub(c.id)} style={{padding:12}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <IconBox label={c.abbr} bg={c.col} size={40} fs={10}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,color:C.dark}}>{c.label}</div>
                <BarH pct={Math.min(total>0?c.val/total*100*3:0,85)} color={c.col} height={5}/>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:700,fontSize:13,color:C.dark}}>{fmt(c.val)}</div>
                <div style={{fontSize:11,color:C.g3}}>{total>0?Math.round(c.val/total*100):0}%</div>
              </div>
              <span style={{color:C.g2,fontSize:18}}>›</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Page Conseils ────────────────────────────────────────
function PageConseils({data,onNav}) {
  const peaVal = calcPEA(data.pea);
  const peaCout= calcPEACout(data.pea);
  const total  = useMemo(()=>totalPatrimoine(data),[data]);

  const conseils = useMemo(()=>{
    const cs=[];
    const liq=(calcLiquide(data.liquidites)+calcBanque(data.banque));
    const liqPct=total>0?liq/total*100:0;
    if(liqPct>30) cs.push({id:1,icon:'💧',titre:'Liquidités élevées',corps:`Vos liquidités représentent ${Math.round(liqPct)}% du patrimoine. Considérez de placer une partie en PEA ou carnet d'épargne.`,couleur:C.navy,priority:2,action:'Voir mon PEA',nav:'actifs'});
    if(peaCout>0&&pctDiff(peaVal,peaCout)<-5) cs.push({id:2,icon:'📉',titre:'PEA en moins-value',corps:`Votre PEA affiche une moins-value de ${Math.abs(pctDiff(peaVal,peaCout)).toFixed(1)}%. Évaluez si un renforcement est judicieux.`,couleur:C.rneg,priority:1,action:'Voir mon PEA',nav:'actifs'});
    if(calcOr(data.or,data.prixOr)/total<0.05) cs.push({id:3,icon:'🥇',titre:'Diversifiez dans l\'or',corps:'L\'or représente moins de 5% de votre patrimoine. Une allocation de 5-10% protège contre l\'inflation.',couleur:C.gold,priority:3,action:'Voir mon or',nav:'actifs'});
    return cs;
  },[data,total,peaVal,peaCout]);

  const scores = [
    {label:'Diversification',pct:Math.min(100,(calcOr(data.or,data.prixOr)>0?25:0)+(calcImmo(data.immobilier)>0?25:0)+(peaVal>0?25:0)+(calcCT(data.ct)>0?25:0)),col:C.pri},
    {label:'Épargne réglementée',pct:Math.min(100,calcCarnet(data.carnet)>0?80:10),col:C.teal},
    {label:'Investissements BVC',pct:Math.min(100,total>0?(peaVal+calcCT(data.ct))/total*300:0),col:C.navy},
    {label:'Liquidité optimale',pct:Math.min(100,total>0?Math.max(0,100-Math.abs(((calcLiquide(data.liquidites)+calcBanque(data.banque))/total*100)-15)*4):0),col:C.gpos},
  ];

  return (
    <div style={{flex:1,overflowY:'auto',background:C.g1}}>
      <TopBar title="Conseils & Ressources" subtitle="Basés sur votre vrai portfolio"/>
      <div style={{padding:12}}>
        {conseils.length>0&&<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
          <div style={{width:8,height:8,borderRadius:4,background:C.gpos}}/>
          <span style={{fontWeight:700,fontSize:14,color:C.dark}}>{conseils.length} recommandation{conseils.length>1?'s':''} pour vous</span>
        </div>}
        {conseils.map(c=>(
          <Card key={c.id} style={{borderLeft:`4px solid ${c.couleur}`,background:c.priority===1?'#FFF0F0':c.priority===2?'#FFF8E8':'#F0F8FF'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:28,height:28,borderRadius:14,background:c.couleur,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>
                  {c.icon}
                </div>
                <span style={{fontWeight:700,fontSize:13,color:C.dark}}>{c.titre}</span>
              </div>
              <span style={{background:`${c.couleur}22`,borderRadius:6,padding:'2px 7px',fontSize:9,fontWeight:700,color:c.couleur}}>
                {c.priority===1?'Urgent':c.priority===2?'Important':'À considérer'}
              </span>
            </div>
            <div style={{fontSize:12,color:C.dark,lineHeight:1.6,marginBottom:10}}>{c.corps}</div>
            <button onClick={()=>onNav(c.nav)} style={{background:c.couleur,border:'none',borderRadius:8,padding:'8px 0',width:'100%',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'}}>
              {c.action} →
            </button>
          </Card>
        ))}

        <Card>
          <div style={{fontWeight:700,fontSize:13,color:C.dark,marginBottom:10}}>Score de santé de votre patrimoine</div>
          {scores.map((s,i)=>(
            <div key={i} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:11,color:C.dark}}>{s.label}</span>
                <span style={{fontSize:11,fontWeight:700,color:s.col}}>{Math.round(s.pct)}%</span>
              </div>
              <BarH pct={s.pct} color={s.col} height={6}/>
            </div>
          ))}
        </Card>

        <div style={{fontWeight:700,fontSize:13,color:C.dark,margin:'8px 0 6px'}}>Sources officielles</div>
        {[
          {abbr:'BVC',col:C.pri,url:'casablanca-bourse.com',desc:'Cours officiels BVC'},
          {abbr:'BAM',col:C.navy,url:'bkam.ma',desc:'Bank Al-Maghrib'},
          {abbr:'AMC',col:C.sec,url:'ammc.ma',desc:'Régulateur des marchés'},
          {abbr:'IMB',col:C.teal,url:'mubawab.ma',desc:'Prix immobilier Maroc'},
        ].map((s,i)=>(
          <Card key={i} style={{padding:10}}>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <IconBox label={s.abbr} bg={s.col} size={34} fs={8}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>{s.url}</div>
                <div style={{fontSize:11,color:C.g3}}>{s.desc}</div>
              </div>
              <span style={{color:C.g2,fontSize:20}}>›</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Page À propos ────────────────────────────────────────
function PageAPropos() {
  return (
    <div style={{flex:1,overflowY:'auto',background:C.g1}}>
      <TopBar title="À propos de PatriMoi" subtitle="Made in Morocco, For Morocco"/>
      <div style={{padding:12}}>
        <div style={{textAlign:'center',padding:'20px 0'}}>
          <div style={{width:80,height:80,borderRadius:24,background:C.priL,display:'inline-flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginBottom:10}}>
            <span style={{fontWeight:700,fontSize:22,color:C.pri}}>PAT</span>
            <span style={{fontWeight:700,fontSize:12,color:C.acc}}>RIMOI</span>
          </div>
          <div style={{fontWeight:700,fontSize:20,color:C.pri}}>PatriMoi</div>
          <div style={{fontSize:12,color:C.g3,marginTop:4}}>Votre Patrimoine. Votre Avenir.</div>
        </div>

        <Card style={{borderLeft:`4px solid ${C.pri}`}}>
          <div style={{fontWeight:700,fontSize:14,color:C.pri,marginBottom:6}}>Notre mission</div>
          <div style={{fontSize:13,color:C.dark,lineHeight:1.6}}>Donner à chaque Marocain les outils pour comprendre, suivre et faire croître son patrimoine — simplement, en français ou en arabe, depuis son téléphone.</div>
        </Card>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,margin:'8px 0'}}>
          {[['12 400+','Utilisateurs'],['4,8/5','Note app'],['8','Catégories'],['366','Proverbes']].map(([v,l],i)=>(
            <div key={i} style={{background:C.white,borderRadius:12,padding:12,textAlign:'center',border:`1px solid ${C.g2}`}}>
              <div style={{fontWeight:700,fontSize:14,color:C.pri}}>{v}</div>
              <div style={{fontSize:9,color:C.g3,marginTop:4}}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{fontWeight:700,fontSize:13,color:C.dark,margin:'8px 0 6px'}}>Contactez-nous</div>
        {[
          {abbr:'TEL',col:C.gpos,val:'06 00 00 00 00',sub:'Appel ou WhatsApp'},
          {abbr:'MAL',col:C.navy,val:'contact@patrimoi.ma',sub:'Support & questions'},
          {abbr:'WEB',col:C.pri,val:'www.patrimoi.ma',sub:'Site officiel'},
          {abbr:'IG',col:C.sec,val:'@patrimoi.app',sub:'Instagram & réseaux'},
        ].map((c,i)=>(
          <Card key={i} style={{padding:10}}>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <IconBox label={c.abbr} bg={c.col} size={34} fs={8}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>{c.val}</div>
                <div style={{fontSize:11,color:C.g3}}>{c.sub}</div>
              </div>
              <span style={{color:C.g2,fontSize:20}}>›</span>
            </div>
          </Card>
        ))}
        <div style={{background:C.pri,borderRadius:12,padding:14,textAlign:'center',marginTop:8}}>
          <div style={{color:C.white,fontWeight:700,fontSize:15}}>PatriMoi v1.3</div>
          <div style={{color:'rgba(180,230,200,0.85)',fontSize:11,marginTop:4}}>Made in Morocco — 2025</div>
        </div>
      </div>
    </div>
  );
}

// ── Page Paramètres ──────────────────────────────────────
function PageParams() {
  const [bio,setBio]         = useState(true);
  const [discret,setDiscret] = useState(false);
  const [rappels,setRappels] = useState(true);
  const [alertes,setAlertes] = useState(true);
  const [hebdo,setHebdo]     = useState(false);

  const sections = [
    {title:'Mon compte',items:[
      {label:'Informations personnelles',right:'›'},
      {label:"Monnaie d'affichage",right:'DH (MAD) ›'},
      {label:'Date de début de suivi',right:'01/01/2023 ›'},
    ]},
    {title:'Sécurité',items:[
      {label:'Auth. biométrique (Face ID)',right:<Toggle on={bio} onChange={setBio}/>},
      {label:'Code PIN 6 chiffres',right:'›'},
      {label:'Verrouillage automatique',right:'5 min ›'},
      {label:'Mode discret (masquer montants)',right:<Toggle on={discret} onChange={setDiscret}/>},
    ]},
    {title:'Notifications',items:[
      {label:"Rappels d'épargne",right:<Toggle on={rappels} onChange={setRappels}/>},
      {label:'Alertes de performance',right:<Toggle on={alertes} onChange={setAlertes}/>},
      {label:'Synthèse hebdo marchés',right:<Toggle on={hebdo} onChange={setHebdo}/>},
    ]},
    {title:'Données & Export',items:[
      {label:'Exporter en PDF',right:'›'},
      {label:'Exporter en CSV',right:'›'},
      {label:'Supprimer mon compte',right:<span style={{color:C.sec}}>›</span>},
    ]},
  ];

  return (
    <div style={{flex:1,overflowY:'auto',background:C.g1}}>
      <TopBar title="Paramètres" subtitle="PatriMoi v1.3"/>
      <div style={{padding:12}}>
        <Card style={{background:C.pri,padding:14}}>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <div style={{width:50,height:50,borderRadius:25,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{color:C.white,fontWeight:700,fontSize:18}}>MA</span>
            </div>
            <div style={{flex:1}}>
              <div style={{color:C.white,fontWeight:700,fontSize:15}}>Mohammed Alami</div>
              <div style={{color:'rgba(180,230,200,0.85)',fontSize:12}}>m.alami@gmail.com</div>
            </div>
            <div style={{background:C.acc,borderRadius:8,padding:'4px 10px'}}>
              <span style={{fontSize:11,fontWeight:700,color:C.white}}>PatriMoi+</span>
            </div>
          </div>
        </Card>

        {sections.map((sec,si)=>(
          <div key={si}>
            <div style={{fontSize:11,fontWeight:600,color:C.g3,marginTop:14,marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>{sec.title}</div>
            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.g2}`,overflow:'hidden'}}>
              {sec.items.map((it,ii)=>(
                <div key={ii} style={{display:'flex',alignItems:'center',padding:'13px 14px',borderBottom:ii<sec.items.length-1?`1px solid ${C.g1}`:'none'}}>
                  <span style={{flex:1,fontSize:13,color:C.dark}}>{it.label}</span>
                  {typeof it.right==='string'
                    ?<span style={{fontSize:12,color:C.g3}}>{it.right}</span>
                    :it.right
                  }
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{fontSize:11,fontWeight:600,color:C.g3,marginTop:14,marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>Abonnement</div>
        <Card style={{borderLeft:`4px solid ${C.pri}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:C.dark}}>Plan PatriMoi+</div>
              <div style={{fontSize:12,color:C.g3,marginTop:2}}>Comptes illimités · Temps réel · Export</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:700,fontSize:16,color:C.pri}}>49 DH</div>
              <div style={{fontSize:10,color:C.g3}}>/mois</div>
            </div>
          </div>
          <button style={{marginTop:10,width:'100%',border:`1px solid ${C.pri}`,borderRadius:8,padding:'8px 0',background:'transparent',color:C.pri,fontWeight:600,fontSize:12,cursor:'pointer'}}>
            Gérer mon abonnement →
          </button>
        </Card>
      </div>
    </div>
  );
}

// ── NavBar ───────────────────────────────────────────────
const NAV_ITEMS = [
  {id:'proverbe',label:'Accueil',icon:'🏠'},
  {id:'dashboard',label:'Tableau',icon:'📊'},
  {id:'actifs',label:'Actifs',icon:'💼'},
  {id:'conseils',label:'Conseils',icon:'💡'},
  {id:'apropos',label:'À propos',icon:'ℹ️'},
  {id:'params',label:'Réglages',icon:'⚙️'},
];

function NavBar({active,onChange}) {
  return (
    <div style={{display:'flex',background:C.white,borderTop:`1px solid ${C.g2}`,padding:'4px 0 2px'}}>
      {NAV_ITEMS.map(n=>(
        <button key={n.id} onClick={()=>onChange(n.id)} style={{flex:1,border:'none',background:'transparent',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',padding:'4px 0',gap:2}}>
          <span style={{fontSize:18}}>{n.icon}</span>
          <span style={{fontSize:9,fontWeight:active===n.id?700:400,color:active===n.id?C.pri:C.g3}}>{n.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── App Root ─────────────────────────────────────────────
export default function PatriMoiPreview() {
  const [page,setPage] = useState('proverbe');
  const [data,setData] = useState(INIT);

  const goTo = (p) => setPage(p);

  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'flex-start',minHeight:'100vh',background:'#E5E7EB',padding:'20px 0'}}>
      <div style={{width:390,height:780,display:'flex',flexDirection:'column',background:C.bg,borderRadius:40,overflow:'hidden',boxShadow:'0 25px 60px rgba(0,0,0,0.25)',border:'10px solid #1C1C1E'}}>
        {/* Status bar */}
        <div style={{background:C.pri,padding:'10px 20px 4px',display:'flex',justifyContent:'space-between'}}>
          <span style={{color:C.white,fontSize:12,fontWeight:600}}>9:41</span>
          <span style={{color:C.white,fontSize:12}}>●●●●  WiFi  🔋</span>
        </div>
        {/* Page content */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {page==='proverbe'  && <PageProverbe data={data} onNav={goTo}/>}
          {page==='dashboard' && <PageDashboard data={data} onNav={goTo}/>}
          {page==='actifs'    && <PageActifs data={data} setData={setData}/>}
          {page==='conseils'  && <PageConseils data={data} onNav={goTo}/>}
          {page==='apropos'   && <PageAPropos/>}
          {page==='params'    && <PageParams/>}
        </div>
        <NavBar active={page} onChange={setPage}/>
        {/* Home indicator */}
        <div style={{background:'#1C1C1E',padding:'6px 0',display:'flex',justifyContent:'center'}}>
          <div style={{width:120,height:4,borderRadius:2,background:'rgba(255,255,255,0.3)'}}/>
        </div>
      </div>
    </div>
  );
}
