import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import i18n from '../i18n/i18n';
import * as cloudSave from '../services/cloudSave';
import { useAuthStore } from './authStore';
import { GameState, HoleResult, Player, PlayerId, RoundResult, ScoreInput } from '../types';
import { calculateHoleResult } from '../utils/golfLogic';

// ─── 定数 ──────────────────────────────────────────────────────────────
const BOGEY_KUN_ID: PlayerId = 'bogey_kun';

// ─── ボギーくんプレイヤー定義 ────────────────────────────────────────
const BOGEY_KUN_PLAYER: Player = {
    id: BOGEY_KUN_ID,
    name: 'ボギーくん',
    type: 'bogey_kun',
    pushUsageCount: { front9: 0, back9: 0 },
};

// ─── ヘルパー: ランク付け ─────────────────────────────────────────────
/**
 * 個人スコア（ホール累計ポイント）でプレイヤーをランク付けする。
 * 低スコア（ポイント少ない）ほど上位。同スコアの場合は現在のランク順を維持（stable sort）。
 *
 * @param playerIds    現在のプレイヤーIDリスト（P1→P4 順）
 * @param history      確定済みホール結果リスト
 * @param currentRanking 直前のランキング（同スコア時の安定ソート基準）
 */
function computeNextRanking(
    playerIds: PlayerId[],
    history: HoleResult[],
    currentRanking: PlayerId[],
): PlayerId[] {
    // 累計ポイントを計算
    const totalPoints: Record<PlayerId, number> = {};
    for (const id of playerIds) {
        totalPoints[id] = history.reduce((sum, h) => sum + (h.pointsResult[id] ?? 0), 0);
    }

    // 現在のランキングが空の場合は playerIds 順を初期順とする
    const rankBase = currentRanking.length > 0 ? currentRanking : playerIds;

    // 安定ソート: 同ポイントなら rankBase の順序を維持
    const sorted = [...playerIds].sort((a, b) => {
        const diff = (totalPoints[a] ?? 0) - (totalPoints[b] ?? 0);
        if (diff !== 0) return diff;
        // 同スコア: 前回ランクの順序で安定
        return rankBase.indexOf(a) - rankBase.indexOf(b);
    });

    return sorted;
}

/**
 * ホール番号とランキングからチームペアを決定する。
 * (holeNumber - 1) % 3 でパターンを選択:
 *   0 → P1+P2 vs P3+P4
 *   1 → P1+P3 vs P2+P4
 *   2 → P1+P4 vs P2+P3
 */
function computeTeamPairs(
    holeNumber: number,
    ranking: PlayerId[],
): { teamA: [PlayerId, PlayerId]; teamB: [PlayerId, PlayerId] } {
    const [p1, p2, p3, p4] = ranking;
    const mod = (holeNumber - 1) % 3;

    if (mod === 0) return { teamA: [p1, p2], teamB: [p3, p4] };
    if (mod === 1) return { teamA: [p1, p3], teamB: [p2, p4] };
    return { teamA: [p1, p4], teamB: [p2, p3] };
}

/**
 * 3人モード時のソロプレイヤー（ボギーくんとペアになるプレイヤー）を特定する。
 * teamA または teamB のうち bogey_kun が含まれている側の、もう一方のプレイヤーがソロ。
 */
function findSoloPlayer(
    teamA: [PlayerId, PlayerId],
    teamB: [PlayerId, PlayerId],
): PlayerId | undefined {
    if (teamA.includes(BOGEY_KUN_ID)) {
        return teamA.find(id => id !== BOGEY_KUN_ID);
    }
    if (teamB.includes(BOGEY_KUN_ID)) {
        return teamB.find(id => id !== BOGEY_KUN_ID);
    }
    return undefined;
}

/**
 * プッシュ残り回数を返す。
 * 残り = pushLimit + pushBonus[id] - pushUsed[id]
 */
function getRemainingPush(
    id: PlayerId,
    pushLimit: number,
    pushUsed: Record<PlayerId, number>,
    pushBonus: Record<PlayerId, number>,
): number {
    return pushLimit + (pushBonus[id] ?? 0) - (pushUsed[id] ?? 0);
}

// ─── アクション型定義 ──────────────────────────────────────────────────
interface GameActions {
    addPlayer: (name: string) => void;
    updateSettings: (settings: Partial<GameState['settings']>) => void;
    setLanguage: (lang: 'en' | 'ja') => void;

    /**
     * ホールを確定する。
     * 以下の順序で処理する:
     *  1. スコアキャップ(9)
     *  2. イーグル/バーディー判定
     *  3. フリップ処理
     *  4. 倍率計算
     *  5. ポイント計算（3人モード時はソロ×2）
     *  6. COLevel 更新
     *  7. プッシュカウント更新・バーディー復活ボーナス付与
     *  8. ハーフ切り替え(9→10)時のプッシュリセット
     *  9. 次ホールのランク付け
     * 10. AsyncStorage に保存
     */
    completeHole: (input: {
        par: number;
        scores: Record<PlayerId, ScoreInput>;
        teamA_Ids: [PlayerId, PlayerId];
        teamB_Ids: [PlayerId, PlayerId];
        holeNumber: number;
    }) => void;

    resetGame: () => void;
    updatePlayerName: (id: PlayerId, name: string) => void;

    /**
     * 推奨チームペアを返す。
     * 動的ランキング（playerRanking）と (holeNumber-1)%3 パターンで決定する。
     * playerRanking が空（ゲーム開始直後）の場合は players 配列順を使用。
     */
    getRecommendedPairs: (holeNumber: number) => { teamA: [PlayerId, PlayerId]; teamB: [PlayerId, PlayerId] };

    getPlayerTotalScore: (id: PlayerId) => number;

    /**
     * 指定プレイヤーのプッシュ残り回数を返す。
     * bogey_kun は常に 0 を返す。
     */
    getRemainingPushForPlayer: (id: PlayerId) => number;

    goToHole: (holeNumber: number) => void;
    startGame: (startHole: 1 | 10) => void;
    saveCurrentRound: () => void;
    resumeRound: (roundId: string) => void;
    loadCloudRounds: () => Promise<void>;
}

type GameStore = GameState & GameActions;

// ─── 初期状態 ─────────────────────────────────────────────────────────
const DEFAULT_PLAYERS: Player[] = [
    { id: 'p1', name: 'Player A', pushUsageCount: { front9: 0, back9: 0 } },
    { id: 'p2', name: 'Player B', pushUsageCount: { front9: 0, back9: 0 } },
    { id: 'p3', name: 'Player C', pushUsageCount: { front9: 0, back9: 0 } },
    { id: 'p4', name: 'Player D', pushUsageCount: { front9: 0, back9: 0 } },
];

const INITIAL_STATE: Omit<GameState, 'players'> & { players: Player[] } = {
    players: DEFAULT_PLAYERS,
    currentHole: 1,
    history: [],
    gameStatus: 'menu',
    settings: {
        rate: 10,
        maxPushCountPerHalf: 2,
        language: 'ja',
        matchName: '',
        playerCount: 4,
        birdyPushRecovery: false,
    },
    savedRounds: [],
    nextHoleMultiplier: 1,
    playerRanking: [],
    pushUsed: {},
    pushBonus: {},
    cloudRoundId: null,
};

// ─── ストア作成 ───────────────────────────────────────────────────────
export const useGameStore = create<GameStore>()(
    persist(
        (set, get) => ({
            ...INITIAL_STATE,

            // ── プレイヤー追加 ───────────────────────────────────────
            addPlayer: (name) =>
                set((state) => ({
                    players: [
                        ...state.players,
                        {
                            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
                            name,
                            pushUsageCount: { front9: 0, back9: 0 },
                        },
                    ],
                })),

            // ── 言語設定 ─────────────────────────────────────────────
            setLanguage: (lang) => {
                i18n.changeLanguage(lang);
                set((state) => ({
                    settings: { ...state.settings, language: lang },
                }));
            },

            // ── ホール確定 ───────────────────────────────────────────
            completeHole: ({ par, scores, teamA_Ids, teamB_Ids, holeNumber }) => {
                const state = get();
                const { players, history, settings, nextHoleMultiplier, pushUsed, pushBonus } = state;
                const pushLimit = settings.maxPushCountPerHalf;

                // 3人モード: ボギーくんのスコアを par+1 で自動設定
                const effectiveScores = { ...scores };
                if (settings.playerCount === 3) {
                    effectiveScores[BOGEY_KUN_ID] = {
                        score: par + 1,
                        isBirdie: false,
                        isEagle: false,
                        pushCount: 0,
                    };
                }

                // --- 1. ホール計算 ---
                const currentCarryOverLevel = nextHoleMultiplier === 1
                    ? 0
                    : nextHoleMultiplier / 2;

                const result = calculateHoleResult({
                    holeNumber,
                    par,
                    scores: effectiveScores,
                    teamA_Ids,
                    teamB_Ids,
                    currentCarryOverLevel,
                });

                // --- 2. 3人モード: ソロプレイヤーのポイントを×2 ---
                let adjustedPointsResult = { ...result.pointsResult };
                if (settings.playerCount === 3) {
                    const soloId = findSoloPlayer(teamA_Ids, teamB_Ids);
                    if (soloId && soloId !== BOGEY_KUN_ID) {
                        adjustedPointsResult[soloId] = (adjustedPointsResult[soloId] ?? 0) * 2;
                    }
                }

                // 調整済みポイントで HoleResult を上書き
                const adjustedResult: HoleResult = {
                    ...result,
                    pointsResult: adjustedPointsResult,
                };

                // --- 3. 履歴を更新 ---
                const existingIndex = history.findIndex(h => h.holeNumber === holeNumber);
                const newHistory = [...history];
                if (existingIndex !== -1) {
                    newHistory[existingIndex] = adjustedResult;
                } else {
                    newHistory.push(adjustedResult);
                    newHistory.sort((a, b) => a.holeNumber - b.holeNumber);
                }

                // --- 4. プッシュカウント更新 ---
                const isFront9 = holeNumber <= 9;
                const updatedPlayers = players.map(p => {
                    const usedCount = effectiveScores[p.id]?.pushCount ?? 0;
                    if (usedCount <= 0) return p;
                    return {
                        ...p,
                        pushUsageCount: {
                            front9: isFront9
                                ? p.pushUsageCount.front9 + usedCount
                                : p.pushUsageCount.front9,
                            back9: !isFront9
                                ? p.pushUsageCount.back9 + usedCount
                                : p.pushUsageCount.back9,
                        },
                    };
                });

                // --- 5. pushUsed を更新 ---
                const newPushUsed = { ...pushUsed };
                for (const id of [...teamA_Ids, ...teamB_Ids]) {
                    const used = effectiveScores[id]?.pushCount ?? 0;
                    newPushUsed[id] = (newPushUsed[id] ?? 0) + used;
                }

                // --- 6. ハーフ切り替え（9→10）でプッシュリセット ---
                const crossingHalfBoundary = holeNumber === 9;
                const newPushUsedAfterReset = crossingHalfBoundary
                    ? Object.fromEntries(Object.keys(newPushUsed).map(id => [id, 0]))
                    : newPushUsed;
                const newPushBonusAfterReset = crossingHalfBoundary
                    ? Object.fromEntries(Object.keys(pushBonus).map(id => [id, 0]))
                    : { ...pushBonus };

                // --- 7. バーディー復活ボーナス付与 ---
                const newPushBonus = { ...newPushBonusAfterReset };
                if (settings.birdyPushRecovery) {
                    for (const id of [...teamA_Ids, ...teamB_Ids]) {
                        // ボギーくんはボーナス対象外
                        if (id === BOGEY_KUN_ID) continue;
                        const s = effectiveScores[id];
                        if (s && (s.isBirdie || s.isEagle)) {
                            newPushBonus[id] = (newPushBonus[id] ?? 0) + 1;
                        }
                    }
                }

                // --- 8. 次ホールのランク付け ---
                const realPlayerIds = updatedPlayers
                    .filter(p => p.type !== 'bogey_kun')
                    .map(p => p.id);
                const currentRanking = state.playerRanking.filter(id => realPlayerIds.includes(id));
                const nextRanking = computeNextRanking(realPlayerIds, newHistory, currentRanking);

                // 3人モード: bogey_kun を末尾に追加
                const fullRanking = settings.playerCount === 3
                    ? [...nextRanking, BOGEY_KUN_ID]
                    : nextRanking;

                // --- 9. ゲーム終了判定 ---
                const isGameOver = holeNumber === 18;
                const nextHole = isGameOver ? 18 : holeNumber + 1;
                const nextStatus: GameState['gameStatus'] = isGameOver ? 'finished' : 'playing';

                set({
                    history: newHistory,
                    players: updatedPlayers,
                    currentHole: nextHole,
                    gameStatus: nextStatus,
                    nextHoleMultiplier: result.nextHoleMultiplier,
                    playerRanking: fullRanking,
                    pushUsed: newPushUsedAfterReset,
                    pushBonus: newPushBonus,
                });
            },

            // ── ゲームリセット ───────────────────────────────────────
            resetGame: () => {
                const { savedRounds } = get();
                // AsyncStorage からゲーム状態を削除（履歴は別キーで保持）
                AsyncStorage.removeItem('golf-lasvegas-game').catch(() => {/* 無視 */});
                set({
                    ...INITIAL_STATE,
                    savedRounds,
                    cloudRoundId: null,
                    players: DEFAULT_PLAYERS.map(p => ({
                        ...p,
                        pushUsageCount: { front9: 0, back9: 0 },
                    })),
                });
            },

            // ── プレイヤー名更新 ─────────────────────────────────────
            updatePlayerName: (id, name) =>
                set((state) => ({
                    players: state.players.map((p) => (p.id === id ? { ...p, name } : p)),
                })),

            // ── 推奨チームペア取得 ────────────────────────────────────
            getRecommendedPairs: (holeNumber) => {
                const { players, playerRanking, settings } = get();

                // 実プレイヤーのみでランキング構築
                const realPlayers = players.filter(p => p.type !== 'bogey_kun');
                if (realPlayers.length < 3) {
                    // フォールバック（プレイヤー不足時）
                    const ids = realPlayers.map(p => p.id);
                    return {
                        teamA: [ids[0] ?? 'p1', ids[1] ?? 'p2'],
                        teamB: [ids[2] ?? 'p3', ids[3] ?? 'p4'],
                    };
                }

                // playerRanking が設定済みなら使用、なければ players 順
                const realPlayerIds = realPlayers.map(p => p.id);
                const validRanking = playerRanking.filter(id => realPlayerIds.includes(id));
                const baseRanking = validRanking.length === realPlayerIds.length
                    ? validRanking
                    : realPlayerIds;

                // 3人モード: bogey_kun を末尾に追加してランキングを4人分に
                const fullRanking: PlayerId[] = settings.playerCount === 3
                    ? [...baseRanking, BOGEY_KUN_ID]
                    : baseRanking;

                if (fullRanking.length < 4) {
                    return {
                        teamA: [fullRanking[0] ?? 'p1', fullRanking[1] ?? 'p2'],
                        teamB: [fullRanking[2] ?? 'p3', fullRanking[3] ?? 'p4'],
                    };
                }

                return computeTeamPairs(holeNumber, fullRanking);
            },

            // ── 累計スコア取得 ───────────────────────────────────────
            getPlayerTotalScore: (id) => {
                const { history } = get();
                return history.reduce((total, h) => total + (h.pointsResult[id] ?? 0), 0);
            },

            // ── プッシュ残り回数取得 ─────────────────────────────────
            getRemainingPushForPlayer: (id) => {
                if (id === BOGEY_KUN_ID) return 0;
                const { settings, pushUsed, pushBonus } = get();
                return getRemainingPush(id, settings.maxPushCountPerHalf, pushUsed, pushBonus);
            },

            // ── ホール移動 ───────────────────────────────────────────
            goToHole: (holeNumber) => {
                const { history } = get();
                const prevResult = history.find(h => h.holeNumber === holeNumber - 1);
                const restoredMultiplier = prevResult ? prevResult.nextHoleMultiplier : 1;
                set({ currentHole: holeNumber, nextHoleMultiplier: restoredMultiplier });
            },

            // ── ゲーム開始 ───────────────────────────────────────────
            startGame: (startHole) => {
                const { players: currentPlayers, settings: currentSettings, savedRounds } = get();

                // 実プレイヤーのみ（bogey_kun は startGame 時は含めない）
                const realPlayers = currentPlayers
                    .filter(p => p.type !== 'bogey_kun')
                    .map(p => ({ ...p, pushUsageCount: { front9: 0, back9: 0 } }));

                // 3人モード時: bogey_kun を追加
                const gamePlayers: Player[] = currentSettings.playerCount === 3
                    ? [...realPlayers, { ...BOGEY_KUN_PLAYER }]
                    : realPlayers;

                const initialPushUsed: Record<PlayerId, number> = {};
                const initialPushBonus: Record<PlayerId, number> = {};
                for (const p of gamePlayers) {
                    initialPushUsed[p.id] = 0;
                    initialPushBonus[p.id] = 0;
                }

                set({
                    ...INITIAL_STATE,
                    savedRounds,
                    players: gamePlayers,
                    settings: {
                        ...INITIAL_STATE.settings,
                        ...currentSettings,
                    },
                    currentHole: startHole,
                    gameStatus: 'playing',
                    playerRanking: [],
                    pushUsed: initialPushUsed,
                    pushBonus: initialPushBonus,
                });
            },

            // ── 設定更新 ─────────────────────────────────────────────
            updateSettings: (newSettings) => {
                set((state) => ({
                    settings: { ...state.settings, ...newSettings },
                }));
            },

            // ── ラウンド保存 ─────────────────────────────────────────
            saveCurrentRound: () => {
                const { history, players, settings, savedRounds, getPlayerTotalScore, cloudRoundId } = get();
                if (history.length === 0) return;

                const finalScores: Record<PlayerId, number> = {};
                players.forEach(p => {
                    finalScores[p.id] = getPlayerTotalScore(p.id);
                });

                const newRound: RoundResult = {
                    id: Date.now().toString(),
                    date: new Date().toISOString(),
                    name: settings.matchName || 'Untitled Match',
                    players,
                    history,
                    finalScores,
                    gameStatus: 'finished',
                    currentHole: get().currentHole,
                };

                set({ savedRounds: [newRound, ...savedRounds] });

                // ── クラウド保存（ログインユーザーのみ） ──────────────
                const authUser = useAuthStore.getState().user;
                if (authUser) {
                    const playerNames: Record<string, string> = {};
                    const totalPoints: Record<string, number> = {};
                    players.forEach(p => {
                        playerNames[p.id] = p.name;
                        totalPoints[p.id] = finalScores[p.id] ?? 0;
                    });

                    const roundData: cloudSave.RoundSaveData = {
                        match_name: settings.matchName || 'Untitled Match',
                        rate: settings.rate,
                        player_count: settings.playerCount,
                        player_names: playerNames,
                        push_limit: settings.maxPushCountPerHalf,
                        birdy_push_recovery: settings.birdyPushRecovery,
                        holes: history,
                        total_points: totalPoints,
                    };

                    if (cloudRoundId) {
                        // 既存ラウンドを更新
                        cloudSave.updateRound(cloudRoundId, roundData).catch(() => {
                            // cloud save failure is non-fatal
                        });
                    } else {
                        // 新規ラウンドを保存して cloudRoundId を記録
                        cloudSave.saveRound(authUser.id, roundData)
                            .then((id) => {
                                set({ cloudRoundId: id });
                            })
                            .catch(() => {
                                // cloud save failure is non-fatal
                            });
                    }
                }
            },

            // ── クラウドラウンド読み込み ─────────────────────────────
            loadCloudRounds: async () => {
                const authUser = useAuthStore.getState().user;
                if (!authUser) return;

                try {
                    const cloudRounds = await cloudSave.loadUserRounds(authUser.id);
                    const mapped: RoundResult[] = cloudRounds.map((r) => ({
                        id: r.id,
                        date: r.created_at,
                        name: r.match_name,
                        players: Object.entries(r.player_names).map(([id, name]) => ({
                            id,
                            name,
                            pushUsageCount: { front9: 0, back9: 0 },
                        })),
                        history: (r.holes as HoleResult[]) ?? [],
                        finalScores: r.total_points,
                        gameStatus: 'finished' as const,
                        currentHole: 18,
                    }));

                    // ローカル履歴とマージ（IDで重複排除）
                    const { savedRounds } = get();
                    const localIds = new Set(savedRounds.map(r => r.id));
                    const newRounds = mapped.filter(r => !localIds.has(r.id));
                    set({ savedRounds: [...newRounds, ...savedRounds] });
                } catch {
                    // cloud load failure is non-fatal
                }
            },

            // ── ラウンド再開 ─────────────────────────────────────────
            resumeRound: (roundId) => {
                const { savedRounds } = get();
                const round = savedRounds.find(r => r.id === roundId);
                if (!round) return;

                const sortedHistory = [...round.history].sort((a, b) => a.holeNumber - b.holeNumber);
                const lastResult = sortedHistory[sortedHistory.length - 1];

                // プッシュ状態を再構築（再開時は使用済み回数を履歴から再計算）
                const initialPushUsed: Record<PlayerId, number> = {};
                const initialPushBonus: Record<PlayerId, number> = {};
                for (const p of round.players) {
                    initialPushUsed[p.id] = 0;
                    initialPushBonus[p.id] = 0;
                }

                set({
                    players: round.players,
                    history: round.history,
                    currentHole: round.currentHole,
                    gameStatus: 'playing',
                    nextHoleMultiplier: lastResult?.nextHoleMultiplier ?? 1,
                    settings: {
                        ...get().settings,
                        matchName: round.name,
                    },
                    playerRanking: [],
                    pushUsed: initialPushUsed,
                    pushBonus: initialPushBonus,
                });
            },
        }),
        {
            name: 'golf-lasvegas-game',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                players: state.players,
                currentHole: state.currentHole,
                history: state.history,
                gameStatus: state.gameStatus,
                settings: state.settings,
                savedRounds: state.savedRounds,
                nextHoleMultiplier: state.nextHoleMultiplier,
                playerRanking: state.playerRanking,
                pushUsed: state.pushUsed,
                pushBonus: state.pushBonus,
                cloudRoundId: state.cloudRoundId,
            }),
            // 破損データのフォールバック
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    // 破損データは無視して初期状態を使用
                }
                if (state) {
                    // 後方互換: 新フィールドが存在しない古いデータのマイグレーション
                    if (!state.playerRanking) state.playerRanking = [];
                    if (!state.pushUsed) state.pushUsed = {};
                    if (!state.pushBonus) state.pushBonus = {};
                    if (state.cloudRoundId === undefined) state.cloudRoundId = null;
                    if (state.settings && !('playerCount' in state.settings)) {
                        (state.settings as GameState['settings']).playerCount = 4;
                    }
                    if (state.settings && !('birdyPushRecovery' in state.settings)) {
                        (state.settings as GameState['settings']).birdyPushRecovery = false;
                    }
                }
            },
        },
    ),
);

// ─── ユーティリティエクスポート ────────────────────────────────────
export { BOGEY_KUN_ID, BOGEY_KUN_PLAYER, computeTeamPairs, findSoloPlayer, getRemainingPush };
