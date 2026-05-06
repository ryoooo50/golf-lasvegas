---
inclusion: always
---

# プロジェクト構造

```
golf-lasvegas/
├── app/                          # Expo Router ページ
│   ├── _layout.tsx               # ルートレイアウト（Provider類）
│   ├── (tabs)/                   # タブナビゲーション
│   │   ├── index.tsx             # メイン画面エントリ
│   │   └── explore.tsx           # (未使用、削除予定)
│   └── modal.tsx                 # モーダル画面
├── src/
│   ├── screens/
│   │   ├── StartScreen.tsx       # トップ/スタート画面
│   │   └── ScoreInputScreen.tsx  # スコア入力画面（メイン）
│   ├── components/               # 再利用可能コンポーネント（整備予定）
│   ├── store/
│   │   └── gameStore.ts          # Zustand ゲームストア
│   ├── utils/
│   │   ├── golfLogic.ts          # コアビジネスロジック（テスト対象）
│   │   └── golfLogic.test.ts     # ユニットテスト
│   ├── types.ts                  # 型定義
│   └── i18n/
│       ├── i18n.ts               # i18next初期化
│       └── locales/
│           ├── ja.ts             # 日本語
│           └── en.ts             # 英語
├── constants/
│   └── theme.ts                  # テーマ定数
├── .kiro/
│   ├── steering/                 # ステアリングドキュメント
│   └── specs/                    # 機能仕様
└── specification.md              # 元仕様書
```

## コードパターン

### 状態管理
- ゲーム状態は `useGameStore()` から取得
- ローカルUI状態は `useState` で管理
- 永続化が必要なものは Zustand persist に移行

### コンポーネント設計
- 画面コンポーネント: `src/screens/`
- 汎用コンポーネント: `src/components/`
- スタイルは同一ファイルの末尾に `StyleSheet.create()` で定義

### ビジネスロジック
- 全てのゲーム計算は `src/utils/golfLogic.ts` に集約
- UIコンポーネントは計算をしない（ストアかユーティリティに委譲）
- 新しいロジックにはテストを必ず書く
