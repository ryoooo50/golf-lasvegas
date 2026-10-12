import { PlayerHandicap } from '../types';
import { applyHandicap, buildScoreInput, formatHandicap } from './handicap';

const everyOne: PlayerHandicap = { strokes: 1, floor: 'none' };
const everyOnePar: PlayerHandicap = { strokes: 1, floor: 'par' };
const everyOneBogey: PlayerHandicap = { strokes: 1, floor: 'bogey' };
const everyTwoPar: PlayerHandicap = { strokes: 2, floor: 'par' };

describe('applyHandicap', () => {
    it('returns the gross score when there is no handicap', () => {
        expect(applyHandicap(7, 4, undefined)).toBe(7);
        expect(applyHandicap(7, 4, { strokes: 0, floor: 'none' })).toBe(7);
    });

    it('every-one subtracts one stroke on every hole', () => {
        expect(applyHandicap(7, 4, everyOne)).toBe(6);
        expect(applyHandicap(4, 4, everyOne)).toBe(3); // パー → バーディー扱い
    });

    it('par floor stops the handicap at par', () => {
        expect(applyHandicap(4, 4, everyOnePar)).toBe(4); // パーはパーのまま
        expect(applyHandicap(5, 4, everyOnePar)).toBe(4); // ボギー → パー
        expect(applyHandicap(7, 4, everyOnePar)).toBe(6);
        expect(applyHandicap(3, 4, everyOnePar)).toBe(3); // 実バーディーはそのまま
    });

    it('bogey floor stops the handicap at bogey', () => {
        expect(applyHandicap(5, 4, everyOneBogey)).toBe(5); // ボギーはボギーのまま
        expect(applyHandicap(6, 4, everyOneBogey)).toBe(5); // ダボ → ボギー
        expect(applyHandicap(4, 4, everyOneBogey)).toBe(4); // パーはパーのまま
    });

    it('every-two applies partially when it would cross the floor', () => {
        expect(applyHandicap(5, 4, everyTwoPar)).toBe(4);
        expect(applyHandicap(7, 4, everyTwoPar)).toBe(5);
    });

    it('never goes below 1', () => {
        expect(applyHandicap(1, 3, { strokes: 2, floor: 'none' })).toBe(1);
    });
});

describe('buildScoreInput', () => {
    it('judges birdie from the net score', () => {
        const input = buildScoreInput({ gross: 4, par: 4, pushCount: 0, handicap: everyOne });
        expect(input).toEqual({ score: 3, grossScore: 4, handicap: everyOne, isBirdie: true, isEagle: false, pushCount: 0 });
    });

    it('does not become a birdie under par floor', () => {
        const input = buildScoreInput({ gross: 4, par: 4, pushCount: 1, handicap: everyOnePar });
        expect(input.score).toBe(4);
        expect(input.isBirdie).toBe(false);
        expect(input.pushCount).toBe(1);
    });

    it('judges eagle from the net score', () => {
        const input = buildScoreInput({ gross: 3, par: 4, pushCount: 0, handicap: everyOne });
        expect(input.score).toBe(2);
        expect(input.isEagle).toBe(true);
        expect(input.isBirdie).toBe(true);
    });

    it('omits handicap fields for players without a handicap', () => {
        expect(buildScoreInput({ gross: 5, par: 4, pushCount: 0 })).toEqual({
            score: 5, isBirdie: false, isEagle: false, pushCount: 0,
        });
    });
});

describe('formatHandicap', () => {
    it('describes the handicap in Japanese', () => {
        expect(formatHandicap(everyOne, 'ja')).toBe('エブリワン');
        expect(formatHandicap(everyTwoPar, 'ja')).toBe('エブリツー・パー縛り');
        expect(formatHandicap(everyOneBogey, 'ja')).toBe('エブリワン・ボギー縛り');
        expect(formatHandicap(undefined, 'ja')).toBe('なし');
    });

    it('describes the handicap in English', () => {
        expect(formatHandicap(everyOnePar, 'en')).toBe('Every 1 (par floor)');
        expect(formatHandicap(undefined, 'en')).toBe('None');
    });
});
