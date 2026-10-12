import { Player } from '../types';
import { calculateMinimumSettlement } from './settlement';

const players: Player[] = ['A', 'B', 'C', 'D'].map((name, index) => ({
    id: `p${index + 1}`,
    name,
    type: 'real',
    pushUsageCount: { front9: 0, back9: 0 },
}));

describe('calculateMinimumSettlement', () => {
    test('settles a mixed balance set in three transfers', () => {
        const result = calculateMinimumSettlement(
            players,
            { p1: 300, p2: 100, p3: -250, p4: -150 },
            10,
        );

        expect(result).toHaveLength(3);
        expect(result.reduce((sum, transfer) => sum + transfer.amount, 0)).toBe(4000);
        expect(result.every(transfer => transfer.points > 0)).toBe(true);
    });

    test('uses two transfers for two exact debtor-creditor pairs', () => {
        const result = calculateMinimumSettlement(
            players,
            { p1: 300, p2: 200, p3: -300, p4: -200 },
            1,
        );
        expect(result).toHaveLength(2);
    });

    test('returns no transfers for an unbalanced score set', () => {
        expect(calculateMinimumSettlement(players, { p1: 10, p2: 0, p3: 0, p4: 0 }, 1)).toEqual([]);
    });
});
