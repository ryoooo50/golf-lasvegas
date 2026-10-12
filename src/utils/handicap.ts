import { HandicapFloor, PlayerHandicap, ScoreInput } from '../types';

export const HANDICAP_STROKE_OPTIONS = [0, 1, 2] as const;
export const HANDICAP_FLOOR_OPTIONS: HandicapFloor[] = ['none', 'par', 'bogey'];

const MIN_SCORE = 1;

export function hasHandicap(handicap: PlayerHandicap | undefined): handicap is PlayerHandicap {
    return handicap !== undefined && handicap.strokes > 0;
}

/**
 * ハンデ適用後のスコアを返す。
 * 上限がある場合、ハンデを引いても上限のスコア（パー or ボギー）より良くはならない。
 * もともと上限より良いスコアならそのまま（例: 上限パーで実バーディーは引かない）。
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

const strokesLabel = (n: number) => (n === 1 ? 'Every One' : n === 2 ? 'Every Two' : `Every ${n}`);

const LABELS = {
    ja: {
        none: 'なし',
        strokes: strokesLabel,
        floor: { par: '上限パー', bogey: '上限ボギー' },
        join: (s: string, f: string) => `${s}・${f}`,
    },
    en: {
        none: 'None',
        strokes: strokesLabel,
        floor: { par: 'capped at par', bogey: 'capped at bogey' },
        join: (s: string, f: string) => `${s} (${f})`,
    },
};

export function formatHandicap(handicap: PlayerHandicap | undefined, language: 'ja' | 'en'): string {
    const labels = LABELS[language];
    if (!hasHandicap(handicap)) return labels.none;
    const strokes = labels.strokes(handicap.strokes);
    return handicap.floor === 'none' ? strokes : labels.join(strokes, labels.floor[handicap.floor]);
}
