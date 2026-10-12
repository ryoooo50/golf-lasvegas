import { RoundResult } from '../types';
import { buildRoundCsv, buildRoundHtml } from './roundExport';

jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-print', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

const round: RoundResult = {
    id: 'round-1',
    cloudId: null,
    date: '2026-08-31T00:00:00.000Z',
    name: 'Sunday, Match',
    players: [
        { id: 'p1', name: 'Alice', type: 'real', pushUsageCount: { front9: 0, back9: 0 } },
        { id: 'p2', name: 'Bob', type: 'real', pushUsageCount: { front9: 0, back9: 0 } },
    ],
    history: [],
    finalScores: { p1: 10, p2: -10 },
    gameStatus: 'completed',
    currentHole: 9,
    startHole: 1,
    roundLength: 9,
    settings: {
        rate: 100,
        maxPushCountPerHalf: 2,
        language: 'ja',
        matchName: 'Sunday, Match',
        courseName: '<Test Hills>',
        playedAt: '2026-08-31',
        memo: 'Good round',
        playerCount: 4,
        roundLength: 9,
        pushRecoveryOnBirdie: 1,
        pushRecoveryOnEagle: 2,
    },
    draftHole: null,
    updatedAt: '2026-08-31T00:00:00.000Z',
    ownerId: 'guest',
    playerRanking: [],
};

describe('round exports', () => {
    test('builds a quoted UTF-8 CSV with settlement data', () => {
        const csv = buildRoundCsv(round);
        expect(csv.startsWith('\uFEFF')).toBe(true);
        expect(csv).toContain('"Sunday, Match"');
        expect(csv).toContain('"Bob","->","Alice","10","1000"');
    });

    test('escapes user-entered text in PDF HTML', () => {
        const html = buildRoundHtml(round);
        expect(html).toContain('&lt;Test Hills&gt;');
        expect(html).not.toContain('<Test Hills>');
    });
});
