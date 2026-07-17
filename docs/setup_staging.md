# Setup Staging Supabase — PatriMoi

## 1. Créer le projet staging

1. Va sur **supabase.com/dashboard** → **New project**
2. Nom : `patrimoi-staging`
3. Mot de passe DB : génère-en un fort et note-le
4. Région : West EU (Frankfurt) — même que prod

## 2. Récupérer l'URL de connexion DB

Dans le projet staging :
**Settings → Database → Connection string → URI**

Format : `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`

## 3. Ajouter les secrets GitHub Actions

Va sur : **github.com/Zizou13221/patrimoi-/settings/secrets/actions**

Ajouter :
| Secret | Valeur |
|--------|--------|
| `SUPABASE_DB_URL_STAGING` | L'URI de connexion DB du projet staging |
| `SUPABASE_URL_STAGING` | `https://[REF].supabase.co` |
| `SUPABASE_ANON_KEY_STAGING` | Clé anon du projet staging (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY_STAGING` | Clé service_role du projet staging |

## 4. Créer les utilisateurs de test en staging

Dans le SQL Editor du projet staging :

```sql
-- Créer user_A et user_B pour les tests RLS
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'test-a@patrimoi.ma', crypt('TestA123!', gen_salt('bf')), NOW(), 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'test-b@patrimoi.ma', crypt('TestB123!', gen_salt('bf')), NOW(), 'authenticated')
ON CONFLICT (id) DO NOTHING;
```

## 5. Appliquer les migrations sur staging (une fois)

```bash
cd ~/PatriMoiApp
npx supabase db push --project-ref [REF_STAGING]
```

Après ça, le job CI `test-rls` s'exécutera automatiquement sur chaque PR.
