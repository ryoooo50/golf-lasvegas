import { RoundLength } from '../types';

/** プレー順のホール番号列。IN スタートは 10〜18 → 1〜9 の順 */
export function getRoundHoleSequence(startHole: 1 | 10, roundLength: RoundLength): number[] {
    const fullSequence = startHole === 1
        ? Array.from({ length: 18 }, (_, index) => index + 1)
        : [
            ...Array.from({ length: 9 }, (_, index) => index + 10),
            ...Array.from({ length: 9 }, (_, index) => index + 1),
        ];
    return fullSequence.slice(0, roundLength);
}
