/**
 * PatriMoi — Configuration d'environnement (source unique)
 *
 * SUPABASE_ANON_KEY est une clé PUBLIQUE côté client (rôle "anon").
 * La sécurité des données repose sur les politiques RLS PostgreSQL,
 * pas sur le secret de cette clé.
 *
 * Cette clé apparaît dans les bundles JS distribués (comportement normal
 * et documenté par Supabase). Ne pas la confondre avec la clé service_role
 * (secrète, jamais côté client).
 *
 * Pour changer de projet Supabase : modifier ici uniquement.
 */

export const SUPABASE_URL      = 'https://fwgsdjhavrqrqwmydwxf.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3Z3NkamhhdnJxcnF3bXlkd3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNjg1MTIsImV4cCI6MjA5ODg0NDUxMn0.qAjD61kxDe374QCs90-k-rTQRWxpkPOD1tN7Ic8Vsvg';
