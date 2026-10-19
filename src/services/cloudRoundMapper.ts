import { GameState, HoleDraft, HoleResult, PlayerHandicap, PlayerId, RoundResult } from '../types';
import { BOGEY_KUN_ID } from '../utils/threePlayerMode';
import { SavedRound } from './cloudSave';

/** 履歴の最新ホールからプレイヤーのハンデを復元する（クラウドにはハンデ列が無いため） */
function latestHandicapFromHistory(playerId: PlayerId, history: HoleResult[]): PlayerHandicap | undefined {
    const latest = [...history]
        .sort((a, b) => b.holeNumber - a.holeNumber)
        .find(hole => hole.scores[playerId] !== undefined);
    return latest?.scores[playerId]?.handicap;
}

/** クラウドのラウンド行をアプリ内の RoundResult に変換する */
export function toRoundResult(saved: SavedRound, defaultSettings: GameState['settings']): RoundResult {
    const holes = (saved.holes as HoleResult[]) ?? [];
    return {
        id: saved.id,
        cloudId: saved.id,
        date: saved.created_at,
        name: saved.match_name,
        players: Object.entries(saved.player_names).map(([id, name]) => {
            const handicap = latestHandicapFromHistory(id, holes);
            return {
                id,
                name,
                type: id === BOGEY_KUN_ID ? 'bogey_kun' as const : 'real' as const,
                pushUsageCount: { front9: 0, back9: 0 },
                ...(handicap ? { handicap } : {}),
            };
        }),
        history: holes,
        finalScores: saved.total_points,
        gameStatus: saved.status ?? 'completed',
        currentHole: saved.current_hole ?? 18,
        startHole: saved.start_hole ?? 1,
        roundLength: saved.round_length ?? 18,
        settings: {
            ...defaultSettings,
            matchName: saved.match_name,
            rate: saved.rate,
            playerCount: saved.player_count as 3 | 4,
            maxPushCountPerHalf: saved.push_limit,
            pushRecoveryOnBirdie: saved.push_recovery_on_birdie,
            pushRecoveryOnEagle: saved.push_recovery_on_eagle,
            nearPinRate: saved.near_pin_rate ?? 0,
            roundLength: saved.round_length ?? 18,
            courseName: saved.course_name ?? '',
            playedAt: saved.played_at ?? '',
            memo: saved.memo ?? '',
        },
        draftHole: (saved.draft_hole as HoleDraft | null) ?? null,
        updatedAt: saved.updated_at,
        ownerId: saved.user_id,
        playerRanking: saved.player_ranking ?? [],
    };
}
