// 「今朝の通知を今すぐ受け取る（お試し）」：毎朝の自動送信と同じ処理を、本人の分だけ今すぐ行う。
// 送信記録も同じものを使うので、同じ日の同じ通知は、ここで受け取ると朝の自動送信では送られない。
import { NextResponse } from 'next/server';
import { verifyRequestUser } from '@/lib/server/auth';
import { getAdminApp } from '@/lib/server/firebaseAdmin';
import { runMorningForUser } from '@/lib/server/morning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const app = getAdminApp();
  if (!app) return NextResponse.json({ error: 'サーバーの通知設定がまだ登録されていません' }, { status: 503 });

  const uid = await verifyRequestUser(app, req);
  if (!uid) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  try {
    return NextResponse.json(await runMorningForUser(app, uid));
  } catch (e) {
    console.error('morning (manual) failed', e);
    return NextResponse.json({ error: '通知の送信中にエラーが発生しました' }, { status: 500 });
  }
}
