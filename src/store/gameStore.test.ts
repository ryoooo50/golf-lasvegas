import {
    applySoloPlayerPointMultiplier,
    BOGEY_KUN_ID,
    computeTeamPairs,
    findSoloPlayer,
} from '../utils/threePlayerMode';
import { PlayerId, ScoreInput } from '../types';
import { getRoundHoleSequence, useGameStore } from './gameStore';

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
    upsertRound: jest.fn(),
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
    useGameStore.setState({ savedRounds: [], pendingCloudSaves: [], playerProfiles: [] });
    useGameStore.getState().startGame(1);
}

describe('round lifecycle', () => {
    beforeEach(() => {
        startFreshGame();
    });

    test('builds a wrapped 18-hole sequence for an IN start', () => {
        expect(getRoundHoleSequence(10, 18)).toEqual([
            10, 11, 12, 13, 14, 15, 16, 17, 18,
            1, 2, 3, 4, 5, 6, 7, 8, 9,
        ]);
    });

    test('finishes a nine-hole round after its ninth completed hole', () => {
        useGameStore.getState().updateSettings({ roundLength: 9 });
        for (let holeNumber = 1; holeNumber <= 9; holeNumber += 1) {
            completeTestHole(holeNumber);
        }

        expect(useGameStore.getState().gameStatus).toBe('finished');
        expect(useGameStore.getState().currentHole).toBe(9);
    });

    test('pauses before any hole is completed and keeps the current draft', async () => {
        useGameStore.getState().saveDraft({
            holeNumber: 1,
            par: 4,
            scores: { p1: 4 },
            birdieFlags: {},
            pushCounts: {},
            teamAssignments: { p1: 'A', p2: 'A', p3: 'B', p4: 'B' },
        });

        const result = await useGameStore.getState().pauseCurrentRound();
        const state = useGameStore.getState();

        expect(result.localSaved).toBe(true);
        expect(state.gameStatus).toBe('menu');
        expect(state.savedRounds[0].gameStatus).toBe('paused');
        expect(state.savedRounds[0].draftHole?.par).toBe(4);
    });

    test('restores the saved round settings when resuming', async () => {
        useGameStore.getState().updateSettings({
            matchName: 'Nine Hole Match',
            roundLength: 9,
            rate: 25,
            maxPushCountPerHalf: 4,
        });
        await useGameStore.getState().pauseCurrentRound();
        const roundId = useGameStore.getState().savedRounds[0].id;

        useGameStore.getState().updateSettings({ roundLength: 18, rate: 1, maxPushCountPerHalf: 1 });
        useGameStore.getState().resumeRound(roundId);

        expect(useGameStore.getState().settings.roundLength).toBe(9);
        expect(useGameStore.getState().settings.rate).toBe(25);
        expect(useGameStore.getState().settings.maxPushCountPerHalf).toBe(4);
    });
});

describe('phase 2 round reuse', () => {
    beforeEach(() => {
        startFreshGame();
    });

    test('keeps a reusable player history and favorite flag', () => {
        useGameStore.getState().rememberPlayerProfiles(['Alice', 'Bob', 'Alice']);
        const alice = useGameStore.getState().playerProfiles.find(profile => profile.name === 'Alice');

        expect(alice?.useCount).toBe(2);
        useGameStore.getState().togglePlayerFavorite(alice!.id);
        expect(useGameStore.getState().playerProfiles[0]).toMatchObject({ name: 'Alice', isFavorite: true });
    });

    test('duplicates a saved round as a clean new round with the same setup', async () => {
        useGameStore.getState().updateSettings({
            matchName: 'Sunday Match',
            courseName: 'Test Hills',
            playedAt: '2026-08-01',
            memo: 'Original memo',
            roundLength: 9,
        });
        completeTestHole(1);
        const saveResult = await useGameStore.getState().saveCurrentRound('completed');

        useGameStore.getState().duplicateRound(saveResult.roundId!);
        const state = useGameStore.getState();

        expect(state.gameStatus).toBe('playing');
        expect(state.history).toEqual([]);
        expect(state.settings.courseName).toBe('Test Hills');
        expect(state.settings.roundLength).toBe(9);
        expect(state.currentHole).toBe(1);
    });
});

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
                gameStatus: 'completed',
                currentHole: 10,
                startHole: 1,
                roundLength: 18,
                settings: state.settings,
                draftHole: null,
                updatedAt: '2026-05-11T00:00:00.000Z',
                playerRanking: state.playerRanking,
            }],
        });

        useGameStore.getState().resetGame();
        useGameStore.getState().resumeRound('round_1');

        expect(useGameStore.getState().pushUsedFront9.p1).toBe(2);
        expect(useGameStore.getState().getRemainingPushForPlayer('p1')).toBe(2);
    });
});

describe('recommended pairs by previous hole strokes', () => {
    beforeEach(() => {
        startFreshGame();
    });

    test('ranks players by the previous hole strokes and applies the hole pattern', () => {
        // hole 1 strokes: p1 6, p2 4, p3 5, p4 3 → ranking p4, p2, p3, p1
        completeTestHole(1, { p1: { score: 6 }, p2: { score: 4 }, p3: { score: 5 }, p4: { score: 3 } });
        // hole 2 pattern: P1+P3 vs P2+P4
        expect(useGameStore.getState().getRecommendedPairs(2)).toEqual({ teamA: ['p4', 'p3'], teamB: ['p2', 'p1'] });
        expect(useGameStore.getState().playerRanking).toEqual(['p4', 'p2', 'p3', 'p1']);
    });

    test('ignores cumulative points and earlier holes', () => {
        completeTestHole(1, { p1: { score: 3 }, p2: { score: 9 }, p3: { score: 9 }, p4: { score: 9 } });
        completeTestHole(2, { p1: { score: 6 }, p2: { score: 4 }, p3: { score: 5 }, p4: { score: 3 } });
        // hole 3 pattern: P1+P4 vs P2+P3, ranking p4, p2, p3, p1
        expect(useGameStore.getState().getRecommendedPairs(3)).toEqual({ teamA: ['p4', 'p1'], teamB: ['p2', 'p3'] });
    });
});

describe('claimLegacyLocalData', () => {
    const LEGACY_ID = '11111111-2222-3333-4444-555555555555';
    const NEW_ID = 'Xk3v9QmZp2LrT8wYc4NbH6dJf1sGa7eU';

    beforeEach(() => {
        startFreshGame();
        completeTestHole(1);
    });

    function legacyRound(id: string, ownerId: string) {
        const state = useGameStore.getState();
        return {
            id, cloudId: id, date: '2026-09-01T00:00:00.000Z', name: 'Old', players: state.players,
            history: state.history, finalScores: { p1: 0 }, gameStatus: 'completed' as const, currentHole: 2,
            startHole: 1 as const, roundLength: 18 as const, settings: state.settings, draftHole: null,
            updatedAt: '2026-09-01T00:00:00.000Z', ownerId, playerRanking: [],
        };
    }

    test('moves rounds owned by an old Supabase user to the new user and queues uploads', () => {
        useGameStore.setState({
            savedRounds: [legacyRound('r-legacy', LEGACY_ID), legacyRound('r-guest', 'guest')],
            pendingCloudSaves: [{ id: 'old', operation: 'delete', userId: LEGACY_ID, localRoundId: 'x', cloudRoundId: 'x', createdAt: '' }],
        });

        useGameStore.getState().claimLegacyLocalData(NEW_ID);

        const { savedRounds, pendingCloudSaves } = useGameStore.getState();
        expect(savedRounds.find(r => r.id === 'r-legacy')).toMatchObject({ ownerId: NEW_ID, cloudId: null });
        expect(savedRounds.find(r => r.id === 'r-guest')?.ownerId).toBe('guest');
        expect(pendingCloudSaves).toHaveLength(1);
        expect(pendingCloudSaves[0]).toMatchObject({ operation: 'upsert', userId: NEW_ID, localRoundId: 'r-legacy', cloudRoundId: null });
        expect(pendingCloudSaves[0].roundData?.match_name).toBe(useGameStore.getState().settings.matchName || 'Untitled Match');
    });

    test('does not touch rounds of other new-style accounts and is idempotent', () => {
        const otherNew = 'Ab3v9QmZp2LrT8wYc4NbH6dJf1sGa7eQ';
        useGameStore.setState({ savedRounds: [legacyRound('r-other', otherNew), legacyRound('r-legacy', LEGACY_ID)], pendingCloudSaves: [] });

        useGameStore.getState().claimLegacyLocalData(NEW_ID);
        useGameStore.getState().claimLegacyLocalData(NEW_ID);

        const { savedRounds, pendingCloudSaves } = useGameStore.getState();
        expect(savedRounds.find(r => r.id === 'r-other')?.ownerId).toBe(otherNew);
        expect(pendingCloudSaves).toHaveLength(1);
    });

    test('merges player profiles without creating duplicates', () => {
        useGameStore.setState({
            playerProfiles: [
                { id: 'a', name: 'Taro', isFavorite: true, useCount: 3, lastUsedAt: '', ownerId: LEGACY_ID },
                { id: 'b', name: 'Hanako', isFavorite: false, useCount: 1, lastUsedAt: '', ownerId: LEGACY_ID },
                { id: 'c', name: 'taro', isFavorite: false, useCount: 1, lastUsedAt: '', ownerId: NEW_ID },
            ],
        });

        useGameStore.getState().claimLegacyLocalData(NEW_ID);

        const profiles = useGameStore.getState().playerProfiles;
        expect(profiles.map(p => p.id).sort()).toEqual(['b', 'c']);
        expect(profiles.every(p => p.ownerId === NEW_ID)).toBe(true);
    });
});
