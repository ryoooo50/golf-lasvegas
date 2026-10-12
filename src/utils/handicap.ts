import { HandicapFloor, PlayerHandicap, ScoreInput } from '../types';

export const HANDICAP_STROKE_OPTIONS = [0, 1, 2] as const;
export const HANDICAP_FLOOR_OPTIONS: HandicapFloor[] = ['none', 'par', 'bogey'];

const MIN_SCORE = 1;

export function hasHandicap(handicap: PlayerHandicap | undefined): handicap is PlayerHandicap {
    return handicap !== undefined && handicap.strokes > 0;
}

/**
 * ハンデ適用後のスコアを返す。
 * 縛りがある場合、ハンデを引いても縛りのスコア（パー or ボギー）より良くはならない。
 * もともと縛りより良いスコアならそのまま（例: パー縛りで実バーディーは引かない）。
 */
export function applyHandicap(gross: number, par: number, handicap: PlayerHandicap | undefined): number {
    if (!hasHandicap(handicap)) return gross;
    const reduced = gross - handicap.strokes;
    if (handicap.floor === 'none') return Math.max(MIN_SCORE, reduced);
    const floorScore = handicap.floor === 'par' ? par : par + 1;
    return Math.max(MIN_SCORE, reduced, Math.min(gross, floorScore));
}

interface BuildScoreInputParams {
    gross: number;
    par: number;
    pushCount: number;
    handicap?: PlayerHandicap;
}

/** 実打数からホール計算用の ScoreInput を作る。バーディー/イーグルはハンデ適用後で判定する */
export function buildScoreInput({ gross, par, pushCount, handicap }: BuildScoreInputParams): ScoreInput {
    const score = applyHandicap(gross, par, handicap);
    const isEagle = score <= par - 2;
    const isBirdie = isEagle || score === par - 1;
    const base: ScoreInput = { score, isBirdie, isEagle, pushCount };
    return hasHandicap(handicap) ? { ...base, grossScore: gross, handicap } : base;
}

/** 実際の打数（ハンデ適用前）を返す */
export function grossScoreOf(input: ScoreInput | undefined): number | undefined {
    return input?.grossScore ?? input?.score;
}

const LABELS = {
    ja: {
        none: 'なし',
        strokes: (n: number) => (n === 1 ? 'エブリワン' : n === 2 ? 'エブリツー' : `毎ホール-${n}`),
        floor: { par: 'パー縛り', bogey: 'ボギー縛り' },
        join: (s: string, f: string) => `${s}・${f}`,
    },
    en: {
        none: 'None',
        strokes: (n: number) => `Every ${n}`,
        floor: { par: 'par floor', bogey: 'bogey floor' },
        join: (s: string, f: string) => `${s} (${f})`,
    },
};

export function formatHandicap(handicap: PlayerHandicap | undefined, language: 'ja' | 'en'): string {
    const labels = LABELS[language];
    if (!hasHandicap(handicap)) return labels.none;
    const strokes = labels.strokes(handicap.strokes);
    return handicap.floor === 'none' ? strokes : labels.join(strokes, labels.floor[handicap.floor]);
}
