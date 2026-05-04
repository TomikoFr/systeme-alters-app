create table if not exists public.alters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  age text default '',
  role text default '',
  color text not null default '#3f7d68',
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.fronts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  alter_id uuid references public.alters(id) on delete set null,
  time timestamptz not null,
  presence integer not null default 3 check (presence between 1 and 5),
  context text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  mood text not null default 'stable',
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.alters enable row level security;
alter table public.fronts enable row level security;
alter table public.notes enable row level security;

drop policy if exists "Users can read their alters" on public.alters;
drop policy if exists "Users can create their alters" on public.alters;
drop policy if exists "Users can update their alters" on public.alters;
drop policy if exists "Users can delete their alters" on public.alters;
drop policy if exists "Users can read their fronts" on public.fronts;
drop policy if exists "Users can create their fronts" on public.fronts;
drop policy if exists "Users can update their fronts" on public.fronts;
drop policy if exists "Users can delete their fronts" on public.fronts;
drop policy if exists "Users can read their notes" on public.notes;
drop policy if exists "Users can create their notes" on public.notes;
drop policy if exists "Users can update their notes" on public.notes;
drop policy if exists "Users can delete their notes" on public.notes;

create policy "Users can read their alters"
on public.alters for select
using (auth.uid() = user_id);

create policy "Users can create their alters"
on public.alters for insert
with check (auth.uid() = user_id);

create policy "Users can update their alters"
on public.alters for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their alters"
on public.alters for delete
using (auth.uid() = user_id);

create policy "Users can read their fronts"
on public.fronts for select
using (auth.uid() = user_id);

create policy "Users can create their fronts"
on public.fronts for insert
with check (
  auth.uid() = user_id
  and (
    alter_id is null
    or exists (
      select 1
      from public.alters
      where alters.id = fronts.alter_id
      and alters.user_id = auth.uid()
    )
  )
);

create policy "Users can update their fronts"
on public.fronts for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    alter_id is null
    or exists (
      select 1
      from public.alters
      where alters.id = fronts.alter_id
      and alters.user_id = auth.uid()
    )
  )
);

create policy "Users can delete their fronts"
on public.fronts for delete
using (auth.uid() = user_id);

create policy "Users can read their notes"
on public.notes for select
using (auth.uid() = user_id);

create policy "Users can create their notes"
on public.notes for insert
with check (auth.uid() = user_id);

create policy "Users can update their notes"
on public.notes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their notes"
on public.notes for delete
using (auth.uid() = user_id);
