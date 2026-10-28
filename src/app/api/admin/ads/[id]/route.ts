// 運営者のみ：広告の変更・停止・再開（PATCH）と削除（DELETE）
import { readJson, withUser } from '@/lib/server/api';
import { deleteAd, updateAd } from '@/lib/server/ads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export const PATCH = (req: Request, { params }: Params) =>
  withUser(req, async ({ app, user }) => updateAd(app, user, params.id, await readJson(req)));

export const DELETE = (req: Request, { params }: Params) =>
  withUser(req, ({ app, user }) => deleteAd(app, user, params.id));
