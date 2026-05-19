create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

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
