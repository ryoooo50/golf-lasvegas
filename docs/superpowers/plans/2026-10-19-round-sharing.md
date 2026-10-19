# ラウンド共有 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** オーナーがラウンドの共有リンクを作り、リンクを開いてログインした友人がそのラウンドを閲覧専用で見られるようにする。

**Architecture:** DB に `round_shares`（1ラウンド1リンク）と `round_share_members`（受け取った人）を追加し、Vercel Functions に `/api/round-shares`（オーナー向け）と `/api/shared-rounds`（友人向け）を足す。クライアントは共有されたラウンドを自分の `savedRounds` と分けた新しいストア `sharedRoundsStore` に持ち、`/share?token=` ルートで受け取り、ラウンド詳細に共有パネル、履歴に「共有されたラウンド」セクションを出す。

**Tech Stack:** Expo Router 6 / React Native Web / zustand（persist + AsyncStorage）/ Vercel Functions（Web 標準 Request/Response）/ Postgres（`pg`、本番 Neon）/ Better Auth / Jest（ts-jest）/ node:test（API 結合テスト）

**Spec:** `docs/superpowers/specs/2026-10-19-round-sharing-design.md`

## Global Constraints

- サーバーは ESM。`api/` と `server/` 内の import は `.js` 拡張子付き（例: `from '../server/http.js'`）。
- 認証は既存の `getSessionUserId(request)`（`server/auth.ts`）。未ログインは 401 `{ error: 'unauthorized' }`。
- 他人のラウンド・存在しない ID・不正な形式は区別せず 404 `{ error: 'not found' }`。
- トークン: `crypto.randomBytes(24).toString('base64url')`（32文字）。形式チェック `/^[A-Za-z0-9_-]{32}$/`、合わない値は DB を引かず 404。
- 共有 URL: `${getApiBaseUrl()}/share?token=<token>`。
- 新しい npm 依存は追加しない（コピーは Web の `navigator.clipboard` のみ）。
- 文言は `src/i18n/locales/ja.ts` と `en.ts` の両方に追加する。UI は既存の配色・カード・ボタンに合わせ、装飾を足さない（主ボタンは1エリア1つ、赤は停止・削除だけ）。
- DB マイグレーションは本番へのプッシュより先に適用する（`npx tsx --env-file=.env scripts/db-migrate.mts`）。本番 DB への適用とプッシュはユーザーの承認を得てから行う。
- 開発サーバー（`expo start --web`）は既存の `import.meta` 問題で動かない。画面確認は `npm run build:web` の `dist/` を使う。

## Review Focus

1. 未ログインで LINE 内ブラウザからリンクを開き、その場でログインした → もう一度タップしなくても受け取りが完了し、ラウンド詳細が開く。（Task 5 の画面テスト手順）
2. オーナー本人が自分のリンクを開いた → メンバーにならず、自分のラウンド詳細が開く（別端末でも、クラウドから読み込んでから開く）。（Task 2 の API テスト + Task 5）
3. ゲストのまま共有リンクを開いた → ゲストのままでは受け取れず、ログインを求められる（ゲストボタンを出さない）。（Task 5）
4. 共有停止・ラウンド削除のあと、友人の端末に残っていたコピー → 次に一覧を取得したら消える（取得失敗時は残す）。（Task 3 のストアテスト）
5. 改ざん・途中で切れたトークン（`?token=abc`、トークン無し）→ クラッシュせず「このリンクは無効です」と出る。（Task 2 の API テスト + Task 5）

---

### Task 1: 共有リンクの DB とオーナー向け API

**Files:**
- Modify: `neon/schema.sql`（末尾にテーブル2つ。設計書「データモデル」の SQL をそのまま）
- Create: `server/http.ts`（`api/rounds.ts` の `json` と `withUser` を移す）
- Modify: `api/rounds.ts`（`server/http.js` を使う。挙動は変えない）
- Create: `server/roundShares.ts`
- Create: `api/round-shares.ts`
- Test: `server/api.test.ts`

**Interfaces:**
- Produces:
  - `server/http.ts`: `json(body: unknown, status?: number): Response`、`withUser(request: Request, run: (userId: string) => Promise<Response>, label: string): Promise<Response>`（`label` は `console.error` の接頭辞。`ValidationError`→400、`SyntaxError`→400、その他→500 は今と同じ）
  - `server/roundShares.ts`:
    - `interface ShareStatus { token: string | null; memberCount: number }`
    - `isShareToken(value: unknown): value is string`
    - `getShareStatus(pool: pg.Pool, ownerId: string, roundId: string): Promise<ShareStatus | null>` — 自分のラウンドでなければ null
    - `createShareLink(pool, ownerId, roundId): Promise<ShareStatus | null>` — 既存リンクがあれば同じトークンを返す
    - `stopSharing(pool, ownerId, roundId): Promise<boolean>` — リンクと全メンバーを削除。自分のラウンドでなければ false
  - `/api/round-shares?roundId=`: `GET` → 200 `ShareStatus` / `POST` → 200 `ShareStatus` / `DELETE` → 204。`roundId` は `isRoundId` で検証。

- [ ] **Step 1: ローカル Postgres を用意する**

Docker Desktop が止まっていれば `open -a Docker` で起動し、README の手順で `golf-lv-pg` を起動（既にあれば `docker start golf-lv-pg`）して `DATABASE_URL=postgres://postgres:postgres@localhost:54329/golf npm run db:migrate` を流す。
Expected: `schema applied`

- [ ] **Step 2: 失敗するテストを書く**

`server/api.test.ts` の `describe('api')` 内に `describe('round sharing')` を追加し、`roundSharesRequest(method, cookie, roundId?)` ヘルパー（`roundsRequest` と同じ形）を作る。

```ts
test('owner creates one link per round and reads its status', async () => {
    const { id } = await (await roundsRequest('POST', alice, { body: ROUND })).json();
    assert.deepEqual(await (await roundSharesRequest('GET', alice, id)).json(), { token: null, memberCount: 0 });
    const first = await (await roundSharesRequest('POST', alice, id)).json();
    assert.match(first.token, /^[A-Za-z0-9_-]{32}$/);
    const second = await (await roundSharesRequest('POST', alice, id)).json();
    assert.equal(second.token, first.token);
});

test("cannot create, read or stop a link for another user's round", async () => {
    const { id } = await (await roundsRequest('POST', alice, { body: ROUND })).json();
    assert.equal((await roundSharesRequest('POST', bob, id)).status, 404);
    assert.equal((await roundSharesRequest('GET', bob, id)).status, 404);
    assert.equal((await roundSharesRequest('DELETE', bob, id)).status, 404);
    assert.equal((await roundSharesRequest('GET', null, id)).status, 401);
    assert.equal((await roundSharesRequest('POST', alice, 'not-a-uuid')).status, 404);
});

test('stopping then sharing again issues a new token', async () => {
    const { id } = await (await roundsRequest('POST', alice, { body: ROUND })).json();
    const { token } = await (await roundSharesRequest('POST', alice, id)).json();
    assert.equal((await roundSharesRequest('DELETE', alice, id)).status, 204);
    assert.deepEqual(await (await roundSharesRequest('GET', alice, id)).json(), { token: null, memberCount: 0 });
    const again = await (await roundSharesRequest('POST', alice, id)).json();
    assert.notEqual(again.token, token);
});

test('deleting a round removes its link', async () => {
    const { id } = await (await roundsRequest('POST', alice, { body: ROUND })).json();
    await roundSharesRequest('POST', alice, id);
    await roundsRequest('DELETE', alice, { id });
    const { rows } = await getPool().query('select count(*)::int as n from round_shares where round_id = $1', [id]);
    assert.equal(rows[0].n, 0);
});
```

既存テスト `create, list, update and delete own rounds` は「alice のラウンドが1件」を前提にしているので、新しいテストは `describe('round sharing')` を既存の rounds テストより後ろに置く。

- [ ] **Step 3: テストが失敗することを確認する**

Run: `DATABASE_URL=postgres://postgres:postgres@localhost:54329/golf BETTER_AUTH_SECRET=$(openssl rand -hex 32) BETTER_AUTH_URL=http://localhost:3000 npm run test:api`
Expected: FAIL（`../api/round-shares.js` が見つからない）

- [ ] **Step 4: `server/http.ts` を作り、`api/rounds.ts` をそれに置き換える**

- [ ] **Step 5: `server/roundShares.ts` と `api/round-shares.ts` を実装する**

`createShareLink` は `insert into round_shares (round_id, token) select id, $3 from rounds where id = $1 and user_id = $2 on conflict (round_id) do nothing` のあと `getShareStatus` を返す。`stopSharing` は所有確認のあとメンバーとリンクを削除する（1文の CTE でも2文でもよい）。

- [ ] **Step 6: テストが通ることを確認する**

Run: Step 3 と同じ
Expected: PASS（既存テストも含め全件）

- [ ] **Step 7: コミット**

```bash
git add neon/schema.sql server/http.ts server/roundShares.ts api/rounds.ts api/round-shares.ts server/api.test.ts
git commit -m "feat: ラウンドの共有リンクを作成・停止する API を追加"
```

---

### Task 2: 友人向け API（受け取り・一覧・一覧から外す）

**Files:**
- Modify: `server/roundShares.ts`
- Create: `api/shared-rounds.ts`
- Test: `server/api.test.ts`

**Interfaces:**
- Consumes: Task 1 の `isShareToken`、`server/http.ts`
- Produces:
  - `acceptShare(pool, userId: string, token: string): Promise<{ roundId: string; isOwner: boolean } | null>` — 無効トークンは null。オーナー本人はメンバー登録しない。2回目以降は重複しない（`on conflict do nothing`）
  - `listSharedRounds(pool, userId): Promise<unknown[]>` — `rounds` の行（`select r.*`）。メンバーかつ `round_shares` に行があるものだけ、`created_at desc`、`limit 500`
  - `leaveSharedRound(pool, userId, roundId): Promise<boolean>`
  - `/api/shared-rounds`: `POST` body `{ token }` → 200 `{ roundId, isOwner }` / 404。`GET` → 200 `{ rounds }`。`DELETE ?id=` → 204 / 404

- [ ] **Step 1: 失敗するテストを書く**（`describe('round sharing')` 内、`sharedRoundsRequest(method, cookie, { id?, body? })` ヘルパーを追加）

```ts
test('a friend accepts a link once and sees the round, read-only', async () => {
    const { id } = await (await roundsRequest('POST', alice, { body: ROUND })).json();
    const { token } = await (await roundSharesRequest('POST', alice, id)).json();
    assert.deepEqual(await (await sharedRoundsRequest('POST', bob, { body: { token } })).json(), { roundId: id, isOwner: false });
    await sharedRoundsRequest('POST', bob, { body: { token } });
    const { rounds } = await (await sharedRoundsRequest('GET', bob)).json();
    assert.deepEqual(rounds.map((r: { id: string }) => r.id), [id]);
    assert.equal((await (await roundSharesRequest('GET', alice, id)).json()).memberCount, 1);
    assert.equal((await roundsRequest('PATCH', bob, { id, body: { memo: 'x' } })).status, 404);
    assert.equal((await roundsRequest('DELETE', bob, { id })).status, 404);
});

test('the owner opening their own link does not become a member', async () => {
    const { id } = await (await roundsRequest('POST', alice, { body: ROUND })).json();
    const { token } = await (await roundSharesRequest('POST', alice, id)).json();
    assert.deepEqual(await (await sharedRoundsRequest('POST', alice, { body: { token } })).json(), { roundId: id, isOwner: true });
    assert.equal((await (await roundSharesRequest('GET', alice, id)).json()).memberCount, 0);
});

test('invalid, malformed or stopped tokens are rejected', async () => {
    const { id } = await (await roundsRequest('POST', alice, { body: ROUND })).json();
    const { token } = await (await roundSharesRequest('POST', alice, id)).json();
    await sharedRoundsRequest('POST', bob, { body: { token } });
    await roundSharesRequest('DELETE', alice, id);
    assert.equal((await sharedRoundsRequest('POST', bob, { body: { token } })).status, 404);
    assert.equal((await sharedRoundsRequest('POST', bob, { body: { token: 'abc' } })).status, 404);
    assert.equal((await sharedRoundsRequest('POST', bob, { body: {} })).status, 404);
    const { rounds } = await (await sharedRoundsRequest('GET', bob)).json();
    assert.equal(rounds.some((r: { id: string }) => r.id === id), false);
    assert.equal((await sharedRoundsRequest('GET', null)).status, 401);
});

test('a friend can remove a shared round from their own list', async () => {
    const { id } = await (await roundsRequest('POST', alice, { body: ROUND })).json();
    const { token } = await (await roundSharesRequest('POST', alice, id)).json();
    await sharedRoundsRequest('POST', bob, { body: { token } });
    assert.equal((await sharedRoundsRequest('DELETE', bob, { id })).status, 204);
    assert.equal((await (await roundSharesRequest('GET', alice, id)).json()).memberCount, 0);
    assert.equal((await sharedRoundsRequest('DELETE', bob, { id })).status, 404);
});
```

- [ ] **Step 2: テストが失敗することを確認する**（Task 1 Step 3 のコマンド）
Expected: FAIL（`../api/shared-rounds.js` が見つからない）

- [ ] **Step 3: `acceptShare` / `listSharedRounds` / `leaveSharedRound` と `api/shared-rounds.ts` を実装する**

`POST` の body が JSON でない・`token` が文字列でない・`isShareToken` に合わない場合は 404（400 にしない。リンク改ざんは「無効」と同じ扱い）。

- [ ] **Step 4: テストが通ることを確認する**
Expected: PASS（全件）

- [ ] **Step 5: コミット**

```bash
git add server/roundShares.ts api/shared-rounds.ts server/api.test.ts
git commit -m "feat: 共有されたラウンドの受け取り・一覧・一覧から外す API を追加"
```

---

### Task 3: クライアントのデータ層（変換の共通化・API 呼び出し・共有ストア）

**Files:**
- Create: `src/services/cloudRoundMapper.ts`（`gameStore.ts` の `loadCloudRounds` 内の変換と `latestHandicapFromHistory` を移す）
- Modify: `src/store/gameStore.ts`（`loadCloudRounds` が `toRoundResult` を使う）
- Modify: `src/services/cloudSave.ts`（`request` を `apiRequest` として export）
- Create: `src/services/roundShares.ts`
- Create: `src/store/sharedRoundsStore.ts`
- Test: `src/services/cloudRoundMapper.test.ts`、`src/services/roundShares.test.ts`、`src/store/sharedRoundsStore.test.ts`

**Interfaces:**
- Consumes: Task 1・2 の API 形
- Produces:
  - `toRoundResult(saved: SavedRound, defaultSettings: GameState['settings']): RoundResult`（`gameStore` は `INITIAL_STATE.settings` を渡す）
  - `src/services/roundShares.ts`:
    - `type ShareStatus = { token: string | null; memberCount: number }`
    - `buildShareUrl(token: string): string` → `${getApiBaseUrl()}/share?token=${encodeURIComponent(token)}`
    - `fetchShareStatus(roundId: string): Promise<ShareStatus>`、`createShareLink(roundId): Promise<ShareStatus>`、`stopSharing(roundId): Promise<void>`
    - `acceptSharedRound(token: string): Promise<{ roundId: string; isOwner: boolean }>`（無効なら `CloudSaveError` status 404 を投げる）
    - `fetchSharedRounds(): Promise<SavedRound[]>`、`leaveSharedRound(roundId: string): Promise<void>`
  - `src/store/sharedRoundsStore.ts`（`useSharedRoundsStore`、persist キー `golf-lasvegas-shared-rounds`）:
    - state: `viewerId: string | null`、`rounds: RoundResult[]`
    - `loadSharedRounds(viewerId: string): Promise<void>` — 成功時に `viewerId` と `rounds` を丸ごと置き換える。失敗時は何も変えない
    - `removeSharedRound(roundId: string): Promise<boolean>` — API 成功時だけローカルから消して true
    - `visibleSharedRounds(viewerId: string | null): RoundResult[]` — `viewerId` が一致するときだけ `rounds`、それ以外は `[]`

- [ ] **Step 1: 失敗するテストを書く**

`cloudRoundMapper.test.ts`:
```ts
test('maps a cloud row to a round result with defaults for older rows', () => {
    const result = toRoundResult(savedRow({ near_pin_rate: undefined, player_names: { p1: 'A', bogey_kun: 'ボギーくん' } }), DEFAULT_SETTINGS);
    expect(result.id).toBe('round-uuid');
    expect(result.cloudId).toBe('round-uuid');
    expect(result.settings.nearPinRate).toBe(0);
    expect(result.players.find(p => p.id === 'bogey_kun')?.type).toBe('bogey_kun');
    expect(result.ownerId).toBe('owner-1');
});
test('restores a player handicap from the latest hole', () => { /* holes に handicap 付き scores → players[].handicap */ });
```
（`savedRow(overrides)` はテスト内で `SavedRound` を組み立てるヘルパー。`DEFAULT_SETTINGS` もテスト内で定義）

`roundShares.test.ts`（`../lib/apiBase` を `getApiBaseUrl: () => 'https://golf.example'` でモック、`../lib/authClient` もモック）:
```ts
test('builds a share URL with the token as a query parameter', () => {
    expect(buildShareUrl('a_b-C')).toBe('https://golf.example/share?token=a_b-C');
});
```

`sharedRoundsStore.test.ts`（AsyncStorage と `../services/roundShares` をモック）:
```ts
test('replaces the list with the latest server result, dropping stopped shares', async () => {
    useSharedRoundsStore.setState({ viewerId: 'u1', rounds: [round('old')] });
    mocked(fetchSharedRounds).mockResolvedValue([savedRow({ id: 'new' })]);
    await useSharedRoundsStore.getState().loadSharedRounds('u1');
    expect(useSharedRoundsStore.getState().rounds.map(r => r.id)).toEqual(['new']);
});
test('keeps the cached list when loading fails (offline)', async () => { /* reject → rounds unchanged */ });
test('shows shared rounds only to the user they were loaded for', () => {
    useSharedRoundsStore.setState({ viewerId: 'u1', rounds: [round('r')] });
    expect(useSharedRoundsStore.getState().visibleSharedRounds('u2')).toEqual([]);
    expect(useSharedRoundsStore.getState().visibleSharedRounds(null)).toEqual([]);
});
test('removes a round locally only after the server accepts it', async () => { /* leave 成功 → 消える / 失敗 → 残り false */ });
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx jest src/services/cloudRoundMapper.test.ts src/services/roundShares.test.ts src/store/sharedRoundsStore.test.ts`
Expected: FAIL（モジュールが無い）

- [ ] **Step 3: `cloudRoundMapper.ts` を作り、`loadCloudRounds` を置き換える**（挙動は変えない）

- [ ] **Step 4: `roundShares.ts` と `sharedRoundsStore.ts` を実装する**

- [ ] **Step 5: 全テストが通ることを確認する**

Run: `npx jest` と `npx tsc --noEmit -p .`
Expected: 全件 PASS、tsc エラーなし（既存の gameStore テストも通ること）

- [ ] **Step 6: コミット**

```bash
git add src/services/cloudRoundMapper.ts src/services/cloudRoundMapper.test.ts src/services/cloudSave.ts src/services/roundShares.ts src/services/roundShares.test.ts src/store/sharedRoundsStore.ts src/store/sharedRoundsStore.test.ts src/store/gameStore.ts
git commit -m "feat: 共有ラウンドの API 呼び出しとストアを追加"
```

---

### Task 4: オーナーの共有パネル（ラウンド詳細）

**Files:**
- Create: `src/components/round-detail/SharePanel.tsx`
- Modify: `src/screens/RoundDetailScreen.tsx`（アクションボタン群の下に置く）
- Modify: `src/i18n/locales/ja.ts`、`en.ts`

**Interfaces:**
- Consumes: Task 3 の `fetchShareStatus` / `createShareLink` / `stopSharing` / `buildShareUrl`
- Produces: `SharePanel({ cloudRoundId }: { cloudRoundId: string | null })` — `cloudRoundId` が null（ゲスト or 未同期）なら説明文だけ

表示（ja の文言は固定）:
- 見出し「共有」
- 共有できない: 「ログインしてクラウドに保存されたラウンドだけ共有できます」
- 未共有: 説明「リンクを開いてログインした人が、このラウンドを見られるようになります（編集はできません）」＋ 主ボタン「共有リンクを作る」
- 共有中: 「共有中（{{count}}人が追加済み）」、リンク文字列（1行・省略可）、「LINE などで送る」（主ボタン）、Web で `navigator.clipboard` があれば「コピー」、赤のテキストボタン「共有をやめる」
- 「共有をやめる」は `confirmAction`（destructive）で「共有をやめると、このリンクは使えなくなり、追加済みの人からも見えなくなります。」
- 通信失敗: `notify` で「通信できませんでした。時間をおいてもう一度お試しください。」
- コピー成功: `notify` で「コピーしました」

送る: Web は `navigator.share({ url })`（無ければ clipboard にフォールバック）、ネイティブは `Share.share({ message: url })`。ユーザーがシートを閉じた（AbortError）場合は何も出さない。

- [ ] **Step 1: `SharePanel.tsx` を実装し、`RoundDetailScreen` に `cloudRoundId={user ? round.cloudId ?? null : null}` で置く**
- [ ] **Step 2: 文言を ja / en に追加する**
- [ ] **Step 3: `npx tsc --noEmit -p .` と `npx expo lint` が通ることを確認する**
- [ ] **Step 4: コミット**

```bash
git add src/components/round-detail/SharePanel.tsx src/screens/RoundDetailScreen.tsx src/i18n/locales/ja.ts src/i18n/locales/en.ts
git commit -m "feat: ラウンド詳細に共有リンクの作成・送信・停止を追加"
```

---

### Task 5: 友人側の画面（受け取りルート・履歴セクション・閲覧専用の詳細）

**Files:**
- Create: `app/(tabs)/share.tsx`、`src/screens/AcceptShareScreen.tsx`
- Modify: `app/(tabs)/_layout.tsx`（`share` を Stack に追加）
- Modify: `src/screens/AuthScreen.tsx`（props 追加）
- Modify: `src/screens/HistoryScreen.tsx`、`src/screens/RoundDetailScreen.tsx`、`app/(tabs)/index.tsx`
- Modify: `src/i18n/locales/ja.ts`、`en.ts`

**Interfaces:**
- Consumes: Task 3 の `acceptSharedRound`、`useSharedRoundsStore`（`loadSharedRounds` / `removeSharedRound` / `visibleSharedRounds`）、`useGameStore().loadCloudRounds`
- Produces: `AuthScreen({ message, allowGuest }: { message?: string; allowGuest?: boolean })`（既定 `allowGuest = true`。`message` はフォーム上に1行表示）

**AcceptShareScreen の流れ:**
1. `token` を `useLocalSearchParams<{ token?: string }>()` で取る。
2. マウント時、`user` が無ければ `useAuthStore.getState().initialize()` を1回だけ呼ぶ（ref ガード）。`isLoading` 中はスピナー。
3. `user` が無い（ゲスト含む）→ `<AuthScreen message="共有されたラウンドを見るにはログインしてください" allowGuest={false} />`。
4. `user` があれば1回だけ `acceptSharedRound(token)`:
   - `isOwner: false` → `loadSharedRounds(user.id)` を待ってから `router.replace({ pathname: '/round-detail', params: { id: roundId } })`
   - `isOwner: true` → `loadCloudRounds()` を待ってから同じく `router.replace`
   - 404 / token 無し → 「このリンクは無効です（共有が停止された可能性があります）」＋「ホームへ」ボタン（`router.replace('/')`）
   - それ以外の失敗 → 通信エラー文言 ＋「もう一度試す」

**HistoryScreen:** `user` があればマウント時に `loadSharedRounds(user.id)`。自分のラウンド一覧の下に見出し「共有されたラウンド」と `visibleSharedRounds(user?.id ?? null)` の行（無ければセクションごと出さない）。行の表示は自分のラウンドと同じ（名前・日付・コース・ホール数・ポイント）、ボタンは「詳細」と「一覧から外す」だけ。「一覧から外す」は `confirmAction`（「自分の履歴から外します。もう一度見るには共有リンクが必要です。」）。検索・状態フィルタは共有セクションにも同じ条件を当てる。

**RoundDetailScreen:** 自分のラウンドが見つからなければ `visibleSharedRounds(user?.id ?? null)` から `id` で探す。共有ラウンドなら、タイトル下に「共有されたラウンド（閲覧のみ）」と出し、`SharePanel` は出さない（画像・CSV・PDF は出す）。

**index.tsx:** ログイン後に `loadCloudRounds()` と並べて `useSharedRoundsStore.getState().loadSharedRounds(user.id)` を呼ぶ。

- [ ] **Step 1: `AuthScreen` に `message` / `allowGuest` を足す**（既存の呼び出しは変えない）
- [ ] **Step 2: `AcceptShareScreen` とルートを追加する**
- [ ] **Step 3: 履歴・詳細・index を変更し、文言を ja / en に追加する**
- [ ] **Step 4: `npx jest`、`npx tsc --noEmit -p .`、`npx expo lint` が通ることを確認する**
- [ ] **Step 5: コミット**

```bash
git add app src/screens src/i18n/locales
git commit -m "feat: 共有リンクの受け取りと、共有されたラウンドの閲覧を追加"
```

---

### Task 6: 2アカウントでの通し確認とリリース

**Files:**
- Create（コミットしない）: スクラッチパッドに `dev-server.mts` と Playwright スクリプト

- [ ] **Step 1: ローカル API 付きの配信サーバーを用意する**

`dev-server.mts`（tsx で起動）: `dist/` を静的配信し、`/api/auth/<path>` は `/api/auth?__path=<path>` に書き換えて `api/auth.ts`、`/api/rounds`・`/api/round-shares`・`/api/shared-rounds` は各 `api/*.ts` の `GET/POST/PATCH/DELETE` に `Request` を渡す。それ以外の未知パスは `dist/index.html`（vercel.json と同じ）。環境変数は `DATABASE_URL=postgres://postgres:postgres@localhost:54329/golf`、`BETTER_AUTH_SECRET`（ランダム）、`BETTER_AUTH_URL=http://localhost:8099`。

- [ ] **Step 2: `npm run build:web` して、Playwright（スマホ幅 375px、日本語）で確認する**

1. A でサインアップ → ラウンドを1つ作って完了 → 詳細で「共有リンクを作る」→ リンク取得
2. 別コンテキストでリンクを開く → ログイン画面（ゲストボタン無し）→ B でサインアップ → そのままラウンド詳細（閲覧のみ）が開く（Review Focus 1, 3）
3. B の履歴に「共有されたラウンド」があり、再開・複製・削除が無い
4. A の詳細で「共有中（1人が追加済み）」
5. A がリンクを自分で開く → 自分の詳細、人数は 1 のまま（Review Focus 2）
6. `?token=abc` と `/share` → 無効表示（Review Focus 5）
7. A が「共有をやめる」→ B が履歴を開き直すと消えている（Review Focus 4）
8. コンソールに新しいエラーが無い（既存の React #418 は除く）

- [ ] **Step 3: ユーザーに報告し、承認を得てから本番へ**

承認後: `npx tsx --env-file=.env scripts/db-migrate.mts` → テーブル2つの存在を確認 → `git push origin main` → Vercel のステータスが success になるまで待つ → 本番バンドルに `round-shares` が含まれることを確認。
