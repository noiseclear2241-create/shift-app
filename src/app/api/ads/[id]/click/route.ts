// 広告が押されたとき：クリック数を記録してから、広告のリンク先へ移動する。
// 移動先は登録済みの広告のURLだけ（任意のURLへ飛ばせる「抜け道」にしない）。
import { NextResponse } from 'next/server';
import { recordClick } from '@/lib/server/ads';
import { getAdminApp } from '@/lib/server/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const app = getAdminApp();
  const url = app ? await recordClick(app, params.id).catch(() => null) : null;
  const res = NextResponse.redirect(url ?? new URL('/', req.url), 302);
  // 広告先に、アプリのどの画面から来たかを伝えない
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
