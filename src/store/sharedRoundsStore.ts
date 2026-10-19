import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { toRoundResult } from '../services/cloudRoundMapper';
import { fetchSharedRounds, leaveSharedRound } from '../services/roundShares';
import { RoundResult } from '../types';
import { INITIAL_STATE } from './gameStore';

interface SharedRoundsState {
    /** rounds を取得したユーザー。別ユーザーのキャッシュを見せないために持つ */
    viewerId: string | null;
    rounds: RoundResult[];
    loadSharedRounds: (viewerId: string) => Promise<void>;
    removeSharedRound: (roundId: string) => Promise<boolean>;
    visibleSharedRounds: (viewerId: string | null) => RoundResult[];
}

export const useSharedRoundsStore = create<SharedRoundsState>()(
    persist(
        (set, get) => ({
            viewerId: null,
            rounds: [],

            // 成功時は丸ごと置き換え（共有停止されたものを消す）。失敗時（オフライン等）はキャッシュを残す
            loadSharedRounds: async (viewerId) => {
                try {
                    const saved = await fetchSharedRounds();
                    set({ viewerId, rounds: saved.map(r => toRoundResult(r, INITIAL_STATE.settings)) });
                } catch {
                    // 取得失敗は致命的ではない
                }
            },

            removeSharedRound: async (roundId) => {
                try {
                    await leaveSharedRound(roundId);
                } catch {
                    return false;
                }
                set({ rounds: get().rounds.filter(r => r.id !== roundId) });
                return true;
            },

            visibleSharedRounds: (viewerId) => {
                const { viewerId: ownerOfCache, rounds } = get();
                return viewerId !== null && viewerId === ownerOfCache ? rounds : [];
            },
        }),
        {
            name: 'golf-lasvegas-shared-rounds',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ viewerId: state.viewerId, rounds: state.rounds }),
        },
    ),
);
