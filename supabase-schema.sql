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

create table if not exists public.global_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Membre',
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists global_chat_messages_created_at_idx
  on public.global_chat_messages (created_at desc);

alter table public.global_chat_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'global_chat_messages'
      and policyname = 'Authenticated users can read global chat'
  ) then
    create policy "Authenticated users can read global chat"
      on public.global_chat_messages
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'global_chat_messages'
      and policyname = 'Authenticated users can send global chat messages'
  ) then
    create policy "Authenticated users can send global chat messages"
      on public.global_chat_messages
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'global_chat_messages'
      and policyname = 'Users can delete their own global chat messages'
  ) then
    create policy "Users can delete their own global chat messages"
      on public.global_chat_messages
      for delete
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

grant select, insert, delete on public.global_chat_messages to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'global_chat_messages'
    ) then
      alter publication supabase_realtime add table public.global_chat_messages;
    end if;
  end if;
end $$;
