import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  isGuest: boolean;
  isLoading: boolean;
  error: string | null;

  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  playAsGuest: () => void;
  initialize: () => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return '不明なエラーが発生しました';
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isGuest: false,
  isLoading: false,
  error: null,

  signUp: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // onAuthStateChange がユーザーをセットする
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange がユーザーをセットする
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null, isGuest: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  playAsGuest: () => {
    set({ isGuest: true, user: null, error: null });
  },

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      // 既存セッションを復元
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      set({ user: session?.user ?? null });

      // セッション変化を購読
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null });
      });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    } finally {
      set({ isLoading: false });
    }
  },
}));
