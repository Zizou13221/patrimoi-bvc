import { Dimensions } from 'react-native';

// =========================================================
// PALETTE COULEURS
// =========================================================
export const C = {
  pri:   '#1A6B3A', priL: '#E8F5EE', priD: '#0F4B26',
  sec:   '#C8102E',
  acc:   '#F5A623', accL: '#FEF7DC',
  navy:  '#1E3C82', navyL:'#E1E8FA',
  teal:  '#008080', tealL:'#E0F4F4',
  gold:  '#B88E30', goldL:'#FFF8DC', goldD:'#785A14',
  gpos:  '#27AE60', rneg: '#E74C3C',
  g1:    '#F1F3F5', g2:   '#CED4DA', g3:   '#868E96',
  dark:  '#1C2833', bg:   '#F8FAFA', white:'#FFFFFF',
};

const { width: SCREEN_W } = Dimensions.get('window');
export const APP_W = Math.min(440, SCREEN_W);
