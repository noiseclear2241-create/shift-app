// 画面からサーバーの処理（/api/...）を呼ぶときの共通処理。ログイン証明（IDトークン）を付けて送る。
import { getFirebase } from './firebase';

export async function callApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const user = getFirebase().auth.currentUser;
  if (!user) throw new Error('ログインしていません');
  const res = await fetch(path, {
    method: init.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `処理に失敗しました（${res.status}）`);
  return body as T;
}
