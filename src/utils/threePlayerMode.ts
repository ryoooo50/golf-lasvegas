import { PlayerId } from '../types';

export const BOGEY_KUN_ID: PlayerId = 'bogey_kun';

/**
 * ホール番号とランキングからチームペアを決定する。
 * (holeNumber - 1) % 3 でパターンを選択:
 *   0 -> P1+P2 vs P3+P4
 *   1 -> P1+P3 vs P2+P4
 *   2 -> P1+P4 vs P2+P3
 */
export function computeTeamPairs(
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
 */
export function findSoloPlayer(
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

export function applySoloPlayerPointMultiplier(
    pointsResult: Record<PlayerId, number>,
    teamA: [PlayerId, PlayerId],
    teamB: [PlayerId, PlayerId],
): Record<PlayerId, number> {
    const soloId = findSoloPlayer(teamA, teamB);
    if (!soloId || soloId === BOGEY_KUN_ID) return { ...pointsResult };

    return {
        ...pointsResult,
        [soloId]: (pointsResult[soloId] ?? 0) * 2,
    };
}
