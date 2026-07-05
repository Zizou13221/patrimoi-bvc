/**
 * PatriMoi — Client Supabase
 *
 * La clé `anon` est une clé PUBLIQUE (côté client) — c'est normal qu'elle
 * soit dans le code. La sécurité des données est assurée par les politiques
 * RLS côté Supabase (chaque utilisateur ne voit que ses propres données).
 *
 * Project : fwgsdjhavrqrqwmydwxf (West EU - Ireland)
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL      = 'https://fwgsdjhavrqrqwmydwxf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3Z3NkamhhdnJxcnF3bXlkd3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNjg1MTIsImV4cCI6MjA5ODg0NDUxMn0.qAjD61kxDe374QCs90-k-rTQRWxpkPOD1tN7Ic8Vsvg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});
