// 表示する広告を1つ選んで返す（表示回数も記録する）。?wid=作業スペースID&slot=home
import { withUser } from '@/lib/server/api';
import { serveAd } from '@/lib/server/ads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) =>
  withUser(req, ({ app, user }) => {
    const params = new URL(req.url).searchParams;
    return serveAd(app, user, params.get('wid') ?? '', params.get('slot') ?? '');
  });
