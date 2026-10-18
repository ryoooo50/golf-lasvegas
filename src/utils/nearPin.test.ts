import { HoleResult, Player, PlayerId, RoundResult } from '../types';
import { getRoundHoleSequence } from './holeSequence';
import { calculateNearPin, isNearPinHole, nearPinAmountsForRound, nearPinCarryOverBefore } from './nearPin';
import { BOGEY_KUN_ID } from './threePlayerMode';

const FOUR_PLAYERS: PlayerId[] = ['p1', 'p2', 'p3', 'p4'];
const FRONT_NINE = getRoundHoleSequence(1, 9);

/** ニアピン計算に必要な項目だけを持つホール結果を作る */
function hole(holeNumber: number, par: number, nearPinWinnerId?: PlayerId | null): HoleResult {
    return { holeNumber, par, nearPinWinnerId } as HoleResult;
}

describe('isNearPinHole', () => {
    test('is a near-pin hole only on par 3 when near pin is on', () => {
        expect(isNearPinHole(3, 500)).toBe(true);
        expect(isNearPinHole(4, 500)).toBe(false);
        expect(isNearPinHole(3, 0)).toBe(false);
        expect(isNearPinHole(null, 500)).toBe(false);
    });
});

describe('calculateNearPin', () => {
    test('pays the winner the rate from every other player', () => {
        const result = calculateNearPin({
            history: [hole(1, 4), hole(2, 3, 'p1')],
            sequence: FRONT_NINE,
            participantIds: FOUR_PLAYERS,
            nearPinRate: 500,
        });

        expect(result.amounts).toEqual({ p1: 1500, p2: -500, p3: -500, p4: -500 });
        expect(result.carryOver).toBe(0);
    });

    test('carries an unwon near pin over to the next par 3', () => {
        const result = calculateNearPin({
            history: [hole(2, 3, null), hole(3, 4), hole(5, 3, 'p2')],
            sequence: FRONT_NINE,
            participantIds: FOUR_PLAYERS,
            nearPinRate: 1000,
        });

        expect(result.amounts).toEqual({ p1: -2000, p2: 6000, p3: -2000, p4: -2000 });
        expect(result.carryOver).toBe(0);
    });

    test('lets a carry-over left after the last par 3 lapse', () => {
        const result = calculateNearPin({
            history: [hole(2, 3, 'p1'), hole(5, 3, null)],
            sequence: FRONT_NINE,
            participantIds: FOUR_PLAYERS,
            nearPinRate: 500,
        });

        expect(result.amounts).toEqual({ p1: 1500, p2: -500, p3: -500, p4: -500 });
        expect(result.carryOver).toBe(1);
    });

    test('follows play order for an IN start', () => {
        const result = calculateNearPin({
            history: [hole(3, 3, 'p3'), hole(17, 3, null)],
            sequence: getRoundHoleSequence(10, 18),
            participantIds: FOUR_PLAYERS,
            nearPinRate: 500,
        });

        // 17番の持ち越しが、後でプレーする3番に乗る
        expect(result.amounts.p3).toBe(3000);
    });

    test('keeps bogey-kun out of the near pin in 3-player mode', () => {
        const result = calculateNearPin({
            history: [hole(2, 3, 'p1')],
            sequence: FRONT_NINE,
            participantIds: ['p1', 'p2', 'p3'],
            nearPinRate: 500,
        });

        expect(result.amounts).toEqual({ p1: 1000, p2: -500, p3: -500 });
        expect(result.amounts[BOGEY_KUN_ID]).toBeUndefined();
    });

    test('ignores par 3 holes when near pin is off', () => {
        const result = calculateNearPin({
            history: [hole(2, 3, 'p1')],
            sequence: FRONT_NINE,
            participantIds: FOUR_PLAYERS,
            nearPinRate: 0,
        });

        expect(result.amounts).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });
    });

    test('skips par 3 holes played before near pin was turned on', () => {
        // 途中からニアピンを有効にした場合、それ以前のパー3には記録が無い（undefined）
        const result = calculateNearPin({
            history: [hole(2, 3), hole(5, 3, 'p4')],
            sequence: FRONT_NINE,
            participantIds: FOUR_PLAYERS,
            nearPinRate: 500,
        });

        expect(result.amounts.p4).toBe(1500);
        expect(result.carryOver).toBe(0);
    });
});

describe('nearPinCarryOverBefore', () => {
    test('counts unwon par 3 holes played before the given hole', () => {
        const params = {
            history: [hole(2, 3, null), hole(3, 4), hole(5, 3, null), hole(8, 3, 'p1')],
            sequence: FRONT_NINE,
            participantIds: FOUR_PLAYERS,
            nearPinRate: 500,
        };

        expect(nearPinCarryOverBefore(params, 2)).toBe(0);
        expect(nearPinCarryOverBefore(params, 5)).toBe(1);
        expect(nearPinCarryOverBefore(params, 8)).toBe(2);
        expect(nearPinCarryOverBefore(params, 9)).toBe(0);
    });
});

describe('nearPinAmountsForRound', () => {
    test('uses the round settings, play order and real players only', () => {
        const players: Player[] = [
            ...['p1', 'p2', 'p3'].map(id => ({ id, name: id, type: 'real' as const, pushUsageCount: { front9: 0, back9: 0 } })),
            { id: BOGEY_KUN_ID, name: 'ボギーくん', type: 'bogey_kun', pushUsageCount: { front9: 0, back9: 0 } },
        ];
        const round = {
            players,
            history: [hole(12, 3, null), hole(4, 3, 'p2')],
            startHole: 10,
            roundLength: 18,
            settings: { nearPinRate: 1000 },
        } as unknown as RoundResult;

        expect(nearPinAmountsForRound(round)).toEqual({ p1: -2000, p2: 4000, p3: -2000 });
    });

    test('returns no amounts for rounds saved before near pin existed', () => {
        const round = {
            players: [],
            history: [],
            startHole: 1,
            roundLength: 18,
            settings: {},
        } as unknown as RoundResult;

        expect(nearPinAmountsForRound(round)).toEqual({});
    });
});
