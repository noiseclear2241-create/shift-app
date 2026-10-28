// サーバー専用：画面から送られたログイン証明（IDトークン）を確かめる。
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface RequestUser {
  uid: string;
  /** 表示名（Google の名前、なければメールアドレス） */
  name: string;
}

export async function verifyRequest(app: App, req: Request): Promise<RequestUser | null> {
  const idToken = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!idToken) return null;
  try {
    const t = await getAuth(app).verifyIdToken(idToken);
    return { uid: t.uid, name: (t.name as string | undefined) || t.email || 'メンバー' };
  } catch {
    return null;
  }
}

/** ユーザーIDだけ必要なとき */
export async function verifyRequestUser(app: App, req: Request): Promise<string | null> {
  return (await verifyRequest(app, req))?.uid ?? null;
}
