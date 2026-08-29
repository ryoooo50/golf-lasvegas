-- birdy_push_recovery (boolean) を
-- push_recovery_on_birdie / push_recovery_on_eagle (integer) に分割する。
-- 実行前に rounds テーブルが存在し、旧カラム birdy_push_recovery があることを前提とする。

alter table public.rounds
  add column if not exists push_recovery_on_birdie integer not null default 1,
  add column if not exists push_recovery_on_eagle integer not null default 2;

-- 既存データの移行: 旧ON/OFFフラグから新しいデフォルト数値へ変換
update public.rounds
set
  push_recovery_on_birdie = case when birdy_push_recovery then 1 else 0 end,
  push_recovery_on_eagle = case when birdy_push_recovery then 2 else 0 end
where birdy_push_recovery is not null;

alter table public.rounds
  drop column if exists birdy_push_recovery;
