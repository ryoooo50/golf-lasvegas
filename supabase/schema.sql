-- ─── rounds テーブル ──────────────────────────────────────────────────
create table public.rounds (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  match_name text not null default '',
  rate numeric not null default 0,
  player_count integer not null default 4,
  player_names jsonb not null default '{}',
  push_limit integer not null default 2,
  birdy_push_recovery boolean not null default false,
  holes jsonb not null default '[]',
  total_points jsonb not null default '{}'
);

-- ─── Row Level Security ───────────────────────────────────────────────
alter table public.rounds enable row level security;

create policy "users can manage their own rounds"
  on public.rounds
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── updated_at 自動更新トリガー ──────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger rounds_updated_at
  before update on public.rounds
  for each row execute function update_updated_at();
