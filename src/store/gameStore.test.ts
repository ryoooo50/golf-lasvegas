import {
    applySoloPlayerPointMultiplier,
    BOGEY_KUN_ID,
    computeTeamPairs,
    findSoloPlayer,
} from '../utils/threePlayerMode';
import { PlayerId, ScoreInput } from '../types';
import { useGameStore } from './gameStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../i18n/i18n', () => ({
    changeLanguage: jest.fn(),
}));

jest.mock('../services/cloudSave', () => ({
    saveRound: jest.fn(),
    updateRound: jest.fn(),
    deleteRound: jest.fn(),
    loadUserRounds: jest.fn(() => Promise.resolve([])),
}));

jest.mock('./authStore', () => ({
    useAuthStore: {
        getState: jest.fn(() => ({ user: null })),
    },
}));

const PLAYER_IDS: PlayerId[] = ['p1', 'p2', 'p3', 'p4'];

function scoreInput(score: number, pushCount = 0, isBirdie = false): ScoreInput {
    return {
        score,
        isBirdie,
        isEagle: false,
        pushCount,
    };
}

function completeTestHole(holeNumber: number, overrides: Partial<Record<PlayerId, Partial<ScoreInput>>> = {}) {
    const scores: Record<PlayerId, ScoreInput> = {
        p1: scoreInput(4),
        p2: scoreInput(4),
        p3: scoreInput(4),
        p4: scoreInput(4),
    };

    for (const [id, override] of Object.entries(overrides)) {
        scores[id] = { ...scores[id], ...override };
    }

    useGameStore.getState().completeHole({
        par: 4,
        scores,
        teamA_Ids: ['p1', 'p2'],
        teamB_Ids: ['p3', 'p4'],
        holeNumber,
    });
}

function startFreshGame() {
    useGameStore.getState().resetGame();
    useGameStore.getState().startGame(1);
}

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

describe('push limits by half', () => {
    beforeEach(() => {
        startFreshGame();
    });

    test('keeps back-nine push count independent when jumping to 10 before hole 9 is complete', () => {
        completeTestHole(1, { p1: { pushCount: 1 } });
        completeTestHole(2, { p1: { pushCount: 1 } });

        useGameStore.getState().goToHole(10);

        expect(useGameStore.getState().getRemainingPushForPlayer('p1')).toBe(2);
    });

    test('keeps back-nine push count independent after hole 9 is complete', () => {
        completeTestHole(1, { p1: { pushCount: 1 } });
        completeTestHole(2, { p1: { pushCount: 1 } });
        for (let holeNumber = 3; holeNumber <= 9; holeNumber += 1) {
            completeTestHole(holeNumber);
        }

        expect(useGameStore.getState().currentHole).toBe(10);
        expect(useGameStore.getState().getRemainingPushForPlayer('p1')).toBe(2);
    });

    test('does not let back-nine pushes affect front-nine remaining count', () => {
        completeTestHole(1, { p1: { pushCount: 1 } });
        useGameStore.getState().goToHole(10);
        completeTestHole(10, { p1: { pushCount: 2 } });

        useGameStore.getState().goToHole(3);

        expect(useGameStore.getState().getRemainingPushForPlayer('p1')).toBe(1);
    });

    test('does not carry birdie push recovery bonuses across halves', () => {
        useGameStore.getState().updateSettings({ pushRecoveryOnBirdie: 1, pushRecoveryOnEagle: 2 });

        completeTestHole(1, { p1: { score: 3, isBirdie: true } });

        expect(useGameStore.getState().getRemainingPushForPlayer('p1')).toBe(3);

        useGameStore.getState().goToHole(10);

        expect(useGameStore.getState().getRemainingPushForPlayer('p1')).toBe(2);
    });

    test('recovers the configured eagle amount instead of the birdie amount when a player scores an eagle', () => {
        useGameStore.getState().updateSettings({ pushRecoveryOnBirdie: 1, pushRecoveryOnEagle: 2 });

        completeTestHole(1, { p1: { score: 2, isBirdie: true, isEagle: true } });

        expect(useGameStore.getState().getRemainingPushForPlayer('p1')).toBe(4);
    });

    test('respects custom recovery amounts', () => {
        useGameStore.getState().updateSettings({ pushRecoveryOnBirdie: 3, pushRecoveryOnEagle: 5 });

        completeTestHole(1, { p1: { score: 3, isBirdie: true } });

        expect(useGameStore.getState().getRemainingPushForPlayer('p1')).toBe(5);
    });

    test('does not grant recovery when the configured amount is 0', () => {
        useGameStore.getState().updateSettings({ pushRecoveryOnBirdie: 0, pushRecoveryOnEagle: 0 });

        completeTestHole(1, { p1: { score: 2, isBirdie: true, isEagle: true } });

        expect(useGameStore.getState().getRemainingPushForPlayer('p1')).toBe(2);
    });

    test('rebuilds push state when resuming a saved round', () => {
        completeTestHole(1, { p1: { pushCount: 1 } });
        completeTestHole(2, { p1: { pushCount: 1 } });
        for (let holeNumber = 3; holeNumber <= 9; holeNumber += 1) {
            completeTestHole(holeNumber);
        }

        const state = useGameStore.getState();
        useGameStore.setState({
            savedRounds: [{
                id: 'round_1',
                cloudId: null,
                date: '2026-05-11T00:00:00.000Z',
                name: 'Saved Push Test',
                players: state.players,
                history: state.history,
                finalScores: Object.fromEntries(PLAYER_IDS.map(id => [id, 0])),
                gameStatus: 'finished',
                currentHole: 10,
            }],
        });

        useGameStore.getState().resetGame();
        useGameStore.getState().resumeRound('round_1');

        expect(useGameStore.getState().pushUsedFront9.p1).toBe(2);
        expect(useGameStore.getState().getRemainingPushForPlayer('p1')).toBe(2);
    });
});
