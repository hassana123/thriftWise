-- Run this file in the Supabase SQL editor (Dashboard → SQL Editor → New query → Run).
-- It lets family members who sign in with just their name (no Supabase auth account)
-- read and write the shared thrift document. Without it, the login page won't show
-- the family list and name sign-in can't load the thrift.

drop policy if exists "anon read thrift_state"   on public.thrift_state;
drop policy if exists "anon insert thrift_state" on public.thrift_state;
drop policy if exists "anon update thrift_state" on public.thrift_state;
drop policy if exists "anon delete thrift_state" on public.thrift_state;

create policy "anon read thrift_state"
  on public.thrift_state for select to anon using (true);
create policy "anon insert thrift_state"
  on public.thrift_state for insert to anon with check (true);
create policy "anon update thrift_state"
  on public.thrift_state for update to anon using (true);
create policy "anon delete thrift_state"
  on public.thrift_state for delete to anon using (true);

drop policy if exists "anon read profiles"
  on public.profiles;

create policy "anon read profiles"
  on public.profiles for select to anon using (true);
