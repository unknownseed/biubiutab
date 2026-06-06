create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Existing admins can read/manage the table; new setup uses the RPC below.
create policy "Admins can view admin_users"
on public.admin_users
for select
to authenticated
using (public.is_admin());

create policy "Admins can insert admin_users"
on public.admin_users
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can delete admin_users"
on public.admin_users
for delete
to authenticated
using (public.is_admin());

-- security-definer RPC used by /api/admin/setup to insert the first admin
create or replace function public.admin_setup(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  insert into public.admin_users(user_id) values(target_user_id) on conflict do nothing;
  select true;
$$;

grant execute on function public.admin_setup to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Admins can manage all teaching songs" on public.teaching_songs;

create policy "Admins can manage all teaching songs"
on public.teaching_songs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Anyone can read published teaching songs"
on public.teaching_songs
for select
to anon, authenticated
using (status = 'published');
