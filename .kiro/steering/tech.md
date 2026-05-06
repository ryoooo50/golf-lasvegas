---
inclusion: always
---

# 技術スタック

## フレームワーク
- **React Native + Expo** (SDK 52)
- **TypeScript** (strict mode)
- **Expo Router** (ファイルベースルーティング)

## 状態管理
- **Zustand** (`useGameStore`) — ゲーム状態のグローバル管理
- 永続化: **AsyncStorage** + Zustand persist middleware（実装予定）

## UIライブラリ
- **React Native Paper** — マテリアルデザインコンポーネント
- **SafeAreaContext** — セーフエリア対応

## 国際化
- **i18next** + **react-i18next** — 日英切り替え
- ロケールファイル: `src/i18n/locales/ja.ts`, `en.ts`

## テスト
- **Jest** + **@testing-library/react-native**
- ユニットテスト: `src/utils/golfLogic.test.ts`

## デプロイ
- **Vercel** (PWAとしてWeb配信)
- ネイティブ: Expo Go / EAS Build

## アーキテクチャ原則
- ビジネスロジックはUIから分離（`src/utils/golfLogic.ts`）
- 型安全性を最優先（`any` 禁止、型アサーション最小限）
- コンポーネントは単一責任（1ファイル300行以下を目標）
- テストファーストでロジック修正を行う
