alter table public.rounds
  add column if not exists status text not null default 'completed',
  add column if not exists current_hole integer not null default 1,
  add column if not exists start_hole integer not null default 1,
  add column if not exists round_length integer not null default 18,
  add column if not exists draft_hole jsonb,
  add column if not exists player_ranking jsonb not null default '[]',
  add column if not exists course_name text not null default '',
  add column if not exists played_at text not null default '',
  add column if not exists memo text not null default '';

-- 旧バージョンの保存データには進行ホールがないため、履歴の末尾から復元する。
update public.rounds round_row
set current_hole = coalesce((
  select least(max((hole ->> 'holeNumber')::integer) + 1, 18)
  from jsonb_array_elements(round_row.holes) as hole
), 1)
where jsonb_array_length(round_row.holes) > 0
  and round_row.current_hole = 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rounds_status_check'
  ) then
    alter table public.rounds
      add constraint rounds_status_check check (status in ('paused', 'completed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rounds_start_hole_check'
  ) then
    alter table public.rounds
      add constraint rounds_start_hole_check check (start_hole in (1, 10));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rounds_round_length_check'
  ) then
    alter table public.rounds
      add constraint rounds_round_length_check check (round_length in (9, 18));
  end if;
end $$;
