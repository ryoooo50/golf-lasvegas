import { HoleResult, PlayerId } from '../types';

/**
 * 指定ホールの P1〜P4 順を返す。
 *
 * ルール: 前のホール（プレー順で直前のホール）の打数が少ない順に並べる。
 * 同打数の場合は、そのさらに前のホールでの順位を維持する。
 * 最初のホールは開始時の入力順。直前ホールが未入力ならひとつ前の順位を引き継ぐ。
 *
 * 保存済みの順位に頼らず履歴から毎回計算するため、過去ホールの修正や
 * ホール移動をしても組み合わせがずれない。
 *
 * @param playerIds 開始時の入力順（3人モードはボギーくんを末尾に含む）
 * @param sequence  プレー順のホール番号列（OUT開始: 1..18, IN開始: 10..18,1..9）
 */
export function computeRankingForHole(
    playerIds: PlayerId[],
    sequence: number[],
    history: HoleResult[],
    holeNumber: number,
): PlayerId[] {
    const holeIndex = sequence.indexOf(holeNumber);
    const playedBefore = holeIndex > 0 ? sequence.slice(0, holeIndex) : [];

    return playedBefore.reduce<PlayerId[]>((ranking, prevHole) => {
        const result = history.find(h => h.holeNumber === prevHole);
        if (!result) return ranking;
        const strokes = (id: PlayerId) => result.scores[id]?.score ?? Number.POSITIVE_INFINITY;
        return [...ranking].sort((a, b) => (strokes(a) - strokes(b)) || (ranking.indexOf(a) - ranking.indexOf(b)));
    }, [...playerIds]);
}
