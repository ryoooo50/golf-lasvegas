
import { PlayerId, ScoreInput } from '../types';
import { calculateHoleResult } from './golfLogic';

describe('calculateHoleResult', () => {
    const p1 = 'p1';
    const p2 = 'p2';
    const p3 = 'p3';
    const p4 = 'p4';

    const teamA_Ids: [PlayerId, PlayerId] = [p1, p2];
    const teamB_Ids: [PlayerId, PlayerId] = [p3, p4];

    const createScores = (
        s1: number,
        s2: number,
        s3: number,
        s4: number,
        b1 = false,
        b2 = false,
        b3 = false,
        b4 = false,
        pushCount = 0
    ): Record<PlayerId, ScoreInput> => {
        // Distribute push count among players simply for testing
        let pushesAssigned = 0;
        const getPush = () => {
            if (pushesAssigned < pushCount) {
                pushesAssigned++;
                return true;
            }
            return false;
        };

        return {
            [p1]: { score: s1, isBirdie: b1, usePush: getPush() },
            [p2]: { score: s2, isBirdie: b2, usePush: getPush() },
            [p3]: { score: s3, isBirdie: b3, usePush: getPush() },
            [p4]: { score: s4, isBirdie: b4, usePush: getPush() },
        };
    };

    test('Basic Calculation: Team A wins', () => {
        // A: 4, 5 -> 45
        // B: 5, 6 -> 56
        // Diff: 11
        // Push: 0 (x1)
        // Carry: x1
        const scores = createScores(4, 5, 5, 6);
        const result = calculateHoleResult({
            holeNumber: 1,
            par: 4,
            scores,
            teamA_Ids,
            teamB_Ids,
            currentCarryOverMultiplier: 1,
        });

        expect(result.pointsResult[p1]).toBe(11);
        expect(result.pointsResult[p2]).toBe(11);
        expect(result.pointsResult[p3]).toBe(-11);
        expect(result.pointsResult[p4]).toBe(-11);
        expect(result.isDraw).toBe(false);
    });

    test('Birdie Flip: Team A gets birdie, Team B flips', () => {
        // A: 3(Birdie), 5 -> 35
        // B: 4, 6 -> 46 normally -> Flips to 64
        // Diff: 64 - 35 = 29
        const scores = createScores(3, 5, 4, 6, true, false, false, false);
        const result = calculateHoleResult({
            holeNumber: 1,
            par: 4,
            scores,
            teamA_Ids,
            teamB_Ids,
            currentCarryOverMultiplier: 1,
        });

        expect(result.pointsResult[p1]).toBe(29);
        expect(result.pointsResult[p3]).toBe(-29);
    });

    test('Birdie Flip: Both teams get birdie -> Both flip', () => {
        // A: 3(Birdie), 5 -> 35 -> Flip to 53
        // B: 3(Birdie), 6 -> 36 -> Flip to 63
        // Diff: 63 - 53 = 10 (A wins)
        const scores = createScores(3, 5, 3, 6, true, false, true, false);
        const result = calculateHoleResult({
            holeNumber: 1,
            par: 4,
            scores,
            teamA_Ids,
            teamB_Ids,
            currentCarryOverMultiplier: 1,
        });

        expect(result.pointsResult[p1]).toBe(10);
    });

    test('Push Multiplier: 1 person pushes -> x2', () => {
        // A: 4, 5 -> 45
        // B: 5, 6 -> 56
        // Diff: 11
        // Push: 1 user -> x2
        // total = 22
        const scores = createScores(4, 5, 5, 6, false, false, false, false, 1);
        const result = calculateHoleResult({
            holeNumber: 1,
            par: 4,
            scores,
            teamA_Ids,
            teamB_Ids,
            currentCarryOverMultiplier: 1,
        });

        expect(result.pointsResult[p1]).toBe(22);
    });

    test('Push Multiplier: 2 people push -> x4', () => {
        // A: 4, 5 -> 45
        // B: 5, 6 -> 56
        // Diff: 11
        // Push: 2 users -> x4
        // total = 44
        const scores = createScores(4, 5, 5, 6, false, false, false, false, 2);
        const result = calculateHoleResult({
            holeNumber: 1,
            par: 4,
            scores,
            teamA_Ids,
            teamB_Ids,
            currentCarryOverMultiplier: 1,
        });

        expect(result.pointsResult[p1]).toBe(44);
    });

    test('CarryOver: Previous CarryOver applies', () => {
        // A: 4, 5 -> 45
        // B: 5, 6 -> 56
        // Diff: 11
        // Push: 0 -> x1
        // CarryOver: x2
        // Total: 22
        const scores = createScores(4, 5, 5, 6);
        const result = calculateHoleResult({
            holeNumber: 1,
            par: 4,
            scores,
            teamA_Ids,
            teamB_Ids,
            currentCarryOverMultiplier: 2,
        });

        expect(result.pointsResult[p1]).toBe(22);
    });

    test('Draw: Points are 0, CarryOver flag set', () => {
        // A: 4, 5 -> 45
        // B: 4, 5 -> 45
        // Diff: 0
        const scores = createScores(4, 5, 4, 5);
        const result = calculateHoleResult({
            holeNumber: 1,
            par: 4,
            scores,
            teamA_Ids,
            teamB_Ids,
            currentCarryOverMultiplier: 1,
        });

        expect(result.pointsResult[p1]).toBe(0);
        expect(result.isDraw).toBe(true);
    });
});
