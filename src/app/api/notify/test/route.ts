// テスト通知：ログイン中の本人の登録端末すべてに、その場で通知を1件送る。
import { getAuth } from 'firebase-admin/auth';
import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/server/firebaseAdmin';
import { sendPushToUser } from '@/lib/server/sendPush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const app = getAdminApp();
  if (!app) {
    return NextResponse.json(
      { error: 'サーバーの通知設定（FIREBASE_SERVICE_ACCOUNT）がまだ登録されていません' },
      { status: 503 },
    );
  }

  // 本人確認：画面から送られたログイン証明（IDトークン）を Firebase で検証する
  const idToken = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!idToken) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  let uid: string;
  try {
    uid = (await getAuth(app).verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: 'ログインの確認ができませんでした。もう一度ログインしてください' }, { status: 401 });
  }

  try {
    const result = await sendPushToUser(app, uid, {
      title: 'テスト通知',
      body: 'シフト手帳からの通知が届きました。毎朝の通知もこのように届きます。',
      url: '/settings',
      tag: 'test',
    });
    if (result.sent === 0 && result.failed === 0) {
      return NextResponse.json({ error: '通知を受け取る端末が登録されていません' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error('test push failed', e);
    return NextResponse.json({ error: '通知の送信中にエラーが発生しました' }, { status: 500 });
  }
}
