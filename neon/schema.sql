-- Golf Las Vegas: Neon (Postgres) スキーマ
-- 適用: npm run db:migrate（DATABASE_URL が必要）。何度流しても安全なように if not exists で書く。

-- ─── Better Auth のテーブル（better-auth 1.7 の生成結果） ─────────────
create table if not exists "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
create table if not exists "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);
create table if not exists "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);
create table if not exists "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
-- admin プラグイン（権限・利用停止）
alter table "user" add column if not exists "role" text;
alter table "user" add column if not exists "banned" boolean default false;
alter table "user" add column if not exists "banReason" text;
alter table "user" add column if not exists "banExpires" timestamptz;
alter table "session" add column if not exists "impersonatedBy" text;
update "user" set "role" = 'user' where "role" is null;
create index if not exists "session_userId_idx" on "session" ("userId");
create index if not exists "account_userId_idx" on "account" ("userId");
create index if not exists "verification_identifier_idx" on "verification" ("identifier");

-- ─── rounds ───────────────────────────────────────────────────────────
-- アクセス制御は API（api/rounds.mts）で user_id を必ず条件に入れて行う。
create table if not exists rounds (
  id uuid default gen_random_uuid() primary key,
  user_id text not null references "user" ("id") on delete cascade,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  match_name text not null default '',
  rate double precision not null default 0,
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
create index if not exists rounds_user_id_created_at_idx on rounds (user_id, created_at desc);
-- ニアピン1回・1人あたりの額（円）。0 = ニアピンなし
alter table rounds add column if not exists near_pin_rate integer not null default 0;

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists rounds_updated_at on rounds;
create trigger rounds_updated_at
  before update on rounds
  for each row execute function update_updated_at();

-- ラウンドの共有リンク（1ラウンド最大1本）
create table if not exists round_shares (
  round_id uuid primary key references rounds (id) on delete cascade,
  token text not null unique,
  created_at timestamptz default now() not null
);

-- 共有リンクから受け取ったユーザー
create table if not exists round_share_members (
  round_id uuid not null references rounds (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  created_at timestamptz default now() not null,
  primary key (round_id, user_id)
);
create index if not exists round_share_members_user_id_idx on round_share_members (user_id);
