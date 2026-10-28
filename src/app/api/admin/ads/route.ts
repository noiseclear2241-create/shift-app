// 運営者のみ：広告の一覧（GET）と追加（POST）
import { readJson, withUser } from '@/lib/server/api';
import { createAd, listAdsForAdmin } from '@/lib/server/ads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => withUser(req, ({ app, user }) => listAdsForAdmin(app, user));

export const POST = (req: Request) =>
  withUser(req, async ({ app, user }) => createAd(app, user, await readJson(req)));
