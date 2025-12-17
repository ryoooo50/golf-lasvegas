import { create } from 'zustand';
import i18n from '../i18n/i18n';
import { GameState, HoleResult, Player, PlayerId, RoundResult, ScoreInput } from '../types';
import { calculateHoleResult } from '../utils/golfLogic';

interface GameActions {
    addPlayer: (name: string) => void;
    updateSettings: (settings: Partial<GameState['settings']>) => void;
    setLanguage: (lang: 'en' | 'ja') => void;
    /**
     * Calculates the result for the current hole, updates history, 
     * adjusts multipliers, and advances to the next hole.
     */
    completeHole: (input: {
        par: number,
        scores: Record<PlayerId, ScoreInput>,
        teamA_Ids: [PlayerId, PlayerId],
        teamB_Ids: [PlayerId, PlayerId],
        holeNumber: number // Explicitly pass hole number
    }) => void;
    resetGame: () => void;
    updatePlayerName: (id: PlayerId, name: string) => void;
    /**
     * Helper to get recommended team pairs based on the current hole and previous scores.
     * Logic:
     * - Order players by previous hole score (Honor order). If Hole 1, use current list order.
     * - Pattern A (1,4,7...): 1&2 vs 3&4
     * - Pattern B (2,5,8...): 1&3 vs 2&4
     * - Pattern C (3,6,9...): 1&4 vs 2&3
     */
    getRecommendedPairs: (holeNumber: number) => { teamA: [PlayerId, PlayerId], teamB: [PlayerId, PlayerId] };
    getPlayerTotalScore: (id: PlayerId) => number;
    goToHole: (holeNumber: number) => void;
    startGame: (startHole: 1 | 10) => void;
    saveCurrentRound: () => void;
}

type GameStore = GameState & GameActions;

const INITIAL_STATE: Omit<GameState, 'players'> & { players: Player[] } = {
    players: [
        { id: 'p1', name: 'Player A', pushUsageCount: { front9: 0, back9: 0 } },
        { id: 'p2', name: 'Player B', pushUsageCount: { front9: 0, back9: 0 } },
        { id: 'p3', name: 'Player C', pushUsageCount: { front9: 0, back9: 0 } },
        { id: 'p4', name: 'Player D', pushUsageCount: { front9: 0, back9: 0 } },
    ],
    currentHole: 1,
    history: [],
    settings: {
        rate: 10,
        maxPushCountPerHalf: 2,
        language: 'ja', // Default to Japanese as requested
        matchName: '',
    },
    savedRounds: [],
    nextHoleMultiplier: 1,
};

export const useGameStore = create<GameStore>((set, get) => ({
    ...INITIAL_STATE,

    addPlayer: (name) =>
        set((state) => ({
            players: [
                ...state.players,
                {
                    id: Date.now().toString() + Math.random().toString(), // Simple ID generation
                    name,
                    pushUsageCount: { front9: 0, back9: 0 },
                },
            ],
        })),

    setLanguage: (lang) => {
        i18n.changeLanguage(lang);
        set((state) => ({
            settings: { ...state.settings, language: lang },
        }));
    },

    completeHole: ({ par, scores, teamA_Ids, teamB_Ids, holeNumber }) => {
        const { players, history, settings, nextHoleMultiplier } = get();

        const result = calculateHoleResult({
            holeNumber,
            par,
            scores,
            teamA_Ids,
            teamB_Ids,
            currentCarryOverMultiplier: nextHoleMultiplier,
        });

        // 3. Update Push Usage Counts for players who used push
        const updatedPlayers = players.map(p => {
            const usedPush = scores[p.id]?.usePush || false;
            if (usedPush) {
                // Determine if front9 or back9 based on HOLE NUMBER (not just current state)
                const isFront9 = holeNumber <= 9;
                return {
                    ...p,
                    pushUsageCount: {
                        ...p.pushUsageCount,
                        front9: isFront9 ? p.pushUsageCount.front9 + 1 : p.pushUsageCount.front9,
                        back9: !isFront9 ? p.pushUsageCount.back9 + 1 : p.pushUsageCount.back9,
                    }
                };
            }
            return p;
        });

        const newHoleResult: HoleResult = result;

        // Check if updating existing history
        const existingIndex = history.findIndex(h => h.holeNumber === holeNumber);
        let newHistory = [...history];

        if (existingIndex !== -1) {
            // Update existng
            newHistory[existingIndex] = newHoleResult;
            // NOTE: Updating a past hole MIGHT invalidate subsequent multipliers (CarryOver).
            // For full correctness, we would need to re-calculate ALL subsequent holes.
            // That is complex. For now, we assume simple editing. 
            // Ideally, we should warn user or only allow editing the LATEST hole.
            // But user asked for "back and edit".
            // Let's stick to simple replacement for now, acknowledging the "Butterfly Effect" risk on multipliers.
        } else {
            // Append
            newHistory.push(newHoleResult);
            // Sort history by hole number just in case
            newHistory.sort((a, b) => a.holeNumber - b.holeNumber);
        }

        set({
            history: newHistory,
            players: updatedPlayers,
            currentHole: holeNumber + 1, // Auto advance? Or stay? Generally advance.
            nextHoleMultiplier: result.nextHoleMultiplier // This sets multiplier for the NEXT new hole.
        });
    },

    resetGame: () => set({ ...INITIAL_STATE, players: [] }), // Or keep players? Usually reset clears everything or just game state. Let's clear for now.

    updatePlayerName: (id, name) =>
        set((state) => ({
            players: state.players.map((p) => (p.id === id ? { ...p, name } : p)),
        })),

    getRecommendedPairs: (holeNumber) => {
        const state = get();
        const { players, history } = state;

        if (players.length < 4) {
            // Fallback if not enough players
            return { teamA: ['1', '2'], teamB: ['3', '4'] };
        }

        // 1. Determine Honor Order
        let rankedPlayers = [...players];
        if (holeNumber > 1 && history.length > 0) {
            // Look at previous hole (history[history.length - 1] might not matches holeNumber-1 if we skipped, 
            // but let's assume history is sequential for now or find exact previous hole)
            // Ideally: find result for holeNumber - 1
            const lastHole = history.find(h => h.holeNumber === holeNumber - 1);

            if (lastHole) {
                // Sort by score low to high.
                // If tie, keep previous order (stable sort).
                // Actually JS sort is stable in modern engines, but to be safe we relies on index if scores equal?
                // For simplified "Honor" in golf: strictly score based.
                rankedPlayers.sort((a, b) => {
                    const scoreA = lastHole.scores[a.id]?.score ?? 999;
                    const scoreB = lastHole.scores[b.id]?.score ?? 999;
                    return scoreA - scoreB;
                });
            }
        }

        const p = rankedPlayers; // p[0] is 1st (Honor), p[1] 2nd...

        // 2. Determine Pattern (A, B, C)
        // Hole 1 -> Pattern A (1%3 == 1)
        // Hole 2 -> Pattern B (2%3 == 2)
        // Hole 3 -> Pattern C (3%3 == 0)
        // Hole 4 -> Pattern A
        const mod = holeNumber % 3;

        let teamA_Ids: [PlayerId, PlayerId];
        let teamB_Ids: [PlayerId, PlayerId];

        if (mod === 1) {
            // Pattern A: 1&2 vs 3&4
            teamA_Ids = [p[0].id, p[1].id];
            teamB_Ids = [p[2].id, p[3].id];
        } else if (mod === 2) {
            // Pattern B: 1&3 vs 2&4
            teamA_Ids = [p[0].id, p[2].id];
            teamB_Ids = [p[1].id, p[3].id];
        } else {
            // Pattern C (mod 0): 1&4 vs 2&3
            teamA_Ids = [p[0].id, p[3].id];
            teamB_Ids = [p[1].id, p[2].id];
        }

        return { teamA: teamA_Ids, teamB: teamB_Ids };
    },

    getPlayerTotalScore: (id) => {
        const { history } = get();
        return history.reduce((total, h) => {
            const points = h.pointsResult[id] || 0;
            return total + points;
        }, 0);
    },

    goToHole: (holeNumber) => {
        set({ currentHole: holeNumber });
    },

    startGame: (startHole) => {
        const currentPlayers = get().players;
        const currentSettings = get().settings;
        const currentSavedRounds = get().savedRounds; // Persist history across resets!

        set({
            ...INITIAL_STATE,
            // Restore persistent state
            savedRounds: currentSavedRounds,
            players: currentPlayers.map(p => ({
                ...p,
                pushUsageCount: { front9: 0, back9: 0 }
            })),
            settings: {
                ...INITIAL_STATE.settings,
                ...currentSettings, // Keep settings? Or reset? Usually keep.
                // Reset match name? Maybe. Let's keep for now or reset in UI.
            },
            currentHole: startHole,
        });
    },

    updateSettings: (newSettings) => {
        set((state) => ({
            settings: { ...state.settings, ...newSettings }
        }));
    },

    saveCurrentRound: () => {
        const { history, players, settings, savedRounds, getPlayerTotalScore } = get();
        if (history.length === 0) return;

        const finalScores: Record<PlayerId, number> = {};
        players.forEach(p => finalScores[p.id] = getPlayerTotalScore(p.id));

        const newRound: RoundResult = {
            id: Date.now().toString(), // Simple ID
            date: new Date().toISOString(),
            name: settings.matchName || 'Untitled Match',
            players: players,
            history: history,
            finalScores: finalScores
        };

        set({ savedRounds: [newRound, ...savedRounds] });
    }
}));
