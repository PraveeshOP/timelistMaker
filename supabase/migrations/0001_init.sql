-- TimelistMaker initial schema + Row Level Security
create extension if not exists "pgcrypto";

-- Mirrors auth.users with the app-specific full_name captured at sign-up.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.workplaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.timelists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  year smallint not null check (year between 2000 and 2100),
  created_at timestamptz not null default now(),
  unique (user_id, month, year)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workplace_id uuid not null references public.workplaces (id) on delete cascade,
  timelist_id uuid not null references public.timelists (id) on delete cascade,
  date date not null,
  start_time time,
  stop_time time,
  total_hours numeric(5, 2) not null default 0,
  is_weekend boolean not null default false,
  is_holiday boolean not null default false,
  created_at timestamptz not null default now(),
  unique (timelist_id, workplace_id, date)
);

create index idx_workplaces_user on public.workplaces (user_id);
create index idx_timelists_user on public.timelists (user_id);
create index idx_time_entries_user on public.time_entries (user_id);
create index idx_time_entries_timelist on public.time_entries (timelist_id);
create index idx_time_entries_workplace on public.time_entries (workplace_id);

-- Populates public.users from auth.users on signup, pulling full_name from user metadata
-- (set at sign-up time via supabase.auth.signUp({ options: { data: { full_name } } })).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security: every user only ever sees their own rows.
alter table public.users enable row level security;
alter table public.workplaces enable row level security;
alter table public.timelists enable row level security;
alter table public.time_entries enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = id);
-- No client insert policy: the row is created only by the security-definer trigger above.

create policy "workplaces_select_own" on public.workplaces
  for select using (auth.uid() = user_id);
create policy "workplaces_insert_own" on public.workplaces
  for insert with check (auth.uid() = user_id);
create policy "workplaces_update_own" on public.workplaces
  for update using (auth.uid() = user_id);
create policy "workplaces_delete_own" on public.workplaces
  for delete using (auth.uid() = user_id);

create policy "timelists_select_own" on public.timelists
  for select using (auth.uid() = user_id);
create policy "timelists_insert_own" on public.timelists
  for insert with check (auth.uid() = user_id);
create policy "timelists_update_own" on public.timelists
  for update using (auth.uid() = user_id);
create policy "timelists_delete_own" on public.timelists
  for delete using (auth.uid() = user_id);

create policy "time_entries_select_own" on public.time_entries
  for select using (auth.uid() = user_id);
create policy "time_entries_insert_own" on public.time_entries
  for insert with check (auth.uid() = user_id);
create policy "time_entries_update_own" on public.time_entries
  for update using (auth.uid() = user_id);
create policy "time_entries_delete_own" on public.time_entries
  for delete using (auth.uid() = user_id);
