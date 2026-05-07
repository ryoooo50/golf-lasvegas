import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import i18n from '../i18n/i18n';
import * as cloudSave from '../services/cloudSave';
import { useAuthStore } from './authStore';
import { GameState, HoleResult, PendingCloudSave, Player, PlayerId, RoundResult, SaveRoundResult, ScoreInput } from '../types';
import { calculateHoleResult } from '../utils/golfLogic';
import { BOGEY_KUN_ID, applySoloPlayerPointMultiplier, computeTeamPairs, findSoloPlayer } from '../utils/threePlayerMode';

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

function createLocalId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function buildRoundSaveData(
    players: Player[],
    settings: GameState['settings'],
    history: HoleResult[],
    finalScores: Record<PlayerId, number>,
): cloudSave.RoundSaveData {
    const playerNames: Record<string, string> = {};
    const totalPoints: Record<string, number> = {};

    players.forEach(p => {
        playerNames[p.id] = p.name;
        totalPoints[p.id] = finalScores[p.id] ?? 0;
    });

    return {
        match_name: settings.matchName || 'Untitled Match',
        rate: settings.rate,
        player_count: settings.playerCount,
        player_names: playerNames,
        push_limit: settings.maxPushCountPerHalf,
        birdy_push_recovery: settings.birdyPushRecovery,
        holes: history,
        total_points: totalPoints,
    };
}

function rebuildPushStateFromHistory(
    players: Player[],
    history: HoleResult[],
    settings: GameState['settings'],
): { players: Player[]; pushUsed: Record<PlayerId, number>; pushBonus: Record<PlayerId, number> } {
    const sortedHistory = [...history].sort((a, b) => a.holeNumber - b.holeNumber);
    let pushUsed: Record<PlayerId, number> = {};
    let pushBonus: Record<PlayerId, number> = {};

    const rebuiltPlayers = players.map(p => ({
        ...p,
        pushUsageCount: { front9: 0, back9: 0 },
    }));

    for (const p of rebuiltPlayers) {
        pushUsed[p.id] = 0;
        pushBonus[p.id] = 0;
    }

    for (const hole of sortedHistory) {
        const isFront9 = hole.holeNumber <= 9;
        for (const id of [...hole.teamA_Ids, ...hole.teamB_Ids]) {
            const used = hole.scores[id]?.pushCount ?? 0;
            pushUsed[id] = (pushUsed[id] ?? 0) + used;

            const playerIndex = rebuiltPlayers.findIndex(p => p.id === id);
            if (playerIndex >= 0 && used > 0) {
                const player = rebuiltPlayers[playerIndex];
                rebuiltPlayers[playerIndex] = {
                    ...player,
                    pushUsageCount: {
                        front9: isFront9 ? player.pushUsageCount.front9 + used : player.pushUsageCount.front9,
                        back9: !isFront9 ? player.pushUsageCount.back9 + used : player.pushUsageCount.back9,
                    },
                };
            }
        }

        if (hole.holeNumber === 9) {
            pushUsed = Object.fromEntries(Object.keys(pushUsed).map(id => [id, 0]));
            pushBonus = Object.fromEntries(Object.keys(pushBonus).map(id => [id, 0]));
        }

        if (settings.birdyPushRecovery) {
            for (const id of [...hole.teamA_Ids, ...hole.teamB_Ids]) {
                if (id === BOGEY_KUN_ID) continue;
                const score = hole.scores[id];
                if (score?.isBirdie || score?.isEagle) {
                    pushBonus[id] = (pushBonus[id] ?? 0) + 1;
                }
            }
        }
    }

    return { players: rebuiltPlayers, pushUsed, pushBonus };
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
    resetHole: (holeNumber: number) => void;
    startGame: (startHole: 1 | 10) => void;
    saveCurrentRound: () => Promise<SaveRoundResult>;
    deleteSavedRound: (roundId: string) => Promise<{ cloudStatus: 'deleted' | 'queued' | 'local-only' }>;
    resumeRound: (roundId: string) => void;
    loadCloudRounds: () => Promise<void>;
    syncPendingCloudSaves: () => Promise<void>;
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
    pendingCloudSaves: [],
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
                const { players, history, settings, nextHoleMultiplier } = state;

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
                    adjustedPointsResult = applySoloPlayerPointMultiplier(adjustedPointsResult, teamA_Ids, teamB_Ids);
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

                // --- 4. 履歴からプッシュ使用回数とボーナスを再構築 ---
                const rebuiltPushState = rebuildPushStateFromHistory(players, newHistory, settings);

                // --- 5. 次ホールのランク付け ---
                const realPlayerIds = rebuiltPushState.players
                    .filter(p => p.type !== 'bogey_kun')
                    .map(p => p.id);
                const currentRanking = state.playerRanking.filter(id => realPlayerIds.includes(id));
                const nextRanking = computeNextRanking(realPlayerIds, newHistory, currentRanking);

                // 3人モード: bogey_kun を末尾に追加
                const fullRanking = settings.playerCount === 3
                    ? [...nextRanking, BOGEY_KUN_ID]
                    : nextRanking;

                // --- 6. ゲーム終了判定 ---
                const isGameOver = holeNumber === 18;
                const nextHole = isGameOver ? 18 : holeNumber + 1;
                const nextStatus: GameState['gameStatus'] = isGameOver ? 'finished' : 'playing';

                set({
                    history: newHistory,
                    players: rebuiltPushState.players,
                    currentHole: nextHole,
                    gameStatus: nextStatus,
                    nextHoleMultiplier: result.nextHoleMultiplier,
                    playerRanking: fullRanking,
                    pushUsed: rebuiltPushState.pushUsed,
                    pushBonus: rebuiltPushState.pushBonus,
                });
            },

            // ── ゲームリセット ───────────────────────────────────────
            resetGame: () => {
                const { savedRounds, pendingCloudSaves } = get();
                // AsyncStorage からゲーム状態を削除（履歴は別キーで保持）
                AsyncStorage.removeItem('golf-lasvegas-game').catch(() => {/* 無視 */});
                set({
                    ...INITIAL_STATE,
                    savedRounds,
                    pendingCloudSaves,
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

            // ── ホールリセット ───────────────────────────────────────
            resetHole: (holeNumber) => {
                const { history, players, settings } = get();
                const newHistory = history.filter(h => h.holeNumber !== holeNumber);
                const rebuiltPushState = rebuildPushStateFromHistory(players, newHistory, settings);

                const prevResult = newHistory.find(h => h.holeNumber === holeNumber - 1);
                const restoredMultiplier = prevResult ? prevResult.nextHoleMultiplier : 1;

                set({
                    history: newHistory,
                    players: rebuiltPushState.players,
                    pushUsed: rebuiltPushState.pushUsed,
                    pushBonus: rebuiltPushState.pushBonus,
                    nextHoleMultiplier: restoredMultiplier,
                });
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
                const { players: currentPlayers, settings: currentSettings, savedRounds, pendingCloudSaves } = get();

                // 実プレイヤーのみ（bogey_kun は startGame 時は含めない）
                const realPlayerLimit = currentSettings.playerCount === 3 ? 3 : 4;
                const realPlayers = currentPlayers
                    .filter(p => p.type !== 'bogey_kun')
                    .slice(0, realPlayerLimit)
                    .map(p => ({ ...p, type: 'real' as const, pushUsageCount: { front9: 0, back9: 0 } }));

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
                    pendingCloudSaves,
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
            saveCurrentRound: async () => {
                const { history, players, settings, savedRounds, getPlayerTotalScore, cloudRoundId } = get();
                if (history.length === 0) return { localSaved: false, cloudStatus: 'no-data' };

                const finalScores: Record<PlayerId, number> = {};
                players.forEach(p => {
                    finalScores[p.id] = getPlayerTotalScore(p.id);
                });

                const existingRound = cloudRoundId
                    ? savedRounds.find(r => r.cloudId === cloudRoundId || r.id === cloudRoundId)
                    : null;
                const localRoundId = existingRound?.id ?? createLocalId('round');
                const newRound: RoundResult = {
                    id: localRoundId,
                    cloudId: cloudRoundId,
                    date: existingRound?.date ?? new Date().toISOString(),
                    name: settings.matchName || 'Untitled Match',
                    players,
                    history,
                    finalScores,
                    gameStatus: 'finished',
                    currentHole: get().currentHole,
                };

                const nextSavedRounds = existingRound
                    ? savedRounds.map(r => (r.id === existingRound.id ? newRound : r))
                    : [newRound, ...savedRounds];

                set({ savedRounds: nextSavedRounds });

                // ── クラウド保存（ログインユーザーのみ） ──────────────
                const authUser = useAuthStore.getState().user;
                if (!authUser) {
                    return { localSaved: true, cloudStatus: 'guest', roundId: localRoundId };
                }

                const roundData = buildRoundSaveData(players, settings, history, finalScores);

                try {
                    const syncedCloudId = cloudRoundId
                        ? (await cloudSave.updateRound(cloudRoundId, roundData), cloudRoundId)
                        : await cloudSave.saveRound(authUser.id, roundData);

                    set((state) => ({
                        cloudRoundId: syncedCloudId,
                        savedRounds: state.savedRounds.map(r => (
                            r.id === localRoundId ? { ...r, cloudId: syncedCloudId, id: syncedCloudId } : r
                        )),
                        pendingCloudSaves: state.pendingCloudSaves.filter(p => p.localRoundId !== localRoundId),
                    }));

                    return { localSaved: true, cloudStatus: 'saved', roundId: syncedCloudId };
                } catch (err: unknown) {
                    const pending: PendingCloudSave = {
                        id: createLocalId('pending'),
                        operation: 'upsert',
                        userId: authUser.id,
                        localRoundId,
                        cloudRoundId,
                        roundData,
                        createdAt: new Date().toISOString(),
                    };

                    set((state) => ({
                        pendingCloudSaves: [
                            pending,
                            ...state.pendingCloudSaves.filter(p => p.localRoundId !== localRoundId || p.operation !== 'upsert'),
                        ],
                    }));

                    return {
                        localSaved: true,
                        cloudStatus: 'queued',
                        roundId: localRoundId,
                        message: err instanceof Error ? err.message : undefined,
                    };
                }
            },

            // ── 保存済みラウンド削除 ────────────────────────────────
            deleteSavedRound: async (roundId) => {
                const { savedRounds } = get();
                const round = savedRounds.find(r => r.id === roundId);
                const cloudId = round?.cloudId ?? (round?.id?.includes('-') ? round.id : null);

                set((state) => ({
                    savedRounds: state.savedRounds.filter(r => r.id !== roundId),
                    cloudRoundId: state.cloudRoundId === cloudId ? null : state.cloudRoundId,
                }));

                if (!cloudId) {
                    return { cloudStatus: 'local-only' };
                }

                const authUser = useAuthStore.getState().user;
                if (!authUser) {
                    return { cloudStatus: 'local-only' };
                }

                try {
                    await cloudSave.deleteRound(cloudId);
                    return { cloudStatus: 'deleted' };
                } catch {
                    const pending: PendingCloudSave = {
                        id: createLocalId('pending_delete'),
                        operation: 'delete',
                        userId: authUser.id,
                        localRoundId: roundId,
                        cloudRoundId: cloudId,
                        createdAt: new Date().toISOString(),
                    };
                    set((state) => ({
                        pendingCloudSaves: [
                            pending,
                            ...state.pendingCloudSaves.filter(p => p.cloudRoundId !== cloudId || p.operation !== 'delete'),
                        ],
                    }));
                    return { cloudStatus: 'queued' };
                }
            },

            // ── 保留中クラウド同期 ────────────────────────────────
            syncPendingCloudSaves: async () => {
                const authUser = useAuthStore.getState().user;
                if (!authUser) return;

                const pendingItems = get().pendingCloudSaves.filter(p => p.userId === authUser.id);
                for (const item of pendingItems) {
                    try {
                        if (item.operation === 'delete') {
                            if (item.cloudRoundId) await cloudSave.deleteRound(item.cloudRoundId);
                            set((state) => ({
                                pendingCloudSaves: state.pendingCloudSaves.filter(p => p.id !== item.id),
                            }));
                            continue;
                        }

                        if (!item.roundData) continue;
                        const syncedCloudId = item.cloudRoundId
                            ? (await cloudSave.updateRound(item.cloudRoundId, item.roundData), item.cloudRoundId)
                            : await cloudSave.saveRound(authUser.id, item.roundData);

                        set((state) => ({
                            savedRounds: state.savedRounds.map(r => (
                                r.id === item.localRoundId ? { ...r, cloudId: syncedCloudId, id: syncedCloudId } : r
                            )),
                            pendingCloudSaves: state.pendingCloudSaves.filter(p => p.id !== item.id),
                        }));
                    } catch {
                        // Still offline or Supabase unavailable. Keep the item queued.
                    }
                }
            },

            // ── クラウドラウンド読み込み ─────────────────────────────
            loadCloudRounds: async () => {
                const authUser = useAuthStore.getState().user;
                if (!authUser) return;

                try {
                    await get().syncPendingCloudSaves();
                    const cloudRounds = await cloudSave.loadUserRounds(authUser.id);
                    const mapped: RoundResult[] = cloudRounds.map((r) => ({
                        id: r.id,
                        cloudId: r.id,
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
                pendingCloudSaves: state.pendingCloudSaves,
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
                    if (!state.pendingCloudSaves) state.pendingCloudSaves = [];
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
