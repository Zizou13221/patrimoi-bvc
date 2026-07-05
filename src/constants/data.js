// =========================================================
// CLÉS DE STOCKAGE
// =========================================================
export const STORAGE_KEY     = '@patrimoi_data_v1';
export const BVC_STORAGE_KEY = '@patrimoi_bvc_v1';

// =========================================================
// PARAMÈTRES CACHE BVC
// =========================================================
export const BVC_COURS_URL = 'https://raw.githubusercontent.com/Zizou13221/patrimoi-bvc/main/bvc_cours.json';
export const BVC_CACHE_MS  = 30 * 60 * 1000;       // 30 min — validité cache in-memory
export const BVC_STALE_MS  = 24 * 60 * 60 * 1000;  // 24h  — max âge cache persisté

// =========================================================
// PROVERBES (rotation par jour de l'année)
// =========================================================
export const PROVERBES = [
  { q:"L'argent est un bon serviteur mais un mauvais maitre.", a:"Francis Bacon", d:"Philosophe (1561-1626)", comment:"Laissez votre patrimoine travailler pour vous !" },
  { q:"Ne remettez pas a demain ce que vous pouvez investir aujourd'hui.", a:"Benjamin Franklin", d:"Fondateur et economiste (1706-1790)", comment:"Chaque jour sans investir, c'est un interet compose de perdu." },
  { q:"Le risque vient de ne pas savoir ce que vous faites.", a:"Warren Buffett", d:"Investisseur milliardaire (1930-)", comment:"Connaissez vos actifs. PatriMoi vous aide a y voir clair." },
  { q:"Achetez quand tout le monde vend, vendez quand tout le monde achete.", a:"Bernard Baruch", d:"Financier et conseiller (1870-1965)", comment:"La BVC aussi a ses moments de panique. Restez calme !" },
  { q:"Un investissement dans la connaissance rapporte le meilleur interet.", a:"Benjamin Franklin", d:"Fondateur et economiste (1706-1790)", comment:"Lisez, apprenez, et votre portefeuille vous remerciera." },
  { q:"La richesse, c'est savoir faire durer son argent.", a:"Proverbe marocain", d:"Sagesse populaire", comment:"Le dirham qui dort, c'est le dirham qui maigrit." },
  { q:"Le meilleur moment pour planter un arbre etait il y a 20 ans. Le second meilleur, c'est maintenant.", a:"Proverbe chinois", d:"Sagesse populaire", comment:"Commencez votre PEA aujourd'hui. Dans 5 ans, exoneration totale !" },
  { q:"Diversifiez vos investissements comme vous diversifiez vos repas.", a:"Peter Lynch", d:"Gestionnaire de fonds (1944-)", comment:"8 categories dans PatriMoi — exactement pour ca." },
  { q:"Ce n'est pas combien vous gagnez qui compte, c'est combien vous gardez.", a:"Robert Kiyosaki", d:"Auteur et entrepreneur (1947-)", comment:"Suivez chaque dirham. PatriMoi est la pour vous." },
  { q:"Epargner sans investir, c'est courir sur place.", a:"Anonyme", d:"Sagesse financiere", comment:"Faites travailler vos economies avec le Compte PEA." },
];

// =========================================================
// DONNÉES INITIALES (démo)
// =========================================================
export const INIT = {
  liquidites: {
    dh: 7500,
    devises: [
      { code:'USD', nom:'Dollar US',      quantite:1500, taux:10.22, variation:+0.12 },
      { code:'EUR', nom:'Euro',            quantite:1000, taux:10.81, variation:+0.05 },
      { code:'GBP', nom:'Livre Sterling',  quantite:200,  taux:12.65, variation:+0.21 },
      { code:'SAR', nom:'Riyal Saoudien',  quantite:1000, taux:2.72,  variation:-0.03 },
    ],
  },
  banque: [
    { banque:'CIH Bank',         solde:130000, compte:'Compte courant' },
    { banque:'Attijariwafa Bank', solde:85000,  compte:'Compte courant' },
  ],
  carnet: [
    { banque:'CIH Bank',        solde:30000, taux:3.0, rappel:{ montant:500,  freq:'Mensuel',     prochaine:'01/02/2025' } },
    { banque:'Banque Populaire', solde:15000, taux:2.5, rappel:{ montant:1000, freq:'Trimestriel', prochaine:'01/04/2025' } },
  ],
  pea: [
    { ticker:'ATW', nom:'Attijariwafa Bank',    pru:124.50, cours:128.20, qty:80  },
    { ticker:'BCP', nom:'Banque Centrale Pop.', pru:290.00, cours:312.50, qty:100 },
    { ticker:'ATL', nom:'Attijari Leasing',     pru:156.00, cours:162.40, qty:60  },
    { ticker:'IAM', nom:'Maroc Telecom',        pru:140.00, cours:136.80, qty:60  },
    { ticker:'CIH', nom:'CIH Bank',            pru:320.00, cours:345.00, qty:45  },
  ],
  ct: {
    actions: [
      { ticker:'MNG', nom:'Managem',        pru:265.00,  cours:290.00,  qty:20 },
      { ticker:'WAA', nom:'Wafa Assurance', pru:3800.00, cours:4100.00, qty:5  },
      { ticker:'HPS', nom:'HPS',            pru:5200.00, cours:4950.00, qty:3  },
    ],
    opcvm: [
      { code:'OPC1', nom:'BMCE Cap. Actions',   vl:1230, parts:5,  type:'Actions'     },
      { code:'OPC2', nom:'CDG Oblig. Court T.', vl:1050, parts:10, type:'Obligataire' },
      { code:'OPC3', nom:'Wafa Diversifie',     vl:2310, parts:3,  type:'Diversifie'  },
    ],
  },
  immobilier: [
    { id:1, nom:'Appartement Gueliz', type:'Bien bati', ville:'Marrakech',  surface:85,   unite:'m2', prixAchat:500000, datAchat:'2018', prixM2:8000, prixOffert:720000, meth:'offert'    },
    { id:2, nom:'Terrain Benslimane', type:'Terrain',   ville:'Benslimane', surface:2000, unite:'m2', prixAchat:230000, datAchat:'2020', prixM2:130,  prixOffert:null,   meth:'estimatif' },
  ],
  transport: [
    { id:1, nom:'Dacia Logan', type:'Voiture', annee:2019, immat:'A-123-456', prixAchat:120000, dateAchat:'2020', valEstim:92000, prixOffert:95000, meth:'offert' },
  ],
  or: [
    { id:1, nom:'Lingot 250g', quantite:250, unite:'g', prixAchat:185000, prixOffert:null },
    { id:2, nom:'Pieces 21K',  quantite:125, unite:'g', prixAchat:90000,  prixOffert:null },
  ],
  prixOr:     905,
  lastUpdate: '20/03/2025 09:30',
};
