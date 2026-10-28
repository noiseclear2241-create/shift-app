// 招待リンクを作る（オーナーと管理者のみ）。
import { readJson, withUser } from '@/lib/server/api';
import { createInvite } from '@/lib/server/workspaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = (req: Request, { params }: { params: { wid: string } }) =>
  withUser(req, async ({ app, user }) => createInvite(app, user, params.wid, (await readJson(req)).role));
