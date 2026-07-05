-- ============================================================
-- PatriMoi — Schéma Supabase
-- À exécuter dans l'éditeur SQL de ton projet Supabase
-- ============================================================

-- ── Extensions ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Table : profiles ─────────────────────────────────────
-- Étend auth.users avec les infos métier
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  prenom     TEXT,
  nom        TEXT,
  plan       TEXT        NOT NULL DEFAULT 'free'  CHECK (plan IN ('free','plus')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Table : patrimoine_data ───────────────────────────────
-- 1 ligne par utilisateur — tout le JSON patrimoine
CREATE TABLE IF NOT EXISTS public.patrimoine_data (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  data       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index sur user_id pour les lookups rapides
CREATE INDEX IF NOT EXISTS idx_patrimoine_data_user_id ON public.patrimoine_data(user_id);

-- ── Trigger : updated_at automatique ─────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER patrimoine_data_updated_at
  BEFORE UPDATE ON public.patrimoine_data
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Trigger : créer un profil à l'inscription ─────────────
-- Se déclenche automatiquement quand un user s'inscrit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (
    NEW.id,
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Row Level Security ────────────────────────────────────
-- Chaque utilisateur ne voit et ne modifie QUE ses données

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrimoine_data ENABLE ROW LEVEL SECURITY;

-- Policies profiles
CREATE POLICY "profiles: lecture propre"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: mise à jour propre"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policies patrimoine_data
CREATE POLICY "patrimoine: lecture propre"
  ON public.patrimoine_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "patrimoine: insertion propre"
  ON public.patrimoine_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "patrimoine: mise à jour propre"
  ON public.patrimoine_data FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "patrimoine: suppression propre"
  ON public.patrimoine_data FOR DELETE
  USING (auth.uid() = user_id);

-- ── Vue : stats admin (sans données personnelles) ─────────
-- Pour suivre les métriques sans exposer les données
CREATE OR REPLACE VIEW public.stats_admin AS
SELECT
  COUNT(*)                                    AS total_users,
  COUNT(*) FILTER (WHERE plan = 'plus')       AS users_plus,
  COUNT(*) FILTER (WHERE plan = 'free')       AS users_free,
  ROUND(COUNT(*) FILTER (WHERE plan = 'plus')::numeric / NULLIF(COUNT(*),0) * 100, 1) AS taux_conversion_pct
FROM public.profiles;

-- ── Permissions ───────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.stats_admin TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.patrimoine_data TO authenticated;
