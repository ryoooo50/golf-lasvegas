import { supabase } from '../lib/supabase';

// ─── 型定義 ──────────────────────────────────────────────────────────
export interface RoundSaveData {
  match_name: string;
  rate: number;
  player_count: number;
  player_names: Record<string, string>;  // { playerId: name }
  push_limit: number;
  birdy_push_recovery: boolean;
  holes: unknown;                         // HoleResult[] を JSON で保存
  total_points: Record<string, number>;  // { playerId: totalPoints }
}

export interface SavedRound extends RoundSaveData {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// ─── ユーティリティ ───────────────────────────────────────────────────
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return '不明なエラーが発生しました';
}

// ─── CRUD ────────────────────────────────────────────────────────────

/**
 * 新規ラウンドを保存し、生成された UUID を返す。
 */
export async function saveRound(userId: string, roundData: RoundSaveData): Promise<string> {
  const { data, error } = await supabase
    .from('rounds')
    .insert({ user_id: userId, ...roundData })
    .select('id')
    .single();

  if (error) throw new Error(getErrorMessage(error));
  return (data as { id: string }).id;
}

/**
 * 既存ラウンドを部分更新する。
 */
export async function updateRound(
  roundId: string,
  roundData: Partial<RoundSaveData>,
): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update(roundData)
    .eq('id', roundId);

  if (error) throw new Error(getErrorMessage(error));
}

/**
 * ユーザーの全ラウンドを新しい順で取得する。
 */
export async function loadUserRounds(userId: string): Promise<SavedRound[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(getErrorMessage(error));
  return (data ?? []) as SavedRound[];
}

/**
 * ラウンドを削除する。
 */
export async function deleteRound(roundId: string): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .delete()
    .eq('id', roundId);

  if (error) throw new Error(getErrorMessage(error));
}
