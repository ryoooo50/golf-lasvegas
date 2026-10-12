import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import i18n from '../i18n/i18n';
import { authClient } from '../lib/authClient';
import { toAuthErrorKey } from '../utils/authErrorMessage';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  isGuest: boolean;
  isLoading: boolean;
  error: string | null;
  notice: string | null;

  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  playAsGuest: () => void;
  initialize: () => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  const { key, detail } = toAuthErrorKey(error);
  return i18n.t(key, { detail });
}

function toAuthUser(user: { id: string; email: string } | null | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email } : null;
}

// オフライン起動でもログイン状態を保つため、最後に確認できたユーザーを端末に残す
const CACHED_USER_KEY = 'golf-lasvegas-auth-user';

async function cacheUser(user: AuthUser | null): Promise<void> {
  try {
    if (user) await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(CACHED_USER_KEY);
  } catch {
    // 端末保存に失敗してもログイン自体は継続できる
  }
}

async function readCachedUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && typeof (parsed as AuthUser).id === 'string') {
      return { id: (parsed as AuthUser).id, email: String((parsed as AuthUser).email ?? '') };
    }
  } catch {
    // 壊れたキャッシュは無視する
  }
  return null;
}

const missingFields = (email: string, password: string) => !email.trim() || !password;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isGuest: false,
  isLoading: false,
  error: null,
  notice: null,

  signUp: async (email, password) => {
    if (missingFields(email, password)) {
      set({ error: i18n.t('auth.errorMissingFields'), notice: null });
      return;
    }
    set({ isLoading: true, error: null, notice: null });
    try {
      const trimmed = email.trim();
      const { data, error } = await authClient.signUp.email({
        email: trimmed,
        password,
        name: trimmed.split('@')[0],
      });
      if (error) throw error;
      // メール確認を有効にした場合は token が返らずログイン状態にならないため、案内を出す
      if (data?.token) {
        const user = toAuthUser(data.user);
        set({ user });
        await cacheUser(user);
      }
      else set({ notice: i18n.t('auth.signupConfirmSent') });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    if (missingFields(email, password)) {
      set({ error: i18n.t('auth.errorMissingFields'), notice: null });
      return;
    }
    set({ isLoading: true, error: null, notice: null });
    try {
      const { data, error } = await authClient.signIn.email({ email: email.trim(), password });
      if (error) throw error;
      const user = toAuthUser(data?.user);
      set({ user });
      await cacheUser(user);
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      if (useAuthStore.getState().user) {
        const { error } = await authClient.signOut();
        if (error) throw error;
      }
      set({ user: null, isGuest: false });
      await cacheUser(null);
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  playAsGuest: () => {
    set({ isGuest: true, user: null, error: null, notice: null });
  },

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      // 既存セッションを復元（Web: Cookie / ネイティブ: SecureStore）
      const { data, error } = await authClient.getSession();
      if (error) throw error;
      const user = toAuthUser(data?.user);
      set({ user });
      await cacheUser(user);
    } catch (err: unknown) {
      // 通信できない場合は、前回確認できたユーザーで続行する（同期は復帰後に行われる）
      const cached = toAuthErrorKey(err).key === 'auth.errorNetwork' ? await readCachedUser() : null;
      if (cached) set({ user: cached });
      else set({ error: getErrorMessage(err) });
    } finally {
      set({ isLoading: false });
    }
  },
}));
