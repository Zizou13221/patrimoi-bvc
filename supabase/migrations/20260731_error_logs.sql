-- PatriMoi — Table error_logs
-- Capture les crashes JS (ErrorBoundary) et erreurs critiques côté client.
-- Write-only côté client (RLS insert uniquement).
-- Lecture réservée au service_role (dashboard Supabase ou Edge Function).

create table if not exists public.error_logs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete set null,
  message     text,
  stack       text,
  context     varchar(100),
  app_version varchar(20),
  created_at  timestamptz default now()
);

-- Index pour requêtes dashboard
create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);
create index if not exists error_logs_user_id_idx    on public.error_logs (user_id);

-- RLS
alter table public.error_logs enable row level security;

-- Les utilisateurs connectés peuvent insérer leurs propres erreurs
create policy "users can insert own errors"
  on public.error_logs
  for insert
  with check (user_id = auth.uid());

-- Les utilisateurs anonymes (mode démo ou non connecté) peuvent aussi insérer
create policy "anon can insert errors"
  on public.error_logs
  for insert
  with check (user_id is null);

-- Pas de policy SELECT côté client — lecture réservée au service_role
