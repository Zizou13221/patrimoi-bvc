/**
 * PatriMoi — Client Supabase
 *
 * Installation :
 *   npm install @supabase/supabase-js
 *
 * Variables à renseigner (créer un fichier .env à la racine) :
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY=eyJ...
 *
 * Ces valeurs se trouvent dans ton projet Supabase :
 *   Settings → API → Project URL + anon public key
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL      = process.env.SUPABASE_URL      ?? 'https://TON_PROJET.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'TON_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persiste la session dans AsyncStorage (survit aux redémarrages)
    storage:          AsyncStorage,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
});
