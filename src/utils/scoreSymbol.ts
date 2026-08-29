export type ScoreSymbol = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double';

/** スコアとパーの差からスコアカード表示用のシンボル種別を判定する */
export function getScoreSymbol(score: number, par: number): ScoreSymbol {
    const diff = score - par;
    if (diff <= -2) return 'eagle';
    if (diff === -1) return 'birdie';
    if (diff === 0) return 'par';
    if (diff === 1) return 'bogey';
    return 'double';
}
