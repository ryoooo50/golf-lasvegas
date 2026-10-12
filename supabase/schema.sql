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
  push_recovery_on_birdie integer not null default 1,
  push_recovery_on_eagle integer not null default 2,
  holes jsonb not null default '[]',
  total_points jsonb not null default '{}',
  status text not null default 'completed' check (status in ('paused', 'completed')),
  current_hole integer not null default 1,
  start_hole integer not null default 1 check (start_hole in (1, 10)),
  round_length integer not null default 18 check (round_length in (9, 18)),
  draft_hole jsonb,
  player_ranking jsonb not null default '[]',
  course_name text not null default '',
  played_at text not null default '',
  memo text not null default ''
);

-- 既存環境向けマイグレーション
alter table public.rounds add column if not exists status text not null default 'completed';
alter table public.rounds add column if not exists current_hole integer not null default 1;
alter table public.rounds add column if not exists start_hole integer not null default 1;
alter table public.rounds add column if not exists round_length integer not null default 18;
alter table public.rounds add column if not exists draft_hole jsonb;
alter table public.rounds add column if not exists player_ranking jsonb not null default '[]';
alter table public.rounds add column if not exists course_name text not null default '';
alter table public.rounds add column if not exists played_at text not null default '';
alter table public.rounds add column if not exists memo text not null default '';

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
