import { RoundResult } from '../types';
import { SavedRound } from '../services/cloudSave';
import { fetchSharedRounds, leaveSharedRound } from '../services/roundShares';
import { useSharedRoundsStore } from './sharedRoundsStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('./gameStore', () => ({ INITIAL_STATE: { settings: {} } }));

jest.mock('../services/roundShares', () => ({
    fetchSharedRounds: jest.fn(),
    leaveSharedRound: jest.fn(),
}));

const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.Mock;

function savedRow(overrides: Partial<SavedRound> = {}): SavedRound {
    return {
        id: 'r1',
        user_id: 'owner-1',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-02T00:00:00Z',
        match_name: 'match',
        rate: 20,
        player_count: 4,
        player_names: { p1: 'A' },
        push_limit: 3,
        push_recovery_on_birdie: 1,
        push_recovery_on_eagle: 2,
        holes: [],
        total_points: {},
        status: 'completed',
        current_hole: 18,
        start_hole: 1,
        round_length: 18,
        draft_hole: null,
        player_ranking: [],
        course_name: '',
        played_at: '',
        memo: '',
        ...overrides,
    };
}

function round(id: string): RoundResult {
    return { id } as unknown as RoundResult;
}

beforeEach(() => {
    jest.clearAllMocks();
    useSharedRoundsStore.setState({ viewerId: null, rounds: [] });
});

describe('sharedRoundsStore', () => {
    test('replaces the list with the latest server result, dropping stopped shares', async () => {
        useSharedRoundsStore.setState({ viewerId: 'u1', rounds: [round('old')] });
        mocked(fetchSharedRounds).mockResolvedValue([savedRow({ id: 'new' })]);
        await useSharedRoundsStore.getState().loadSharedRounds('u1');
        expect(useSharedRoundsStore.getState().rounds.map(r => r.id)).toEqual(['new']);
        expect(useSharedRoundsStore.getState().viewerId).toBe('u1');
    });

    test('keeps the cached list when loading fails (offline)', async () => {
        useSharedRoundsStore.setState({ viewerId: 'u1', rounds: [round('old')] });
        mocked(fetchSharedRounds).mockRejectedValue(new Error('offline'));
        await useSharedRoundsStore.getState().loadSharedRounds('u2');
        expect(useSharedRoundsStore.getState().rounds.map(r => r.id)).toEqual(['old']);
        expect(useSharedRoundsStore.getState().viewerId).toBe('u1');
    });

    test('shows shared rounds only to the user they were loaded for', () => {
        useSharedRoundsStore.setState({ viewerId: 'u1', rounds: [round('r')] });
        expect(useSharedRoundsStore.getState().visibleSharedRounds('u1').map(r => r.id)).toEqual(['r']);
        expect(useSharedRoundsStore.getState().visibleSharedRounds('u2')).toEqual([]);
        expect(useSharedRoundsStore.getState().visibleSharedRounds(null)).toEqual([]);
    });

    test('removes a round locally only after the server accepts it', async () => {
        useSharedRoundsStore.setState({ viewerId: 'u1', rounds: [round('a'), round('b')] });
        mocked(leaveSharedRound).mockResolvedValueOnce(undefined);
        await expect(useSharedRoundsStore.getState().removeSharedRound('a')).resolves.toBe(true);
        expect(useSharedRoundsStore.getState().rounds.map(r => r.id)).toEqual(['b']);

        mocked(leaveSharedRound).mockRejectedValueOnce(new Error('fail'));
        await expect(useSharedRoundsStore.getState().removeSharedRound('b')).resolves.toBe(false);
        expect(useSharedRoundsStore.getState().rounds.map(r => r.id)).toEqual(['b']);
    });
});
