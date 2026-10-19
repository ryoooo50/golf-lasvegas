# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Backend (Neon + Better Auth on Vercel Functions)

- `api/` … Vercel Functions の入口（`/api/auth/*` 認証、`/api/rounds` ラウンド保存、`/api/round-shares` 共有リンクの作成・状態・停止（オーナー）、`/api/shared-rounds` 共有の受け取り・一覧・解除（友達））
- `server/` … 認証設定・DB 接続・rounds の処理
- `neon/schema.sql` … DB スキーマ（`round_shares` / `round_share_members` の共有テーブルを含む）。`DATABASE_URL=... npm run db:migrate` で適用（何度流しても安全）

必要な環境変数は `.env.example` を参照。

### 権限（管理者 / ユーザー）

- Better Auth の admin プラグインで `user.role` を `admin` / `user` に分けている。新規登録は `user`。
- 環境変数 `ADMIN_EMAILS`（カンマ区切り）に載っているメールは、登録時・ログイン時に `admin` になる。
- 管理者は開始画面の「ユーザー管理」から、ユーザー一覧・利用停止・削除・パスワード再設定・権限変更ができる（なりすましは不可）。
- 権限の判定はサーバー側（`server/auth.ts`）で行う。アプリ側の `isAdmin` は画面の出し分けにだけ使う。
- `ADMIN_EMAILS` は昇格のみ（外しても降格しない）。メール確認をしていないので、登録済みアカウントのメールだけを載せる。
- 本番に出すときは **先に `npm run db:migrate` で Neon に列・テーブル（`round_shares` / `round_share_members` など）を追加してからデプロイ** する（逆順だとログインや共有が失敗する）。

```bash
# API の結合テスト（ローカルの Postgres に対して実行）
docker run -d --name golf-lv-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=golf -p 54329:5432 postgres:17-alpine
export DATABASE_URL=postgres://postgres:postgres@localhost:54329/golf
npm run db:migrate
BETTER_AUTH_SECRET=$(openssl rand -hex 32) BETTER_AUTH_URL=http://localhost:3000 npm run test:api
```

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
