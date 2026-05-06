import {
    applySoloPlayerPointMultiplier,
    BOGEY_KUN_ID,
    computeTeamPairs,
    findSoloPlayer,
} from '../utils/threePlayerMode';

describe('3 player mode helpers', () => {
    const ranking = ['p1', 'p2', 'p3', BOGEY_KUN_ID];

    test('rotates the bogey-kun solo partner across the three pairing patterns', () => {
        const h1 = computeTeamPairs(1, ranking);
        const h2 = computeTeamPairs(2, ranking);
        const h3 = computeTeamPairs(3, ranking);

        expect(findSoloPlayer(h1.teamA, h1.teamB)).toBe('p3');
        expect(findSoloPlayer(h2.teamA, h2.teamB)).toBe('p2');
        expect(findSoloPlayer(h3.teamA, h3.teamB)).toBe('p1');
    });

    test('returns undefined when bogey-kun is not in either team', () => {
        expect(findSoloPlayer(['p1', 'p2'], ['p3', 'p4'])).toBeUndefined();
    });

    test('doubles only the solo real player points', () => {
        const result = applySoloPlayerPointMultiplier(
            { p1: 10, p2: 10, p3: -10, [BOGEY_KUN_ID]: -10 },
            ['p1', 'p2'],
            ['p3', BOGEY_KUN_ID],
        );

        expect(result.p1).toBe(10);
        expect(result.p2).toBe(10);
        expect(result.p3).toBe(-20);
        expect(result[BOGEY_KUN_ID]).toBe(-10);
    });
});
