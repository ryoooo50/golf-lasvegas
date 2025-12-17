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
    gameStatus: 'playing',
    settings: {
        rate: 10,
        maxPushCountPerHalf: 2,
        language: 'ja',
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

        // --- 1. Auto Use Push Logic (Hole 9 & 18) ---
        let finalScores = { ...scores };
        let pushedPlayers = [...players];

        if (holeNumber === 9 || holeNumber === 18) {
            const maxPush = settings.maxPushCountPerHalf;
            // Force use ANY remaining push count
            pushedPlayers = players.map(p => {
                const usedInHalf = (holeNumber === 9) ? p.pushUsageCount.front9 : p.pushUsageCount.back9;
                const remaining = Math.max(0, maxPush - usedInHalf);

                if (remaining > 0) {
                    finalScores[p.id] = {
                        ...finalScores[p.id],
                        pushCount: remaining // Force usage of all remaining
                    };
                }
                return p;
            });
        }

        // --- 2. Calculate Result ---
        const result = calculateHoleResult({
            holeNumber,
            par,
            scores: finalScores,
            teamA_Ids,
            teamB_Ids,
            currentCarryOverMultiplier: nextHoleMultiplier,
        });

        // --- 3. Update Push Usage Counts ---
        // We use 'finalScores' because it contains auto-used pushes
        const updatedPlayers = pushedPlayers.map(p => {
            const usedCount = finalScores[p.id]?.pushCount || 0;
            if (usedCount > 0) {
                const isFront9 = holeNumber <= 9;
                return {
                    ...p,
                    pushUsageCount: {
                        ...p.pushUsageCount,
                        front9: isFront9 ? p.pushUsageCount.front9 + usedCount : p.pushUsageCount.front9,
                        back9: !isFront9 ? p.pushUsageCount.back9 + usedCount : p.pushUsageCount.back9,
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
            newHistory[existingIndex] = newHoleResult;
        } else {
            newHistory.push(newHoleResult);
            newHistory.sort((a, b) => a.holeNumber - b.holeNumber);
        }

        // --- 4. Game End Check ---
        let nextHole = holeNumber + 1;
        let nextStatus: 'playing' | 'finished' = 'playing';

        if (holeNumber === 18) {
            nextStatus = 'finished';
            nextHole = 18; // Stay on 18 if finished
        }

        set({
            history: newHistory,
            players: updatedPlayers,
            currentHole: nextHole,
            gameStatus: nextStatus,
            nextHoleMultiplier: result.nextHoleMultiplier
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
            finalScores: finalScores,
            gameStatus: 'finished', // Assume saving implies finished or snapshot
            currentHole: get().currentHole
        };

        set({ savedRounds: [newRound, ...savedRounds] });
    }
}));
