import { HoleResult, PlayerId } from '../types';
import { computeRankingForHole } from './teamRanking';

function hole(holeNumber: number, strokes: Record<PlayerId, number>): HoleResult {
    const scores = Object.fromEntries(
        Object.entries(strokes).map(([id, score]) => [id, { score, isBirdie: false, isEagle: false, pushCount: 0 }]),
    );
    return { holeNumber, scores } as unknown as HoleResult;
}

const PLAYERS = ['a', 'b', 'c', 'd'];
const SEQ_OUT = Array.from({ length: 18 }, (_, i) => i + 1);

describe('computeRankingForHole', () => {
    test('uses the starting order on the first hole', () => {
        expect(computeRankingForHole(PLAYERS, SEQ_OUT, [], 1)).toEqual(['a', 'b', 'c', 'd']);
    });

    test('ranks by the previous hole strokes, lowest first', () => {
        const history = [hole(1, { a: 6, b: 4, c: 5, d: 3 })];
        expect(computeRankingForHole(PLAYERS, SEQ_OUT, history, 2)).toEqual(['d', 'b', 'c', 'a']);
    });

    test('only the immediately previous hole matters, not cumulative strokes', () => {
        const history = [
            hole(1, { a: 3, b: 9, c: 9, d: 9 }),
            hole(2, { a: 6, b: 4, c: 5, d: 5 }),
        ];
        expect(computeRankingForHole(PLAYERS, SEQ_OUT, history, 3)).toEqual(['b', 'c', 'd', 'a']);
    });

    test('ties keep the order from the previous hole', () => {
        const history = [
            hole(1, { a: 5, b: 5, c: 4, d: 6 }), // → c, a, b, d
            hole(2, { a: 5, b: 4, c: 5, d: 5 }), // b first, then a/c/d tie keeps c, a, d
        ];
        expect(computeRankingForHole(PLAYERS, SEQ_OUT, history, 2)).toEqual(['c', 'a', 'b', 'd']);
        expect(computeRankingForHole(PLAYERS, SEQ_OUT, history, 3)).toEqual(['b', 'c', 'a', 'd']);
    });

    test('follows the play order for IN start (hole 1 comes after hole 18)', () => {
        const seqIn = [...Array.from({ length: 9 }, (_, i) => i + 10), ...Array.from({ length: 9 }, (_, i) => i + 1)];
        const history = [hole(18, { a: 7, b: 6, c: 5, d: 4 })];
        expect(computeRankingForHole(PLAYERS, seqIn, history, 1)).toEqual(['d', 'c', 'b', 'a']);
        expect(computeRankingForHole(PLAYERS, seqIn, history, 10)).toEqual(['a', 'b', 'c', 'd']);
    });

    test('editing an earlier hole changes the ranking of the following hole', () => {
        const before = [hole(1, { a: 3, b: 4, c: 5, d: 6 })];
        const after = [hole(1, { a: 6, b: 4, c: 5, d: 3 })];
        expect(computeRankingForHole(PLAYERS, SEQ_OUT, before, 2)).toEqual(['a', 'b', 'c', 'd']);
        expect(computeRankingForHole(PLAYERS, SEQ_OUT, after, 2)).toEqual(['d', 'b', 'c', 'a']);
    });

    test('a previous hole that is not entered yet keeps the earlier ranking', () => {
        const history = [hole(1, { a: 6, b: 5, c: 4, d: 3 })];
        expect(computeRankingForHole(PLAYERS, SEQ_OUT, history, 3)).toEqual(['d', 'c', 'b', 'a']);
    });
});
