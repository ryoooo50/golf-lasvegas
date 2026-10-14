import { HoleResult } from '../types';
import { calculateHoleResult } from './golfLogic';
import { applySoloPlayerPointMultiplier } from './threePlayerMode';

/** 直前ホールの nextHoleMultiplier から、このホールのキャリーオーバーレベルを求める */
export function carryOverLevelFrom(nextHoleMultiplier: number): number {
    return nextHoleMultiplier === 1 ? 0 : nextHoleMultiplier / 2;
}

/**
 * 入力済みホールをプレー順に頭から計算し直す。
 *
 * キャリーオーバーは前のホールの結果で決まるため、過去のホールを修正・削除したら
 * それ以降のホールの倍率とポイントも変わる。保存済みの入力（パー・スコア・チーム）は
 * そのまま使い、計算結果だけを作り直す。直前ホールが未入力ならキャリーオーバーなし。
 *
 * @param sequence    プレー順のホール番号列
 * @param playerCount 3人モードならソロプレイヤーのポイントを×2する
 */
export function recalculateHistory(
    history: HoleResult[],
    sequence: number[],
    playerCount: 3 | 4,
): HoleResult[] {
    const recalculated = new Map<number, HoleResult>();
    let carryMultiplier = 1;

    for (const holeNumber of sequence) {
        const saved = history.find(h => h.holeNumber === holeNumber);
        if (!saved) {
            carryMultiplier = 1;
            continue;
        }

        const result = calculateHoleResult({
            holeNumber,
            par: saved.par,
            scores: saved.scores,
            teamA_Ids: saved.teamA_Ids,
            teamB_Ids: saved.teamB_Ids,
            currentCarryOverLevel: carryOverLevelFrom(carryMultiplier),
        });
        const pointsResult = playerCount === 3
            ? applySoloPlayerPointMultiplier(result.pointsResult, saved.teamA_Ids, saved.teamB_Ids)
            : result.pointsResult;

        recalculated.set(holeNumber, { ...result, pointsResult });
        carryMultiplier = result.nextHoleMultiplier;
    }

    // プレー順に含まれないホール（通常は無い）はそのまま残す
    return history
        .map(h => recalculated.get(h.holeNumber) ?? h)
        .sort((a, b) => a.holeNumber - b.holeNumber);
}
