# Golf Las Vegas App - Specification Document (Rev. 2)

## 1. プロジェクト概要

ゴルフの賭けルール「ラスベガス」の計算を管理するスマートフォンアプリ（MVP）を開発する。
独自の「プッシュ」ルールや「キャリーオーバー」、特殊な「バーディー処理」を含み、ラウンド中の複雑な計算を自動化することを目的とする。

## 2. 技術スタック選定

エージェントへの指示として以下を推奨する。

- **Framework**: React Native (Expo) - iOS/Android両対応、開発速度重視
- **Language**: TypeScript
- **State Management**: React Context API or Zustand
- **UI Library**: React Native Paper, Tamagui, or NativeBase
- **Persistence**: AsyncStorage (データ永続化)

## 3. データモデル (TypeScript Interface)

変更に強く、キャリーオーバー等の状態管理を行える設計とする。

```typescript
type PlayerId = string;

interface Player {
  id: PlayerId;
  name: string;
  pushUsageCount: {
    front9: number; // OUT (1-9)
    back9: number;  // IN (10-18)
  };
}

interface ScoreInput {
  score: number;
  isBirdie: boolean; // バーディー以上ならtrue
  isEagle: boolean;  // イーグル以下ならtrue
  pushCount: number; // このホールでプッシュ権を何回行使するか
}

interface HoleResult {
  holeNumber: number; // 1-18
  par: number;
  scores: Record<PlayerId, ScoreInput>;
  
  // ペア分け情報
  teamA_Ids: [PlayerId, PlayerId]; 
  teamB_Ids: [PlayerId, PlayerId];
  
  // 計算用メタデータ
  carryOverMultiplier: number; // このホールに適用されるキャリーオーバー倍率 (通常1)
  isDraw: boolean; // 引き分けだった場合（次回へのキャリーオーバー発生フラグ）
  
  // 計算確定後のポイント変動 (誰が誰に何ポイント払う/貰うか)
  // プラスは受取、マイナスは支払
  pointsResult: Record<PlayerId, number>; 
}

interface GameState {
  players: Player[];
  currentHole: number;
  history: HoleResult[];
  
  // 設定
  settings: {
    rate: number; // 単位なし
    maxPushCountPerHalf: number; // デフォルト2
  };
  
  // 次のホールに持ち越されている倍率（初期値1, 引き分け発生で x2, x4...）
  nextHoleMultiplier: number; 
}
```

## 4. ビジネスロジック（計算ルール詳細）

### 4.1. チームスコアの連結とフリップ（バーディー処理）

**基本連結:**

各チーム2名のスコアを確認する。

- **通常時**: `min(score1, score2)` を10の位、`max(score1, score2)` を1の位とする。
- 例: A(4), B(5) -> 45

**バーディーによるフリップ (Flip):**

- **ルール**: 「バーディーを取ったチームの相手チーム」は、スコアの1の位と10の位が入れ替わる（大きい数字が10の位に来る）。
- 例: チームAがバーディー。チームBのスコアは (4, 6)。
  - 通常のチームBスコア: 46
  - フリップ後のチームBスコア: 64

**相殺ルール**: 両チームにバーディーが出た場合、両チームともフリップする（または相殺して通常通りとするかは実装時に選択可能にするが、MVPでは「条件を満たせばフリップ」という単純ルールを採用し、両チームフリップとする）。

### 4.2. スコアキャップ、勝敗と基本ポイント算出

個人スコアは連結前に最大9でキャップする。

- 例: 10打、12打はいずれも9として扱う。

`Diff = |TeamA_Score - TeamB_Score|`

得点が低い（ゴルフとして良いスコア）チームが勝利。

### 4.3. 倍率計算 (Multiplier Logic)

最終的なポイントは以下の式で算出する。

$$ \text{FinalPoint} = \text{Diff} \times \text{FinalMultiplier} $$

`FinalMultiplier` は、プッシュ・キャリーオーバー・イーグルの倍率要素を加算して決定する。

$$ \text{FinalMultiplier} = \max(1, \text{PushMult} + \text{CarryOverMult} + \text{EagleMult}) $$

倍率要素が何もない場合は1倍とする。

#### A. プッシュ倍率 (PushMult)

参加者全員の `pushCount` の合計数 (`totalPushCount`) をカウントする。

**計算式:**

- `totalPushCount == 0` の場合: 0
- `totalPushCount > 0` の場合: `2 * totalPushCount`
  - 1プッシュ: +2
  - 2プッシュ: +4
  - 3プッシュ: +6
  - 4プッシュ: +8

#### B. キャリーオーバー倍率 (CarryOverMult)

前のホールからの持ち越しレベル。

- 通常は 0。
- 前ホールが引き分けの場合、+2 になる。
- 連続引き分けの場合は +4, +6, +8 と「引き分け連続回数 × 2」で増加する。

#### C. イーグル倍率 (EagleMult)

イーグル以下（パー-2以下、ホールインワン含む）のプレイヤー人数をカウントする。

- `EagleMult = eagleCount * 2`
- イーグルはバーディーフリップの条件にも含める。

#### D. 加算例

- プッシュなし、キャリーなし、イーグルなし: `max(1, 0 + 0 + 0) = 1倍`
- 1プッシュのみ: `max(1, 2 + 0 + 0) = 2倍`
- 2プッシュ + キャリー1回: `max(1, 4 + 2 + 0) = 6倍`
- 1プッシュ + キャリー1回 + イーグル1人: `max(1, 2 + 2 + 2) = 6倍`

### 4.4. 引き分け (Draw) の処理

`TeamA_Score == TeamB_Score` の場合:

- そのホールの `pointsResult` は全員 0 とする。
- `nextHoleMultiplier` を更新する。
  - 現在が 1倍 (通常) の場合 → 2倍 にする。
  - 現在が 2倍以上 (キャリーオーバー中) の場合 → 現在の倍率 + 2 を加算する。
  - (例: 2倍→4倍、4倍→6倍、6倍→8倍)

勝敗がついた場合:

- 計算を実行しポイントを確定。
- `nextHoleMultiplier` を 1 にリセットする。

### 4.5. 3人モード

3人モードでは、実プレイヤー3名に加えて仮想プレイヤー「ボギーくん」を追加し、内部的には4人分のチーム戦として計算する。

- ボギーくんのスコアは常に `par + 1`。
- ボギーくんはバーディー、イーグル、プッシュ、バーディープッシュ復活の対象外。
- ボギーくんとペアになる実プレイヤーを「ソロプレイヤー」とする。
- ソロプレイヤーのホールポイントは、通常計算後に2倍する。
- チームペアは4人モードと同じ3パターンを使い、3人モードではランキング末尾にボギーくんを置いてローテーションする。

チームペアのローテーション:

- `(holeNumber - 1) % 3 == 0`: P1+P2 vs P3+P4
- `(holeNumber - 1) % 3 == 1`: P1+P3 vs P2+P4
- `(holeNumber - 1) % 3 == 2`: P1+P4 vs P2+P3

3人モードでは P4 がボギーくんになるため、各3ホールでソロ担当が入れ替わる。

## 5. UI/UX 要件

### 5.1. 入力画面 (Score Input)

**キャリーオーバー表示:**

現在キャリーオーバー中（倍率がかかっている状態）であることを目立つように表示する（例: 🔥 Rate x2 🔥）。

**スコア入力:**

- 4人分のスコア入力行。
- **Birdie Checkbox**: チェックを入れると、UI上で「相手チームへの攻撃（Flip）」が発生することを視覚的に示唆すると良い（MVPではチェックのみでOK）。

**Push Toggle:**

- ハーフごとの残り回数 (`maxPushCountPerHalf + pushBonus - usedCount`) を表示。
- 残り回数が0なら選択不可(Disabled)。

**リアルタイム予測:**

スコアを入力している最中に、「現在の入力だとどちらが勝つか、何ポイント動くか」をリアルタイムでプレビュー表示する（計算ミス防止のため）。

### 5.2. 結果表示

**詳細内訳:**

なぜそのポイントになったのかの式を表示する。

- 例: `(64 - 45) × (Push +4 + Carry +2) = 114 pts`
- 特にバーディーによるスコア入れ替え（46 -> 64）が発生した場合は、それがわかるように強調表示する。

### 5.3. 設定変更

プッシュの上限回数や、キャリーオーバーの有無などは変更可能にする設計としておくこと。

## 6. 実装ステップ (Agentへの指示)

1. **Core Logic**: `calculateHoleResult` 関数を最初に実装し、単体テストを書くこと（特にバーディーのフリップ、プッシュ倍率、キャリーオーバーのロジック確認のため）。
2. **State**: Context API等でグローバルステートを作成。
3. **UI**: 入力画面 -> 結果モーダル -> 履歴画面 の順で実装。
