-- Upcoded CRM · equipo compartido, asignación y seguimiento.
-- Ejecutar después de schema.sql y 002_production.sql. Es idempotente.

-- Etapas nuevas del pipeline comercial.
alter type public.prospect_state add value if not exists 'reunion';
alter type public.prospect_state add value if not exists 'perdido';

-- Miembros del equipo: única fuente de acceso al CRM.
create table if not exists public.team_members (
  email text primary key check (email = lower(email)),
  display_name text not null,
  initials text not null check (char_length(initials) between 1 and 3),
  created_at timestamptz not null default now()
);

insert into public.team_members (email, display_name, initials) values
  ('juanignaciogonzalez.ca@gmail.com', 'Juan Ignacio', 'JI'),
  ('jpgarciamallorquin@gmail.com', 'JP García', 'JP')
on conflict (email) do nothing;

create or replace function public.is_upcoded_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- Asignación, contacto y seguimiento por prospecto.
alter table public.prospects
  add column if not exists assigned_to text references public.team_members(email) on update cascade on delete set null,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists notes text not null default '',
  add column if not exists last_contacted_at timestamptz,
  add column if not exists last_contacted_by text references public.team_members(email) on update cascade on delete set null,
  add column if not exists next_follow_up_at timestamptz;

create table if not exists public.prospect_activity (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  actor_email text not null,
  kind text not null check (kind in ('estado', 'asignacion', 'nota', 'contacto', 'seguimiento', 'datos')),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.prospect_messages add column if not exists actor_email text;

create table if not exists public.crm_settings (
  key text primary key,
  value jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- RLS: el CRM es compartido entre los miembros; la asignación indica quién lo trabaja.
alter table public.team_members enable row level security;
alter table public.prospect_activity enable row level security;
alter table public.crm_settings enable row level security;

drop policy if exists "Only Upcoded admin may operate prospects" on public.prospects;
drop policy if exists "Only Upcoded admin may operate messages" on public.prospect_messages;
drop policy if exists "Team operates prospects" on public.prospects;
drop policy if exists "Team operates messages" on public.prospect_messages;
drop policy if exists "Team operates activity" on public.prospect_activity;
drop policy if exists "Team operates settings" on public.crm_settings;
drop policy if exists "Team reads members" on public.team_members;
drop policy if exists "Member edits own profile" on public.team_members;

create policy "Team operates prospects" on public.prospects for all using (public.is_upcoded_member()) with check (public.is_upcoded_member());
create policy "Team operates messages" on public.prospect_messages for all using (public.is_upcoded_member()) with check (public.is_upcoded_member());
create policy "Team operates activity" on public.prospect_activity for all using (public.is_upcoded_member()) with check (public.is_upcoded_member());
create policy "Team operates settings" on public.crm_settings for all using (public.is_upcoded_member()) with check (public.is_upcoded_member());
create policy "Team reads members" on public.team_members for select using (public.is_upcoded_member());
create policy "Member edits own profile" on public.team_members for update
  using (email = lower(auth.jwt() ->> 'email')) with check (email = lower(auth.jwt() ->> 'email'));

create index if not exists prospects_assigned_idx on public.prospects(assigned_to, state);
create index if not exists prospects_follow_up_idx on public.prospects(next_follow_up_at) where next_follow_up_at is not null;
create index if not exists prospect_activity_prospect_idx on public.prospect_activity(prospect_id, created_at desc);
