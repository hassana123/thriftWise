-- ThriftWise schema for Supabase.
-- Run in the Supabase SQL editor or via `supabase db push`.
-- The app stores the entire thrift state as a single JSONB document
-- (mirrors the demo/localStorage model), plus a profiles table that links
-- auth users to members.

-- State document -------------------------------------------------------------
create table if not exists public.thrift_state (
  id         text primary key,
  version    integer not null default 1,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Auth profiles (links a Supabase auth user to a thrift member) --------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  member_id    text not null,
  email        text,
  display_name text,
  photo_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Row Level Security ---------------------------------------------------------
alter table public.thrift_state enable row level security;
alter table public.profiles enable row level security;

-- The thrift document is shared by the whole family. Family members sign in
-- with just their name (no Supabase auth account), so the state must be
-- readable and writable by the anon role too. Admin identity is enforced by
-- the app (member.role === "admin"), not by Postgres.
create policy "anon read thrift_state"
  on public.thrift_state for select to anon using (true);
create policy "anon insert thrift_state"
  on public.thrift_state for insert to anon with check (true);
create policy "anon update thrift_state"
  on public.thrift_state for update to anon using (true);
create policy "anon delete thrift_state"
  on public.thrift_state for delete to anon using (true);

create policy "authenticated read thrift_state"
  on public.thrift_state for select to authenticated using (true);
create policy "authenticated write thrift_state"
  on public.thrift_state for insert to authenticated with check (true);
create policy "authenticated update thrift_state"
  on public.thrift_state for update to authenticated using (true);
create policy "authenticated delete thrift_state"
  on public.thrift_state for delete to authenticated using (true);

-- Users may read all profiles (so members can resolve each other) but only
-- manage their own row. Name-sign-in members read the state directly and do
-- not need a profile row.
create policy "anon read profiles"
  on public.profiles for select to anon using (true);
create policy "authenticated read profiles"
  on public.profiles for select to authenticated using (true);
create policy "insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Receipt storage bucket (temporary files, deleted after review) -------------
-- create via Storage UI or:
-- insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true);
