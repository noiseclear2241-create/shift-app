// 招待リンクの確認（GET）と参加（POST）。どちらもログインが必要。
import { withUser } from '@/lib/server/api';
import { acceptInvite, getInviteInfo } from '@/lib/server/workspaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { code: string } };

export const GET = (req: Request, { params }: Params) =>
  withUser(req, ({ app, user }) => getInviteInfo(app, user, params.code));

export const POST = (req: Request, { params }: Params) =>
  withUser(req, ({ app, user }) => acceptInvite(app, user, params.code));
