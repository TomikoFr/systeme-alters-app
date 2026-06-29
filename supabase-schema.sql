create table if not exists public.plural_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.plural_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plural_profiles'
      and policyname = 'Users can read their own plural profile'
  ) then
    create policy "Users can read their own plural profile"
      on public.plural_profiles
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plural_profiles'
      and policyname = 'Users can create their own plural profile'
  ) then
    create policy "Users can create their own plural profile"
      on public.plural_profiles
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plural_profiles'
      and policyname = 'Users can update their own plural profile'
  ) then
    create policy "Users can update their own plural profile"
      on public.plural_profiles
      for update
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plural_profiles'
      and policyname = 'Users can delete their own plural profile'
  ) then
    create policy "Users can delete their own plural profile"
      on public.plural_profiles
      for delete
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.plural_profiles to authenticated;
