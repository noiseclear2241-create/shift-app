// サーバー専用：画面から送られたログイン証明（IDトークン）を確かめる。
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface RequestUser {
  uid: string;
  /** 表示名（Google の名前、なければメールアドレス） */
  name: string;
  email: string;
  /** メールアドレスが本人のものと確認済みか（Google ログインは確認済み） */
  emailVerified: boolean;
}

export async function verifyRequest(app: App, req: Request): Promise<RequestUser | null> {
  const idToken = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!idToken) return null;
  try {
    const t = await getAuth(app).verifyIdToken(idToken);
    return {
      uid: t.uid,
      name: (t.name as string | undefined) || t.email || 'メンバー',
      email: (t.email ?? '').toLowerCase(),
      emailVerified: t.email_verified === true,
    };
  } catch {
    return null;
  }
}

/**
 * 運営者（広告などを管理できる人）か。
 * Vercel の環境変数 ADMIN_EMAILS（カンマ区切り）に入っていて、メールアドレスが確認済みの人だけ。
 */
export function isPlatformAdmin(user: RequestUser): boolean {
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return user.emailVerified && !!user.email && list.includes(user.email);
}

/** ユーザーIDだけ必要なとき */
export async function verifyRequestUser(app: App, req: Request): Promise<string | null> {
  return (await verifyRequest(app, req))?.uid ?? null;
}
