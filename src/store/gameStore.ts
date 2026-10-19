import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import i18n from '../i18n/i18n';
import * as cloudSave from '../services/cloudSave';
import { toRoundResult } from '../services/cloudRoundMapper';
import { useAuthStore } from './authStore';
import { GameState, HoleDraft, HoleResult, PendingCloudSave, Player, PlayerHandicap, PlayerId, PlayerProfile, RoundResult, RoundStatus, SaveRoundResult, ScoreInput } from '../types';
import { calculateHoleResult } from '../utils/golfLogic';
import { hasHandicap } from '../utils/handicap';
import { getRoundHoleSequence } from '../utils/holeSequence';
import { isNearPinHole } from '../utils/nearPin';
import { recalculateHistory } from '../utils/recalculateHistory';
import { computeRankingForHole } from '../utils/teamRanking';
import { BOGEY_KUN_ID, computeTeamPairs, findSoloPlayer } from '../utils/threePlayerMode';

// ─── ボギーくんプレイヤー定義 ────────────────────────────────────────
const BOGEY_KUN_PLAYER: Player = {
    id: BOGEY_KUN_ID,
    name: 'ボギーくん',
    type: 'bogey_kun',
    pushUsageCount: { front9: 0, back9: 0 },
};

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
    status: RoundStatus,
    currentHole: number,
    startHole: 1 | 10,
    draftHole: HoleDraft | null,
    playerRanking: PlayerId[],
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
        push_recovery_on_birdie: settings.pushRecoveryOnBirdie,
        push_recovery_on_eagle: settings.pushRecoveryOnEagle,
        near_pin_rate: settings.nearPinRate,
        holes: history,
        total_points: totalPoints,
        status,
        current_hole: currentHole,
        start_hole: startHole,
        round_length: settings.roundLength,
        draft_hole: draftHole,
        player_ranking: playerRanking,
        course_name: settings.courseName,
        played_at: settings.playedAt,
        memo: settings.memo,
    };
}

function updatePlayerProfiles(profiles: PlayerProfile[], names: string[], ownerId: string): PlayerProfile[] {
    const now = new Date().toISOString();
    const next = [...profiles];
    for (const rawName of names) {
        const name = rawName.trim();
        if (!name || name === 'ボギーくん') continue;
        const existingIndex = next.findIndex(profile =>
            profile.ownerId === ownerId && profile.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        );
        if (existingIndex >= 0) {
            next[existingIndex] = {
                ...next[existingIndex],
                name,
                useCount: next[existingIndex].useCount + 1,
                lastUsedAt: now,
                ownerId,
            };
        } else {
            next.push({
                id: createLocalId('player'),
                name,
                isFavorite: false,
                useCount: 1,
                lastUsedAt: now,
                ownerId,
            });
        }
    }
    return next.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.useCount - a.useCount || b.lastUsedAt.localeCompare(a.lastUsedAt));
}

function rebuildPushStateFromHistory(
    players: Player[],
    history: HoleResult[],
    settings: GameState['settings'],
): {
    players: Player[];
    pushUsed: Record<PlayerId, number>;
    pushBonus: Record<PlayerId, number>;
    pushUsedFront9: Record<PlayerId, number>;
    pushBonusFront9: Record<PlayerId, number>;
} {
    const sortedHistory = [...history].sort((a, b) => a.holeNumber - b.holeNumber);
    let pushUsed: Record<PlayerId, number> = {};
    let pushBonus: Record<PlayerId, number> = {};
    let pushUsedFront9: Record<PlayerId, number> = {};
    let pushBonusFront9: Record<PlayerId, number> = {};

    const rebuiltPlayers = players.map(p => ({
        ...p,
        pushUsageCount: { front9: 0, back9: 0 },
    }));

    for (const p of rebuiltPlayers) {
        pushUsed[p.id] = 0;
        pushBonus[p.id] = 0;
        pushUsedFront9[p.id] = 0;
        pushBonusFront9[p.id] = 0;
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

        for (const id of [...hole.teamA_Ids, ...hole.teamB_Ids]) {
            if (id === BOGEY_KUN_ID) continue;
            const score = hole.scores[id];
            if (score?.isEagle) {
                pushBonus[id] = (pushBonus[id] ?? 0) + settings.pushRecoveryOnEagle;
            } else if (score?.isBirdie) {
                pushBonus[id] = (pushBonus[id] ?? 0) + settings.pushRecoveryOnBirdie;
            }
        }

        if (hole.holeNumber === 9) {
            // 前半終了時点のスナップショットを保存してからリセット
            pushUsedFront9 = { ...pushUsed };
            pushBonusFront9 = { ...pushBonus };
            pushUsed = Object.fromEntries(Object.keys(pushUsed).map(id => [id, 0]));
            pushBonus = Object.fromEntries(Object.keys(pushBonus).map(id => [id, 0]));
        }
    }

    return { players: rebuiltPlayers, pushUsed, pushBonus, pushUsedFront9, pushBonusFront9 };
}

function buildPushStateForHoleHalf(
    players: Player[],
    history: HoleResult[],
    settings: GameState['settings'],
    holeNumber: number,
): {
    pushUsed: Record<PlayerId, number>;
    pushBonus: Record<PlayerId, number>;
} {
    const isFront9 = holeNumber <= 9;
    const pushUsed: Record<PlayerId, number> = {};
    const pushBonus: Record<PlayerId, number> = {};

    for (const p of players) {
        pushUsed[p.id] = 0;
        pushBonus[p.id] = 0;
    }

    const halfHistory = history
        .filter(h => h.holeNumber !== holeNumber && (isFront9 ? h.holeNumber <= 9 : h.holeNumber >= 10))
        .sort((a, b) => a.holeNumber - b.holeNumber);

    for (const hole of halfHistory) {
        for (const id of [...hole.teamA_Ids, ...hole.teamB_Ids]) {
            pushUsed[id] = (pushUsed[id] ?? 0) + (hole.scores[id]?.pushCount ?? 0);
        }

        for (const id of [...hole.teamA_Ids, ...hole.teamB_Ids]) {
            if (id === BOGEY_KUN_ID) continue;
            const score = hole.scores[id];
            if (score?.isEagle) {
                pushBonus[id] = (pushBonus[id] ?? 0) + settings.pushRecoveryOnEagle;
            } else if (score?.isBirdie) {
                pushBonus[id] = (pushBonus[id] ?? 0) + settings.pushRecoveryOnBirdie;
            }
        }
    }

    return { pushUsed, pushBonus };
}

// 旧 Supabase のユーザー ID は UUID。Better Auth の ID は UUID 形式ではない。
const LEGACY_SUPABASE_USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLegacyOwner(ownerId: string | undefined, userId: string): boolean {
    return ownerId !== undefined && ownerId !== userId && LEGACY_SUPABASE_USER_ID.test(ownerId);
}

// ─── アクション型定義 ──────────────────────────────────────────────────
interface GameActions {
    addPlayer: (name: string) => void;
    rememberPlayerProfiles: (names: string[]) => void;
    togglePlayerFavorite: (profileId: string) => void;
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
        /** ニアピンを取った人。null = 該当なし。ニアピンありのパー3以外では無視する */
        nearPinWinnerId?: PlayerId | null;
    }) => void;

    resetGame: () => void;
    updatePlayerName: (id: PlayerId, name: string) => void;
    /** ハンデを設定する。undefined でハンデなし */
    setPlayerHandicap: (id: PlayerId, handicap: PlayerHandicap | undefined) => void;

    /**
     * 推奨チームペアを返す。
     * 前ホールの打数順（P1〜P4）と (holeNumber-1)%3 パターンで決定する。
     * 最初のホールは players 配列順（開始時の入力順）。
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
    saveDraft: (draft: HoleDraft | null) => void;
    saveCurrentRound: (status?: RoundStatus) => Promise<SaveRoundResult>;
    pauseCurrentRound: () => Promise<SaveRoundResult>;
    finishCurrentRound: () => Promise<SaveRoundResult>;
    deleteSavedRound: (roundId: string) => Promise<{ cloudStatus: 'deleted' | 'queued' | 'local-only' }>;
    resumeRound: (roundId: string) => void;
    duplicateRound: (roundId: string) => void;
    loadCloudRounds: () => Promise<void>;
    syncPendingCloudSaves: () => Promise<void>;
    /**
     * 旧 Supabase アカウント（UUID 形式の ID）に紐付いた端末内の履歴・プレイヤー候補を
     * ログイン中のアカウントへ引き継ぎ、ラウンドはクラウドへの再アップロードを予約する。
     */
    claimLegacyLocalData: (userId: string) => void;
}

type GameStore = GameState & GameActions;

// ─── 初期状態 ─────────────────────────────────────────────────────────
const DEFAULT_PLAYERS: Player[] = [
    { id: 'p1', name: 'Player A', pushUsageCount: { front9: 0, back9: 0 } },
    { id: 'p2', name: 'Player B', pushUsageCount: { front9: 0, back9: 0 } },
    { id: 'p3', name: 'Player C', pushUsageCount: { front9: 0, back9: 0 } },
    { id: 'p4', name: 'Player D', pushUsageCount: { front9: 0, back9: 0 } },
];

export const INITIAL_STATE: Omit<GameState, 'players'> & { players: Player[] } = {
    players: DEFAULT_PLAYERS,
    currentHole: 1,
    startHole: 1,
    draftHole: null,
    activeRoundId: null,
    history: [],
    gameStatus: 'menu',
    settings: {
        rate: 10,
        maxPushCountPerHalf: 2,
        language: 'ja',
        matchName: '',
        courseName: '',
        playedAt: '',
        memo: '',
        playerCount: 4,
        roundLength: 18,
        pushRecoveryOnBirdie: 1,
        pushRecoveryOnEagle: 2,
        nearPinRate: 0,
    },
    savedRounds: [],
    playerProfiles: [],
    pendingCloudSaves: [],
    nextHoleMultiplier: 1,
    playerRanking: [],
    pushUsed: {},
    pushBonus: {},
    pushUsedFront9: {},
    pushBonusFront9: {},
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

            rememberPlayerProfiles: (names) => set(state => ({
                playerProfiles: updatePlayerProfiles(
                    state.playerProfiles,
                    names,
                    useAuthStore.getState().user?.id ?? 'guest',
                ),
            })),

            togglePlayerFavorite: (profileId) => set(state => ({
                playerProfiles: state.playerProfiles
                    .map(profile => profile.id === profileId
                        ? { ...profile, isFavorite: !profile.isFavorite }
                        : profile)
                    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.useCount - a.useCount),
            })),

            // ── 言語設定 ─────────────────────────────────────────────
            setLanguage: (lang) => {
                i18n.changeLanguage(lang);
                set((state) => ({
                    settings: { ...state.settings, language: lang },
                }));
            },

            // ── ホール確定 ───────────────────────────────────────────
            completeHole: ({ par, scores, teamA_Ids, teamB_Ids, holeNumber, nearPinWinnerId }) => {
                const state = get();
                const { players, history, settings } = state;

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

                // --- 1. 入力を履歴に反映し、このホール以降をプレー順に計算し直す ---
                // （過去ホールの修正でキャリーオーバーが変わると後続ホールの倍率・ポイントも変わる）
                const sequence = getRoundHoleSequence(state.startHole, settings.roundLength);
                const entered = calculateHoleResult({
                    holeNumber,
                    par,
                    scores: effectiveScores,
                    teamA_Ids,
                    teamB_Ids,
                    currentCarryOverLevel: 0, // 倍率は recalculateHistory で前ホールから求め直す
                });
                const enteredWithNearPin = isNearPinHole(par, settings.nearPinRate)
                    ? { ...entered, nearPinWinnerId: nearPinWinnerId ?? null }
                    : entered;
                const newHistory = recalculateHistory(
                    [...history.filter(h => h.holeNumber !== holeNumber), enteredWithNearPin],
                    sequence,
                    settings.playerCount,
                );
                const result = newHistory.find(h => h.holeNumber === holeNumber) ?? entered;

                // --- 2. 履歴からプッシュ使用回数とボーナスを再構築 ---
                const rebuiltPushState = rebuildPushStateFromHistory(players, newHistory, settings);

                // --- 3. ゲーム終了判定 ---
                const completedHoleNumbers = new Set(newHistory.map(h => h.holeNumber));
                const isGameOver = sequence.every(n => completedHoleNumbers.has(n));
                const sequenceIndex = sequence.indexOf(holeNumber);
                const nextHole = isGameOver
                    ? holeNumber
                    : sequence[Math.min(sequenceIndex + 1, sequence.length - 1)] ?? holeNumber;
                const nextStatus: GameState['gameStatus'] = isGameOver ? 'finished' : 'playing';

                // --- 4. 次ホールのランク付け（前ホールの打数順。ボギーくんも打数で並べる）。保存・表示用 ---
                const fullRanking = computeRankingForHole(players.map(p => p.id), sequence, newHistory, nextHole);

                set({
                    history: newHistory,
                    players: rebuiltPushState.players,
                    currentHole: nextHole,
                    gameStatus: nextStatus,
                    draftHole: null,
                    nextHoleMultiplier: result.nextHoleMultiplier,
                    playerRanking: fullRanking,
                    pushUsed: rebuiltPushState.pushUsed,
                    pushBonus: rebuiltPushState.pushBonus,
                    pushUsedFront9: rebuiltPushState.pushUsedFront9,
                    pushBonusFront9: rebuiltPushState.pushBonusFront9,
                });
            },

            // ── ゲームリセット ───────────────────────────────────────
            resetGame: () => {
                const { savedRounds, pendingCloudSaves, playerProfiles } = get();
                // AsyncStorage からゲーム状態を削除（履歴は別キーで保持）
                AsyncStorage.removeItem('golf-lasvegas-game').catch(() => {/* 無視 */});
                set({
                    ...INITIAL_STATE,
                    savedRounds,
                    pendingCloudSaves,
                    playerProfiles,
                    cloudRoundId: null,
                    activeRoundId: null,
                    draftHole: null,
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

            setPlayerHandicap: (id, handicap) =>
                set((state) => ({
                    players: state.players.map((p) => {
                        if (p.id !== id) return p;
                        return { ...p, handicap: hasHandicap(handicap) ? handicap : undefined };
                    }),
                })),

            // ── 推奨チームペア取得 ────────────────────────────────────
            getRecommendedPairs: (holeNumber) => {
                const { players, history, settings, startHole } = get();

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

                // 3人モードでは players の末尾にボギーくんがいるため、初ホールは4番手、
                // 以降は前ホールの打数（par+1）で実プレイヤーと一緒に並べる
                const sequence = getRoundHoleSequence(startHole, settings.roundLength);
                const fullRanking = computeRankingForHole(players.map(p => p.id), sequence, history, holeNumber);

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
                const { players, settings, currentHole, history } = get();
                const { pushUsed, pushBonus } = buildPushStateForHoleHalf(players, history, settings, currentHole);
                return getRemainingPush(id, settings.maxPushCountPerHalf, pushUsed, pushBonus);
            },

            // ── ホールリセット ───────────────────────────────────────
            resetHole: (holeNumber) => {
                const { history, players, settings, startHole } = get();
                const sequence = getRoundHoleSequence(startHole, settings.roundLength);
                const newHistory = recalculateHistory(
                    history.filter(h => h.holeNumber !== holeNumber),
                    sequence,
                    settings.playerCount,
                );
                const rebuiltPushState = rebuildPushStateFromHistory(players, newHistory, settings);

                const holeIndex = sequence.indexOf(holeNumber);
                const previousHole = holeIndex > 0 ? sequence[holeIndex - 1] : null;
                const prevResult = previousHole ? newHistory.find(h => h.holeNumber === previousHole) : undefined;
                const restoredMultiplier = prevResult ? prevResult.nextHoleMultiplier : 1;

                set({
                    history: newHistory,
                    players: rebuiltPushState.players,
                    pushUsed: rebuiltPushState.pushUsed,
                    pushBonus: rebuiltPushState.pushBonus,
                    pushUsedFront9: rebuiltPushState.pushUsedFront9,
                    pushBonusFront9: rebuiltPushState.pushBonusFront9,
                    nextHoleMultiplier: restoredMultiplier,
                });
            },

            // ── ホール移動 ───────────────────────────────────────────
            goToHole: (holeNumber) => {
                const { history, startHole, settings } = get();
                const sequence = getRoundHoleSequence(startHole, settings.roundLength);
                const holeIndex = sequence.indexOf(holeNumber);
                const previousHole = holeIndex > 0 ? sequence[holeIndex - 1] : null;
                const prevResult = previousHole ? history.find(h => h.holeNumber === previousHole) : undefined;
                const restoredMultiplier = prevResult ? prevResult.nextHoleMultiplier : 1;
                set({ currentHole: holeNumber, nextHoleMultiplier: restoredMultiplier, draftHole: null });
            },

            // ── ゲーム開始 ───────────────────────────────────────────
            startGame: (startHole) => {
                const { players: currentPlayers, settings: currentSettings, savedRounds, pendingCloudSaves, playerProfiles } = get();

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
                    playerProfiles: updatePlayerProfiles(
                        playerProfiles,
                        realPlayers.map(player => player.name),
                        useAuthStore.getState().user?.id ?? 'guest',
                    ),
                    players: gamePlayers,
                    settings: {
                        ...INITIAL_STATE.settings,
                        ...currentSettings,
                    },
                    currentHole: startHole,
                    startHole,
                    gameStatus: 'playing',
                    draftHole: null,
                    activeRoundId: null,
                    playerRanking: [],
                    pushUsed: initialPushUsed,
                    pushBonus: initialPushBonus,
                    pushUsedFront9: {},
                    pushBonusFront9: {},
                });
            },

            // ── 設定更新 ─────────────────────────────────────────────
            updateSettings: (newSettings) => {
                set((state) => ({
                    settings: { ...state.settings, ...newSettings },
                }));
            },

            saveDraft: (draft) => set({ draftHole: draft }),

            // ── ラウンド保存 ─────────────────────────────────────────
            saveCurrentRound: async (status = 'completed') => {
                const {
                    history, players, settings, savedRounds, getPlayerTotalScore,
                    cloudRoundId, activeRoundId, currentHole, startHole, draftHole, playerRanking,
                } = get();

                const finalScores: Record<PlayerId, number> = {};
                players.forEach(p => {
                    finalScores[p.id] = getPlayerTotalScore(p.id);
                });

                const existingRound = savedRounds.find(r =>
                    r.id === activeRoundId ||
                    (cloudRoundId !== null && (r.cloudId === cloudRoundId || r.id === cloudRoundId)),
                );
                const localRoundId = existingRound?.id ?? createLocalId('round');
                const now = new Date().toISOString();
                const authUser = useAuthStore.getState().user;
                const newRound: RoundResult = {
                    id: localRoundId,
                    cloudId: cloudRoundId,
                    date: existingRound?.date ?? now,
                    name: settings.matchName || 'Untitled Match',
                    players,
                    history,
                    finalScores,
                    gameStatus: status,
                    currentHole,
                    startHole,
                    roundLength: settings.roundLength,
                    settings: { ...settings },
                    draftHole: status === 'paused' ? draftHole : null,
                    updatedAt: now,
                    ownerId: authUser?.id ?? 'guest',
                    playerRanking,
                };

                const nextSavedRounds = existingRound
                    ? savedRounds.map(r => (r.id === existingRound.id ? newRound : r))
                    : [newRound, ...savedRounds];

                set({ savedRounds: nextSavedRounds, activeRoundId: localRoundId });

                // ── クラウド保存（ログインユーザーのみ） ──────────────
                if (!authUser) {
                    return { localSaved: true, cloudStatus: 'guest', roundId: localRoundId };
                }

                const roundData = buildRoundSaveData(
                    players, settings, history, finalScores, status, currentHole, startHole,
                    status === 'paused' ? draftHole : null,
                    playerRanking,
                );

                try {
                    const syncedCloudId = await cloudSave.upsertRound(authUser.id, cloudRoundId, roundData);

                    set((state) => ({
                        cloudRoundId: syncedCloudId,
                        activeRoundId: syncedCloudId,
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

            pauseCurrentRound: async () => {
                const result = await get().saveCurrentRound('paused');
                set({ gameStatus: 'menu' });
                return result;
            },

            finishCurrentRound: async () => {
                const result = await get().saveCurrentRound('completed');
                set({ gameStatus: 'menu', draftHole: null, activeRoundId: null, cloudRoundId: null });
                return result;
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
                        const syncedCloudId = await cloudSave.upsertRound(authUser.id, item.cloudRoundId, item.roundData);

                        set((state) => {
                            // 進行中ラウンドの ID も追従させる（古い ID のままだと次回保存で重複作成される）
                            const isActive = state.activeRoundId === item.localRoundId
                                || (item.cloudRoundId != null && state.cloudRoundId === item.cloudRoundId);
                            return {
                                savedRounds: state.savedRounds.map(r => (
                                    r.id === item.localRoundId ? { ...r, cloudId: syncedCloudId, id: syncedCloudId } : r
                                )),
                                pendingCloudSaves: state.pendingCloudSaves.filter(p => p.id !== item.id),
                                ...(isActive ? { activeRoundId: syncedCloudId, cloudRoundId: syncedCloudId } : {}),
                            };
                        });
                    } catch {
                        // Still offline or the API is unavailable. Keep the item queued.
                    }
                }
            },

            claimLegacyLocalData: (userId) => {
                const { savedRounds, playerProfiles, pendingCloudSaves } = get();
                const legacyRounds = savedRounds.filter(r => isLegacyOwner(r.ownerId, userId));
                const legacyProfiles = playerProfiles.filter(p => isLegacyOwner(p.ownerId, userId));
                const legacyPending = pendingCloudSaves.filter(p => isLegacyOwner(p.userId, userId));
                if (legacyRounds.length === 0 && legacyProfiles.length === 0 && legacyPending.length === 0) return;

                const claimedIds = new Set(legacyRounds.map(r => r.id));
                const now = new Date().toISOString();
                const uploads: PendingCloudSave[] = legacyRounds.map(round => ({
                    id: createLocalId('pending'),
                    operation: 'upsert',
                    userId,
                    localRoundId: round.id,
                    cloudRoundId: null,
                    roundData: buildRoundSaveData(
                        round.players, round.settings, round.history, round.finalScores, round.gameStatus,
                        round.currentHole, round.startHole, round.draftHole, round.playerRanking,
                    ),
                    createdAt: now,
                }));

                const ownedNames = new Set(playerProfiles
                    .filter(p => p.ownerId === userId)
                    .map(p => p.name.toLocaleLowerCase()));

                set({
                    // 旧クラウドはもう存在しないので cloudId は外す
                    savedRounds: savedRounds.map(r => (claimedIds.has(r.id) ? { ...r, ownerId: userId, cloudId: null } : r)),
                    playerProfiles: playerProfiles
                        .filter(p => !isLegacyOwner(p.ownerId, userId) || !ownedNames.has(p.name.toLocaleLowerCase()))
                        .map(p => (isLegacyOwner(p.ownerId, userId) ? { ...p, ownerId: userId } : p)),
                    pendingCloudSaves: [
                        ...uploads,
                        ...pendingCloudSaves.filter(p => !isLegacyOwner(p.userId, userId) && !claimedIds.has(p.localRoundId)),
                    ],
                });
            },

            // ── クラウドラウンド読み込み ─────────────────────────────
            loadCloudRounds: async () => {
                const authUser = useAuthStore.getState().user;
                if (!authUser) return;

                try {
                    await get().syncPendingCloudSaves();
                    const cloudRounds = await cloudSave.loadUserRounds(authUser.id);
                    const mapped: RoundResult[] = cloudRounds.map((r) => toRoundResult(r, INITIAL_STATE.settings));


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

                const settings = round.settings ?? {
                    ...get().settings,
                    matchName: round.name,
                    roundLength: round.roundLength ?? 18,
                };
                const sequence = getRoundHoleSequence(round.startHole ?? 1, settings.roundLength);
                const currentIndex = sequence.indexOf(round.currentHole);
                const previousHole = currentIndex > 0 ? sequence[currentIndex - 1] : null;
                const previousResult = previousHole
                    ? round.history.find(result => result.holeNumber === previousHole)
                    : undefined;
                const rebuiltPushState = rebuildPushStateFromHistory(round.players, round.history, settings);

                set({
                    players: rebuiltPushState.players,
                    history: round.history,
                    currentHole: round.currentHole,
                    startHole: round.startHole ?? 1,
                    gameStatus: 'playing',
                    nextHoleMultiplier: previousResult?.nextHoleMultiplier ?? 1,
                    settings,
                    draftHole: round.draftHole ?? null,
                    activeRoundId: round.id,
                    cloudRoundId: round.cloudId ?? null,
                    playerRanking: round.playerRanking ?? [],
                    pushUsed: rebuiltPushState.pushUsed,
                    pushBonus: rebuiltPushState.pushBonus,
                    pushUsedFront9: rebuiltPushState.pushUsedFront9,
                    pushBonusFront9: rebuiltPushState.pushBonusFront9,
                });
            },

            duplicateRound: (roundId) => {
                const { savedRounds, pendingCloudSaves, playerProfiles } = get();
                const round = savedRounds.find(item => item.id === roundId);
                if (!round) return;
                const settings = {
                    ...round.settings,
                    matchName: round.name,
                    playedAt: new Date().toISOString().slice(0, 10),
                };
                const players = round.players.map(player => ({
                    ...player,
                    pushUsageCount: { front9: 0, back9: 0 },
                }));
                set({
                    ...INITIAL_STATE,
                    savedRounds,
                    pendingCloudSaves,
                    playerProfiles: updatePlayerProfiles(
                        playerProfiles,
                        players.map(player => player.name),
                        useAuthStore.getState().user?.id ?? 'guest',
                    ),
                    settings,
                    players,
                    startHole: round.startHole,
                    currentHole: round.startHole,
                    gameStatus: 'playing',
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
                startHole: state.startHole,
                draftHole: state.draftHole,
                activeRoundId: state.activeRoundId,
                settings: state.settings,
                savedRounds: state.savedRounds,
                playerProfiles: state.playerProfiles,
                pendingCloudSaves: state.pendingCloudSaves,
                nextHoleMultiplier: state.nextHoleMultiplier,
                playerRanking: state.playerRanking,
                pushUsed: state.pushUsed,
                pushBonus: state.pushBonus,
                pushUsedFront9: state.pushUsedFront9,
                pushBonusFront9: state.pushBonusFront9,
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
                    if (!state.pushUsedFront9) state.pushUsedFront9 = {};
                    if (!state.pushBonusFront9) state.pushBonusFront9 = {};
                    if (!state.pendingCloudSaves) state.pendingCloudSaves = [];
                    if (!state.playerProfiles) state.playerProfiles = [];
                    if (!state.startHole) state.startHole = 1;
                    if (state.draftHole === undefined) state.draftHole = null;
                    if (state.activeRoundId === undefined) state.activeRoundId = null;
                    if (state.cloudRoundId === undefined) state.cloudRoundId = null;
                    if (state.settings && !('playerCount' in state.settings)) {
                        (state.settings as GameState['settings']).playerCount = 4;
                    }
                    if (state.settings && !('roundLength' in state.settings)) {
                        (state.settings as GameState['settings']).roundLength = 18;
                    }
                    if (state.settings && !('courseName' in state.settings)) (state.settings as GameState['settings']).courseName = '';
                    if (state.settings && !('playedAt' in state.settings)) (state.settings as GameState['settings']).playedAt = '';
                    if (state.settings && !('memo' in state.settings)) (state.settings as GameState['settings']).memo = '';
                    if (state.settings && !('nearPinRate' in state.settings)) (state.settings as GameState['settings']).nearPinRate = 0;
                    state.savedRounds = (state.savedRounds ?? []).map(round => ({
                        ...round,
                        gameStatus: round.gameStatus === 'paused' ? 'paused' : 'completed',
                        startHole: round.startHole ?? 1,
                        roundLength: round.roundLength ?? 18,
                        settings: round.settings ?? { ...INITIAL_STATE.settings, matchName: round.name },
                        draftHole: round.draftHole ?? null,
                        updatedAt: round.updatedAt ?? round.date,
                        playerRanking: round.playerRanking ?? [],
                    }));
                    if (state.settings && !('pushRecoveryOnBirdie' in state.settings)) {
                        const legacySettings = state.settings as GameState['settings'] & { birdyPushRecovery?: boolean };
                        const legacyEnabled = legacySettings.birdyPushRecovery ?? false;
                        legacySettings.pushRecoveryOnBirdie = legacyEnabled ? 1 : 0;
                        legacySettings.pushRecoveryOnEagle = legacyEnabled ? 2 : 0;
                        delete legacySettings.birdyPushRecovery;
                    }
                }
            },
        },
    ),
);

// ─── ユーティリティエクスポート ────────────────────────────────────
export { BOGEY_KUN_ID, BOGEY_KUN_PLAYER, computeTeamPairs, findSoloPlayer, getRemainingPush, getRoundHoleSequence };
