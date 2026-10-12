import { getApiBaseUrl } from '../lib/apiBase';
import { API_CREDENTIALS, getAuthHeaders } from '../lib/authClient';

// ─── 型定義 ──────────────────────────────────────────────────────────
export interface RoundSaveData {
  match_name: string;
  rate: number;
  player_count: number;
  player_names: Record<string, string>;  // { playerId: name }
  push_limit: number;
  push_recovery_on_birdie: number;
  push_recovery_on_eagle: number;
  holes: unknown;                         // HoleResult[] を JSON で保存
  total_points: Record<string, number>;  // { playerId: totalPoints }
  status: 'paused' | 'completed';
  current_hole: number;
  start_hole: 1 | 10;
  round_length: 9 | 18;
  draft_hole: unknown;
  player_ranking: string[];
  course_name: string;
  played_at: string;
  memo: string;
}

export interface SavedRound extends RoundSaveData {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// ─── エラー ──────────────────────────────────────────────────────────
export class CloudSaveError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'CloudSaveError';
  }
}

/** 指定 ID のラウンドがクラウドに無い（旧 Supabase の ID など） */
export function isRoundNotFound(error: unknown): boolean {
  return error instanceof CloudSaveError && error.status === 404;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: API_CREDENTIALS,
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeaders()),
    },
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === 'string') message = body.error;
    } catch {
      // 本文が JSON でなければステータスのみ
    }
    throw new CloudSaveError(message, response.status);
  }

  return (response.status === 204 ? undefined : await response.json()) as T;
}

// ─── CRUD（Vercel Functions: api/rounds.mts） ──────────────────────────
// 所有者はサーバー側でセッションから決まるため、userId は送らない。

/**
 * 新規ラウンドを保存し、生成された UUID を返す。
 */
export async function saveRound(_userId: string, roundData: RoundSaveData): Promise<string> {
  const { id } = await request<{ id: string }>('/api/rounds', {
    method: 'POST',
    body: JSON.stringify(roundData),
  });
  return id;
}

/**
 * 既存ラウンドを部分更新する。見つからない場合は CloudSaveError(404)。
 */
export async function updateRound(roundId: string, roundData: Partial<RoundSaveData>): Promise<void> {
  await request(`/api/rounds?id=${encodeURIComponent(roundId)}`, {
    method: 'PATCH',
    body: JSON.stringify(roundData),
  });
}

/**
 * 更新し、クラウドに無ければ新規作成する。保存先の ID を返す。
 */
export async function upsertRound(userId: string, cloudRoundId: string | null | undefined, roundData: RoundSaveData): Promise<string> {
  if (cloudRoundId) {
    try {
      await updateRound(cloudRoundId, roundData);
      return cloudRoundId;
    } catch (error: unknown) {
      if (!isRoundNotFound(error)) throw error;
    }
  }
  return saveRound(userId, roundData);
}

/**
 * ユーザーの全ラウンドを新しい順で取得する。
 */
export async function loadUserRounds(_userId: string): Promise<SavedRound[]> {
  const { rounds } = await request<{ rounds: SavedRound[] }>('/api/rounds');
  return rounds;
}

/**
 * ラウンドを削除する。すでに無い場合は成功扱い。
 */
export async function deleteRound(roundId: string): Promise<void> {
  try {
    await request(`/api/rounds?id=${encodeURIComponent(roundId)}`, { method: 'DELETE' });
  } catch (error: unknown) {
    if (!isRoundNotFound(error)) throw error;
  }
}
