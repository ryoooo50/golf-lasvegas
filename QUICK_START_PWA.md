# Webアプリ（PWA）としての公開・インストール手順

このプロジェクトは既に**Webアプリ (PWA)** として公開する準備が完了しています。
モダンなExpo (SDK 54) の設定を行い、ビルドが成功することを確認済みです。

## 1. GitHubへのアップロード
現在のコードをGitHubのリポジトリにプッシュしてください。

## 2. Vercelでの公開手順
Vercel (https://vercel.com) を使うと無料で簡単に公開できます。

1.  **Vercelにログイン**し、「Add New ...」 -> 「Project」を選択。
2.  GitHubアカウントを接続し、このリポジトリ（`golf-lasvegas`）をインポート。
3.  **Framework Preset** は `Other` を選択（`Expo` ではなく `Other` 推奨）。
4.  **Build and Output Settings** を以下のように設定してください（**ここが最重要です**）:
    *   **Build Command**: `npm run build:web`
    *   **Output Directory**: `dist`
    *   **Install Command**: `npm install` (そのままでOK)
    *   ※ スイッチを「Override」にして入力してください。
5.  「Deploy」をクリック。

## トラブルシューティング
*   **404 Not Found になる場合**:
    *   Vercelの Settings -> General -> Build & Development Settings を確認してください。
    *   **Output Directory** が `dist` になっているか確認してください（デフォルトの `public` だと失敗します）。
    *   修正したら「Redeploy」を行ってください。

## 3. スマホへのインストール方法 (PWA)
デプロイが完了するとURLが発行されます（例: `https://golf-lasvegas.vercel.app`）。

1.  iPhoneの**Safari**でそのURLにアクセスします。
2.  画面下部の「共有アイコン（四角から矢印が出ているアイコン）」をタップ。
3.  メニューをスクロールして**「ホーム画面に追加」**を選択。
4.  右上の「追加」をタップ。

これでホーム画面に「Golf LasVegas」というアイコンが追加され、アプリのように全画面で起動できるようになります。

## 補足
*   **オフライン動作**: キャッシュが効くため、一度読み込めば電波の悪いゴルフ場でも動作する可能性が高いですが、確実な動作のためには初回ロードを済ませておいてください。
*   **アイコン**: 現在はデフォルトのExpoアイコンになっています。`assets/images` 内の `icon.png` (1024x1024推奨) を独自の画像に差し替えると、ホーム画面のアイコンも変わります。

※ ユーザー様のご指定にあった `@expo/webpack-config` は、最新のExpoでは不要（Metroバンドラーが標準）なため使用していません。上記の設定で問題なく動作します。
