-- Upcoded CRM · esquema para Supabase PostgreSQL
-- Ejecutar en SQL Editor después de crear el proyecto gratuito.
create extension if not exists pgcrypto;

create type public.prospect_state as enum ('nuevo', 'revisar', 'guardado', 'contactado', 'respondio', 'cliente', 'no_contactar', 'descartado');

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  country text not null default 'Argentina',
  province text,
  locality text,
  neighborhood text,
  source_url text,
  website_url text,
  instagram_url text,
  state public.prospect_state not null default 'nuevo',
  opportunity_score smallint check (opportunity_score between 0 and 100),
  confidence_score smallint check (confidence_score between 0 and 100),
  audit jsonb not null default '{}'::jsonb,
  source_evidence jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prospect_messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  channel text not null default 'manual',
  created_at timestamptz not null default now()
);

alter table public.prospects enable row level security;
alter table public.prospect_messages enable row level security;

create policy "Owner may operate own prospects" on public.prospects for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owner may operate own prospect messages" on public.prospect_messages for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Sólo se admite la cuenta administrativa definida para el MVP.
create or replace function public.is_upcoded_admin() returns boolean language sql stable as $$
  select coalesce((auth.jwt() ->> 'email') = 'upcodednow@gmail.com', false);
$$;

drop policy if exists "Owner may operate own prospects" on public.prospects;
drop policy if exists "Owner may operate own prospect messages" on public.prospect_messages;
create policy "Only Upcoded admin may operate prospects" on public.prospects for all using (public.is_upcoded_admin() and auth.uid() = owner_id) with check (public.is_upcoded_admin() and auth.uid() = owner_id);
create policy "Only Upcoded admin may operate messages" on public.prospect_messages for all using (public.is_upcoded_admin() and auth.uid() = owner_id) with check (public.is_upcoded_admin() and auth.uid() = owner_id);

create index prospects_owner_state_idx on public.prospects(owner_id, state);
create index prospects_expiry_idx on public.prospects(expires_at) where expires_at is not null;

-- Limpieza segura: borra sólo prospectos no conservados y ya vencidos.
create or replace function public.purge_expired_temporary_prospects() returns void language sql security definer as $$
  delete from public.prospects
  where expires_at < now() and state in ('nuevo', 'revisar', 'descartado');
$$;
