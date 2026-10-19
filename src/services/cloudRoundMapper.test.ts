import { GameState, HoleResult } from '../types';
import { SavedRound } from './cloudSave';
import { toRoundResult } from './cloudRoundMapper';

const DEFAULT_SETTINGS = {
    matchName: '',
    rate: 10,
    playerCount: 4,
    maxPushCountPerHalf: 2,
    pushRecoveryOnBirdie: 1,
    pushRecoveryOnEagle: 2,
    nearPinRate: 0,
    roundLength: 18,
    courseName: '',
    playedAt: '',
    memo: '',
} as unknown as GameState['settings'];

function savedRow(overrides: Partial<SavedRound> = {}): SavedRound {
    return {
        id: 'round-uuid',
        user_id: 'owner-1',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-02T00:00:00Z',
        match_name: 'match',
        rate: 20,
        player_count: 4,
        player_names: { p1: 'A', p2: 'B' },
        push_limit: 3,
        push_recovery_on_birdie: 1,
        push_recovery_on_eagle: 2,
        near_pin_rate: 50,
        holes: [],
        total_points: { p1: 1, p2: -1 },
        status: 'completed',
        current_hole: 18,
        start_hole: 1,
        round_length: 18,
        draft_hole: null,
        player_ranking: [],
        course_name: 'course',
        played_at: '2026-10-01',
        memo: 'memo',
        ...overrides,
    };
}

describe('toRoundResult', () => {
    test('maps a cloud row to a round result with defaults for older rows', () => {
        const result = toRoundResult(
            savedRow({ near_pin_rate: undefined, player_names: { p1: 'A', bogey_kun: 'ボギーくん' } }),
            DEFAULT_SETTINGS,
        );
        expect(result.id).toBe('round-uuid');
        expect(result.cloudId).toBe('round-uuid');
        expect(result.settings.nearPinRate).toBe(0);
        expect(result.players.find(p => p.id === 'bogey_kun')?.type).toBe('bogey_kun');
        expect(result.ownerId).toBe('owner-1');
    });

    test('restores a player handicap from the latest hole', () => {
        const handicap = { type: 'strokes', value: 2 };
        const holes = [
            { holeNumber: 1, scores: { p1: { score: 4, handicap: { type: 'strokes', value: 1 } } } },
            { holeNumber: 2, scores: { p1: { score: 4, handicap } } },
        ] as unknown as HoleResult[];
        const result = toRoundResult(savedRow({ holes }), DEFAULT_SETTINGS);
        expect(result.players.find(p => p.id === 'p1')?.handicap).toEqual(handicap);
        expect(result.players.find(p => p.id === 'p2')?.handicap).toBeUndefined();
    });
});
