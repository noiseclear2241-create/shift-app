// サーバー専用：画面から送られたログイン証明（IDトークン）を確かめて、ユーザーIDを返す。
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export async function verifyRequestUser(app: App, req: Request): Promise<string | null> {
  const idToken = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!idToken) return null;
  try {
    return (await getAuth(app).verifyIdToken(idToken)).uid;
  } catch {
    return null;
  }
}
