export type PlayerId = string;

// ─── スコア判定型 ──────────────────────────────────────────────────
// 'eagle' はイーグル以下（アルバトロス・ホールインワン含む）をすべて含む
export type ScoreCategory = 'normal' | 'birdie' | 'eagle';

// ─── プレイヤー種別 ────────────────────────────────────────────────
// 'bogey_kun' は3人モード用の仮想プレイヤー（常にpar+1を打つ）
export type PlayerType = 'real' | 'bogey_kun';

export interface Player {
  id: PlayerId;
  name: string;
  type?: PlayerType; // 未指定の場合は 'real' とみなす
  pushUsageCount: {
    front9: number; // OUT (1-9)
    back9: number;  // IN (10-18)
  };
}

// ─── ゲーム設定 ────────────────────────────────────────────────────
export interface GameSettings {
  matchName: string;
  rate: number;                  // 単位なし（通貨単位を表示しない）
  playerCount: 3 | 4;           // 3人 or 4人
  pushLimit: number;             // 0〜5、デフォルト2（1プレイヤー・1ハーフあたり）
  birdyPushRecovery: boolean;    // バーディーでプッシュ権利+1復活オプション
}

export interface ScoreInput {
  score: number;
  isBirdie: boolean; // バーディー（パー-1）以上ならtrue（自動判定 or 手動設定）
  isEagle: boolean;  // イーグル（パー-2以下）またはホールインワンならtrue
  pushCount: number; // このホールでプッシュ権を何回行使するか (0 = なし)
}

export interface TeamScoreBreakdown {
  player1Score: number;
  player2Score: number;
  combinedRaw: number;   // min×10+max の連結スコア
  flipped: boolean;      // バーディーフリップが発生したか
  combinedFinal: number; // フリップ後の最終スコア
}

export interface CalculationBreakdown {
  teamA: TeamScoreBreakdown;
  teamB: TeamScoreBreakdown;
  diff: number;
  pushMultiplier: number;      // PushMult = pushCount × 2 (0人=0, 加算式)
  carryOverMultiplier: number; // COMult = COLevel × 2 (引き分け0回=0, 1回=2, 2回=4...)
  eagleMultiplier: number;     // EagleMult = eagleCount × 2
  finalMultiplier: number;     // max(1, PushMult + COMult + EagleMult)
  finalPoints: number;
  isDraw: boolean;
}

export interface HoleResult {
  holeNumber: number; // 1-18
  par: number;
  scores: Record<PlayerId, ScoreInput>;

  // ペア分け情報
  teamA_Ids: [PlayerId, PlayerId];
  teamB_Ids: [PlayerId, PlayerId];

  // 計算用メタデータ
  carryOverMultiplier: number; // このホールに適用されるキャリーオーバー倍率 (通常1)
  isDraw: boolean;

  appliedMultiplier: number;
  pointsResult: Record<PlayerId, number>;
  nextHoleMultiplier: number;
  breakdown: CalculationBreakdown; // 詳細計算内訳
}

// ─── ホールデータ（新アーキテクチャ用） ───────────────────────────
export interface HoleResultV2 {
  winningSide: 'A' | 'B' | 'draw';
  diff: number;
  pushMult: number;
  coMult: number;
  eagleMult: number;
  multiplier: number;
  points: number;            // diff × multiplier（rate未適用）
  coLevelAfter: number;      // このホール後のCOLevel
  teamAScore: number;        // フリップ後の2桁チームスコア
  teamBScore: number;
}

export interface HoleData {
  holeNumber: number;        // 1〜18
  par: number;               // そのホールのパー（ユーザー入力、デフォルト4）
  scores: Record<PlayerId, number>;               // プレイヤーID → スコア（キャップ前の生スコア）
  scoreCategories: Record<PlayerId, ScoreCategory>; // プレイヤーID → 判定
  pushPlayers: PlayerId[];   // プッシュ宣言したプレイヤーIDリスト
  teamA: PlayerId[];         // チームAのプレイヤーIDリスト（そのホールのローテーション結果）
  teamB: PlayerId[];         // チームBのプレイヤーIDリスト
  soloPlayerId?: PlayerId;   // 3人モード時のソロプレイヤーID（ボギーくんとペア）
  result: HoleResultV2 | null; // 確定後のホール結果
}

export interface RoundResult {
  id: string; // UUID
  cloudId?: string | null; // Supabase rounds.id。未同期ローカル保存時は null
  date: string; // ISO
  name: string; // Match Name
  players: Player[];
  history: HoleResult[];
  finalScores: Record<PlayerId, number>;
  gameStatus: 'menu' | 'playing' | 'finished';
  currentHole: number;
}

export interface GameState {
  players: Player[];
  currentHole: number;
  history: HoleResult[];
  gameStatus: 'menu' | 'playing' | 'finished';

  // 設定
  settings: {
    rate: number;               // 単位なし
    maxPushCountPerHalf: number; // デフォルト2（後方互換用、pushLimit と同義）
    language: 'en' | 'ja';
    matchName: string;
    playerCount: 3 | 4;        // 3人 or 4人モード
    birdyPushRecovery: boolean; // バーディーでプッシュ権利+1復活オプション
  };

  // Saved Rounds
  savedRounds: RoundResult[];
  pendingCloudSaves: PendingCloudSave[];

  // 次のホールに持ち越されている倍率（初期値1, 引き分け発生で x2, x4...）
  nextHoleMultiplier: number;

  // ─── 動的ローテーション・プッシュ管理（新フィールド） ────────
  // 現在のP1〜P4順（プレイヤーIDリスト）。毎ホール後に再ランク付けされる。
  playerRanking: PlayerId[];
  // プレイヤーID → 使用済みプッシュ回数（ハーフ（1〜9 or 10〜18）ごとにリセット）
  pushUsed: Record<PlayerId, number>;
  // プレイヤーID → バーディー復活による追加プッシュ権利
  pushBonus: Record<PlayerId, number>;
  // プレイヤーID → 前半（ホール1〜9）の確定済みプッシュ使用回数（ホール9完了後に確定）
  pushUsedFront9: Record<PlayerId, number>;
  // プレイヤーID → 前半のバーディーボーナス（同上）
  pushBonusFront9: Record<PlayerId, number>;
  // クラウド保存時の Supabase ラウンド ID（ゲスト時は null）
  cloudRoundId: string | null;
}

export interface PendingCloudSave {
  id: string;
  operation: 'upsert' | 'delete';
  userId: string;
  localRoundId: string;
  cloudRoundId?: string | null;
  roundData?: {
    match_name: string;
    rate: number;
    player_count: number;
    player_names: Record<string, string>;
    push_limit: number;
    birdy_push_recovery: boolean;
    holes: unknown;
    total_points: Record<string, number>;
  };
  createdAt: string;
}

export interface SaveRoundResult {
  localSaved: boolean;
  cloudStatus: 'saved' | 'queued' | 'guest' | 'no-data';
  roundId?: string;
  message?: string;
}

// ─── 新ゲーム状態（新アーキテクチャ用） ──────────────────────────
export interface GameStateV2 {
  settings: GameSettings;
  players: Player[];             // P1〜P4の順（毎ホール再ランク後）
  currentHole: number;           // 1〜18
  coLevel: number;               // 現在のキャリーオーバーレベル（0=なし）
  holes: HoleData[];             // 確定済みホールデータ
  pushUsed: Record<PlayerId, number>;   // プレイヤーID → 使用済みプッシュ回数（ハーフごとリセット）
  pushBonus: Record<PlayerId, number>;  // プレイヤーID → バーディー復活による追加プッシュ権利
  playerRanking: PlayerId[];     // 現在のP1〜P4順（プレイヤーIDリスト）
}
