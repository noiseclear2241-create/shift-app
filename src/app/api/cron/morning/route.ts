// 毎朝の自動送信の入口。Vercel の定時実行（vercel.json の crons）から呼ばれる。
// Vercel は環境変数 CRON_SECRET の値を「Authorization: Bearer ...」として付けて呼ぶので、一致しないものは断る。
import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/server/firebaseAdmin';
import { runMorningForAll } from '@/lib/server/morning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const app = getAdminApp();
  if (!app) return NextResponse.json({ error: 'FIREBASE_SERVICE_ACCOUNT が未設定です' }, { status: 503 });

  const result = await runMorningForAll(app);
  console.log('morning notifications', result);
  return NextResponse.json(result);
}
